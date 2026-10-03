import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

// The pasted-link tests' data (CS-65): two more Divar listings of the Peugeot 206 beside the listing page's (fixtures/
// listing-page.ts): one the daily run did not rate (priced, details read, no listing_valuation row, so the page rates it on
// the spot) and one seen on a list page only (no price). It also reads what a paste leaves behind (the wanted links and the
// day's demand for the model) and puts the demand back as it was, so a run against a real database leaves no trace.

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') throw new Error('DATABASE_MIGRATE_URL is not set');
  return url;
}

async function withClient<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export type PasteSeed = {
  readonly token: string;
  readonly keys: { readonly fresh: string; readonly unread: string; readonly never: string };
  readonly ids: { readonly fresh: number; readonly unread: number };
  readonly modelId: number;
  /** The day's paste demand for the model before the test, to put back: null when there was no row. */
  readonly demandBefore: number | null;
};

export async function seedPasteListings(): Promise<PasteSeed> {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const token = 'qzp' + Array.from({ length: 5 }, () => letters.charAt(randomInt(letters.length))).join('');
  const keys = {
    fresh: `e2e-pl-${token}-fresh`,
    unread: `e2e-pl-${token}-unread`,
    never: `e2e-pl-${token}-never`,
  };
  return withClient(async (client) => {
    const catalogue = await client.query<{
      make_id: number;
      model_id: number;
      trim_id: number;
      city_id: number;
    }>(
      `SELECT mk.id AS make_id, m.id AS model_id, t.id AS trim_id, (SELECT id FROM city WHERE slug = 'tehran') AS city_id
       FROM make mk JOIN model m ON m.make_id = mk.id JOIN "trim" t ON t.model_id = m.id
       WHERE mk.slug = 'peugeot' AND m.slug = '206' ORDER BY t.id LIMIT 1`,
    );
    const [row] = catalogue.rows;
    if (row === undefined)
      throw new Error('The pasted-link tests need the catalogue: run pnpm catalogue:sync.');
    const fresh = await client.query<{ id: number }>(
      `INSERT INTO listing (source_id, source_listing_key, url, origin, status, listed_at, last_seen_at, last_checked_at,
                            title, model_year_written, model_year_sh, mileage_km, fuel, gearbox, price_type,
                            asking_price_toman, seller_type, body_condition, engine_condition, gearbox_condition,
                            front_chassis_condition, rear_chassis_condition, make_id, model_id, trim_id,
                            catalogue_match, city_id, district_fa)
       VALUES ('divar', $1, $2, 'external', 'active', now() - interval '2 days', now() - interval '20 minutes',
               now() - interval '20 minutes', 'پژو ۲۰۶ تیپ ۵ آزمایشی', 'sh', 1398, 90000, 'petrol', 'manual', 'asking',
               640000000, 'private', 'minor_scratches', 'sound', 'sound', 'intact', 'intact', $3, $4, $5, 'trim', $6,
               'سعادت آباد')
       RETURNING id`,
      [keys.fresh, `https://divar.ir/v/${keys.fresh}`, row.make_id, row.model_id, row.trim_id, row.city_id],
    );
    const unread = await client.query<{ id: number }>(
      `INSERT INTO listing (source_id, source_listing_key, url, origin, status, listed_at, last_seen_at, title,
                            make_id, model_id, catalogue_match)
       VALUES ('divar', $1, $2, 'external', 'active', now() - interval '2 days', now() - interval '20 minutes',
               'پژو ۲۰۶ آزمایشی', $3, $4, 'model')
       RETURNING id`,
      [keys.unread, `https://divar.ir/v/${keys.unread}`, row.make_id, row.model_id],
    );
    const before = await client.query<{ request_count: number }>(
      `SELECT request_count FROM model_demand
       WHERE demand_date = (now() AT TIME ZONE 'Asia/Tehran')::date AND model_id = $1 AND kind = 'paste'`,
      [row.model_id],
    );
    const [freshRow] = fresh.rows;
    const [unreadRow] = unread.rows;
    if (freshRow === undefined || unreadRow === undefined) throw new Error('the seeded listings have no id');
    return {
      token,
      keys,
      ids: { fresh: freshRow.id, unread: unreadRow.id },
      modelId: row.model_id,
      demandBefore: before.rows[0]?.request_count ?? null,
    };
  });
}

/** The seed the global setup made, handed over through the environment like the listing page's. */
export function pasteSeed(): PasteSeed {
  const text = process.env.E2E_PASTE_SEED;
  if (text === undefined)
    throw new Error('E2E_PASTE_SEED is not set: the global setup seeds the pasted-link listings.');
  return JSON.parse(text) as PasteSeed;
}

export async function removePasteListings(seed: PasteSeed): Promise<void> {
  await withClient(async (client) => {
    await client.query('BEGIN');
    await client.query(`SET LOCAL carshenas.purge = 'on'`);
    await client.query(`DELETE FROM wanted_link WHERE source_listing_key LIKE $1`, [
      `e2e-pl-${seed.token}-%`,
    ]);
    await client.query(`DELETE FROM listing WHERE source_id = 'divar' AND source_listing_key LIKE $1`, [
      `e2e-pl-${seed.token}-%`,
    ]);
    const today = `(now() AT TIME ZONE 'Asia/Tehran')::date`;
    if (seed.demandBefore === null) {
      await client.query(
        `DELETE FROM model_demand WHERE demand_date = ${today} AND model_id = $1 AND kind = 'paste'`,
        [seed.modelId],
      );
    } else {
      await client.query(
        `UPDATE model_demand SET request_count = $2 WHERE demand_date = ${today} AND model_id = $1 AND kind = 'paste'`,
        [seed.modelId, seed.demandBefore],
      );
    }
    await client.query('COMMIT');
  });
}

/** How many times the wanted link was asked for; null when it was never kept. */
export async function wantedCount(key: string): Promise<number | null> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ request_count: number }>(
      `SELECT request_count FROM wanted_link WHERE source_id = 'divar' AND source_listing_key = $1`,
      [key],
    );
    return rows[0]?.request_count ?? null;
  });
}

/** Today's paste demand for the model. */
export async function pasteDemand(modelId: number): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ request_count: number }>(
      `SELECT coalesce(sum(request_count), 0)::int AS request_count FROM model_demand
       WHERE demand_date = (now() AT TIME ZONE 'Asia/Tehran')::date AND model_id = $1 AND kind = 'paste'`,
      [modelId],
    );
    return rows[0]?.request_count ?? 0;
  });
}

/** Requests the crawler's log holds since the given time: a paste must never add one. */
export async function fetchesSince(startedAt: Date): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ count: string }>(
      `SELECT count(*) FROM fetch_log WHERE requested_at > $1`,
      [startedAt],
    );
    return Number(rows[0]?.count ?? 0);
  });
}
