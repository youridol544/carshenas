import { randomBytes } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '@carshenas/db/database';
import type { DB } from '@carshenas/db/db-types';
import { env } from '../env.ts';

// For the integration tests (*.db.test.ts, run by `pnpm db:check` on a scratch database it has just migrated): the
// owner's connection to set rows up, and throwaway sources. Tests that write refuse any database whose name does not
// end in _check or _test, so they can never touch the development or a production database.

function ownerDatabase(): Kysely<DB> {
  return createDatabase({
    connectionString: env.migrateDatabaseUrl,
    applicationName: 'carshenas-worker-tests',
    max: 2,
    onIdleError: () => undefined,
  });
}

/** The owner's connection, after checking that the database is a scratch one. */
export async function openScratchDatabase(): Promise<Kysely<DB>> {
  const owner = ownerDatabase();
  const { rows } = await sql<{ name: string }>`SELECT current_database() AS name`.execute(owner);
  const name = rows[0]?.name ?? '';
  if (!/_(check|test)$/.test(name)) {
    await owner.destroy();
    throw new Error(
      `refusing to write to ${name}: integration tests run on a *_check or *_test database (pnpm db:check)`,
    );
  }
  return owner;
}

export type TestSourceOptions = {
  readonly crawlState?: 'enabled' | 'paused';
  readonly intervalMs?: number;
};

/** What node:test's context offers for cleaning up after a test. */
type Cleanup = { after(fn: () => Promise<unknown>): void };

/**
 * A crawled source of its own for one test: `t_` and random letters, so tests never share a lane. It is deleted
 * when the test ends (its lane with it), so no later test's worker opens its lane and takes its leftover jobs.
 */
export async function createTestSource(
  owner: Kysely<DB>,
  test: Cleanup,
  options: TestSourceOptions = {},
): Promise<string> {
  const id = `t_${randomBytes(6).toString('hex')}`;
  test.after(() => owner.deleteFrom('source').where('id', '=', id).execute());
  await owner
    .insertInto('source')
    .values({
      id,
      origin: 'external',
      access_method: 'crawl',
      name_fa: 'منبع آزمایشی',
      base_url: 'https://test.example',
      listing_visibility: 'public',
      crawl_state: options.crawlState ?? 'enabled',
      min_request_interval_ms: options.intervalMs ?? 3_000,
    })
    .execute();
  return id;
}

/** What a person does in the admin section (CS-40): enable, pause, or resume a stopped source. */
export async function setCrawlState(
  owner: Kysely<DB>,
  sourceId: string,
  crawlState: 'enabled' | 'paused',
): Promise<void> {
  await owner
    .updateTable('source')
    .set({ crawl_state: crawlState, stopped_at: null, stop_reason: null })
    .where('id', '=', sourceId)
    .execute();
}

export type QueuedJob = {
  readonly id: string;
  readonly state: string;
  readonly retryCount: number;
  readonly data: unknown;
  readonly output: unknown;
};

/** The jobs of one queue, oldest first, read with the owner's rights. */
export async function jobsOf(owner: Kysely<DB>, queue: string): Promise<QueuedJob[]> {
  const { rows } = await sql<QueuedJob>`
    SELECT id::text AS id, state::text AS state, retry_count AS "retryCount", data, output
    FROM pgboss.job
    WHERE name = ${queue}
    ORDER BY created_on, id`.execute(owner);
  return rows;
}
