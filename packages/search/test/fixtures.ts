// Five listings that between them pass and fail every filter (CS-58 criterion 5), seeded on the scratch database
// `pnpm db:check` migrated, through the real tables listing_filter_row reads: the catalogue, a valuation run, photos,
// snapshots and text extractions. Names, slugs and source ids are fixed, so the cases in filter-cases.ts can name
// them; every run adds its own listings, and the tests look only at the ones this run made.
import { randomBytes } from 'node:crypto';
import { sql, type Insertable, type Kysely } from 'kysely';
import { createDatabase } from '@carshenas/db/database';
import type { DB, Listing } from '@carshenas/db/db-types';
import { YEAR, type FixtureName } from './fixture-names.ts';

/** The owner's connection to seed with, after checking the database is a scratch one. */
export async function openScratchDatabase(): Promise<Kysely<DB>> {
  const url = process.env.DATABASE_MIGRATE_URL;
  if (url === undefined)
    throw new Error('DATABASE_MIGRATE_URL is not set: run the integration tests with pnpm db:check');
  const owner = createDatabase({
    connectionString: url,
    applicationName: 'carshenas-search-tests',
    max: 2,
    onIdleError: () => undefined,
  });
  const { rows } = await sql<{ name: string }>`SELECT current_database() AS name`.execute(owner);
  const name = rows[0]?.name ?? '';
  if (!/_(check|test)$/.test(name)) {
    await owner.destroy();
    throw new Error(
      `refusing to write to ${name}: integration tests run on a *_check or *_test database (pnpm db:check)`,
    );
  }
  return owner;
}

/** The web app's own role, which the search pages read the view as. */
export function webDatabase(): Kysely<DB> {
  const url = process.env.DATABASE_URL;
  if (url === undefined)
    throw new Error('DATABASE_URL is not set: run the integration tests with pnpm db:check');
  return createDatabase({
    connectionString: url,
    applicationName: 'carshenas-search-tests-web',
    max: 2,
    onIdleError: () => undefined,
  });
}

type Catalogue = {
  readonly makeAlpha: number;
  readonly makeBeta: number;
  readonly citySedan: number;
  readonly cityHatch: number;
  readonly citySedanBase: number;
  readonly suv: number;
  readonly cityA: number;
  readonly cityB: number;
};

async function upsertMake(owner: Kysely<DB>, slug: string, nameFa: string): Promise<number> {
  const row = await owner
    .insertInto('make')
    .values({ slug, name_en: slug, name_fa: nameFa })
    .onConflict((conflict) => conflict.constraint('make_slug_unique').doUpdateSet({ name_fa: nameFa }))
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function upsertModel(
  owner: Kysely<DB>,
  makeId: number,
  slug: string,
  bodyType: string,
): Promise<number> {
  const row = await owner
    .insertInto('model')
    .values({ make_id: makeId, slug, name_en: slug, name_fa: `مدل ${slug}`, body_type: bodyType })
    .onConflict((conflict) => conflict.constraint('model_slug_unique').doUpdateSet({ body_type: bodyType }))
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function upsertCity(owner: Kysely<DB>, slug: string, nameFa: string): Promise<number> {
  const row = await owner
    .insertInto('city')
    .values({ slug, name_fa: nameFa })
    .onConflict((conflict) => conflict.constraint('city_slug_unique').doUpdateSet({ name_fa: nameFa }))
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function seedCatalogue(owner: Kysely<DB>): Promise<Catalogue> {
  // The code tables catalogue:sync keeps; a scratch database has them only if an earlier test made them.
  await sql`
    INSERT INTO body_type (code, label_fa, position)
    VALUES ('sedan', 'سدان', 1), ('hatchback', 'هاچ‌بک', 2), ('suv', 'شاسی‌بلند', 4)
    ON CONFLICT DO NOTHING`.execute(owner);
  await sql`
    INSERT INTO colour (code, label_fa, family)
    VALUES ('white', 'سفید', 'white'), ('pearl_white', 'سفید صدفی', 'white'), ('black', 'مشکی', 'black'),
           ('graphite', 'نوک‌مدادی', 'grey')
    ON CONFLICT DO NOTHING`.execute(owner);
  for (const source of ['tst_search_a', 'tst_search_b']) {
    await sql`
      INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility)
      VALUES (${source}, 'external', 'official_api', ${`منبع ${source}`}, 'https://test.example', 'public')
      ON CONFLICT DO NOTHING`.execute(owner);
  }
  const makeAlpha = await upsertMake(owner, 'tst-alpha', 'آلفا');
  const makeBeta = await upsertMake(owner, 'tst-beta', 'بتا');
  const citySedan = await upsertModel(owner, makeAlpha, 'city', 'sedan');
  const cityHatch = await upsertModel(owner, makeAlpha, 'hatch', 'hatchback');
  const suv = await upsertModel(owner, makeBeta, 'suv', 'suv');
  const trim = await owner
    .insertInto('trim')
    .values({ model_id: citySedan, slug: 'base', name_en: 'base', name_fa: 'مدل city تیپ پایه' })
    .onConflict((conflict) => conflict.constraint('trim_slug_unique').doUpdateSet({ name_en: 'base' }))
    .returning('id')
    .executeTakeFirstOrThrow();
  // Engine volume and origin (CS-99): the sedan model is a domestic 1600 whose base trim is a 2000; the suv is an
  // imported 3000; the hatch and the unmatched listing have none.
  for (const [modelId, trimId, volume, origin] of [
    [citySedan, null, 1600, 'domestic'],
    [citySedan, trim.id, 2000, null],
    [suv, null, 3000, 'imported'],
  ] as const) {
    await sql`
      INSERT INTO model_spec (model_id, trim_id, engine_volume_cc, car_origin, source)
      VALUES (${modelId}, ${trimId}, ${volume}, ${origin}, 'seed')
      ON CONFLICT ON CONSTRAINT model_spec_once_per_scope_unique
      DO UPDATE SET engine_volume_cc = excluded.engine_volume_cc, car_origin = excluded.car_origin`.execute(owner);
  }
  return {
    makeAlpha,
    makeBeta,
    citySedan,
    cityHatch,
    citySedanBase: trim.id,
    suv,
    cityA: await upsertCity(owner, 'tst-city-a', 'شهر الف'),
    cityB: await upsertCity(owner, 'tst-city-b', 'شهر ب'),
  };
}

type Facts = Readonly<
  Partial<
    Record<
      'paint' | 'replaced' | 'chassis' | 'accident' | 'installment' | 'swap' | 'ride_hailing' | 'plate',
      string
    >
  >
>;

async function listing(
  owner: Kysely<DB>,
  values: Omit<
    Insertable<Listing>,
    'source_listing_key' | 'url' | 'status' | 'listed_at' | 'last_seen_at'
  > & { listedHoursAgo: number },
): Promise<number> {
  const { listedHoursAgo, ...columns } = values;
  const key = `s${randomBytes(6).toString('hex')}`;
  const row = await owner
    .insertInto('listing')
    .values({
      ...columns,
      source_listing_key: key,
      url: `https://test.example/${key}`,
      status: 'active',
      listed_at: sql<Date>`now() - make_interval(hours => ${listedHoursAgo})`,
      last_seen_at: sql<Date>`now()`,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** A snapshot of the listing, first fetched `hoursAgo`, read by an extraction with these accepted facts (if any). */
async function snapshotWithFacts(
  owner: Kysely<DB>,
  listingId: number,
  hoursAgo: number,
  facts: Facts | undefined,
): Promise<void> {
  const snapshot = await owner
    .insertInto('snapshot')
    .values({
      listing_id: listingId,
      first_fetched_at: sql<Date>`now() - make_interval(hours => ${hoursAgo})`,
      url: 'https://test.example/api',
      canonical_version: 1,
      payload: { fixture: randomBytes(8).toString('hex') },
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  if (facts === undefined) return;
  const answer = await owner
    .insertInto('ai_answer')
    .values({
      cache_key: randomBytes(32),
      task: 'listing.facts',
      prompt_version: '0123456789abcdef',
      provider: 'google',
      model: 'test-model',
      answering_model: 'test-model',
      output: { ...facts },
      cost_usd_micros: 0,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const extraction = await owner
    .insertInto('extraction')
    .values({
      snapshot_id: snapshot.id,
      listing_id: listingId,
      ai_answer_id: answer.id,
      status: 'usable',
      hold_reasons: [],
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await owner
    .insertInto('extraction_field')
    .values(
      Object.entries(facts).map(([field, value]) => ({
        extraction_id: extraction.id,
        field,
        value,
        evidence: 'متن آزمایشی',
        confidence: '1',
        threshold: '0.75',
        status: 'accepted',
      })),
    )
    .execute();
}

/** Listings that only give a model its place in the popularity ranking. */
async function fillers(owner: Kysely<DB>, makeId: number, modelId: number, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await listing(owner, {
      source_id: 'tst_search_a',
      make_id: makeId,
      model_id: modelId,
      catalogue_match: 'model',
      listedHoursAgo: 100,
    });
  }
}

export type Fixtures = Readonly<Record<FixtureName, number>>;

/**
 * The five listings:
 * - A: clean and sound, rated great, cheap, recent, with photos.
 * - B: repainted around with an accident and a replaced part in its text, automatic, dual-fuel, rated good.
 * - C: accident-damaged, replaced engine, a free-zone plate, a rare model, negotiable, unrated.
 * - D: nothing declared by the site but unpainted and sound in its text, a new car, rated fair.
 * - E: unmatched, no year or mileage, rated overpriced; an older snapshot's reading (full paint, an accident) that a
 *   newer, unread snapshot must not inherit.
 */
export async function seedFixtures(owner: Kysely<DB>): Promise<Fixtures> {
  const c = await seedCatalogue(owner);
  const A = await listing(owner, {
    source_id: 'tst_search_a',
    make_id: c.makeAlpha,
    model_id: c.citySedan,
    trim_id: c.citySedanBase,
    catalogue_match: 'trim',
    model_year_written: 'sh',
    model_year_sh: YEAR - 3,
    mileage_km: 20_000,
    price_type: 'asking',
    asking_price_toman: 800_000_000,
    gearbox: 'manual',
    fuel: 'petrol',
    colour: 'white',
    city_id: c.cityA,
    district_fa: 'ونک',
    seller_type: 'private',
    insurance_months_left: 10,
    body_condition: 'intact',
    engine_condition: 'sound',
    gearbox_condition: 'sound',
    front_chassis_condition: 'intact',
    rear_chassis_condition: 'intact',
    listedHoursAgo: 2,
  });
  const B = await listing(owner, {
    source_id: 'tst_search_b',
    make_id: c.makeAlpha,
    model_id: c.citySedan,
    catalogue_match: 'model',
    model_year_written: 'sh',
    model_year_sh: YEAR - 8,
    mileage_km: 180_000,
    price_type: 'asking',
    asking_price_toman: 1_200_000_000,
    gearbox: 'automatic',
    fuel: 'dual_fuel_factory',
    colour: 'pearl_white',
    city_id: c.cityA,
    district_fa: 'پونک',
    seller_type: 'dealer',
    insurance_months_left: 3,
    body_condition: 'repainted_around',
    engine_condition: 'sound',
    gearbox_condition: 'sound',
    front_chassis_condition: 'intact',
    rear_chassis_condition: 'intact',
    listedHoursAgo: 5 * 24,
  });
  const C = await listing(owner, {
    source_id: 'tst_search_a',
    make_id: c.makeBeta,
    model_id: c.suv,
    catalogue_match: 'model',
    model_year_written: 'sh',
    model_year_sh: YEAR - 1,
    mileage_km: 10_000,
    price_type: 'negotiable',
    gearbox: 'automatic',
    fuel: 'hybrid',
    colour: 'black',
    city_id: c.cityB,
    seller_type: 'private',
    body_condition: 'accident_damaged',
    engine_condition: 'replaced',
    gearbox_condition: 'sound',
    front_chassis_condition: 'damaged',
    rear_chassis_condition: 'intact',
    listedHoursAgo: 20 * 24,
  });
  const D = await listing(owner, {
    source_id: 'tst_search_a',
    make_id: c.makeAlpha,
    model_id: c.cityHatch,
    catalogue_match: 'model',
    model_year_written: 'sh',
    model_year_sh: YEAR,
    mileage_km: 5_000,
    price_type: 'asking',
    asking_price_toman: 950_000_000,
    gearbox: 'manual',
    fuel: 'petrol',
    colour: 'graphite',
    city_id: c.cityA,
    seller_type: 'private',
    accepts_swap: true,
    accepts_installments: true,
    listedHoursAgo: 30,
  });
  const E = await listing(owner, {
    source_id: 'tst_search_a',
    catalogue_match: 'unmatched',
    price_type: 'asking',
    asking_price_toman: 400_000_000,
    seller_type: 'dealer',
    front_chassis_condition: 'repainted',
    rear_chassis_condition: 'intact',
    listedHoursAgo: 60 * 24,
  });

  await snapshotWithFacts(owner, A, 3, { accident: 'none', replaced: 'none', swap: 'yes' });
  await snapshotWithFacts(owner, B, 3, {
    accident: 'had_accident',
    replaced: 'some',
    ride_hailing: 'used',
    installment: 'yes',
  });
  await snapshotWithFacts(owner, C, 3, { plate: 'free_zone', swap: 'no' });
  await snapshotWithFacts(owner, D, 3, { paint: 'none', accident: 'none', chassis: 'intact' });
  await snapshotWithFacts(owner, E, 48, { paint: 'full', accident: 'had_accident' });
  await snapshotWithFacts(owner, E, 1, undefined);

  await owner
    .insertInto('listing_photo')
    .values([
      { listing_id: A, position: 1, url: 'https://test.example/a.jpg' },
      { listing_id: C, position: 1, url: 'https://test.example/c.jpg' },
    ])
    .execute();

  // Popularity: the alpha models lead the market, beta's suv trails sixteen others.
  await fillers(owner, c.makeAlpha, c.citySedan, 40);
  await fillers(owner, c.makeAlpha, c.cityHatch, 40);
  for (let i = 0; i < 16; i++) {
    const filler = await upsertModel(owner, c.makeBeta, `filler-${String(i)}`, 'sedan');
    await fillers(owner, c.makeBeta, filler, 3);
  }

  // The latest succeeded valuation: dated far ahead, so it is the latest whatever other tests ran; replaced each run.
  await sql`DELETE FROM valuation_run WHERE as_of_date = '2099-12-30'`.execute(owner);
  const run = await owner
    .insertInto('valuation_run')
    .values({
      as_of_date: '2099-12-30',
      method_version: 1,
      status: 'succeeded',
      reference_year_sh: YEAR,
      mileage_norm_km_per_year: 20_000,
      window_days: 60,
      prior_strength: 8,
      comparable_count: 0,
      valued_count: 4,
      rated_count: 4,
      finished_at: sql<Date>`now()`,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const rated = (
    listingId: number,
    asking: number,
    market: number,
    gap: string,
    rating: 'great' | 'good' | 'fair' | 'overpriced',
  ) => ({
    valuation_run_id: run.id,
    listing_id: listingId,
    asking_price_toman: asking,
    market_value_toman: market,
    price_gap_pct: gap,
    deal_rating: rating,
  });
  await owner
    .insertInto('listing_valuation')
    .values([
      rated(A, 800_000_000, 910_000_000, '-12.09', 'great'),
      rated(B, 1_200_000_000, 1_280_000_000, '-6.25', 'good'),
      rated(D, 950_000_000, 940_000_000, '1.06', 'fair'),
      rated(E, 400_000_000, 330_000_000, '21.21', 'overpriced'),
      { valuation_run_id: run.id, listing_id: C, no_rating_reason: 'no_asking_price' },
    ])
    .execute();

  return { A, B, C, D, E };
}
