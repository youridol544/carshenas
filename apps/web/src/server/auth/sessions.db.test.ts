import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { endSession, findSessionAccount, SESSION_SECONDS, startSession } from '@/server/auth/sessions';
import { sessionTokenSha256 } from '@/server/auth/session-token';
import { assertScratchDatabase, createAccount, ownerDatabase } from '@/server/db/account-test-database';

// Sessions through the app's own pool, as carshenas_web, on the scratch database `pnpm db:check` migrated.

const owner = ownerDatabase();

beforeAll(async () => {
  await assertScratchDatabase(owner);
});

afterAll(async () => {
  await owner.destroy();
});

async function lifetimeSeconds(tokenSha256: Buffer): Promise<number> {
  const row = await owner
    .selectFrom('account_session')
    .select(['created_at', 'expires_at'])
    .where('token_sha256', '=', tokenSha256)
    .executeTakeFirstOrThrow();
  return (row.expires_at.getTime() - row.created_at.getTime()) / 1_000;
}

function hashOf(token: string): Buffer {
  const hash = sessionTokenSha256(token);
  if (hash === undefined) throw new Error('not a session token');
  return hash;
}

test('a buyer session lasts 30 days and finds its account until it is ended', async () => {
  const buyer = await createAccount(owner, 'buyer');
  const { token, expiresAt } = await startSession(buyer.id, 'buyer');
  expect(await lifetimeSeconds(hashOf(token))).toBe(SESSION_SECONDS.buyer);
  expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + (SESSION_SECONDS.buyer - 60) * 1_000);
  expect(await findSessionAccount(hashOf(token))).toEqual({
    id: buyer.id,
    username: buyer.username,
    role: 'buyer',
  });

  expect(await endSession(hashOf(token))).toBe(buyer.id);
  expect(await findSessionAccount(hashOf(token))).toBeUndefined();
  expect(await endSession(hashOf(token))).toBeUndefined();
});

test('a superadmin session lasts 12 hours', async () => {
  const superadmin = await createAccount(owner, 'superadmin');
  const { token } = await startSession(superadmin.id, 'superadmin');
  expect(await lifetimeSeconds(hashOf(token))).toBe(SESSION_SECONDS.superadmin);
  expect((await findSessionAccount(hashOf(token)))?.role).toBe('superadmin');
});

test('an expired session finds nobody, and the next sign-in removes it', async () => {
  const buyer = await createAccount(owner, 'buyer');
  const expired = randomBytes(32);
  await owner
    .insertInto('account_session')
    .values({
      account_id: buyer.id,
      token_sha256: expired,
      created_at: new Date(Date.now() - 2 * 3_600_000),
      expires_at: new Date(Date.now() - 3_600_000),
    })
    .execute();
  expect(await findSessionAccount(expired)).toBeUndefined();

  await startSession(buyer.id, 'buyer');
  const left = await owner
    .selectFrom('account_session')
    .select('token_sha256')
    .where('account_id', '=', buyer.id)
    .execute();
  expect(left).toHaveLength(1);
  expect(left[0]?.token_sha256).not.toEqual(expired);
});

test('a token nobody was given finds nobody', async () => {
  expect(await findSessionAccount(randomBytes(32))).toBeUndefined();
});
