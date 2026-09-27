import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { afterAll, expect, test, vi } from 'vitest';
import { database } from '@/server/db/database';
import { checkDatabaseHealth, databaseHealthResponse } from '@/server/db/database-health';
import type { DB } from '@/server/db/db-types';
import { migrationFiles } from '@/server/db/schema-test-database';

afterAll(async () => {
  await database().destroy();
});

test('the health check reaches PostgreSQL through the web role and reports the newest migration', async () => {
  const newest = (await migrationFiles()).at(-1)?.slice(0, 14);
  await expect(checkDatabaseHealth()).resolves.toMatchObject({ migration: newest });
  const { rows } = await sql<{ user: string; application: string }>`
    SELECT current_user AS "user", current_setting('application_name') AS application`.execute(database());
  expect(rows[0]).toEqual({ user: 'carshenas_web', application: 'carshenas-web' });
});

test('GET /api/health answers 200 with the migration, and 503 without details when the database is down', async () => {
  const newest = (await migrationFiles()).at(-1)?.slice(0, 14);
  const ok = await databaseHealthResponse();
  expect(ok.status).toBe(200);
  expect(ok.headers.get('cache-control')).toBe('no-store');
  const body: unknown = await ok.json();
  expect(body).toMatchObject({ status: 'ok', database: { migration: newest } });

  // Port 1 on the loopback: nothing listens, so the connection is refused at once.
  const unreachable = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: 'postgres://nobody@127.0.0.1:1/none',
        connectionTimeoutMillis: 1_000,
      }),
    }),
  });
  const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const down = await databaseHealthResponse(unreachable);
  await unreachable.destroy();
  expect(down.status).toBe(503);
  expect(await down.json()).toEqual({ status: 'unavailable' });
  // The cause stays in the server log.
  expect(logged).toHaveBeenCalledWith('[health] the database did not answer', expect.any(Error));
});
