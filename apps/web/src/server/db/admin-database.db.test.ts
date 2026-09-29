import { sql } from 'kysely';
import { afterAll, expect, test } from 'vitest';
import { adminDatabase } from '@/server/db/admin-database';
import { database } from '@/server/db/database';

// The superadmin section's pool (ADR-0023), through its own role, on the scratch database `pnpm db:check` migrated:
// it connects as carshenas_admin with its own name and the web role's limits, and it is a pool of its own.

afterAll(async () => {
  await Promise.all([adminDatabase().destroy(), database().destroy()]);
});

test('the section connects as carshenas_admin, names itself, and keeps the web role limits', async () => {
  const { rows } = await sql<{
    user: string;
    application: string;
    statement_timeout: string;
    transaction_timeout: string;
  }>`
    SELECT current_user AS "user", current_setting('application_name') AS application,
           current_setting('statement_timeout') AS statement_timeout,
           current_setting('transaction_timeout') AS transaction_timeout`.execute(adminDatabase());
  expect(rows[0]).toEqual({
    user: 'carshenas_admin',
    application: 'carshenas-admin',
    statement_timeout: '5s',
    transaction_timeout: '15s',
  });
  expect(adminDatabase()).not.toBe(database());
});

test('the section cannot create temporary tables or change a source directly', async () => {
  const failure = (statement: ReturnType<typeof sql>) =>
    statement.execute(adminDatabase()).then(
      () => undefined,
      (e: unknown) => e,
    );
  expect(await failure(sql`CREATE TEMP TABLE shadow (id bigint)`)).toMatchObject({ code: '42501' });
  expect(await failure(sql`UPDATE source SET crawl_state = 'paused'`)).toMatchObject({ code: '42501' });
});
