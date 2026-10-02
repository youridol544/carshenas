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
      `UPDATE search_file SET viewed_at = now() - make_interval(days => $2)
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
