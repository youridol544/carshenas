import { sql } from 'kysely';
import { afterAll, expect, test } from 'vitest';
import { adminDatabase } from '@/server/db/admin-database';
import { database } from '@/server/db/database';
import { JOB_STATES, PGBOSS_COLUMNS } from '@/server/db/pgboss-types';

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

test('the section reads the worker and the pipeline and changes none of it (CS-41)', async () => {
  const failure = (statement: ReturnType<typeof sql>) =>
    statement.execute(adminDatabase()).then(
      () => undefined,
      (e: unknown) => e,
    );
  for (const table of [
    sql`pgboss.job`,
    sql`pgboss.queue`,
    sql`crawl_lane`,
    sql`crawl_run`,
    sql`fetch_log`,
    sql`source_daily_spend`,
    sql`listing`,
    sql`listing_price_event`,
    sql`listing_unparsed_value`,
    sql`freshness_measurement`,
  ]) {
    expect(await failure(sql`SELECT count(*) FROM ${table}`)).toBeUndefined();
  }
  expect(await failure(sql`UPDATE pgboss.job SET state = 'retry' WHERE false`)).toMatchObject({
    code: '42501',
  });
  expect(await failure(sql`DELETE FROM pgboss.job WHERE false`)).toMatchObject({ code: '42501' });
  expect(await failure(sql`UPDATE crawl_lane SET failure_streak = 0 WHERE false`)).toMatchObject({
    code: '42501',
  });
  expect(await failure(sql`UPDATE listing SET status = 'gone' WHERE false`)).toMatchObject({ code: '42501' });
  // What the screens do not show stays closed: a snapshot's stored page, and every password hash.
  expect(await failure(sql`SELECT count(*) FROM snapshot`)).toMatchObject({ code: '42501' });
  expect(await failure(sql`SELECT password_hash FROM account`)).toMatchObject({ code: '42501' });
});

test("the job queue's hand-written types match the installed pg-boss schema", async () => {
  for (const [table, columns] of Object.entries(PGBOSS_COLUMNS)) {
    const { rows } = await sql<{ column_name: string }>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'pgboss' AND table_name = ${table}`.execute(adminDatabase());
    expect(rows.map((row) => row.column_name)).toEqual(expect.arrayContaining([...columns]));
  }
  const { rows } = await sql<{ state: string }>`
    SELECT unnest(enum_range(NULL::pgboss.job_state))::text AS state`.execute(adminDatabase());
  expect(rows.map((row) => row.state)).toEqual([...JOB_STATES]);
});
