import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

// The model page's data for its browser tests (CS-67): a make and two models of their own (so no real model's numbers
// matter and no other test sees them), written as the migration role straight into the tables the page reads, and
// removed again when the test ends. The first model has 29 listings in the search table and a valuation history:
//   - model year 1400: 12 listings priced 800 to 855 million tomans (a median of 827.5 million), rated in eight
//     daily runs spread over 32 days, the price rising 0.3 % a day, so the trend is drawn by the week, has a 30-day
//     change and no 90-day change;
//   - model year 1398: 9 listings rated in only the last two runs: a short history, no chart;
//   - model year 1401: 5 listings and 1399: 3 listings rated in the last run: too few for any point.
// The second model has no listing at all. The runs are dated far in the past, at a date of this seed's own (a random
// day between 400 and 2,900 days ago), so they are never the latest run of the market values (which the other tests
// and the app read) and two seeds running together never share a day. Photos are never involved: the search table's
// rows carry none.

const REPOSITORY_SETTINGS = fileURLToPath(new URL('../../.env', import.meta.url));

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(readFileSync(REPOSITORY_SETTINGS, 'utf8')).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') {
    throw new Error('DATABASE_MIGRATE_URL is not set: the model page tests need the database the app uses.');
  }
  return url;
}

export type ModelPageSeed = {
  readonly token: string;
  readonly make: { readonly slug: string; readonly name: string };
  /** The model with listings, and the one without. */
  readonly model: { readonly slug: string; readonly name: string };
  readonly emptyModel: { readonly slug: string; readonly name: string };
  readonly numbers: {
    /** Listings the page counts, and the middle share of their asking prices (all years). */
    readonly count: number;
    readonly years: readonly { readonly year: number; readonly count: number }[];
    /** The median asking price of the 1400 listings in the last run, in tomans, and a month and more before it. */
    readonly latestMedianToman: number;
    /** Daily runs the 1400 trend has, the weekly points drawn from them, and the days the history spans. */
    readonly runs: number;
    readonly weeklyPoints: number;
    readonly spanDays: number;
  };
  readonly methodVersion: number;
};

/** Days before the last run of each of the eight daily runs of the 1400 history. */
const DAY_OFFSETS = [32, 29, 26, 23, 20, 13, 6, 0] as const;
const DAILY_DRIFT = 0.003;

type YearPlan = { year: number; count: number; basePrice: number; runs: number; km: number };
const PLAN: readonly YearPlan[] = [
  { year: 1400, count: 12, basePrice: 800_000_000, runs: DAY_OFFSETS.length, km: 70_000 },
  { year: 1398, count: 9, basePrice: 640_000_000, runs: 2, km: 110_000 },
  { year: 1401, count: 5, basePrice: 900_000_000, runs: 1, km: 40_000 },
  { year: 1399, count: 3, basePrice: 700_000_000, runs: 1, km: 90_000 },
];
const PRICE_STEP = 5_000_000;

function randomToken(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  return Array.from({ length: 7 }, () => letters.charAt(randomInt(letters.length))).join('');
}

function ratingFor(gapPct: number): 'great' | 'good' | 'fair' | 'high' | 'overpriced' {
  if (gapPct <= -10) return 'great';
  if (gapPct <= -4) return 'good';
  if (gapPct < 4) return 'fair';
  if (gapPct < 10) return 'high';
  return 'overpriced';
}

function weekStartOffset(daysFromBase: number, baseWeekday: number): number {
  // A week starts on Saturday: the number of days since the Saturday on or before the day.
  return Math.floor((daysFromBase + baseWeekday) / 7);
}

export async function seedModelPage(): Promise<ModelPageSeed> {
  const token = randomToken();
  const methodVersion = 100 + randomInt(30_000);
  const makeSlug = `e2e-${token}`;
  const makeName = `سازنده‌ی آزمایشی ${token}`;
  const modelSlug = 'e2e-model';
  const modelName = `${makeName} مدل یک`;
  const emptySlug = 'e2e-empty';
  const emptyName = `${makeName} مدل بی‌آگهی`;
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    await client.query('BEGIN');
    const city = await client.query<{ id: number }>(`SELECT id FROM city WHERE slug = 'tehran'`);
    const cityId = city.rows[0]?.id;
    if (cityId === undefined)
      throw new Error('The model page tests need the catalogue: run pnpm catalogue:sync.');
    const make = await client.query<{ id: number }>(
      `INSERT INTO make (slug, name_fa, name_en) VALUES ($1, $2, $3) RETURNING id`,
      [makeSlug, makeName, `E2E ${token}`],
    );
    const makeId = make.rows[0]?.id;
    const model = await client.query<{ id: number }>(
      `INSERT INTO model (make_id, slug, name_fa, name_en, body_type) VALUES ($1, $2, $3, 'E2E One', 'sedan')
       RETURNING id`,
      [makeId, modelSlug, modelName],
    );
    await client.query(
      `INSERT INTO model (make_id, slug, name_fa, name_en, body_type) VALUES ($1, $2, $3, 'E2E Empty', 'suv')`,
      [makeId, emptySlug, emptyName],
    );
    const modelId = model.rows[0]?.id;
    const trims: number[] = [];
    for (const [slug, name] of [
      ['e2e-trim-a', `${modelName} تیپ الف`],
      ['e2e-trim-b', `${modelName} تیپ ب`],
    ] as const) {
      const trim = await client.query<{ id: number }>(
        `INSERT INTO "trim" (model_id, slug, name_fa, name_en) VALUES ($1, $2, $3, $4) RETURNING id`,
        [modelId, slug, name, slug],
      );
      trims.push(trim.rows[0]?.id ?? 0);
    }

    // The runs: eight dates for the 1400 history, 32 days apart at most, ending at this seed's own last day.
    const last = await client.query<{ day: string; weekday: number }>(
      `SELECT to_char(current_date - $1::int, 'YYYY-MM-DD') AS day,
              ((extract(isodow FROM current_date - $1::int)::int + 1) % 7) AS weekday`,
      [400 + randomInt(2500)],
    );
    const lastDay = last.rows[0]?.day;
    if (lastDay === undefined) throw new Error('no date');
    const runIds: number[] = [];
    for (const offset of DAY_OFFSETS) {
      const run = await client.query<{ id: number }>(
        `INSERT INTO valuation_run (as_of_date, method_version, status, reference_year_sh, mileage_norm_km_per_year,
                                    window_days, prior_strength, finished_at, comparable_count, valued_count, rated_count)
         VALUES ($1::date - $2::int, $3, 'succeeded', 1405, 20000, 30, 20, now(), 0, 0, 0) RETURNING id`,
        [lastDay, offset, methodVersion],
      );
      runIds.push(run.rows[0]?.id ?? 0);
    }

    let index = 0;
    const years: { year: number; count: number }[] = [];
    let latestMedian = 0;
    for (const plan of PLAN) {
      years.push({ year: plan.year, count: plan.count });
      const prices: number[] = [];
      for (let n = 0; n < plan.count; n += 1) {
        const price = plan.basePrice + n * PRICE_STEP;
        prices.push(price);
        const key = `e2e-mp-${token}-${String(index)}`;
        const trimId = trims[index % trims.length];
        const listing = await client.query<{ id: number }>(
          `INSERT INTO listing (source_id, source_listing_key, url, origin, status, listed_at, last_seen_at, title,
                                model_year_written, model_year_sh, mileage_km, fuel, gearbox, price_type,
                                asking_price_toman, seller_type, make_id, model_id, trim_id, catalogue_match, city_id)
           VALUES ('divar', $1, $2, 'external', 'active', now() - interval '3 days', now(), $3, 'sh', $4, $5,
                   'petrol', $6, 'asking', $7, $8, $9, $10, $11, 'trim', $12)
           RETURNING id`,
          [
            key,
            `https://test.example/post/${key}`,
            `${modelName} ${String(index)}`,
            plan.year,
            plan.km + n * 3_000,
            index % 5 === 0 ? 'automatic' : 'manual',
            price,
            index % 3 === 0 ? 'dealer' : 'private',
            makeId,
            modelId,
            trimId,
            cityId,
          ],
        );
        const listingId = listing.rows[0]?.id ?? 0;
        // The market value is the model year's own middle price, so the gaps run from -3 % to +3 % (fair) with one
        // listing well below it (great) and one well above (overpriced).
        const value = plan.basePrice + Math.floor(plan.count / 2) * PRICE_STEP;
        const gap =
          n === 0 ? -12 : n === plan.count - 1 ? 12 : Math.round(((price - value) / value) * 10000) / 100;
        const rating = ratingFor(gap);
        await client.query(
          `INSERT INTO search_document (
             listing_id, source_id, listed_at, last_seen_at, make_id, model_id, trim_id, make_key, model_key, trim_key,
             body_type, model_year_sh, mileage_km, km_per_year, price_type, asking_price_toman, market_value_toman,
             price_gap_pct, deal_rating, valued_on, gearbox, fuel, city_id, city_key, district_fa, district_key,
             seller_type, paint_free, has_photo, photo_count, model_rank, search_text, refreshed_at)
           SELECT l.id, l.source_id, l.listed_at, l.last_seen_at, l.make_id, l.model_id, l.trim_id, mk.slug,
                  mk.slug || '.' || m.slug, mk.slug || '.' || m.slug || '.' || t.slug, m.body_type, l.model_year_sh,
                  l.mileage_km, round(l.mileage_km / greatest(1405 - l.model_year_sh, 0.5))::integer, l.price_type,
                  l.asking_price_toman, $2::bigint, $3::numeric, $4::deal_rating, current_date, l.gearbox, l.fuel,
                  l.city_id, c.slug, 'سعادت آباد', c.slug || '.سعادت آباد', l.seller_type, $5::boolean, false, 0, 1,
                  concat_ws(' ', l.title, mk.name_fa, m.name_fa, t.name_fa), now()
           FROM listing l JOIN make mk ON mk.id = l.make_id JOIN model m ON m.id = l.model_id
           JOIN "trim" t ON t.id = l.trim_id JOIN city c ON c.id = l.city_id WHERE l.id = $1`,
          [listingId, value, gap, rating, index % 2 === 0],
        );
        // The valuation history: the last `runs` runs; the price moves with the day, the same for every listing.
        for (const runIndex of Array.from({ length: plan.runs }, (_, i) => runIds.length - plan.runs + i)) {
          const offset = DAY_OFFSETS[runIndex] ?? 0;
          const drift = 1 + DAILY_DRIFT * (DAY_OFFSETS[0] - offset);
          const asking = Math.round((price * drift) / 1000) * 1000;
          const marketValue = Math.round((value * drift) / 1000) * 1000;
          const runGap = Math.round(((asking - marketValue) / marketValue) * 10000) / 100;
          await client.query(
            `INSERT INTO listing_valuation (valuation_run_id, listing_id, asking_price_toman, market_value_toman,
                                            price_gap_pct, deal_rating)
             VALUES ($1, $2, $3, $4, $5, $6::deal_rating)`,
            [runIds[runIndex], listingId, asking, marketValue, runGap, ratingFor(runGap)],
          );
        }
        index += 1;
      }
      if (plan.year === 1400) {
        const sorted = [...prices].sort((a, b) => a - b);
        const middle = (sorted[5] ?? 0) / 2 + (sorted[6] ?? 0) / 2;
        const drift = 1 + DAILY_DRIFT * (DAY_OFFSETS[0] - 0);
        latestMedian = Math.round((middle * drift) / 1000) * 1000;
      }
    }
    await client.query('COMMIT');
    const weeks = new Set(DAY_OFFSETS.map((offset) => weekStartOffset(-offset, last.rows[0]?.weekday ?? 0)));
    return {
      token,
      make: { slug: makeSlug, name: makeName },
      model: { slug: modelSlug, name: modelName },
      emptyModel: { slug: emptySlug, name: emptyName },
      numbers: {
        count: index,
        years,
        latestMedianToman: latestMedian,
        runs: DAY_OFFSETS.length,
        weeklyPoints: weeks.size,
        spanDays: DAY_OFFSETS[0],
      },
      methodVersion,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

/** Removes everything the seed made: the runs (their valuations go with them), the listings, the models and the make. */
export async function removeModelPage(seed: ModelPageSeed): Promise<void> {
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM valuation_run WHERE method_version = $1`, [seed.methodVersion]);
    await client.query(`DELETE FROM listing WHERE source_id = 'divar' AND source_listing_key LIKE $1`, [
      `e2e-mp-${seed.token}-%`,
    ]);
    await client.query(
      `DELETE FROM "trim" WHERE model_id IN (SELECT m.id FROM model m JOIN make mk ON mk.id = m.make_id WHERE mk.slug = $1)`,
      [seed.make.slug],
    );
    await client.query(`DELETE FROM model WHERE make_id IN (SELECT id FROM make WHERE slug = $1)`, [
      seed.make.slug,
    ]);
    await client.query(`DELETE FROM make WHERE slug = $1`, [seed.make.slug]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
