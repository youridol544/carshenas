import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';
import type { TestModel } from './crawl-requests';

// Tracked models for the browser tests (CS-53): what a test cannot do through the page. The superadmin tracks, pauses
// and removes by clicking; what the page does not offer is made here, as the migration role, in the database the app
// under test uses: a catalogue model's listings (so a card has a backfill to show), and a look at what the database
// holds. The model itself, its tracked row and its change record are removed with removeModel (crawl-requests.ts).

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_MIGRATE_URL is not set: the tracked-model tests need the database the app uses.',
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

/**
 * Active listings of the model on Divar: `unread` that only a sweep has seen, and `read` whose own page was read. They
 * are posted a minute apart, the newest first, and all seen now.
 */
export async function seedModelListings(
  model: TestModel,
  counts: { readonly unread: number; readonly read: number },
): Promise<void> {
  const token = randomBytes(4).toString('hex');
  await withOwner(async (client) => {
    for (let index = 0; index < counts.unread + counts.read; index += 1) {
      const isRead = index >= counts.unread;
      await client.query(
        `INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at, last_checked_at,
                              model_id, make_id, catalogue_match)
         VALUES ('divar', $1, $2, 'active', now() - make_interval(mins => $3), now(),
                 CASE WHEN $4 THEN now() ELSE NULL END, $5, $6, 'model')`,
        [
          `e2e${token}${String(index)}`,
          `https://divar.ir/v/e2e${token}${String(index)}`,
          index,
          isRead,
          model.modelId,
          model.makeId,
        ],
      );
    }
  });
}

export type TrackedRow = {
  state: string;
  priority: string;
  origin: string;
  createdBy: string | null;
  requestId: number | null;
};

/** The model's tracked row as the database holds it; null when it is not tracked. */
export async function trackedRowOf(model: TestModel): Promise<TrackedRow | null> {
  return withOwner(async (client) => {
    const result = await client.query<{
      state: string;
      priority: string;
      origin: string;
      created_by: string | null;
      crawl_request_id: number | null;
    }>(
      `SELECT t.state, t.priority, t.origin, who.username AS created_by, t.crawl_request_id::int
       FROM tracked_model t LEFT JOIN account who ON who.id = t.created_by_account_id
       WHERE t.model_id = $1 AND t.trim_id IS NULL`,
      [model.modelId],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : {
          state: row.state,
          priority: row.priority,
          origin: row.origin,
          createdBy: row.created_by,
          requestId: row.crawl_request_id,
        };
  });
}

/** Every recorded change of the model, oldest first: its action and the superadmin who made it. */
export async function trackedChangesOf(model: TestModel): Promise<{ action: string; by: string | null }[]> {
  return withOwner(async (client) => {
    const result = await client.query<{ action: string; by: string | null }>(
      `SELECT c.action, who.username AS by FROM tracked_model_change c
       LEFT JOIN account who ON who.id = c.by_account_id
       WHERE c.model_id = $1 ORDER BY c.id`,
      [model.modelId],
    );
    return result.rows;
  });
}

/** Whether Divar is paused in this database (the crawl is, while the owner has it paused): what the screen must say. */
export async function crawlIsPaused(): Promise<boolean> {
  return withOwner(async (client) => {
    const result = await client.query<{ paused: boolean }>(
      `SELECT NOT coalesce(bool_or(crawl_state = 'enabled'), false) AS paused FROM source WHERE access_method = 'crawl'`,
    );
    return result.rows[0]?.paused === true;
  });
}
