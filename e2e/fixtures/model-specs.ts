import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';
import type { TestModel } from './crawl-requests';

// Engine volume and origin for the browser tests (CS-99): what a test cannot do through the page, made as the migration
// role in the database the app under test uses, and a look at what the database holds. The model, its specs and their
// change record are removed with removeModel (crawl-requests.ts).

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') {
    throw new Error('DATABASE_MIGRATE_URL is not set: the model-spec tests need the database the app uses.');
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

export type TestTrim = { id: number; nameFa: string };

/** A trim of the test's own model, with a Persian name made of letters only (a digit would show in Persian digits). */
export async function seedTrim(model: TestModel): Promise<TestTrim> {
  const token = randomBytes(4).toString('hex');
  const letters = Array.from(randomBytes(5), (byte) => 'ghijkmnpqrstuvwxyz'[byte % 18]).join('');
  const nameFa = `تیپ آزمایشی ${letters}`;
  const id = await withOwner(async (client) => {
    const result = await client.query<{ id: number }>(
      `INSERT INTO trim (model_id, slug, name_en, name_fa) VALUES ($1, $2, $3, $4) RETURNING id::int`,
      [model.modelId, `t${token}`, `E2E trim ${token}`, nameFa],
    );
    return result.rows[0]?.id ?? 0;
  });
  return { id, nameFa };
}

/** An active, read listing of the model (or of its trim) that states its own engine volume, or none. */
export async function seedSpecListing(
  model: TestModel,
  options: { readonly trim?: TestTrim; readonly ownVolumeCc?: number } = {},
): Promise<number> {
  const token = randomBytes(5).toString('hex');
  return withOwner(async (client) => {
    const result = await client.query<{ id: number }>(
      `INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at, last_checked_at,
                            model_id, make_id, trim_id, catalogue_match, price_type, asking_price_toman, engine_volume_cc,
                            title, mileage_km)
       VALUES ('divar', $1, $2, 'active', now(), now(), now(), $3, $4, $5, $6, 'asking', 900000000, $7, $8, 90000)
       RETURNING id::int`,
      [
        `e2espec${token}`,
        `https://divar.ir/v/e2espec${token}`,
        model.modelId,
        model.makeId,
        options.trim?.id ?? null,
        options.trim === undefined ? 'model' : 'trim',
        options.ownVolumeCc ?? null,
        model.nameFa,
      ],
    );
    return result.rows[0]?.id ?? 0;
  });
}

export type SpecRow = {
  volumeCc: number | null;
  origin: string | null;
  source: string;
  setBy: string | null;
};

/** The model's own spec row (trim null), or one of its trim's, as the database holds it; null when there is none. */
export async function specOf(model: TestModel, trim?: TestTrim): Promise<SpecRow | null> {
  return withOwner(async (client) => {
    const result = await client.query<{
      engine_volume_cc: number | null;
      car_origin: string | null;
      source: string;
      set_by: string | null;
    }>(
      `SELECT s.engine_volume_cc, s.car_origin, s.source, who.username AS set_by
       FROM model_spec s LEFT JOIN account who ON who.id = s.set_by_account_id
       WHERE s.model_id = $1 AND s.trim_id IS NOT DISTINCT FROM $2`,
      [model.modelId, trim?.id ?? null],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : { volumeCc: row.engine_volume_cc, origin: row.car_origin, source: row.source, setBy: row.set_by };
  });
}

/** Every recorded change of the model's specs, oldest first. */
export async function specChangesOf(
  model: TestModel,
): Promise<{ action: string; by: string | null; toVolumeCc: number | null; toOrigin: string | null }[]> {
  return withOwner(async (client) => {
    const result = await client.query<{
      action: string;
      by: string | null;
      to_volume_cc: number | null;
      to_origin: string | null;
    }>(
      `SELECT c.action, who.username AS by, c.to_volume_cc, c.to_origin FROM model_spec_change c
       LEFT JOIN account who ON who.id = c.by_account_id WHERE c.model_id = $1 ORDER BY c.id`,
      [model.modelId],
    );
    return result.rows.map((row) => ({
      action: row.action,
      by: row.by,
      toVolumeCc: row.to_volume_cc,
      toOrigin: row.to_origin,
    }));
  });
}

/** What a listing inherits, as search reads it (listing_filter_row). */
export async function inheritedBy(
  listingId: number,
): Promise<{ volumeCc: number | null; origin: string | null }> {
  return withOwner(async (client) => {
    const result = await client.query<{ engine_volume_cc: number | null; car_origin: string | null }>(
      `SELECT engine_volume_cc, car_origin FROM listing_filter_row WHERE listing_id = $1`,
      [listingId],
    );
    return { volumeCc: result.rows[0]?.engine_volume_cc ?? null, origin: result.rows[0]?.car_origin ?? null };
  });
}
