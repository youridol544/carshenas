import 'server-only';
import { newSessionToken } from '@/server/auth/session-token';
import { database, readDatabase } from '@/server/db/database';
import { databaseNow, secondsFromNow } from '@/server/db/sql-helpers';

// Sessions in PostgreSQL (ADR-0020 point 5): a row per signed-in browser, found by the hash of the cookie's token,
// valid until a lifetime fixed at sign-in and never extended, so no cookie has to be rewritten while a page renders.
// The role is read from account on every request, never copied into the session.

export type AccountRole = 'buyer' | 'superadmin';

/** Who a session belongs to: what pages and actions need to know, and nothing more. */
export type SessionAccount = { id: number; username: string; role: AccountRole };

export const SESSION_SECONDS = {
  // NIST SP 800-63B-4 at AAL1: reauthenticate within 30 days.
  buyer: 30 * 24 * 60 * 60,
  // The owner's choice of 2026-09-29: a stolen admin session lasts at most half a day.
  superadmin: 12 * 60 * 60,
} as const satisfies Record<AccountRole, number>;

/** A new session for a successful sign-in or sign-up. The account's expired sessions are removed on the way. */
export async function startSession(
  accountId: number,
  role: AccountRole,
): Promise<{ token: string; expiresAt: Date }> {
  const { token, tokenSha256 } = newSessionToken();
  const db = database();
  await db
    .deleteFrom('account_session')
    .where('account_id', '=', accountId)
    .where('expires_at', '<=', databaseNow())
    .execute();
  const { expires_at } = await db
    .insertInto('account_session')
    .values({
      account_id: accountId,
      token_sha256: tokenSha256,
      expires_at: secondsFromNow(SESSION_SECONDS[role]),
    })
    .returning('expires_at')
    .executeTakeFirstOrThrow();
  return { token, expiresAt: expires_at };
}

/** The account a live session belongs to, or undefined for an unknown or expired one. */
export async function findSessionAccount(tokenSha256: Buffer): Promise<SessionAccount | undefined> {
  return readDatabase()
    .selectFrom('account_session')
    .innerJoin('account', 'account.id', 'account_session.account_id')
    .select(['account.id as id', 'account.username as username', 'account.role as role'])
    .where('account_session.token_sha256', '=', tokenSha256)
    .where('account_session.expires_at', '>', databaseNow())
    .executeTakeFirst();
}

/** Ends one session; the account it belonged to comes back for the log line, when there was one. */
export async function endSession(tokenSha256: Buffer): Promise<number | undefined> {
  const ended = await database()
    .deleteFrom('account_session')
    .where('token_sha256', '=', tokenSha256)
    .returning('account_id')
    .executeTakeFirst();
  return ended?.account_id;
}
