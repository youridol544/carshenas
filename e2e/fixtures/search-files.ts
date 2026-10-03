import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

// Search files for the browser tests (CS-70): what a test cannot do through the page. A file is made, renamed, paused
// and deleted by clicking; what only time does (a car that came after the buyer last looked) is made here, as the
// migration role, in the database the app under test uses: the file's last look is moved back, so the seeded listings
// (first seen a moment ago) are new to the buyer.

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') {
    throw new Error('DATABASE_MIGRATE_URL is not set: the search file tests need the database the app uses.');
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

/** Moves the last look of every file of a buyer back by days, so what Carshenas saw since is new to them. */
export async function rewindLastLook(username: string, days = 3): Promise<number> {
  return withOwner(async (client) => {
    const result = await client.query(
      `UPDATE search_file SET created_at = now() - make_interval(days => $2),
                              status_changed_at = now() - make_interval(days => $2),
                              viewed_at = now() - make_interval(days => $2),
                              previous_viewed_at = now() - make_interval(days => $2)
       WHERE account_id = (SELECT id FROM account WHERE username = $1)`,
      [username, days],
    );
    return result.rowCount ?? 0;
  });
}

/** The state and name of a buyer's files, as the database holds them. */
export async function fileRows(
  username: string,
): Promise<{ id: number; name: string; status: string; search: unknown }[]> {
  return withOwner(async (client) => {
    const result = await client.query<{ id: number; name: string; status: string; search: unknown }>(
      `SELECT id::int, name, status, search FROM search_file
       WHERE account_id = (SELECT id FROM account WHERE username = $1) ORDER BY id`,
      [username],
    );
    return result.rows;
  });
}

/** True once a buyer's first file has been looked at after it was made (the page records a look two seconds in). */
export async function hasLooked(username: string): Promise<boolean> {
  return withOwner(async (client) => {
    const result = await client.query<{ looked: boolean }>(
      `SELECT viewed_at > created_at AS looked FROM search_file
       WHERE account_id = (SELECT id FROM account WHERE username = $1) ORDER BY id LIMIT 1`,
      [username],
    );
    return result.rows[0]?.looked ?? false;
  });
}

/** Removes a buyer's files: a test that made them cleans up, so the superadmin's list stays readable. */
export async function removeFilesOf(username: string): Promise<void> {
  await withOwner(async (client) => {
    await client.query(
      `DELETE FROM search_file WHERE account_id = (SELECT id FROM account WHERE username = $1)`,
      [username],
    );
  });
}

/**
 * Lets a buyer's visit pass: their files' looks and the seeded listings' first sight move back by minutes together, so
 * the listings are as old, against the look, as they were, and the visit that was going on has ended.
 */
export async function letVisitPass(
  username: string,
  listingKeys: readonly string[],
  minutes = 15,
): Promise<void> {
  await withOwner(async (client) => {
    await client.query(
      `UPDATE search_file SET created_at = created_at - make_interval(mins => $2),
                              status_changed_at = status_changed_at - make_interval(mins => $2),
                              viewed_at = viewed_at - make_interval(mins => $2),
                              previous_viewed_at = previous_viewed_at - make_interval(mins => $2)
       WHERE account_id = (SELECT id FROM account WHERE username = $1)`,
      [username, minutes],
    );
    await client.query(
      `UPDATE listing SET created_at = created_at - make_interval(mins => $2)
       WHERE source_listing_key = ANY($1::text[])`,
      [listingKeys, minutes],
    );
    // «New» is measured on when a listing became searchable (CS-72): its row moves back with it.
    await client.query(
      `UPDATE search_document SET indexed_at = indexed_at - make_interval(mins => $2)
       WHERE listing_id IN (SELECT id FROM listing WHERE source_listing_key = ANY($1::text[]))`,
      [listingKeys, minutes],
    );
  });
}

/**
 * What the matching job does for a buyer, through the database function every producer uses (CS-72): a digest of
 * `newCount` listings (and `dropCount` price drops) for the buyer's file, and the time the buyer was told. The job's own
 * rules are tested by the worker's integration tests; the browser only needs the notification and the stored times.
 * Returns the notification's id, or null when the file is muted (create_notification() creates nothing for it).
 */
export async function sendDigest(
  username: string,
  fileId: number,
  facts: { newCount: number; goodCount?: number; dropCount?: number; fileName: string; sinceKey?: string },
): Promise<number | null> {
  return withOwner(async (client) => {
    const sinceKey = facts.sinceKey ?? String(Date.now() * 1000);
    const payload = {
      searchFileId: fileId,
      fileName: facts.fileName,
      newCount: facts.newCount,
      goodCount: facts.goodCount ?? 0,
      dropCount: facts.dropCount ?? 0,
      sinceKey,
    };
    const result = await client.query<{ id: string | null }>(
      `SELECT create_notification(
         (SELECT id FROM account WHERE username = $1), 'search_file_matches',
         $2, $3::jsonb, NULL, $4) AS id`,
      [username, `search_file:${String(fileId)}:${sinceKey}`, JSON.stringify(payload), fileId],
    );
    const id = result.rows[0]?.id ?? null;
    if (id !== null) {
      await client.query(`UPDATE search_file SET last_alert_at = now() WHERE id = $1`, [fileId]);
    }
    return id === null ? null : Number(id);
  });
}

/** Whether a file's alerts are muted, as the database holds it. */
export async function alertsMuted(fileId: number): Promise<boolean> {
  return withOwner(async (client) => {
    const result = await client.query<{ muted: boolean }>(
      `SELECT muted_at IS NOT NULL AS muted FROM search_file WHERE id = $1`,
      [fileId],
    );
    return result.rows[0]?.muted ?? false;
  });
}
