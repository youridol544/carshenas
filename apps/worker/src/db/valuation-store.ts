import { sql, type Kysely, type Transaction } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { Comparable, Valuation } from '../valuation/fit.ts';
import type { ListingAttributes } from '../valuation/method.ts';

// The valuation in the database (CS-51, docs/specs/S01-deal-ratings.md; tables in docs/design/data-model.md, layer 6):
// the comparables a run learns from, the run with its coefficients, segments and comparables, and every active
// listing's value and rating through valuation_rate_listing(), so the daily run and a later listing are rated by the
// same SQL. A run's fit is written in one transaction, its ratings in batches, and it replaces an earlier succeeded run of its day when it is marked succeeded in a last one.

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
 * are the fit's. A mileage the run itself read in thousands from the asking price (CS-101, thousands_price) is never a
 * comparable: the price chose the reading, so it could not then also teach the fit what a price is.
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
       AND l.mileage_reading IS DISTINCT FROM 'thousands_price'
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
/** Listings rated, and rated listings given their shown comparables, per statement. */
export const RATING_BATCH = 1_000;

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
 * The planner's statistics of the tables a run has just written, so the statements that read them are planned for
 * their real size. Without them the rating's statements chose sequential scans inside valuation_rate_listing() and one
 * batch of 5,000 listings took 86 s, against 0.17 s with statistics (2026-10-02, CS-51); the worker holds MAINTAIN on
 * these tables for it.
 */
export async function analyzeValuationTables(db: Executor, tables: 'fit' | 'ratings'): Promise<void> {
  if (tables === 'fit')
    await sql`ANALYZE valuation_coefficient, valuation_segment, valuation_comparable`.execute(db);
  else await sql`ANALYZE listing_valuation`.execute(db);
}

/**
 * Every active listing's value and rating from the run's stored numbers, then the ten comparables shown beside each
 * rated one: its model's nearest in model year and mileage (a year counts as 50,000 km), never itself. Both in batches
 * of listing ids, each batch its own statement, so none nears the worker's 30-second limit as the index grows; the
 * run's rows stay invisible to readers until finishRun marks it succeeded.
 */
export async function rateActiveListings(
  db: Executor,
  runId: number,
  batchSize: number = RATING_BATCH,
): Promise<RatedCounts> {
  let after = 0;
  for (;;) {
    const { rows } = await sql<{ last_id: number | null }>`
      WITH batch AS (
        SELECT l.id FROM listing l
         WHERE l.status = 'active' AND l.id > ${after}
         ORDER BY l.id
         LIMIT ${batchSize}
      ),
      rated AS (
        INSERT INTO listing_valuation (valuation_run_id, listing_id, asking_price_toman, market_value_toman,
                                       price_gap_pct, deal_rating, no_rating_reason)
        SELECT ${runId}, b.id, v.asking_price_toman, v.market_value_toman, v.price_gap_pct, v.deal_rating,
               v.no_rating_reason
          FROM batch b
         CROSS JOIN LATERAL valuation_rate_listing(${runId}, b.id) v
      )
      SELECT max(id) AS last_id FROM batch`.execute(db);
    const last = rows[0]?.last_id ?? null;
    if (last === null) break;
    after = last;
  }
  // The comparables read the rows just written: analyse them first so their join is planned for their size.
  await analyzeValuationTables(db, 'ratings');
  after = 0;
  for (;;) {
    const { rows } = await sql<{ last_id: number | null }>`
      WITH batch AS (
        SELECT lv.listing_id, lv.market_value_toman FROM listing_valuation lv
         WHERE lv.valuation_run_id = ${runId} AND lv.deal_rating IS NOT NULL AND lv.listing_id > ${after}
         ORDER BY lv.listing_id
         LIMIT ${batchSize}
      ),
      shown AS (
        INSERT INTO listing_valuation_comparable (valuation_run_id, listing_id, comparable_listing_id, position,
                                                  asking_price_toman, adjusted_price_toman)
        SELECT ${runId}, b.listing_id, n.listing_id, n.position, n.asking_price_toman,
               round(n.asking_price_toman::numeric * b.market_value_toman / n.fitted_value_toman)::bigint
          FROM batch b
          JOIN listing l ON l.id = b.listing_id
         CROSS JOIN LATERAL (
           SELECT nearest.*, row_number() OVER (ORDER BY nearest.distance, nearest.listing_id)::smallint AS position
             FROM (SELECT vc.listing_id, vc.asking_price_toman, vc.fitted_value_toman,
                          abs(vc.model_year_sh - l.model_year_sh) + abs(vc.mileage_km - l.mileage_km) / 50000.0 AS distance
                     FROM valuation_comparable vc
                    WHERE vc.valuation_run_id = ${runId}
                      AND vc.model_id = l.model_id
                      AND NOT vc.is_outlier
                      AND vc.listing_id <> l.id
                    ORDER BY distance, vc.listing_id
                    LIMIT 10) nearest) n
      )
      SELECT max(listing_id) AS last_id FROM batch`.execute(db);
    const last = rows[0]?.last_id ?? null;
    if (last === null) break;
    after = last;
  }
  const counts = await db
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


/** A listing whose written mileage is under the floor and was not settled by its text (CS-101). */
export type MileageCandidate = Omit<LoadedComparable, 'listedDate'> & {
  /** The figure the seller wrote, 1 to 999. */
  readonly writtenKm: number;
  /** Whole model years old at the run's reference year. */
  readonly storedReading: 'really_low' | 'thousands_text' | 'thousands_price' | 'unread';
};

/**
 * The listings whose mileage the valuation run may read in thousands: an unread figure (or one an earlier run read so),
 * of 1 km or more (a written 0 has no thousands), on a listing the valuation can price (an asking price, a catalogue
 * model, a year and a gearbox). Every status, so a gone listing's page shows the reading its rating had.
 */
export async function loadMileageCandidates(
  db: Executor,
  query: ComparableQuery,
  /** `run`: the listings the run decides on; `all`: every listing with a reading, the measurement's sample. */
  scope: 'run' | 'all' = 'run',
): Promise<MileageCandidate[]> {
  const readings = scope === 'run' ? ['unread', 'thousands_price'] : ['unread', 'thousands_price', 'thousands_text', 'really_low'];
  const { rows } = await sql<ComparableRow & { written: number; reading: MileageCandidate['storedReading'] }>`
    SELECT l.id, l.model_id, l.trim_id, l.model_year_sh, l.mileage_written_km AS written,
           l.mileage_reading AS reading, l.mileage_written_km AS mileage_km, l.gearbox, l.fuel, l.body_condition,
           l.front_chassis_condition, l.rear_chassis_condition, co.family AS colour_family, l.asking_price_toman,
           coalesce(${query.asOfDate}::date - (l.listed_at AT TIME ZONE 'Asia/Tehran')::date, 0) AS days_before,
           ''::text AS listed_date
      FROM listing l
      LEFT JOIN colour co ON co.code = l.colour
     WHERE l.mileage_reading = ANY(${readings}::text[])
       AND l.mileage_written_km >= ${scope === 'run' ? 1 : 0}
       AND l.price_type = 'asking'
       AND l.asking_price_toman IS NOT NULL
       AND l.model_id IS NOT NULL
       AND l.model_year_sh IS NOT NULL
       AND l.gearbox IS NOT NULL
     ORDER BY l.id`.execute(db);
  return rows.map((row) => ({
    listingId: row.id,
    modelId: row.model_id,
    trimId: row.trim_id,
    askingPriceToman: row.asking_price_toman,
    writtenKm: row.written,
    storedReading: row.reading,
    attributes: {
      modelYearSh: row.model_year_sh,
      mileageKm: row.written,
      gearbox: row.gearbox,
      fuel: row.fuel,
      bodyCondition: row.body_condition,
      frontChassisCondition: row.front_chassis_condition,
      rearChassisCondition: row.rear_chassis_condition,
      colourFamily: row.colour_family,
      daysBeforeAsOf: row.days_before,
    },
  }));
}

/** What the run decided for one candidate: read in thousands (with the evidence) or left unread. */
export type MileageDecision = {
  readonly listingId: number;
  readonly writtenKm: number;
  /** Asking price over the market value at 1,000 times the figure; null when the model gave no value. */
  readonly priceRatio: number | null;
  readonly thousands: boolean;
};

/**
 * Writes the decisions: a listing read in thousands gets mileage_km 1,000 times the figure and the reading
 * thousands_price with its ratio; one left unread gets no mileage and, when it was tested, the ratio. Each row is
 * written only while it still holds the figure the run read, so a derivation that replaced it meanwhile wins. Returns
 * how many listings changed.
 */
export async function writeMileageDecisions(db: Executor, decisions: readonly MileageDecision[]): Promise<number> {
  let changed = 0;
  for (let at = 0; at < decisions.length; at += BATCH) {
    const batch = decisions.slice(at, at + BATCH);
    const { numAffectedRows } = await sql`
      UPDATE listing l
         SET mileage_reading = CASE WHEN d.thousands THEN 'thousands_price' ELSE 'unread' END,
             mileage_km = CASE WHEN d.thousands THEN l.mileage_written_km * 1000 END,
             mileage_ask_ratio = d.ratio
        FROM unnest(${batch.map((d) => d.listingId)}::bigint[], ${batch.map((d) => d.writtenKm)}::int[],
                    ${batch.map((d) => d.thousands)}::boolean[], ${batch.map((d) => d.priceRatio)}::float8[])
             AS d(listing_id, written, thousands, ratio)
       WHERE l.id = d.listing_id
         AND l.mileage_reading IN ('unread', 'thousands_price')
         AND l.mileage_written_km = d.written
         AND (l.mileage_reading, l.mileage_km, l.mileage_ask_ratio)
             IS DISTINCT FROM (CASE WHEN d.thousands THEN 'thousands_price' ELSE 'unread' END,
                               CASE WHEN d.thousands THEN d.written * 1000 END, d.ratio)`.execute(db);
    changed += Number(numAffectedRows ?? 0n);
  }
  return changed;
}

/**
 * A listing the run read in thousands that it can no longer test (its asking price went, or its model) goes back to
 * unread: the reading rested on a price it cannot check. `testedIds` are the listings this run decided on.
 */
export async function clearUntestedMileageReadings(db: Executor, testedIds: readonly number[]): Promise<number> {
  const { numAffectedRows } = await sql`
    UPDATE listing
       SET mileage_reading = 'unread', mileage_km = NULL, mileage_ask_ratio = NULL
     WHERE mileage_reading = 'thousands_price'
       AND id <> ALL(${[...testedIds]}::bigint[])`.execute(db);
  return Number(numAffectedRows ?? 0n);
}
