import { sql, type Kysely, type Transaction } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { Comparable, Valuation } from '../valuation/fit.ts';
import type { ListingAttributes } from '../valuation/method.ts';

// The valuation in the database (CS-51, docs/specs/S01-deal-ratings.md; tables in docs/design/data-model.md, layer 6):
// the comparables a run learns from, the run with its coefficients, segments and comparables, and every active
// listing's value and rating through valuation_rate_listing(), so the daily run and a later listing are rated by the
// same SQL. A run is written in one transaction and replaces an earlier succeeded run of its day.

type Executor = Kysely<DB> | Transaction<DB>;

export type ComparableQuery = {
  /** The Tehran day the comparables are gathered for, YYYY-MM-DD: listed on or before it. */
  readonly asOfDate: string;
  readonly windowDays: number;
};

type ComparableRow = {
  id: number;
  model_id: number;
  trim_id: number | null;
  model_year_sh: number;
  mileage_km: number;
  gearbox: 'manual' | 'automatic';
  fuel: string | null;
  body_condition: string | null;
  front_chassis_condition: string | null;
  rear_chassis_condition: string | null;
  colour_family: string | null;
  asking_price_toman: number;
  days_before: number;
  listed_date: string;
};

export type LoadedComparable = Comparable & { readonly listedDate: string };

/**
 * S01's comparables rules 1 to 4, 6 and 8: an asking price, a catalogue model, year, mileage and gearbox known, on the
 * market inside the window, no excluded condition, one per same-source repost, no dealer's zero-km post. Rules 5 and 7
 * are the fit's.
 */
export async function loadComparables(db: Executor, query: ComparableQuery): Promise<LoadedComparable[]> {
  const { rows } = await sql<ComparableRow>`
    SELECT DISTINCT ON (l.source_id, l.model_id, l.model_year_sh, l.mileage_km, l.asking_price_toman)
           l.id, l.model_id, l.trim_id, l.model_year_sh, l.mileage_km, l.gearbox, l.fuel, l.body_condition,
           l.front_chassis_condition, l.rear_chassis_condition, co.family AS colour_family, l.asking_price_toman,
           ${query.asOfDate}::date - (l.listed_at AT TIME ZONE 'Asia/Tehran')::date AS days_before,
           to_char((l.listed_at AT TIME ZONE 'Asia/Tehran')::date, 'YYYY-MM-DD') AS listed_date
      FROM listing l
      LEFT JOIN colour co ON co.code = l.colour
     WHERE l.price_type = 'asking'
       AND l.asking_price_toman IS NOT NULL
       AND l.model_id IS NOT NULL
       AND l.model_year_sh IS NOT NULL
       AND l.mileage_km IS NOT NULL
       AND l.gearbox IS NOT NULL
       AND (l.listed_at AT TIME ZONE 'Asia/Tehran')::date <= ${query.asOfDate}::date
       AND (l.status = 'active'
            OR (l.last_seen_at AT TIME ZONE 'Asia/Tehran')::date >= ${query.asOfDate}::date - ${query.windowDays}::int)
       AND coalesce(l.body_condition, '') NOT IN ('fully_repainted', 'accident_damaged', 'salvage')
       AND coalesce(l.engine_condition, '') NOT IN ('replaced', 'needs_repair')
       AND coalesce(l.gearbox_condition, '') NOT IN ('replaced', 'needs_repair')
       AND coalesce(l.front_chassis_condition, '') <> 'damaged'
       AND coalesce(l.rear_chassis_condition, '') <> 'damaged'
       AND NOT (l.seller_type = 'dealer' AND l.mileage_km < 1000)
     ORDER BY l.source_id, l.model_id, l.model_year_sh, l.mileage_km, l.asking_price_toman, l.listed_at, l.id`.execute(
    db,
  );
  return rows.map((row) => {
    const attributes: ListingAttributes = {
      modelYearSh: row.model_year_sh,
      mileageKm: row.mileage_km,
      gearbox: row.gearbox,
      fuel: row.fuel,
      bodyCondition: row.body_condition,
      frontChassisCondition: row.front_chassis_condition,
      rearChassisCondition: row.rear_chassis_condition,
      colourFamily: row.colour_family,
      daysBeforeAsOf: row.days_before,
    };
    return {
      listingId: row.id,
      modelId: row.model_id,
      trimId: row.trim_id,
      attributes,
      askingPriceToman: row.asking_price_toman,
      listedDate: row.listed_date,
    };
  });
}

export type RunSettings = {
  readonly asOfDate: string;
  readonly methodVersion: number;
  readonly referenceYearSh: number;
  readonly mileageNormKmPerYear: number;
  readonly windowDays: number;
  readonly priorStrength: number;
};

export async function startRun(db: Executor, settings: RunSettings): Promise<number> {
  const run = await db
    .insertInto('valuation_run')
    .values({
      as_of_date: settings.asOfDate,
      method_version: settings.methodVersion,
      status: 'running',
      reference_year_sh: settings.referenceYearSh,
      mileage_norm_km_per_year: settings.mileageNormKmPerYear,
      window_days: settings.windowDays,
      prior_strength: settings.priorStrength,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return run.id;
}

export async function failRun(db: Executor, runId: number): Promise<void> {
  await db
    .updateTable('valuation_run')
    .set({ status: 'failed', finished_at: sql<Date>`clock_timestamp()` })
    .where('id', '=', runId)
    .where('status', '=', 'running')
    .execute();
}

const BATCH = 1_000;
const RATING_BATCH = 5_000;

async function insertInBatches<Row>(
  rows: readonly Row[],
  insert: (batch: Row[]) => Promise<unknown>,
): Promise<void> {
  for (let start = 0; start < rows.length; start += BATCH) await insert(rows.slice(start, start + BATCH));
}

/** The fit's coefficients, segments and comparables. */
export async function writeFit(tx: Transaction<DB>, runId: number, valuation: Valuation): Promise<void> {
  const coefficients = [
    ...Object.entries(valuation.model.shared).map(([term, coefficient]) => ({
      valuation_run_id: runId,
      term: term as keyof typeof valuation.model.shared,
      model_id: null,
      trim_id: null,
      coefficient,
    })),
    ...[...valuation.model.models].flatMap(([modelId, fitted]) => [
      {
        valuation_run_id: runId,
        term: 'model_level' as const,
        model_id: modelId,
        trim_id: null,
        coefficient: fitted.level,
      },
      {
        valuation_run_id: runId,
        term: 'model_age_slope' as const,
        model_id: modelId,
        trim_id: null,
        coefficient: fitted.ageSlope,
      },
    ]),
    ...[...valuation.model.trims].map(([trimId, fitted]) => ({
      valuation_run_id: runId,
      term: 'trim_level' as const,
      model_id: fitted.modelId,
      trim_id: trimId,
      coefficient: fitted.level,
    })),
  ];
  await insertInBatches(coefficients, (batch) =>
    tx.insertInto('valuation_coefficient').values(batch).execute(),
  );
  await insertInBatches(valuation.segments, (batch) =>
    tx
      .insertInto('valuation_segment')
      .values(
        batch.map((segment) => ({
          valuation_run_id: runId,
          model_id: segment.modelId,
          comparable_count: segment.comparableCount,
          zero_km_count: segment.zeroKmCount,
          min_model_year_sh: segment.minModelYearSh,
          max_model_year_sh: segment.maxModelYearSh,
          error_pct: segment.errorPct === null ? null : segment.errorPct.toFixed(2),
          rates_listings: segment.ratesListings,
        })),
      )
      .execute(),
  );
  await insertInBatches(valuation.comparables, (batch) =>
    tx
      .insertInto('valuation_comparable')
      .values(
        batch.map(({ comparable, isOutlier, fittedValueToman }) => ({
          valuation_run_id: runId,
          listing_id: comparable.listingId,
          model_id: comparable.modelId,
          model_year_sh: comparable.attributes.modelYearSh,
          mileage_km: comparable.attributes.mileageKm,
          asking_price_toman: comparable.askingPriceToman,
          fitted_value_toman: fittedValueToman,
          is_outlier: isOutlier,
        })),
      )
      .execute(),
  );
}

export type RatedCounts = { readonly valued: number; readonly rated: number };

/**
 * Every active listing's value and rating from the run's stored numbers, then the ten comparables shown beside each
 * rated one: its model's nearest in model year and mileage (a year counts as 50,000 km), never itself.
 */
export async function rateActiveListings(tx: Transaction<DB>, runId: number): Promise<RatedCounts> {
  // In batches of listing ids, so no one statement nears the worker's 30-second limit as the index grows: about
  // 0.08 ms a listing on 2026-09-30, measured over 16,400 active listings.
  let after = 0;
  for (;;) {
    const { rows } = await sql<{ last_id: number | null }>`
      WITH batch AS (
        SELECT l.id FROM listing l
         WHERE l.status = 'active' AND l.id > ${after}
         ORDER BY l.id
         LIMIT ${RATING_BATCH}
      ),
      rated AS (
        INSERT INTO listing_valuation (valuation_run_id, listing_id, asking_price_toman, market_value_toman,
                                       price_gap_pct, deal_rating, no_rating_reason)
        SELECT ${runId}, b.id, v.asking_price_toman, v.market_value_toman, v.price_gap_pct, v.deal_rating,
               v.no_rating_reason
          FROM batch b
         CROSS JOIN LATERAL valuation_rate_listing(${runId}, b.id) v
      )
      SELECT max(id) AS last_id FROM batch`.execute(tx);
    const last = rows[0]?.last_id ?? null;
    if (last === null) break;
    after = last;
  }
  await sql`
    INSERT INTO listing_valuation_comparable (valuation_run_id, listing_id, comparable_listing_id, position,
                                              asking_price_toman, adjusted_price_toman)
    SELECT lv.valuation_run_id, lv.listing_id, n.listing_id, n.position, n.asking_price_toman,
           round(n.asking_price_toman::numeric * lv.market_value_toman / n.fitted_value_toman)::bigint
      FROM listing_valuation lv
      JOIN listing l ON l.id = lv.listing_id
     CROSS JOIN LATERAL (
       SELECT nearest.*, row_number() OVER (ORDER BY nearest.distance, nearest.listing_id)::smallint AS position
         FROM (SELECT vc.listing_id, vc.asking_price_toman, vc.fitted_value_toman,
                      abs(vc.model_year_sh - l.model_year_sh) + abs(vc.mileage_km - l.mileage_km) / 50000.0 AS distance
                 FROM valuation_comparable vc
                WHERE vc.valuation_run_id = lv.valuation_run_id
                  AND vc.model_id = l.model_id
                  AND NOT vc.is_outlier
                  AND vc.listing_id <> l.id
                ORDER BY distance, vc.listing_id
                LIMIT 10) nearest) n
     WHERE lv.valuation_run_id = ${runId}
       AND lv.deal_rating IS NOT NULL`.execute(tx);
  const counts = await tx
    .selectFrom('listing_valuation')
    .select([
      sql<number>`count(*) FILTER (WHERE market_value_toman IS NOT NULL)::int`.as('valued'),
      sql<number>`count(*) FILTER (WHERE deal_rating IS NOT NULL)::int`.as('rated'),
    ])
    .where('valuation_run_id', '=', runId)
    .executeTakeFirstOrThrow();
  return counts;
}

/**
 * Marks the run succeeded, after deleting the earlier succeeded run of its day and method (a rerun replaces it) and
 * the runs older than the retention.
 */
export async function finishRun(
  tx: Transaction<DB>,
  runId: number,
  counts: { readonly comparables: number } & RatedCounts,
  retentionDays: number,
): Promise<void> {
  await sql`
    DELETE FROM valuation_run old
     USING valuation_run run
     WHERE run.id = ${runId}
       AND old.id <> run.id
       AND ((old.as_of_date = run.as_of_date AND old.method_version = run.method_version AND old.status = 'succeeded')
            OR old.as_of_date < run.as_of_date - ${retentionDays}::int)`.execute(tx);
  await tx
    .updateTable('valuation_run')
    .set({
      status: 'succeeded',
      finished_at: sql<Date>`clock_timestamp()`,
      comparable_count: counts.comparables,
      valued_count: counts.valued,
      rated_count: counts.rated,
    })
    .where('id', '=', runId)
    .execute();
}

/** Persian names of catalogue models, for reports (the Latin name where no Persian one is known). */
export async function modelNames(db: Executor, modelIds: readonly number[]): Promise<Map<number, string>> {
  if (modelIds.length === 0) return new Map();
  const rows = await db
    .selectFrom('model')
    .select(['id', 'name_fa', 'name_en'])
    .where('id', 'in', modelIds)
    .execute();
  return new Map(rows.map((row) => [row.id, row.name_fa ?? row.name_en]));
}
