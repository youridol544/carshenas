import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

// Model photo links for the browser tests (CS-97): what a test cannot do through the page. The superadmin sets and
// clears a link by clicking; this reads what the database holds and removes what a test made (the change record is
// append-only, so it goes in a purge, as the other fixtures' removals do).

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') {
    throw new Error('DATABASE_MIGRATE_URL is not set: the model photo tests need the database the app uses.');
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

/** The model's photo link and who set it, as the database holds them; null when none is set. */
export async function photoLinkOf(
  makeSlug: string,
  modelSlug: string,
): Promise<{ url: string; setBy: string } | null> {
  return withOwner(async (client) => {
    const result = await client.query<{ url: string; set_by: string }>(
      `SELECT p.url, who.username AS set_by FROM model_photo_link p
       JOIN model m ON m.id = p.model_id JOIN make k ON k.id = m.make_id
       JOIN account who ON who.id = p.set_by_account_id
       WHERE k.slug = $1 AND m.slug = $2`,
      [makeSlug, modelSlug],
    );
    const row = result.rows[0];
    return row === undefined ? null : { url: row.url, setBy: row.set_by };
  });
}

/** The recorded changes of the model's link, oldest first. */
export async function photoChangesOf(
  makeSlug: string,
  modelSlug: string,
): Promise<{ action: string; by: string }[]> {
  return withOwner(async (client) => {
    const result = await client.query<{ action: string; by: string }>(
      `SELECT c.action, who.username AS by FROM model_photo_link_change c
       JOIN model m ON m.id = c.model_id JOIN make k ON k.id = m.make_id
       JOIN account who ON who.id = c.by_account_id
       WHERE k.slug = $1 AND m.slug = $2 ORDER BY c.id`,
      [makeSlug, modelSlug],
    );
    return result.rows;
  });
}

/** Removes the model's link and its record, so the real tiles are as the test found them. */
export async function removePhotoLink(makeSlug: string, modelSlug: string): Promise<void> {
  await withOwner(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL carshenas.purge = 'on'`);
      const ids = `(SELECT m.id FROM model m JOIN make k ON k.id = m.make_id WHERE k.slug = $1 AND m.slug = $2)`;
      await client.query(`DELETE FROM model_photo_link_change WHERE model_id = ${ids}`, [
        makeSlug,
        modelSlug,
      ]);
      await client.query(`DELETE FROM model_photo_link WHERE model_id = ${ids}`, [makeSlug, modelSlug]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
