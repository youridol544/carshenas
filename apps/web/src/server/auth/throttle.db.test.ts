import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { keyedHash } from '@carshenas/accounts/keyed-hash';
import {
  claimStreakAttempt,
  clearStreak,
  countInWindow,
  recordStreakFailure,
  uncountInWindow,
} from '@/server/auth/throttle';
import { assertScratchDatabase, ownerDatabase, uniqueUsername } from '@/server/db/account-test-database';
import type { env as serverEnv } from '@/server/env';

// The throttle through the app's own pool, as carshenas_web, on the scratch database `pnpm db:check` migrated. Time
// moves by rewriting a row's times as the owner instead of waiting.

const TEST_AUTH_KEY = vi.hoisted(() => Buffer.alloc(32, 9));

vi.mock('@/server/env', async (importOriginal) => {
  const { env } = await importOriginal<{ env: typeof serverEnv }>();
  return {
    env: Object.defineProperty(Object.create(env) as typeof serverEnv, 'authKey', { value: TEST_AUTH_KEY }),
  };
});

const owner = ownerDatabase();

beforeAll(async () => {
  await assertScratchDatabase(owner);
});

afterAll(async () => {
  await owner.destroy();
});

/** Lets the next attempt start now, as if the wait had passed. */
async function letTimePass(scope: 'sign_in_account' | 'sign_in_device', value: string): Promise<void> {
  await owner
    .updateTable('auth_throttle')
    .set({ next_attempt_at: new Date(Date.now() - 1_000) })
    .where('scope', '=', scope)
    .where('subject_hmac', '=', keyedHash(TEST_AUTH_KEY, scope, value))
    .execute();
}

test('an account name allows one attempt at a time, and five free failures before the waits begin', async () => {
  const name = uniqueUsername();
  expect(await claimStreakAttempt('sign_in_account', name)).toEqual({ status: 'claimed', failures: 0 });
  // A second attempt while the first is being checked waits for it.
  const meanwhile = await claimStreakAttempt('sign_in_account', name);
  expect(meanwhile.status).toBe('throttled');

  for (let failure = 1; failure <= 4; failure += 1) {
    expect(await recordStreakFailure('sign_in_account', name)).toBe(failure);
    expect(await claimStreakAttempt('sign_in_account', name)).toEqual({
      status: 'claimed',
      failures: failure,
    });
  }
  expect(await recordStreakFailure('sign_in_account', name)).toBe(5);
  const waiting = await claimStreakAttempt('sign_in_account', name);
  expect(waiting.status === 'throttled' && waiting.retryAfterSeconds).toBeGreaterThanOrEqual(29);
  expect(waiting.status === 'throttled' && waiting.retryAfterSeconds).toBeLessThanOrEqual(30);

  await letTimePass('sign_in_account', name);
  expect(await claimStreakAttempt('sign_in_account', name)).toEqual({ status: 'claimed', failures: 5 });
  expect(await recordStreakFailure('sign_in_account', name)).toBe(6);
  const longer = await claimStreakAttempt('sign_in_account', name);
  expect(longer.status === 'throttled' && longer.retryAfterSeconds).toBeGreaterThanOrEqual(59);
});

test('a success forgets the failures, and the row holds no trace of the name', async () => {
  const name = uniqueUsername();
  await claimStreakAttempt('sign_in_account', name);
  await recordStreakFailure('sign_in_account', name);
  const rows = await owner.selectFrom('auth_throttle').select(['subject_hmac', 'hits']).execute();
  expect(rows.some((row) => row.subject_hmac.includes(Buffer.from(name)))).toBe(false);

  await clearStreak('sign_in_account', name);
  expect(await claimStreakAttempt('sign_in_account', name)).toEqual({ status: 'claimed', failures: 0 });
});

test('attempts on one account name sent at the same moment get one turn between them', async () => {
  const name = uniqueUsername();
  const claims = await Promise.all(
    Array.from({ length: 10 }, () => claimStreakAttempt('sign_in_account', name)),
  );
  expect(claims.filter((claim) => claim.status === 'claimed')).toHaveLength(1);
});

test('a device counts on its own row, apart from the account name', async () => {
  const name = uniqueUsername();
  for (let failure = 0; failure < 5; failure += 1) {
    await claimStreakAttempt('sign_in_account', name);
    await recordStreakFailure('sign_in_account', name);
  }
  expect((await claimStreakAttempt('sign_in_account', name)).status).toBe('throttled');
  expect(await claimStreakAttempt('sign_in_device', `42.${name}`)).toEqual({
    status: 'claimed',
    failures: 0,
  });
});

test('an address hour counts up to its limit, then says when the hour ends, then starts again', async () => {
  const address = `10.${Math.floor(Math.random() * 250)}.0.1`;
  for (let event = 1; event <= 3; event += 1) {
    expect(await countInWindow('sign_up_address', address, 3)).toEqual({ status: 'open' });
  }
  const over = await countInWindow('sign_up_address', address, 3);
  expect(over.status).toBe('throttled');
  expect(over.status === 'throttled' && over.retryAfterSeconds).toBeGreaterThan(3_500);

  await owner
    .updateTable('auth_throttle')
    .set({ window_started_at: new Date(Date.now() - 2 * 3_600_000) })
    .where('scope', '=', 'sign_up_address')
    .where('subject_hmac', '=', keyedHash(TEST_AUTH_KEY, 'sign_up_address', address))
    .execute();
  expect(await countInWindow('sign_up_address', address, 3)).toEqual({ status: 'open' });
  const row = await owner
    .selectFrom('auth_throttle')
    .select('hits')
    .where('scope', '=', 'sign_up_address')
    .where('subject_hmac', '=', keyedHash(TEST_AUTH_KEY, 'sign_up_address', address))
    .executeTakeFirstOrThrow();
  expect(row.hits).toBe(1);
});

test('a burst from one address cannot pass its limit, and what succeeded is given back', async () => {
  const address = `10.${Math.floor(Math.random() * 250)}.1.1`;
  const answers = await Promise.all(
    Array.from({ length: 20 }, () => countInWindow('sign_in_address', address, 5)),
  );
  expect(answers.filter((answer) => answer.status === 'open')).toHaveLength(5);
  // Five successes give their counts back: the next attempts are open again.
  for (let success = 0; success < 20; success += 1) await uncountInWindow('sign_in_address', address);
  expect(await countInWindow('sign_in_address', address, 5)).toEqual({ status: 'open' });
});
