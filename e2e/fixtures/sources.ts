import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

// Sources for the superadmin section's browser tests (CS-40). A source reaches the database only through a migration
// or a person at psql, so each test writes its own as the migration role, with the repository's settings, as
// `pnpm account:superadmin` does for the superadmin: these tests need the database the app under test uses.
// Afterwards the test's sources are removed, with the changes recorded on them. A test source left behind would be an
// enabled crawled source pointing at test.example in a development database, where a worker takes it for a source to
// read. Recorded changes are append-only, so the removal is a purge (data model, "Privacy"). Purges are otherwise kept
// for removal requests; this one deletes only rows the test itself made, by their ids (decided on the recommendation
// with CS-40's database review, 2026-09-29).

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_MIGRATE_URL is not set: the superadmin tests need the database the app under test uses.',
    );
  }
  return url;
}

async function withOwner<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

const persianNumber = new Intl.NumberFormat('fa-IR', { useGrouping: false });

export type TestSource = { id: string; nameFa: string };

export type TestSourceState =
  | { crawlState: 'enabled' | 'paused' }
  /** What the crawler's stop_source() leaves: the start of the blocked request, and why. */
  | { crawlState: 'stopped_on_block'; stoppedAt: string; reason: 'blocked' | 'rate_limited' | 'challenge' };

/** A crawled source of one test's own, named «منبع آزمایشی ۴۸۲۹۱۷» so the test finds its card by name. */
export async function createTestSource(state: TestSourceState): Promise<TestSource> {
  const number = randomInt(100_000, 1_000_000);
  const source = { id: `e2e_${String(number)}`, nameFa: `منبع آزمایشی ${persianNumber.format(number)}` };
  const stop = state.crawlState === 'stopped_on_block' ? state : undefined;
  await withOwner((client) =>
    client.query(
      `INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, crawl_state,
                           min_request_interval_ms, daily_request_budget, stopped_at, stop_reason)
       VALUES ($1, 'external', 'crawl', $2, 'https://test.example', 'public', $3, 3000, 12000, $4, $5)`,
      [source.id, source.nameFa, state.crawlState, stop?.stoppedAt ?? null, stop?.reason ?? null],
    ),
  );
  return source;
}

/** Stops a source the way the crawler does, as if a block arrived after the page was opened. */
export async function stopTestSource(id: string, stoppedAt: string): Promise<void> {
  await withOwner((client) =>
    client.query(
      `UPDATE source SET crawl_state = 'stopped_on_block', stopped_at = $2, stop_reason = 'blocked' WHERE id = $1`,
      [id, stoppedAt],
    ),
  );
}

/** Removes a test's sources and the changes recorded on them, in one purge. */
export async function removeTestSources(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await withOwner(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL carshenas.purge = 'on'`);
      await client.query(`DELETE FROM source_state_change WHERE source_id = ANY($1)`, [ids]);
      await client.query(`DELETE FROM source WHERE id = ANY($1)`, [ids]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
