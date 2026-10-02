import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

// The listing page's data for its browser tests (CS-64): a handful of listings of one catalogue model (Peugeot 206),
// written as the migration role straight into the tables the page reads, in the latest succeeded valuation run (one is
// made, and removed again, when the database has none), and removed when the test ends. Each kind of page has its own
// listing: a rated one with everything (five photos, four comparables, two price changes, facts read from the text, a
// seller's field that the text contradicts), a stale one whose page was last read nine hours ago (opening it records a
// re-check request), one with a market value and no rating, an instalment sale, and one that left the market.
// Photos point at the source's photo host with addresses no one has; test.ts answers them with a drawn stand-in. The
// numbers are chosen so each has a known answer: a market value of 740 million tomans and an asking price of 640 million
// give a gap of -13.51 %, a «معامله‌ی عالی».

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_MIGRATE_URL is not set: the listing page tests need the database the app uses.',
    );
  }
  return url;
}

export type ListingPageSeed = {
  readonly token: string;
  readonly ids: {
    readonly rated: number;
    readonly stale: number;
    readonly unrated: number;
    readonly installment: number;
    readonly gone: number;
    readonly comparables: readonly number[];
  };
  readonly numbers: {
    readonly askingToman: number;
    readonly marketValueToman: number;
    readonly gapPct: number;
    readonly firstPriceToman: number;
    readonly comparableAskingToman: readonly number[];
    readonly photos: number;
  };
  /** The run the rows were written in, and whether the seed made it. */
  readonly run: { readonly id: number; readonly made: boolean };
};

const ASKING = 640_000_000;
const MARKET_VALUE = 740_000_000;
const FIRST_PRICE = 700_000_000;
const STALE_ASKING = 650_000_000;
const PHOTOS = 5;
const COMPARABLES = [
  { price: 700_000_000, adjusted: 735_000_000, year: 1398, km: 80_000, status: 'active' },
  { price: 760_000_000, adjusted: 745_000_000, year: 1399, km: 60_000, status: 'active' },
  { price: 690_000_000, adjusted: 738_000_000, year: 1397, km: 110_000, status: 'sold' },
  { price: 720_000_000, adjusted: 741_000_000, year: 1398, km: 95_000, status: 'active' },
  { price: 710_000_000, adjusted: 739_000_000, year: 1398, km: 100_000, status: 'active' },
  { price: 705_000_000, adjusted: 736_000_000, year: 1399, km: 85_000, status: 'active' },
  { price: 730_000_000, adjusted: 743_000_000, year: 1397, km: 120_000, status: 'active' },
] as const;

function randomToken(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  return 'qzl' + Array.from({ length: 7 }, () => letters.charAt(randomInt(letters.length))).join('');
}

type Catalogue = { makeId: number; modelId: number; trimId: number; cityId: number };

async function readCatalogue(client: pg.Client): Promise<Catalogue> {
  const trims = await client.query<{ make_id: number; model_id: number; trim_id: number }>(
    `SELECT mk.id AS make_id, m.id AS model_id, t.id AS trim_id
     FROM make mk JOIN model m ON m.make_id = mk.id JOIN "trim" t ON t.model_id = m.id
     WHERE mk.slug = 'peugeot' AND m.slug = '206' ORDER BY t.id LIMIT 1`,
  );
  const city = await client.query<{ id: number }>(`SELECT id FROM city WHERE slug = 'tehran'`);
  const [first] = trims.rows;
  const [tehran] = city.rows;
  if (first === undefined || tehran === undefined) {
    throw new Error(
      'The listing page tests need the catalogue (Peugeot 206 with a trim, and Tehran): run pnpm catalogue:sync.',
    );
  }
  return { makeId: first.make_id, modelId: first.model_id, trimId: first.trim_id, cityId: tehran.id };
}

type Kind = 'rated' | 'stale' | 'unrated' | 'installment' | 'gone' | 'comparable';

type ListingRow = {
  readonly key: string;
  readonly kind: Kind;
  readonly status?: string;
  readonly year: number;
  readonly km: number;
  readonly price: number | null;
  readonly priceType?: string;
  readonly downPayment?: number;
  readonly seller?: string;
  readonly checkedHoursAgo: number | null;
  readonly delistedDaysAgo?: number;
};

async function insertListing(
  client: pg.Client,
  catalogue: Catalogue,
  token: string,
  row: ListingRow,
): Promise<number> {
  const priceType = row.priceType ?? 'asking';
  const result = await client.query<{ id: number }>(
    `INSERT INTO listing (source_id, source_listing_key, url, origin, status, listed_at, delisted_at, last_seen_at,
                          last_checked_at, title, model_year_written, model_year_sh, mileage_km, fuel, gearbox,
                          price_type, asking_price_toman, down_payment_toman, seller_type, body_condition,
                          engine_condition, gearbox_condition, front_chassis_condition, rear_chassis_condition,
                          make_id, model_id, trim_id, catalogue_match, city_id, district_fa, insurance_months_left)
     VALUES ('divar', $1, $2, 'external', 'active', now() - interval '12 days', NULL, now() - interval '30 minutes',
             CASE WHEN $3::numeric IS NULL THEN NULL ELSE now() - make_interval(hours => $3::int) END,
             $4, 'sh', $5, $6, 'petrol', 'manual', $7, $8, $9, $10, 'minor_scratches', 'sound', 'sound', 'intact',
             'intact', $11, $12, $13, 'trim', $14, 'سعادت آباد', 6)
     RETURNING id`,
    [
      `e2e-lp-${token}-${row.key}`,
      `https://test.example/post/e2e-lp-${token}-${row.key}`,
      row.checkedHoursAgo,
      `${token} پژو ۲۰۶ تیپ ۵ ${row.kind}`,
      row.year,
      row.km,
      priceType,
      priceType === 'asking' ? row.price : null,
      priceType === 'installment' ? (row.downPayment ?? 200_000_000) : null,
      row.seller ?? 'private',
      catalogue.makeId,
      catalogue.modelId,
      catalogue.trimId,
      catalogue.cityId,
    ],
  );
  const id = result.rows[0]?.id;
  if (id === undefined) throw new Error('the seeded listing has no id');
  // A listing enters as active and leaves the market by a transition the database allows.
  if (row.status !== undefined && row.status !== 'active') {
    await client.query(
      `UPDATE listing SET status = $2, delisted_at = now() - make_interval(days => $3),
                          last_seen_at = now() - make_interval(days => $3 + 1) WHERE id = $1`,
      [id, row.status, row.delistedDaysAgo ?? 2],
    );
  }
  return id;
}

async function addSearchDocument(client: pg.Client, listingId: number, token: string): Promise<void> {
  await client.query(
    `INSERT INTO search_document (
       listing_id, source_id, listed_at, last_seen_at, make_id, model_id, trim_id, make_key, model_key, trim_key,
       body_type, model_year_sh, mileage_km, km_per_year, price_type, asking_price_toman, gearbox, fuel, city_id,
       city_key, district_fa, district_key, seller_type, body_condition, engine_condition, gearbox_condition,
       chassis_condition, has_photo, photo_count, cover_photo_url, cover_thumbnail_url, model_rank, search_text,
       refreshed_at)
     SELECT l.id, l.source_id, l.listed_at, l.last_seen_at, l.make_id, l.model_id, l.trim_id, mk.slug,
            mk.slug || '.' || m.slug, mk.slug || '.' || m.slug || '.' || t.slug, m.body_type, l.model_year_sh,
            l.mileage_km, round(l.mileage_km / greatest(1405 - l.model_year_sh, 0.5))::integer, l.price_type,
            l.asking_price_toman, l.gearbox, l.fuel, l.city_id, c.slug, l.district_fa, c.slug || '.' || l.district_fa,
            l.seller_type, l.body_condition, l.engine_condition, l.gearbox_condition, 'intact', false, 0, NULL, NULL, 1,
            concat_ws(' ', $2::text, l.title, mk.name_fa, m.name_fa, t.name_fa, c.name_fa), now()
     FROM listing l JOIN make mk ON mk.id = l.make_id JOIN model m ON m.id = l.model_id
     JOIN "trim" t ON t.id = l.trim_id JOIN city c ON c.id = l.city_id WHERE l.id = $1`,
    [listingId, token],
  );
}

async function latestRun(client: pg.Client): Promise<{ id: number; made: boolean }> {
  const found = await client.query<{ id: number }>(
    `SELECT id FROM valuation_run WHERE status = 'succeeded' ORDER BY as_of_date DESC, id DESC LIMIT 1`,
  );
  const [run] = found.rows;
  if (run !== undefined) return { id: run.id, made: false };
  const made = await client.query<{ id: number }>(
    `INSERT INTO valuation_run (as_of_date, method_version, status, reference_year_sh, mileage_norm_km_per_year,
                                window_days, prior_strength, finished_at, comparable_count, valued_count, rated_count)
     VALUES (current_date, 95, 'succeeded', 1405, 20000, 30, 20, now(), 0, 0, 0) RETURNING id`,
  );
  const id = made.rows[0]?.id;
  if (id === undefined) throw new Error('the valuation run was not made');
  return { id, made: true };
}

export async function seedListingPages(): Promise<ListingPageSeed> {
  const token = randomToken();
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    const catalogue = await readCatalogue(client);
    await client.query('BEGIN');
    const run = await latestRun(client);
    const rated = await insertListing(client, catalogue, token, {
      key: 'rated',
      kind: 'rated',
      year: 1398,
      km: 90_000,
      price: ASKING,
      checkedHoursAgo: 1,
    });
    const stale = await insertListing(client, catalogue, token, {
      key: 'stale',
      kind: 'stale',
      year: 1398,
      km: 95_000,
      price: 650_000_000,
      checkedHoursAgo: 9,
    });
    const unrated = await insertListing(client, catalogue, token, {
      key: 'unrated',
      kind: 'unrated',
      year: 1404,
      km: 0,
      price: 810_000_000,
      seller: 'dealer',
      checkedHoursAgo: 1,
    });
    const installment = await insertListing(client, catalogue, token, {
      key: 'installment',
      kind: 'installment',
      year: 1399,
      km: 70_000,
      price: null,
      priceType: 'installment',
      downPayment: 200_000_000,
      checkedHoursAgo: 1,
    });
    const gone = await insertListing(client, catalogue, token, {
      key: 'gone',
      kind: 'gone',
      status: 'gone',
      year: 1398,
      km: 100_000,
      price: 660_000_000,
      checkedHoursAgo: 80,
      delistedDaysAgo: 2,
    });
    const comparables: number[] = [];
    for (const [index, item] of COMPARABLES.entries()) {
      comparables.push(
        await insertListing(client, catalogue, token, {
          key: `cmp${String(index)}`,
          kind: 'comparable',
          status: item.status,
          year: item.year,
          km: item.km,
          price: item.price,
          checkedHoursAgo: 1,
          delistedDaysAgo: 3,
        }),
      );
    }
    // Active comparables and the rated one are searchable, so the gone listing has similar ones to offer.
    for (const id of [rated, ...comparables.filter((_, index) => COMPARABLES[index]?.status === 'active')]) {
      await addSearchDocument(client, id, token);
    }
    // The market values, and the comparable rows the rated listing's valuation lists.
    const gapOf = (price: number) => Math.round(((price - MARKET_VALUE) * 10_000) / MARKET_VALUE) / 100;
    await client.query(
      `INSERT INTO listing_valuation (valuation_run_id, listing_id, asking_price_toman, market_value_toman, price_gap_pct,
                                      deal_rating, no_rating_reason)
       VALUES ($1, $2, $3, $4, $5, 'great', NULL),
              ($1, $6, $7, $4, $8, 'good', NULL),
              ($1, $9, 810000000, 770000000, NULL, NULL, 'dealer_new_car'),
              ($1, $10, NULL, 780000000, NULL, NULL, 'installment_price')`,
      [
        run.id,
        rated,
        ASKING,
        MARKET_VALUE,
        gapOf(ASKING),
        stale,
        STALE_ASKING,
        gapOf(STALE_ASKING),
        unrated,
        installment,
      ],
    );
    for (const [index, item] of COMPARABLES.entries()) {
      const id = comparables[index];
      await client.query(
        `INSERT INTO valuation_comparable (valuation_run_id, listing_id, model_id, model_year_sh, mileage_km,
                                           asking_price_toman, fitted_value_toman, is_outlier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
        [run.id, id, catalogue.modelId, item.year, item.km, item.price, item.adjusted],
      );
      await client.query(
        `INSERT INTO listing_valuation_comparable (valuation_run_id, listing_id, comparable_listing_id, position,
                                                   asking_price_toman, adjusted_price_toman)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [run.id, rated, id, index + 1, item.price, item.adjusted],
      );
    }
    // Photos of the rated listing and of the active comparables' cover.
    for (let position = 1; position <= PHOTOS; position += 1) {
      await client.query(
        `INSERT INTO listing_photo (listing_id, position, url, thumbnail_url) VALUES ($1, $2, $3, $4)`,
        [
          rated,
          position,
          `https://s100.divarcdn.com/static/photo/e2e/${token}-${String(position)}.webp`,
          `https://s100.divarcdn.com/static/photo/e2e/thumb-${token}-${String(position)}.webp`,
        ],
      );
    }
    await client.query(
      `INSERT INTO listing_photo (listing_id, position, url, thumbnail_url) VALUES ($1, 1, $2, NULL)`,
      [gone, `https://s100.divarcdn.com/static/photo/e2e/${token}-gone.webp`],
    );
    // The price history: first read at 700 million, a cut to 640 million three days ago.
    const snapshot = await client.query<{ id: number }>(
      `INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload)
       VALUES ($1, now() - interval '10 days', 'https://api.test.example/post', 1, '{}') RETURNING id`,
      [rated],
    );
    const snapshotId = snapshot.rows[0]?.id;
    if (snapshotId === undefined) throw new Error('the snapshot was not made');
    await client.query(
      `INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, snapshot_id)
       VALUES ($1, now() - interval '10 days', 'asking', $2, $4), ($1, now() - interval '3 days', 'asking', $3, $4)`,
      [rated, FIRST_PRICE, ASKING, snapshotId],
    );
    // Facts the text states: a repaint the seller's own field contradicts, a sound chassis.
    const answer = await client.query<{ id: number }>(
      `INSERT INTO ai_answer (cache_key, task, prompt_version, provider, model, answering_model, output, cost_usd_micros)
       VALUES (decode(md5($1), 'hex') || decode(md5($1 || 'x'), 'hex'), 'listing.facts', '0123456789abcdef', 'google',
               'gemini-3.7-flash', 'gemini-3.7-flash', '{}', 1) RETURNING id`,
      [token],
    );
    const extraction = await client.query<{ id: number }>(
      `INSERT INTO extraction (snapshot_id, listing_id, ai_answer_id, status, hold_reasons)
       VALUES ($1, $2, $3, 'usable', '{}') RETURNING id`,
      [snapshotId, rated, answer.rows[0]?.id],
    );
    await client.query(
      `INSERT INTO extraction_field (extraction_id, field, value, evidence, confidence, threshold, status) VALUES
         ($1, 'paint', 'around', 'دور رنگ', 0.9, 0.75, 'accepted'),
         ($1, 'chassis', 'intact', 'شاسی ها سالم', 0.95, 0.75, 'accepted')`,
      [extraction.rows[0]?.id],
    );
    await client.query('COMMIT');
    return {
      token,
      ids: { rated, stale, unrated, installment, gone, comparables },
      numbers: {
        askingToman: ASKING,
        marketValueToman: MARKET_VALUE,
        gapPct: Math.round(((ASKING - MARKET_VALUE) * 10_000) / MARKET_VALUE) / 100,
        firstPriceToman: FIRST_PRICE,
        comparableAskingToman: COMPARABLES.map((item) => item.price),
        photos: PHOTOS,
      },
      run,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

/** Removes the seeded listings and everything that hangs on them, and the run when the seed made it. */
export async function removeListingPages(seed: ListingPageSeed): Promise<void> {
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL carshenas.purge = 'on'`);
    const pattern = `e2e-lp-${seed.token}-%`;
    await client.query(
      `DELETE FROM listing_recheck_request WHERE listing_id IN
         (SELECT id FROM listing WHERE source_id = 'divar' AND source_listing_key LIKE $1)`,
      [pattern],
    );
    await client.query(
      `DELETE FROM listing_valuation_comparable WHERE listing_id IN
         (SELECT id FROM listing WHERE source_id = 'divar' AND source_listing_key LIKE $1)`,
      [pattern],
    );
    await client.query(
      `DELETE FROM valuation_comparable WHERE listing_id IN
         (SELECT id FROM listing WHERE source_id = 'divar' AND source_listing_key LIKE $1)`,
      [pattern],
    );
    await client.query(
      `DELETE FROM listing_valuation WHERE listing_id IN
         (SELECT id FROM listing WHERE source_id = 'divar' AND source_listing_key LIKE $1)`,
      [pattern],
    );
    await client.query(`DELETE FROM listing WHERE source_id = 'divar' AND source_listing_key LIKE $1`, [
      pattern,
    ]);
    await client.query(
      `DELETE FROM ai_answer WHERE cache_key = decode(md5($1), 'hex') || decode(md5($1 || 'x'), 'hex')`,
      [seed.token],
    );
    if (seed.run.made) await client.query(`DELETE FROM valuation_run WHERE id = $1`, [seed.run.id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

/** How many re-check requests wait for a listing: what opening its page recorded. */
export async function pendingRechecks(listingId: number): Promise<number> {
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    const result = await client.query<{ count: string }>(
      `SELECT count(*) FROM listing_recheck_request WHERE listing_id = $1 AND handled_at IS NULL`,
      [listingId],
    );
    return Number(result.rows[0]?.count ?? 0);
  } finally {
    await client.end();
  }
}
