import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { upgradePasswordHash, insertBuyer } from '@/features/accounts/server/account-mutations';
import { signUp } from '@/features/accounts/server/sign-up';
import {
  assertScratchDatabase,
  ownerDatabase,
  STAND_IN_HASH,
  uniqueUsername,
} from '@/server/db/account-test-database';
import type { env as serverEnv } from '@/server/env';

// Sign-up and the account writes through the app's own pool, as carshenas_web, on the scratch database
// `pnpm db:check` migrated: the unique constraint alone decides a taken name, even for two sign-ups at once.

const TEST_AUTH_KEY = vi.hoisted(() => Buffer.alloc(32, 3));

vi.mock('@/server/env', async (importOriginal) => {
  const { env } = await importOriginal<{ env: typeof serverEnv }>();
  return {
    env: Object.defineProperty(Object.create(env) as typeof serverEnv, 'authKey', { value: TEST_AUTH_KEY }),
  };
});

const owner = ownerDatabase();
let nextAddress = 0;

function address(): string {
  nextAddress += 1;
  return `10.77.${String(Math.floor(nextAddress / 250))}.${String(nextAddress % 250)}`;
}

beforeAll(async () => {
  await assertScratchDatabase(owner);
});

afterAll(async () => {
  await owner.destroy();
});

test('a name inserted twice is taken the second time, by the unique constraint', async () => {
  const username = uniqueUsername();
  expect(await insertBuyer(username, STAND_IN_HASH)).toMatchObject({ status: 'created' });
  expect(await insertBuyer(username, STAND_IN_HASH)).toEqual({ status: 'taken' });
});

test('two sign-ups for one name at the same moment: one account and one session, and the other is told it is taken', async () => {
  const username = uniqueUsername();
  const [first, second] = await Promise.all([
    signUp({ username, password: 'blue tiger eats rice' }, { address: address() }),
    signUp({ username, password: 'green lion drinks tea' }, { address: address() }),
  ]);
  const outcomes = [first.status, second.status].sort();
  expect(outcomes).toEqual(['created', 'rejected']);
  expect([first, second].find((result) => result.status === 'rejected')).toMatchObject({
    usernameError: 'taken',
  });
  const accounts = await owner
    .selectFrom('account')
    .innerJoin('account_session', 'account_session.account_id', 'account.id')
    .select('account.id')
    .where('account.username', '=', username)
    .execute();
  expect(accounts).toHaveLength(1);
});

test('a hash upgrade never writes over a password reset that landed after the verification', async () => {
  const created = await insertBuyer(uniqueUsername(), STAND_IN_HASH);
  if (created.status !== 'created') throw new Error('expected an account');
  const reset = `${STAND_IN_HASH}r`;
  await owner.updateTable('account').set({ password_hash: reset }).where('id', '=', created.id).execute();
  await upgradePasswordHash(created.id, STAND_IN_HASH, `${STAND_IN_HASH}u`);
  const { password_hash } = await owner
    .selectFrom('account')
    .select('password_hash')
    .where('id', '=', created.id)
    .executeTakeFirstOrThrow();
  expect(password_hash).toBe(reset);
});
