import { sql } from 'kysely';
import { afterAll, expect, test } from 'vitest';
import { database } from '@/server/db/database';

// The server and role settings the schema relies on, read through the web app's own pool: db/postgresql.conf and
// db/bootstrap/ must keep saying what the data model assumes.

afterAll(async () => {
  await database().destroy();
});

test('the web role cannot create temporary tables, which could shadow real ones', async () => {
  const error = await sql`CREATE TEMP TABLE shadow (id bigint)`.execute(database()).then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toMatchObject({ code: '42501' });
});

test('large values are compressed with lz4, and the log carries no bind parameters or failing rows', async () => {
  const { rows } = await sql<{
    compression: string;
    log_parameters: string;
    plan_parameters: string;
    error_verbosity: string;
  }>`
    SELECT current_setting('default_toast_compression') AS compression,
           current_setting('log_parameter_max_length') AS log_parameters,
           current_setting('auto_explain.log_parameter_max_length') AS plan_parameters,
           current_setting('log_error_verbosity') AS error_verbosity`.execute(database());
  expect(rows[0]).toEqual({
    compression: 'lz4',
    log_parameters: '0',
    plan_parameters: '0',
    error_verbosity: 'terse',
  });
});
