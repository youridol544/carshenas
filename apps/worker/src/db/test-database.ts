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
  /** Requests a Tehran day (ADR-0017 point 5): 12,000 by default, as Divar's; small to prove the budget refuses. */
  readonly dailyBudget?: number;
  /**
   * The reading of its robots.txt and terms (ADR-0008 point 1): current by default, as a crawled source has; stale
   * (older than its 30 days) or none, to prove that nothing is crawled then.
   */
  readonly policy?: 'current' | 'stale' | 'none';
};

/** What node:test's context offers for cleaning up after a test. */
type Cleanup = { after(fn: () => Promise<unknown>): void };

/**
 * A crawled source of its own for one test: `t_` and random letters, so tests never share a lane. It is deleted
 * when the test ends, with everything a crawl of it wrote (its lane too), so no later test's worker opens its lane and
 * takes its leftover jobs.
 */
export async function createTestSource(
  owner: Kysely<DB>,
  test: Cleanup,
  options: TestSourceOptions = {},
): Promise<string> {
  const id = `t_${randomBytes(6).toString('hex')}`;
  test.after(() => deleteTestSource(owner, id));
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
      daily_request_budget: options.dailyBudget ?? 12_000,
    })
    .execute();
  const policy = options.policy ?? 'current';
  if (policy !== 'none') {
    await owner
      .insertInto('source_policy_check')
      .values({
        source_id: id,
        checked_at: policy === 'current' ? new Date() : new Date(Date.now() - 31 * 24 * 60 * 60_000),
        checked_by: 'the integration tests',
        terms_summary: 'A test source: nothing is read from a real site.',
        verdict: 'allowed',
        photos_allowed: false,
      })
      .execute();
  }
  return id;
}

/**
 * Deletes a test source and everything a crawl of it wrote, as a purge does (ADR-0008 point 8): fetches, snapshots,
 * price events and policy checks are append-only outside one.
 */
export async function deleteTestSource(owner: Kysely<DB>, id: string): Promise<void> {
  await owner.transaction().execute(async (trx) => {
    await sql`SET LOCAL carshenas.purge = 'on'`.execute(trx);
    // Its listings take their fetches, snapshots and price events with them; the fetches of search pages remain.
    await trx.deleteFrom('listing').where('source_id', '=', id).execute();
    await trx.deleteFrom('fetch_log').where('source_id', '=', id).execute();
    await trx.deleteFrom('crawl_run').where('source_id', '=', id).execute();
    await trx.deleteFrom('model_volume').where('source_id', '=', id).execute();
    await trx.deleteFrom('freshness_measurement').where('source_id', '=', id).execute();
    await trx.deleteFrom('source_policy_check').where('source_id', '=', id).execute();
    // The catalogue keeps what the source named (CS-50); its makes, models and trims are shared and stay.
    await trx.deleteFrom('catalogue_alias').where('source_id', '=', id).execute();
    await trx.deleteFrom('catalogue_source_key').where('source_id', '=', id).execute();
    await trx.deleteFrom('source').where('id', '=', id).execute();
  });
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
