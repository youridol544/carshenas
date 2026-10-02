// Seeds a scratch database with a synthetic search table of any size, with the skew of the real market: a handful of
// models carrying most listings, hybrid and electric cars in a fraction of a percent, a tenth of the cars automatic, a
// city that is Tehran for 98.5 % of them, a third of the cars rated. For measuring how the search's queries scale
// (docs/evidence/search-api/2026-10-02/): `pnpm --filter @carshenas/search seed:scale 100000`. It refuses any database
// whose name does not end in _test or _check, and sends no request anywhere.
import { sql } from 'kysely';
import { createDatabase } from '@carshenas/db/database';
import {
  analyzeSearchTables,
  buildSearchDocuments,
  recordBuildEvent,
  refreshFacetCounts,
  refreshSearchWords,
  tryLockSearchBuild,
} from '../src/document.ts';

const count = Number(process.argv[2] ?? '25000');
const url = process.env.DATABASE_MIGRATE_URL;
if (url === undefined || !Number.isInteger(count) || count < 1) {
  process.stderr.write('usage: seed-scale.ts <count>, with DATABASE_MIGRATE_URL naming a *_test database\n');
  process.exit(2);
}
const owner = createDatabase({
  connectionString: url,
  applicationName: 'carshenas-search-scale',
  max: 2,
  onIdleError: () => undefined,
});
const { rows: names } = await sql<{ name: string }>`SELECT current_database() AS name`.execute(owner);
if (!/_(check|test)$/.test(names[0]?.name ?? '')) {
  process.stderr.write(
    `refusing to write to ${names[0]?.name ?? '?'}: a scratch database ends in _test or _check\n`,
  );
  process.exit(2);
}

const SOURCE = 'tst_search_scale';
const started = performance.now();
// A run before this one is replaced: the same database serves tables of different sizes.
await owner.transaction().execute(async (trx) => {
  await sql`SET LOCAL carshenas.purge = 'on'`.execute(trx);
  await sql`DELETE FROM listing_valuation WHERE valuation_run_id IN (SELECT id FROM valuation_run WHERE method_version = 96)`.execute(
    trx,
  );
  await sql`DELETE FROM valuation_run WHERE method_version = 96`.execute(trx);
  await sql`DELETE FROM listing WHERE source_id = ${SOURCE}`.execute(trx);
});
await sql`SELECT setseed(0.59)`.execute(owner);
await sql`
  INSERT INTO body_type (code, label_fa, position)
  VALUES ('sedan', 'سدان', 1), ('hatchback', 'هاچ‌بک', 2), ('suv', 'شاسی‌بلند', 4), ('crossover', 'کراس‌اوور', 3)
  ON CONFLICT DO NOTHING`.execute(owner);
await sql`
  INSERT INTO colour (code, label_fa, family)
  VALUES ('white', 'سفید', 'white'), ('black', 'مشکی', 'black'), ('grey', 'خاکستری', 'grey'),
         ('silver', 'نقره‌ای', 'silver'), ('blue', 'آبی', 'blue'), ('red', 'قرمز', 'red'), ('gold', 'طلایی', 'gold'),
         ('purple', 'بنفش', 'purple')
  ON CONFLICT DO NOTHING`.execute(owner);
await sql`
  INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility)
  VALUES (${SOURCE}, 'external', 'official_api', 'منبع مقیاس', 'https://test.example', 'public')
  ON CONFLICT DO NOTHING`.execute(owner);
const make = await owner
  .insertInto('make')
  .values({ slug: 'scale', name_en: 'scale', name_fa: 'مقیاس' })
  .onConflict((conflict) => conflict.constraint('make_slug_unique').doUpdateSet({ name_fa: 'مقیاس' }))
  .returning('id')
  .executeTakeFirstOrThrow();
// A second make with one model: a rare make and a rare model (0.3 % of the listings).
const tiny = await owner
  .insertInto('make')
  .values({ slug: 'tiny', name_en: 'tiny', name_fa: 'کوچک' })
  .onConflict((conflict) => conflict.constraint('make_slug_unique').doUpdateSet({ name_fa: 'کوچک' }))
  .returning('id')
  .executeTakeFirstOrThrow();
const models: Record<string, number> = {};
const makeOf: Record<string, number> = { one: make.id, two: make.id, three: make.id, four: tiny.id };
for (const [slug, body] of [
  ['one', 'sedan'],
  ['two', 'hatchback'],
  ['three', 'suv'],
  ['four', 'crossover'],
] as const) {
  const row = await owner
    .insertInto('model')
    .values({
      make_id: makeOf[slug] ?? make.id,
      slug,
      name_en: slug,
      name_fa: `مدل ${slug}`,
      body_type: body,
    })
    .onConflict((conflict) => conflict.constraint('model_slug_unique').doUpdateSet({ body_type: body }))
    .returning('id')
    .executeTakeFirstOrThrow();
  models[slug] = row.id;
}
// Four trims a model, one of them rare (0.1 %): the filter on a trim is a filter on a rare value.
const trims: Record<string, number[]> = {};
for (const [slug, modelId] of Object.entries(models)) {
  trims[slug] = [];
  for (const trim of ['base', 'plus', 'sport', 'rare']) {
    const row = await owner
      .insertInto('trim')
      .values({ model_id: modelId, slug: trim, name_en: trim, name_fa: `${trim} ${slug}` })
      .onConflict((conflict) => conflict.constraint('trim_slug_unique').doUpdateSet({ name_en: trim }))
      .returning('id')
      .executeTakeFirstOrThrow();
    trims[slug].push(row.id);
  }
}
await sql`
  INSERT INTO city (slug, name_fa)
  SELECT 'scale-city-' || g, 'شهر ' || g FROM generate_series(0, 40) g
  ON CONFLICT DO NOTHING`.execute(owner);
await sql`INSERT INTO city (slug, name_fa) VALUES ('tehran', 'تهران') ON CONFLICT DO NOTHING`.execute(owner);
const run = await owner
  .insertInto('valuation_run')
  .values({
    as_of_date: '2099-12-29',
    method_version: 96,
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

await sql`
  INSERT INTO listing (
    source_id, source_listing_key, url, status, listed_at, last_seen_at, title, make_id, model_id, trim_id,
    catalogue_match, district_fa, model_year_written, model_year_sh, mileage_km, price_type, asking_price_toman, gearbox, fuel, colour, city_id,
    seller_type, engine_condition, gearbox_condition, front_chassis_condition, rear_chassis_condition, body_condition)
  SELECT ${SOURCE}, 'scale' || r.g, 'https://test.example/scale/' || r.g, 'active',
         now() - make_interval(hours => (r.listed * 24 * 30)::int),
         now() - make_interval(mins => (r.seen * 2880)::int),
         'خودروی ' || r.g || CASE WHEN r.words < 0.5 THEN ' سالم' ELSE '' END || CASE WHEN r.words < 0.2 THEN ' تمیز' ELSE '' END,
         CASE WHEN r.body < 0.997 THEN ${make.id}::bigint ELSE ${tiny.id}::bigint END,
         CASE WHEN r.body < 0.45 THEN ${models.one}::bigint WHEN r.body < 0.95 THEN ${models.two}::bigint
              WHEN r.body < 0.997 THEN ${models.three}::bigint ELSE ${models.four}::bigint END,
         (SELECT t.id FROM trim t WHERE t.model_id = CASE WHEN r.body < 0.45 THEN ${models.one}::bigint
              WHEN r.body < 0.95 THEN ${models.two}::bigint WHEN r.body < 0.997 THEN ${models.three}::bigint
              ELSE ${models.four}::bigint END
            AND t.slug = CASE WHEN r.trim < 0.6 THEN 'base' WHEN r.trim < 0.9 THEN 'plus' WHEN r.trim < 0.999 THEN 'sport'
                              ELSE 'rare' END),
         'trim',
         -- Eighty districts of Tehran, a few of them most of the listings.
         CASE WHEN r.city < 0.985 THEN 'محله ' || (80 * r.district * r.district * r.district)::int END,
         CASE WHEN r.year < 0.04 THEN NULL ELSE 'sh' END,
         CASE WHEN r.year < 0.04 THEN NULL ELSE 1380 + (r.year * 25)::int END,
         CASE WHEN r.mileage < 0.1 THEN NULL ELSE (r.mileage * r.mileage * 400000)::int END,
         CASE WHEN r.price < 0.1 THEN 'negotiable' ELSE 'asking' END,
         CASE WHEN r.price < 0.1 THEN NULL ELSE (200000000 + r.price * r.price * 2800000000)::bigint END,
         CASE WHEN r.gearbox < 0.8 THEN 'manual' WHEN r.gearbox < 0.96 THEN 'automatic' END,
         CASE WHEN r.fuel < 0.95 THEN 'petrol' WHEN r.fuel < 0.98 THEN 'dual_fuel_factory'
              WHEN r.fuel < 0.9965 THEN 'hybrid' WHEN r.fuel < 0.9993 THEN 'dual_fuel_aftermarket'
              WHEN r.fuel < 0.9998 THEN 'electric' ELSE 'plug_in_hybrid' END,
         CASE WHEN r.colour < 0.5 THEN 'white' WHEN r.colour < 0.62 THEN 'black' WHEN r.colour < 0.74 THEN 'grey'
              WHEN r.colour < 0.82 THEN 'silver' WHEN r.colour < 0.87 THEN 'blue' WHEN r.colour < 0.9 THEN 'red'
              WHEN r.colour < 0.92 THEN 'gold' WHEN r.colour < 0.9205 THEN 'purple' END,
         (SELECT c.id FROM city c WHERE c.slug = CASE WHEN r.city < 0.985 THEN 'tehran'
                                                      ELSE 'scale-city-' || (r.city * 1000)::int % 41 END),
         CASE WHEN r.seller < 0.81 THEN 'private' ELSE 'dealer' END,
         CASE WHEN r.engine < 0.94 THEN 'sound' WHEN r.engine < 0.949 THEN 'replaced' WHEN r.engine < 0.955 THEN 'needs_repair' END,
         CASE WHEN r.engine < 0.9 THEN 'sound' END,
         CASE WHEN r.chassis < 0.005 THEN 'damaged' WHEN r.chassis < 0.9 THEN 'intact' END,
         CASE WHEN r.chassis < 0.9 THEN 'intact' END,
         CASE WHEN r.body_cond < 0.002 THEN 'salvage' WHEN r.body_cond < 0.02 THEN 'accident_damaged'
              WHEN r.body_cond < 0.12 THEN 'minor_scratches' END
  FROM (
    -- The randoms are in the row source, so each row draws its own (in a lateral subquery without a FROM, PostgreSQL
    -- draws once and every row is the same).
    SELECT g, random() AS listed, random() AS seen, random() AS words, random() AS body, random() AS year,
           random() AS mileage, random() AS price, random() AS gearbox, random() AS fuel, random() AS colour,
           random() AS city, random() AS seller, random() AS engine, random() AS chassis, random() AS body_cond, random() AS trim, random() AS district
    FROM generate_series(1, ${count}::int) g
  ) r`.execute(owner);
// A third are rated, gaps around zero.
await sql`
  INSERT INTO listing_valuation (
    valuation_run_id, listing_id, asking_price_toman, market_value_toman, price_gap_pct, deal_rating)
  SELECT ${run.id}::bigint, g.id, g.asking_price_toman, round(g.asking_price_toman / (1 + g.gap / 100))::bigint, g.gap,
         CASE WHEN g.gap <= -10 THEN 'great' WHEN g.gap <= -3 THEN 'good' WHEN g.gap <= 3 THEN 'fair'
              WHEN g.gap <= 10 THEN 'high' ELSE 'overpriced' END::deal_rating
  FROM (
    SELECT l.id, l.asking_price_toman, round(((random() + random() + random() - 1.5) * 24)::numeric, 1) AS gap
    FROM listing l
    WHERE l.source_id = ${SOURCE} AND l.asking_price_toman IS NOT NULL AND random() < 0.35
  ) g`.execute(owner);
const seeded = performance.now();

let written = 0;
await owner.transaction().execute(async (trx) => {
  if (!(await tryLockSearchBuild(trx))) throw new Error('a build holds the lock');
  written = (await buildSearchDocuments(trx, { scope: 'all' })).written;
});
await owner.transaction().execute(async (trx) => {
  await refreshFacetCounts(trx);
  await refreshSearchWords(trx);
  await analyzeSearchTables(trx);
  await recordBuildEvent(trx, 'full_rebuild');
});
// What the text says, written straight into the table: a fifth of the listings state an accident or none, a tenth a
// replaced part, a few a ride-hailing use or a free-zone plate. (The facts come from extractions in the real table.)
await sql`
  UPDATE search_document SET
    accident = CASE WHEN random() < 0.03 THEN 'had_accident' WHEN random() < 0.2 THEN 'none' END,
    replaced_parts = CASE WHEN random() < 0.02 THEN 'some' WHEN random() < 0.15 THEN 'none' END,
    ride_hailing = CASE WHEN random() < 0.004 THEN 'used' WHEN random() < 0.05 THEN 'not_used' END,
    plate = CASE WHEN random() < 0.003 THEN 'free_zone' WHEN random() < 0.1 THEN 'national' END,
    offers_installments = CASE WHEN random() < 0.02 THEN true WHEN random() < 0.2 THEN false END,
    offers_swap = CASE WHEN random() < 0.1 THEN true WHEN random() < 0.5 THEN false END,
    paint_free = CASE WHEN random() < 0.4 THEN true WHEN random() < 0.1 THEN false END`.execute(owner);
await sql`ANALYZE search_document`.execute(owner);
const built = performance.now();
const { rows } = await sql<{ rows: number; size: string; heap: string }>`
  SELECT (SELECT count(*) FROM search_document)::integer AS rows,
         pg_size_pretty(pg_total_relation_size('search_document')) AS size,
         pg_size_pretty(pg_relation_size('search_document')) AS heap`.execute(owner);
process.stdout.write(
  `${JSON.stringify({ listings: count, rows: rows[0]?.rows, written, tableAndIndexes: rows[0]?.size, heap: rows[0]?.heap, seedSeconds: Math.round((seeded - started) / 100) / 10, buildSeconds: Math.round((built - seeded) / 100) / 10 })}\n`,
);
await owner.destroy();
