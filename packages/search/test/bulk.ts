// Many searchable listings with the shape of the real ones, for the tests of keyset paging, text and depth (CS-59):
// ties on every sort column (a listed_at shared by dozens, a price gap shared by hundreds), rows without a value on
// each nullable one (a third are rated, a ninth negotiable and so without a price, a tenth without mileage, a
// seventeenth without a year), two cities, and titles that carry common and rare words. Made by one statement of
// generate_series, under a source of its own that deleteBulk removes.
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';

export type BulkOptions = {
  /** The source the listings belong to: `tst_` and a name, so a test never meets another's. */
  readonly source: string;
  readonly count: number;
  readonly makeId: number;
  readonly modelId: number;
  readonly cityA: number;
  readonly cityB: number;
  /** A valuation run (succeeded, the latest) the rated listings take their rating from. */
  readonly valuationRunId: number;
  /** A word every title carries, so a test has a common word to misspell. */
  readonly commonWord?: string;
};

/** The listings of the source, by id. */
export async function seedBulk(owner: Kysely<DB>, options: BulkOptions): Promise<number[]> {
  await sql`
    INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility)
    VALUES (${options.source}, 'external', 'official_api', ${`منبع ${options.source}`}, 'https://test.example', 'public')
    ON CONFLICT DO NOTHING`.execute(owner);
  const common = options.commonWord ?? 'کارکرده';
  const { rows } = await sql<{ id: number }>`
    INSERT INTO listing (
      source_id, source_listing_key, url, status, listed_at, last_seen_at, title, make_id, model_id,
      catalogue_match, model_year_written, model_year_sh, mileage_km, price_type, asking_price_toman, gearbox, fuel,
      city_id, seller_type)
    SELECT ${options.source}, 'bulk' || g, 'https://test.example/' || ${options.source} || '/' || g, 'active',
           date_trunc('hour', now()) - (g % 500) * interval '1 hour',
           now() - (g % 40) * interval '1 minute',
           ${common} || ' ' || g,
           ${options.makeId}::bigint, ${options.modelId}::bigint, 'model',
           CASE WHEN g % 17 = 0 THEN NULL ELSE 'sh' END,
           CASE WHEN g % 17 = 0 THEN NULL ELSE 1380 + g % 25 END,
           CASE WHEN g % 11 = 0 THEN NULL ELSE (g * 313 % 400) * 1000 END,
           CASE WHEN g % 9 = 0 THEN 'negotiable' ELSE 'asking' END,
           CASE WHEN g % 9 = 0 THEN NULL ELSE 300000000 + (g * 7919 % 900) * 1000000 END,
           CASE WHEN g % 5 = 0 THEN 'automatic' ELSE 'manual' END,
           CASE WHEN g % 40 = 0 THEN 'hybrid' ELSE 'petrol' END,
           CASE WHEN g % 7 = 0 THEN ${options.cityB}::bigint ELSE ${options.cityA}::bigint END,
           CASE WHEN g % 4 = 0 THEN 'dealer' ELSE 'private' END
    FROM generate_series(1, ${options.count}) g
    RETURNING id`.execute(owner);
  // Rated: a third of the listings that state a price, with gaps shared by many (-15 to +15 in halves).
  await sql`
    INSERT INTO listing_valuation (
      valuation_run_id, listing_id, asking_price_toman, market_value_toman, price_gap_pct, deal_rating)
    SELECT ${options.valuationRunId}::bigint, g.id, g.asking_price_toman,
           round(g.asking_price_toman / (1 + g.gap / 100))::bigint, g.gap,
           CASE WHEN g.gap <= -10 THEN 'great' WHEN g.gap <= -3 THEN 'good' WHEN g.gap <= 3 THEN 'fair'
                WHEN g.gap <= 10 THEN 'high' ELSE 'overpriced' END::deal_rating
    FROM (
      SELECT l.id, l.asking_price_toman, ((substr(l.source_listing_key, 5)::int * 37) % 61 - 30) / 2.0 AS gap
      FROM listing l
      WHERE l.source_id = ${options.source} AND l.asking_price_toman IS NOT NULL
        AND substr(l.source_listing_key, 5)::int % 3 = 0
    ) g`.execute(owner);
  return rows.map((row) => row.id);
}

/** Removes what seedBulk made: the valuations, the listings and the source. */
export async function deleteBulk(owner: Kysely<DB>, source: string): Promise<void> {
  await owner.transaction().execute(async (trx) => {
    await sql`SET LOCAL carshenas.purge = 'on'`.execute(trx);
    await sql`DELETE FROM listing_valuation WHERE listing_id IN (SELECT id FROM listing WHERE source_id = ${source})`.execute(
      trx,
    );
    await sql`DELETE FROM listing WHERE source_id = ${source}`.execute(trx);
    await sql`DELETE FROM source WHERE id = ${source}`.execute(trx);
  });
}
