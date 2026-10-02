import 'server-only';
import { keyedHash } from '@carshenas/accounts/keyed-hash';
import { database, readDatabase } from '@/server/db/database';
import { databaseNow, secondsAgo, secondsFromNow } from '@/server/db/sql-helpers';
import { env } from '@/server/env';

// Throttling in PostgreSQL (ADR-0020 point 8), one auth_throttle row per scope and subject, the subject a keyed hash
// of the typed username, a device key or a client address, so the table holds none of them.
//
// Streaks (per account name, per device): consecutive failed sign-ins. Five are free, then each attempt waits from
// 30 seconds, doubling, up to an hour (NIST SP 800-63B-4's example); a success deletes the row. An attempt first
// takes the streak for a few seconds, in one statement, so guesses at one account never run side by side.
//
// Windows (per client address): events in the current hour, each counted in one statement before any work is done,
// so a burst of parallel requests cannot get ahead of its own count. A sign-in that succeeds gives its count back, so
// the address's limit counts failures only.

export type StreakScope = 'sign_in_account' | 'sign_in_device';
export type WindowScope =
  | 'sign_in_address'
  | 'sign_up_address'
  | 'username_check_address'
  /** Questions a client address put to the language model in plain-Farsi search (CS-62), counted when a paid one is about to be asked. */
  | 'understand_address';

const FREE_FAILURES = 5;
const FIRST_WAIT_SECONDS = 30;
const LONGEST_WAIT_SECONDS = 60 * 60;
// Longer than a verification waiting its turn (five seconds at most, password-hash.ts) plus the hash itself.
const ATTEMPT_LEASE_SECONDS = 15;
const WINDOW_SECONDS = 60 * 60;

/** Seconds to wait after this many consecutive failures: none for the first five, then 30, 60, 120… up to 3600. */
export function waitAfterFailures(failures: number): number {
  if (failures < FREE_FAILURES) return 0;
  return Math.min(FIRST_WAIT_SECONDS * 2 ** (failures - FREE_FAILURES), LONGEST_WAIT_SECONDS);
}

function subjectOf(scope: StreakScope | WindowScope, value: string): Buffer {
  return keyedHash(env.authKey, scope, value);
}

function secondsBetween(from: Date, to: Date): number {
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 1_000));
}

export type StreakClaim =
  { status: 'claimed'; failures: number } | { status: 'throttled'; retryAfterSeconds: number };

/** Takes the one attempt a streak allows now, or says how long to wait. */
export async function claimStreakAttempt(scope: StreakScope, value: string): Promise<StreakClaim> {
  const subject = subjectOf(scope, value);
  const claimed = await database()
    .insertInto('auth_throttle')
    .values({ scope, subject_hmac: subject, hits: 0, next_attempt_at: secondsFromNow(ATTEMPT_LEASE_SECONDS) })
    .onConflict((conflict) =>
      conflict
        .constraint('auth_throttle_subject_unique')
        .doUpdateSet({ next_attempt_at: secondsFromNow(ATTEMPT_LEASE_SECONDS) })
        .where('auth_throttle.next_attempt_at', '<=', databaseNow()),
    )
    .returning('hits')
    .executeTakeFirst();
  if (claimed !== undefined) return { status: 'claimed', failures: claimed.hits };
  const waiting = await readDatabase()
    .selectFrom('auth_throttle')
    .select(['next_attempt_at', databaseNow().as('now')])
    .where('scope', '=', scope)
    .where('subject_hmac', '=', subject)
    .executeTakeFirst();
  return {
    status: 'throttled',
    retryAfterSeconds: waiting === undefined ? 1 : secondsBetween(waiting.now, waiting.next_attempt_at),
  };
}

/** One more failure in a row: the streak's next attempt waits accordingly. Returns the failures in a row. */
export async function recordStreakFailure(scope: StreakScope, value: string): Promise<number> {
  const subject = subjectOf(scope, value);
  return database()
    .transaction()
    .execute(async (trx) => {
      const counted = await trx
        .updateTable('auth_throttle')
        .set((eb) => ({ hits: eb('hits', '+', 1) }))
        .where('scope', '=', scope)
        .where('subject_hmac', '=', subject)
        .returning('hits')
        .executeTakeFirst();
      if (counted === undefined) return 0;
      await trx
        .updateTable('auth_throttle')
        .set({ next_attempt_at: secondsFromNow(waitAfterFailures(counted.hits)) })
        .where('scope', '=', scope)
        .where('subject_hmac', '=', subject)
        .execute();
      return counted.hits;
    });
}

/** Gives back an attempt that could not be checked (the server was too busy to hash): no failure is counted. */
export async function releaseStreakAttempt(scope: StreakScope, value: string): Promise<void> {
  await database()
    .updateTable('auth_throttle')
    .set({ next_attempt_at: databaseNow() })
    .where('scope', '=', scope)
    .where('subject_hmac', '=', subjectOf(scope, value))
    .execute();
}

/** A success: earlier failures no longer count (NIST: "disregard any previous failed attempts"). */
export async function clearStreak(scope: StreakScope, value: string): Promise<void> {
  await database()
    .deleteFrom('auth_throttle')
    .where('scope', '=', scope)
    .where('subject_hmac', '=', subjectOf(scope, value))
    .execute();
}

export type WindowState = { status: 'open' } | { status: 'throttled'; retryAfterSeconds: number };

/** Counts one event in the subject's hour, starting a new hour when the last one has passed. */
export async function countInWindow(scope: WindowScope, value: string, limit: number): Promise<WindowState> {
  const counted = await database()
    .insertInto('auth_throttle')
    .values({ scope, subject_hmac: subjectOf(scope, value), hits: 1, window_started_at: databaseNow() })
    .onConflict((conflict) =>
      conflict.constraint('auth_throttle_subject_unique').doUpdateSet((eb) => ({
        hits: eb
          .case()
          .when('auth_throttle.window_started_at', '<=', secondsAgo(WINDOW_SECONDS))
          .then(1)
          .else(eb('auth_throttle.hits', '+', 1))
          .end(),
        window_started_at: eb
          .case()
          .when('auth_throttle.window_started_at', '<=', secondsAgo(WINDOW_SECONDS))
          .then(databaseNow())
          .else(eb.ref('auth_throttle.window_started_at'))
          .end(),
      })),
    )
    .returning(['hits', 'window_started_at', databaseNow().as('now')])
    .executeTakeFirstOrThrow();
  return counted.hits <= limit
    ? { status: 'open' }
    : {
        status: 'throttled',
        retryAfterSeconds: secondsBetween(
          counted.now,
          new Date(counted.window_started_at.getTime() + WINDOW_SECONDS * 1_000),
        ),
      };
}

/**
 * Gives back an event counted before its outcome was known: a sign-in that succeeded, or one the server was too busy to
 * check. Counting first and giving back keeps the limit exact however many attempts run at once.
 */
export async function uncountInWindow(scope: WindowScope, value: string): Promise<void> {
  await database()
    .updateTable('auth_throttle')
    .set((eb) => ({ hits: eb.fn<number>('greatest', [eb('hits', '-', 1), eb.lit(0)]) }))
    .where('scope', '=', scope)
    .where('subject_hmac', '=', subjectOf(scope, value))
    .execute();
}
