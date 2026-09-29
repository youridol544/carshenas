import 'server-only';
import { randomBytes } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { inject } from 'vitest';
import { createDatabase } from '@carshenas/db/database';
import type { DB } from '@carshenas/db/db-types';

// For the accounts' integration tests (*.db.test.ts, run by `pnpm db:check` on a scratch database it has just
// migrated): the owner's connection to set rows up and look at them, and throwaway accounts. The code under test
// runs through the app's own pool, as carshenas_web. Refuses any database not named *_check or *_test.

/** The owner's connection, with the app's int8 parser, so ids compare as numbers. */
export function ownerDatabase(): Kysely<DB> {
  return createDatabase({
    connectionString: inject('databaseMigrateUrl'),
    applicationName: 'carshenas-web-tests',
    max: 2,
    onIdleError: () => undefined,
  });
}

export async function assertScratchDatabase(owner: Kysely<DB>): Promise<void> {
  const { rows } = await sql<{ name: string }>`SELECT current_database() AS name`.execute(owner);
  const name = rows[0]?.name ?? '';
  if (!/_(check|test)$/.test(name))
    throw new Error(`refusing to write test rows into ${name}: run pnpm db:check`);
}

export function uniqueUsername(prefix = 'tester'): string {
  return `${prefix}_${randomBytes(5).toString('hex')}`;
}

/** A syntactically valid Argon2id hash that no password produces, for accounts that never sign in by password. */
export const STAND_IN_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g';

/** An account made by the owner, as `pnpm account:superadmin` makes a superadmin; the hash is a stand-in. */
export async function createAccount(
  owner: Kysely<DB>,
  role: 'buyer' | 'superadmin' = 'buyer',
  username = uniqueUsername(),
): Promise<{ id: number; username: string }> {
  const { id } = await owner
    .insertInto('account')
    .values({
      username,
      role,
      password_hash: STAND_IN_HASH,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id, username };
}
