import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test } from 'node:test';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '@carshenas/db/database';
import type { DB } from '@carshenas/db/db-types';
import { generatePassword } from '../src/generated-password.ts';
import { keyedHash } from '../src/keyed-hash.ts';
import { hashPassword, verifyPassword } from '../src/password-hash.ts';
import { setSuperadmin, type SuperadminRequest } from './set-superadmin.ts';

// Run by `pnpm db:check` on the scratch database it has just migrated, as the migration role the command uses. Refuses
// any other database.

let db: Kysely<DB>;
const authKey = randomBytes(32);

before(async () => {
  const connectionString = process.env.DATABASE_MIGRATE_URL;
  if (connectionString === undefined)
    throw new Error('DATABASE_MIGRATE_URL is not set (pnpm db:check sets it)');
  db = createDatabase({
    connectionString,
    applicationName: 'carshenas-accounts-tests',
    max: 2,
    onIdleError: () => undefined,
  });
  const { rows } = await sql<{ name: string }>`SELECT current_database() AS name`.execute(db);
  const name = rows[0]?.name ?? '';
  if (!/_(check|test)$/.test(name)) {
    await db.destroy();
    throw new Error(`refusing to write to ${name}: integration tests run on a *_check or *_test database`);
  }
});

after(async () => {
  await db.destroy();
});

function request(username: string, overrides: Partial<SuperadminRequest> = {}): SuperadminRequest {
  return {
    username,
    password: generatePassword(),
    resetPassword: false,
    changedBy: 'cli:tester@test-host',
    authKey,
    ...overrides,
  };
}

function uniqueUsername(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}

async function accountOf(username: string) {
  return db
    .selectFrom('account')
    .select(['id', 'role', 'password_hash'])
    .where('username', '=', username)
    .executeTakeFirstOrThrow();
}

async function grantsOf(accountId: number) {
  return db
    .selectFrom('account_role_change')
    .select(['from_role', 'to_role', 'changed_by'])
    .where('account_id', '=', accountId)
    .orderBy('id')
    .execute();
}

async function sessionFor(accountId: number): Promise<void> {
  await db
    .insertInto('account_session')
    .values({
      account_id: accountId,
      token_sha256: randomBytes(32),
      expires_at: new Date(Date.now() + 3_600_000),
    })
    .execute();
}

async function sessionCount(accountId: number): Promise<number> {
  const rows = await db
    .selectFrom('account_session')
    .select('id')
    .where('account_id', '=', accountId)
    .execute();
  return rows.length;
}

test('a new username becomes a superadmin whose password verifies, with the grant recorded; again, nothing changes', async () => {
  const username = uniqueUsername('owner');
  const first = request(username);
  assert.equal(await setSuperadmin(db, first), 'created');
  const account = await accountOf(username);
  assert.equal(account.role, 'superadmin');
  assert.equal(await verifyPassword(account.password_hash, first.password), true);
  assert.deepEqual(await grantsOf(account.id), [
    { from_role: null, to_role: 'superadmin', changed_by: 'cli:tester@test-host' },
  ]);

  await sessionFor(account.id);
  assert.equal(await setSuperadmin(db, request(username)), 'unchanged');
  assert.equal((await accountOf(username)).password_hash, account.password_hash);
  assert.equal((await grantsOf(account.id)).length, 1);
  assert.equal(await sessionCount(account.id), 1);
});

test('a buyer is promoted with a new password, the grant recorded and every session ended', async () => {
  const username = uniqueUsername('buyer');
  const { id } = await db
    .insertInto('account')
    .values({ username, password_hash: await hashPassword('blue tiger eats rice') })
    .returning('id')
    .executeTakeFirstOrThrow();
  await sessionFor(id);
  const promotion = request(username);
  assert.equal(await setSuperadmin(db, promotion), 'promoted');
  const account = await accountOf(username);
  assert.equal(account.role, 'superadmin');
  assert.equal(await verifyPassword(account.password_hash, promotion.password), true);
  assert.equal(await verifyPassword(account.password_hash, 'blue tiger eats rice'), false);
  assert.deepEqual(await grantsOf(id), [
    { from_role: 'buyer', to_role: 'superadmin', changed_by: 'cli:tester@test-host' },
  ]);
  assert.equal(await sessionCount(id), 0);
});

test('a superadmin gets a new password only when asked, which ends their sessions and clears their sign-in waits', async () => {
  const username = uniqueUsername('owner');
  await setSuperadmin(db, request(username));
  const { id } = await accountOf(username);
  await sessionFor(id);
  const subject = keyedHash(authKey, 'sign_in_account', username);
  await db
    .insertInto('auth_throttle')
    .values({
      scope: 'sign_in_account',
      subject_hmac: subject,
      hits: 7,
      next_attempt_at: new Date(Date.now() + 60_000),
    })
    .execute();

  const reset = request(username, { resetPassword: true });
  assert.equal(await setSuperadmin(db, reset), 'password_reset');
  const account = await accountOf(username);
  assert.equal(await verifyPassword(account.password_hash, reset.password), true);
  assert.equal(await sessionCount(id), 0);
  assert.equal((await grantsOf(id)).length, 1);
  const waits = await db
    .selectFrom('auth_throttle')
    .select('id')
    .where('subject_hmac', '=', subject)
    .execute();
  assert.equal(waits.length, 0);
});
