import 'server-only';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';

// For the search API's integration tests (*.db.test.ts, run by `pnpm db:check` on a scratch database it has just
// migrated): the rows the owner sets up for a search (a make with listings that carry their details, rated by a
// valuation run, with photos, in two cities) and what the tests change about them. The code under test reads them
// through the app's own pool, as carshenas_web, from search_document, which the test builds with the worker's build.

export type SearchTestData = {
  readonly slug: string;
  readonly bigSlug: string;
  readonly source: string;
  /** The listings of the make with `small` listings, rated, with photos. */
  readonly ids: readonly number[];
  /** The listings of the make with more than a count's cap of them. */
  readonly bigIds: readonly number[];
  readonly cityA: { readonly id: number; readonly slug: string };
  readonly cityB: { readonly id: number; readonly slug: string };
  readonly runId: number;
  /** The date the valuation run is of: the latest, so the listings' ratings come from it. */
  readonly runDate: string;
};

type Options = {
  readonly suffix: string;
  readonly small: number;
  readonly big: number;
};

const RUN_DATE = '2099-12-31';

async function seedListings(
  db: Kysely<DB>,
  data: Pick<SearchTestData, 'source' | 'cityA' | 'cityB' | 'runId'>,
  options: { make: number; models: number[]; count: number; keyPrefix: string; rated: boolean },
): Promise<number[]> {
  const { rows } = await sql<{ id: number }>`
    INSERT INTO listing (
      source_id, source_listing_key, url, status, listed_at, last_seen_at, title, make_id, model_id, catalogue_match,
      model_year_written, model_year_sh, mileage_km, price_type, asking_price_toman, gearbox, fuel, city_id, seller_type)
    SELECT ${data.source}, ${options.keyPrefix} || g, 'https://test.example/' || ${options.keyPrefix} || g, 'active',
           now() - g * interval '1 hour', now() - g * interval '1 minute',
           'پژوی آزمایشی سالم ' || g || CASE WHEN g % 2 = 0 THEN ' نقدی' ELSE '' END,
           ${options.make}::bigint, (${options.models}::bigint[])[1 + g % ${options.models.length}::int], 'model',
           'sh', 1395 + g % 10,
           CASE WHEN g % 5 = 0 THEN NULL ELSE g * 3000 END,
           CASE WHEN g % 7 = 0 THEN 'negotiable' ELSE 'asking' END,
           CASE WHEN g % 7 = 0 THEN NULL ELSE 300000000 + g::bigint * 10000000 END,
           CASE WHEN g % 3 = 0 THEN 'automatic' ELSE 'manual' END, 'petrol',
           CASE WHEN g % 4 = 0 THEN ${data.cityB.id}::bigint ELSE ${data.cityA.id}::bigint END,
           CASE WHEN g % 2 = 0 THEN 'dealer' ELSE 'private' END
    FROM generate_series(1, ${options.count}::int) g
    RETURNING id`.execute(db);
  const made = rows.map((row) => row.id);
  if (options.rated) {
    // Every second listing that states a price is rated, with a gap of its number less fifteen: -13 to +15.
    await sql`
      INSERT INTO listing_valuation (
        valuation_run_id, listing_id, asking_price_toman, market_value_toman, price_gap_pct, deal_rating)
      SELECT ${data.runId}::bigint, l.id, l.asking_price_toman,
             round(l.asking_price_toman / (1 + gap.v / 100))::bigint, gap.v,
             CASE WHEN gap.v <= -10 THEN 'great' WHEN gap.v <= -3 THEN 'good' WHEN gap.v <= 3 THEN 'fair'
                  WHEN gap.v <= 10 THEN 'high' ELSE 'overpriced' END::deal_rating
      FROM listing l, LATERAL (SELECT (substr(l.source_listing_key, ${options.keyPrefix.length + 1})::int - 15) AS v) gap
      WHERE l.id = any(${made}::bigint[]) AND l.asking_price_toman IS NOT NULL
        AND substr(l.source_listing_key, ${options.keyPrefix.length + 1})::int % 2 = 0`.execute(db);
  }
  await sql`
    INSERT INTO listing_photo (listing_id, position, url, thumbnail_url)
    SELECT l.id, 1, 'https://test.example/photo/' || l.id || '.jpg', 'https://test.example/thumb/' || l.id || '.jpg'
    FROM listing l WHERE l.id = any(${made}::bigint[]) AND l.id % 3 <> 0`.execute(db);
  return made;
}

/** A source, two cities, two makes with models, a valuation run, and the listings. Everything under unique names. */
export async function seedSearchData(owner: Kysely<DB>, options: Options): Promise<SearchTestData> {
  const slug = `tst-api-${options.suffix}`;
  const bigSlug = `tst-big-${options.suffix}`;
  const source = `tst_api_${options.suffix}`;
  const city = async (cityName: string, name: string) => {
    const slugOfCity = `tst-${cityName}-${options.suffix}`;
    const row = await owner
      .insertInto('city')
      .values({ slug: slugOfCity, name_fa: name })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { id: row.id, slug: slugOfCity };
  };
  const cityA = await city('a', 'شهر الف');
  const cityB = await city('b', 'شهر ب');
  await owner
    .insertInto('source')
    .values({
      id: source,
      origin: 'external',
      access_method: 'official_api',
      name_fa: 'منبع آزمایشی',
      base_url: 'https://test.example',
      listing_visibility: 'public',
    })
    .execute();
  const makes = await owner
    .insertInto('make')
    .values([
      { slug, name_en: slug, name_fa: 'خودروساز آزمایشی' },
      { slug: bigSlug, name_en: bigSlug, name_fa: 'خودروساز بزرگ' },
    ])
    .returning(['id', 'slug'])
    .execute();
  const make = makes.find((row) => row.slug === slug);
  const bigMake = makes.find((row) => row.slug === bigSlug);
  if (make === undefined || bigMake === undefined) throw new Error('the makes were not made');
  const models = await owner
    .insertInto('model')
    .values([
      { make_id: make.id, slug: 'one', name_en: 'one', name_fa: 'مدل یک', body_type: null },
      { make_id: make.id, slug: 'two', name_en: 'two', name_fa: 'مدل دو', body_type: null },
      { make_id: bigMake.id, slug: 'big', name_en: 'big', name_fa: 'مدل بزرگ', body_type: null },
    ])
    .returning(['id', 'make_id'])
    .execute();
  const run = await owner
    .insertInto('valuation_run')
    .values({
      as_of_date: RUN_DATE,
      method_version: 97,
      status: 'succeeded',
      reference_year_sh: 1405,
      mileage_norm_km_per_year: 20_000,
      window_days: 30,
      prior_strength: 1,
      finished_at: sql<Date>`now()`,
      comparable_count: 0,
      valued_count: 0,
      rated_count: 0,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const base = { source, cityA, cityB, runId: run.id };
  try {
    const ids = await seedListings(owner, base, {
      make: make.id,
      models: models.filter((row) => row.make_id === make.id).map((row) => row.id),
      count: options.small,
      keyPrefix: 'api',
      rated: true,
    });
    const bigIds = await seedListings(owner, base, {
      make: bigMake.id,
      models: models.filter((row) => row.make_id === bigMake.id).map((row) => row.id),
      count: options.big,
      keyPrefix: 'big',
      rated: false,
    });
    return { slug, bigSlug, source, ids, bigIds, cityA, cityB, runId: run.id, runDate: RUN_DATE };
  } catch (error) {
    // The run is the latest of all: left behind, it would take every other test's ratings away.
    await removeSearchData(owner, base);
    throw error;
  }
}

/** Removes the listings, the run (which was the latest, so other tests' ratings would lose it) and the source. */
export async function removeSearchData(
  owner: Kysely<DB>,
  data: Pick<SearchTestData, 'source' | 'runId'>,
): Promise<void> {
  await owner.transaction().execute(async (trx) => {
    await sql`SET LOCAL carshenas.purge = 'on'`.execute(trx);
    await sql`DELETE FROM listing_valuation WHERE valuation_run_id = ${data.runId}`.execute(trx);
    await sql`DELETE FROM valuation_run WHERE id = ${data.runId}`.execute(trx);
    await sql`DELETE FROM listing WHERE source_id = ${data.source}`.execute(trx);
    await sql`DELETE FROM source WHERE id = ${data.source}`.execute(trx);
  });
}

/** A list row a crawl saw: no details read, so it is seen and not searchable. */
export async function addBareListing(owner: Kysely<DB>, source: string, key: string): Promise<number> {
  const row = await owner
    .insertInto('listing')
    .values({
      source_id: source,
      source_listing_key: key,
      url: `https://test.example/${key}`,
      status: 'active',
      listed_at: sql<Date>`now()`,
      last_seen_at: sql<Date>`now()`,
      catalogue_match: 'unmatched',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** The row's last sighting `hours` ago, as if no crawl had seen the listing since: a row the worker has not expired yet. */
export async function ageDocument(owner: Kysely<DB>, listingId: number, hours: number): Promise<void> {
  await owner
    .updateTable('search_document')
    .set({ last_seen_at: sql<Date>`now() - make_interval(hours => ${hours})` })
    .where('listing_id', '=', listingId)
    .execute();
}
