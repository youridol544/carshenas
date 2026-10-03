import 'server-only';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';

// For the model page's integration tests (*.db.test.ts, run by `pnpm db:check` on a scratch database it has just
// migrated): the rows the owner sets up for one model (CS-67): a make with two models, two trims on the first, listings of
// two model years in the search table, and a valuation history of two days (each also run a second time by another
// method on the first day, so the page must count it once). Everything is under unique names. The code under test reads
// them through the app's own pool, as carshenas_web.

export type ModelTestData = {
  readonly makeSlug: string;
  readonly modelSlug: string;
  readonly otherSlug: string;
  readonly modelId: number;
  /** The first day of the history and the second, ISO. */
  readonly days: readonly [string, string];
  readonly trimKeys: readonly [string, string];
};

type Row = {
  readonly year: number;
  readonly price: number;
  readonly trim: 0 | 1 | null;
  readonly seenHoursAgo: number;
  readonly gap: number | null;
  readonly gearbox: 'manual' | 'automatic';
  readonly seller: 'private' | 'dealer';
  readonly paintFree: boolean | null;
};

/** Ten listings of 1400 (100 to 190 million), three of 1399, one stale (seen three days ago) and one of no trim. */
function rows(): Row[] {
  const made: Row[] = [];
  for (let n = 0; n < 10; n += 1) {
    made.push({
      year: 1400,
      price: 100_000_000 + n * 10_000_000,
      trim: n % 2 === 0 ? 0 : 1,
      seenHoursAgo: 1,
      gap: n === 0 ? -12 : n === 9 ? 12 : 0,
      gearbox: n < 3 ? 'automatic' : 'manual',
      seller: n % 2 === 0 ? 'private' : 'dealer',
      paintFree: n < 4 ? true : n < 6 ? false : null,
    });
  }
  for (let n = 0; n < 3; n += 1) {
    made.push({
      year: 1399,
      price: 80_000_000 + n * 10_000_000,
      trim: 0,
      seenHoursAgo: 2,
      gap: null,
      gearbox: 'manual',
      seller: 'private',
      paintFree: null,
    });
  }
  made.push({
    year: 1400,
    price: 500_000_000,
    trim: 1,
    seenHoursAgo: 72,
    gap: 0,
    gearbox: 'manual',
    seller: 'private',
    paintFree: null,
  });
  made.push({
    year: 1400,
    price: 150_000_000,
    trim: null,
    seenHoursAgo: 1,
    gap: null,
    gearbox: 'manual',
    seller: 'private',
    paintFree: null,
  });
  return made;
}

function ratingOf(gap: number): 'great' | 'good' | 'fair' | 'high' | 'overpriced' {
  if (gap <= -10) return 'great';
  if (gap <= -4) return 'good';
  if (gap < 4) return 'fair';
  if (gap < 10) return 'high';
  return 'overpriced';
}

export async function seedModelData(owner: Kysely<DB>, suffix: string): Promise<ModelTestData> {
  const makeSlug = `tst-mp-${suffix}`;
  const modelSlug = 'main';
  const otherSlug = 'other';
  const source = `tst_mp_${suffix}`;
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
  // The scratch database has no catalogue sync: the body type the model points at must exist.
  await sql`
    INSERT INTO body_type (code, label_fa, position)
    SELECT 'sedan', 'سدان', coalesce(max(position), 0) + 1 FROM body_type
    ON CONFLICT (code) DO NOTHING`.execute(owner);
  const make = await owner
    .insertInto('make')
    .values({ slug: makeSlug, name_en: makeSlug, name_fa: 'سازنده‌ی مدل آزمایشی' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const models = await owner
    .insertInto('model')
    .values([
      { make_id: make.id, slug: modelSlug, name_en: 'main', name_fa: 'مدل اصلی', body_type: 'sedan' },
      { make_id: make.id, slug: otherSlug, name_en: 'other', name_fa: 'مدل دیگر', body_type: null },
    ])
    .returning(['id', 'slug'])
    .execute();
  const main = models.find((model) => model.slug === modelSlug);
  const other = models.find((model) => model.slug === otherSlug);
  if (main === undefined || other === undefined) throw new Error('the models were not made');
  const trims = await owner
    .insertInto('trim')
    .values([
      { model_id: main.id, slug: 'a', name_en: 'a', name_fa: 'تیپ الف' },
      { model_id: main.id, slug: 'b', name_en: 'b', name_fa: 'تیپ ب' },
    ])
    .returning(['id', 'slug'])
    .execute();
  const trimIds = [
    trims.find((trim) => trim.slug === 'a')?.id,
    trims.find((trim) => trim.slug === 'b')?.id,
  ] as const;
  if (trimIds[0] === undefined || trimIds[1] === undefined) throw new Error('the trims were not made');

  const days = ['2098-03-01', '2098-03-02'] as const;
  const runs: number[] = [];
  for (const [index, version] of [
    [0, 91],
    [1, 91],
    [0, 92],
  ] as const) {
    const run = await owner
      .insertInto('valuation_run')
      .values({
        as_of_date: days[index],
        method_version: version,
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
    runs.push(run.id);
  }
  const [firstRun, secondRun, rerun] = runs;
  if (firstRun === undefined || secondRun === undefined || rerun === undefined) throw new Error('no runs');

  const made = rows();
  for (const [index, row] of made.entries()) {
    const key = `t-${suffix}-${String(index)}`;
    const trimId = row.trim === null ? null : trimIds[row.trim];
    const { rows: inserted } = await sql<{ id: number }>`
      INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at, title, make_id, model_id,
                           trim_id, catalogue_match, model_year_written, model_year_sh, mileage_km, price_type,
                           asking_price_toman, gearbox, fuel, seller_type)
      VALUES (${source}, ${key}, ${`https://test.example/${key}`}, 'active', now() - interval '3 days',
              now() - make_interval(hours => ${row.seenHoursAgo}), ${`آگهی ${String(index)}`}, ${make.id}, ${main.id},
              ${trimId}, ${trimId === null ? 'model' : 'trim'}, 'sh', ${row.year}, ${50_000 + index * 1_000}, 'asking',
              ${row.price}, ${row.gearbox}, 'petrol', ${row.seller})
      RETURNING id`.execute(owner);
    const id = inserted[0]?.id;
    if (id === undefined) throw new Error('the listing has no id');
    const value = Math.round(row.gap === null ? row.price : row.price / (1 + row.gap / 100));
    await sql`
      INSERT INTO search_document (listing_id, source_id, listed_at, last_seen_at, make_id, model_id, trim_id, make_key,
                                   model_key, trim_key, body_type, model_year_sh, mileage_km, km_per_year, price_type,
                                   asking_price_toman, market_value_toman, price_gap_pct, deal_rating, valued_on, gearbox,
                                   fuel, seller_type, paint_free, has_photo, photo_count, model_rank, search_text,
                                   refreshed_at)
      SELECT l.id, l.source_id, l.listed_at, l.last_seen_at, l.make_id, l.model_id, l.trim_id, ${makeSlug},
             ${`${makeSlug}.${modelSlug}`}, ${trimId === null ? null : `${makeSlug}.${modelSlug}.${row.trim === 0 ? 'a' : 'b'}`},
             'sedan', l.model_year_sh, l.mileage_km, 10000, l.price_type, l.asking_price_toman,
             ${row.gap === null ? null : value}::bigint, ${row.gap}::numeric,
             ${row.gap === null ? null : ratingOf(row.gap)}::deal_rating, ${row.gap === null ? null : days[1]}::date,
             l.gearbox, l.fuel, l.seller_type, ${row.paintFree}::boolean, false, 0, 3, l.title, now()
      FROM listing l WHERE l.id = ${id}`.execute(owner);
    // The history: every 1400 listing but the stale one is rated on both days (the rerun by the other method on the
    // first day carries a different price, which must not be counted); the 1399 listings only on the second day.
    if (row.seenHoursAgo < 72 && row.trim !== null) {
      const onFirst = row.year === 1400;
      const entries: [number, number][] = [[secondRun, 1.05]];
      if (onFirst) entries.push([firstRun, 1], [rerun, 2]);
      for (const [run, factor] of entries) {
        const asking = Math.round(row.price * factor);
        const marketValue = Math.round(value * factor);
        await sql`
          INSERT INTO listing_valuation (valuation_run_id, listing_id, asking_price_toman, market_value_toman,
                                         price_gap_pct, deal_rating)
          VALUES (${run}, ${id}, ${asking}, ${marketValue}, 0, 'fair')`.execute(owner);
      }
    }
  }
  return {
    makeSlug,
    modelSlug,
    otherSlug,
    modelId: main.id,
    days,
    trimKeys: [`${makeSlug}.${modelSlug}.a`, `${makeSlug}.${modelSlug}.b`],
  };
}

/** Removes everything the seed made, in the order its foreign keys allow. */
export async function removeModelData(owner: Kysely<DB>, suffix: string): Promise<void> {
  const makeSlug = `tst-mp-${suffix}`;
  const source = `tst_mp_${suffix}`;
  await sql`DELETE FROM valuation_run WHERE as_of_date IN ('2098-03-01', '2098-03-02') AND method_version IN (91, 92)`.execute(
    owner,
  );
  await sql`DELETE FROM listing WHERE source_id = ${source}`.execute(owner);
  await sql`DELETE FROM "trim" WHERE model_id IN (SELECT m.id FROM model m JOIN make mk ON mk.id = m.make_id WHERE mk.slug = ${makeSlug})`.execute(
    owner,
  );
  await sql`DELETE FROM model WHERE make_id IN (SELECT id FROM make WHERE slug = ${makeSlug})`.execute(owner);
  await sql`DELETE FROM make WHERE slug = ${makeSlug}`.execute(owner);
  await sql`DELETE FROM source WHERE id = ${source}`.execute(owner);
}
