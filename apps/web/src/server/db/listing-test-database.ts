import 'server-only';
import { randomBytes } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';

// For the listing page's integration tests (*.db.test.ts, run by `pnpm db:check` on a scratch database it has just
// migrated): the rows the owner sets up for one rated listing (CS-64: a make with a model and a trim, a valuation run with
// its segment and fitted coefficients, three comparables, two price changes, photos, a snapshot with an extraction's
// accepted facts), and the independent recomputation of every figure the explanation quotes, in SQL from the stored
// rows, which the faithfulness checks compare the explanation against (listing-explanation.db.test.ts).

export type ListingTestData = {
  readonly source: string;
  readonly runId: number;
  readonly listingId: number;
  readonly comparableIds: readonly number[];
  readonly snapshotId: number;
  readonly modelId: number;
  readonly makeId: number;
};

const RUN_DATE = '2099-12-30';

/** What an earlier run that died half way left: its sources, listings and the run (which would be the latest). */
async function removeLeftovers(owner: Kysely<DB>): Promise<void> {
  const sources = await owner.selectFrom('source').select('id').where('id', 'like', 'tst\\_lp\\_%').execute();
  const runs = await owner
    .selectFrom('valuation_run')
    .select('id')
    .where('method_version', '=', 96)
    .execute();
  for (const run of runs) {
    for (const source of sources.length > 0 ? sources : [{ id: '' }]) {
      await removeListingPage(owner, { source: source.id, runId: run.id });
    }
  }
  for (const source of sources) {
    if (runs.length === 0) await removeListingPage(owner, { source: source.id, runId: 0 });
  }
}

/** One listing with everything the page shows, in a run that is the latest of all while the test runs. */
export async function seedListingPage(owner: Kysely<DB>, suffix: string): Promise<ListingTestData> {
  await removeLeftovers(owner);
  const source = `tst_lp_${suffix}`;
  const slug = `tst-lp-${suffix}`;
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
  const make = await owner
    .insertInto('make')
    .values({ slug, name_en: slug, name_fa: 'خودروساز آزمایشی' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const model = await owner
    .insertInto('model')
    .values({ make_id: make.id, slug: 'one', name_en: 'one', name_fa: 'مدل ۲۰۶ آزمایشی', body_type: null })
    .returning('id')
    .executeTakeFirstOrThrow();
  const run = await owner
    .insertInto('valuation_run')
    .values({
      as_of_date: RUN_DATE,
      method_version: 96,
      status: 'succeeded',
      reference_year_sh: 1405,
      mileage_norm_km_per_year: 20_000,
      window_days: 30,
      prior_strength: 20,
      finished_at: sql<Date>`now()`,
      comparable_count: 20,
      valued_count: 4,
      rated_count: 4,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const listingValues = (key: string, price: number, year: number, km: number) => ({
    source_id: source,
    source_listing_key: key,
    url: `https://test.example/${key}`,
    status: 'active' as const,
    listed_at: sql<Date>`now() - interval '10 days'`,
    last_seen_at: sql<Date>`now() - interval '1 hour'`,
    last_checked_at: sql<Date>`now() - interval '1 hour'`,
    title: `آگهی آزمایشی ${key}`,
    make_id: make.id,
    model_id: model.id,
    catalogue_match: 'model' as const,
    model_year_written: 'sh' as const,
    model_year_sh: year,
    mileage_km: km,
    price_type: 'asking' as const,
    asking_price_toman: price,
    gearbox: 'automatic' as const,
    fuel: 'petrol' as const,
    seller_type: 'private' as const,
    body_condition: 'minor_scratches' as const,
    engine_condition: 'sound' as const,
  });
  const listing = await owner
    .insertInto('listing')
    .values(listingValues('main', 900_000_000, 1395, 160_000))
    .returning('id')
    .executeTakeFirstOrThrow();
  const comparableIds: number[] = [];
  for (const [index, [price, year, km]] of [
    [950_000_000, 1395, 150_000],
    [1_000_000_000, 1396, 90_000],
    [880_000_000, 1394, 200_000],
  ].entries()) {
    const row = await owner
      .insertInto('listing')
      .values(listingValues(`cmp${String(index)}`, price ?? 0, year ?? 1395, km ?? 0))
      .returning('id')
      .executeTakeFirstOrThrow();
    comparableIds.push(row.id);
  }
  await owner
    .insertInto('valuation_segment')
    .values({
      valuation_run_id: run.id,
      model_id: model.id,
      comparable_count: 20,
      zero_km_count: 1,
      min_model_year_sh: 1385,
      max_model_year_sh: 1404,
      error_pct: 6.72,
      rates_listings: true,
    })
    .execute();
  await owner
    .insertInto('valuation_coefficient')
    .values([
      { valuation_run_id: run.id, term: 'model_level', model_id: model.id, coefficient: 20.5 },
      { valuation_run_id: run.id, term: 'model_age_slope', model_id: model.id, coefficient: -0.062 },
      { valuation_run_id: run.id, term: 'mileage_deviation', coefficient: -0.08 },
      { valuation_run_id: run.id, term: 'body_minor', coefficient: -0.02 },
      { valuation_run_id: run.id, term: 'gearbox_automatic', coefficient: 0.095 },
      { valuation_run_id: run.id, term: 'off_colour', coefficient: -0.05 },
    ])
    .execute();
  await owner
    .insertInto('listing_valuation')
    .values({
      valuation_run_id: run.id,
      listing_id: listing.id,
      asking_price_toman: 900_000_000,
      market_value_toman: 1_000_000_000,
      price_gap_pct: -10,
      deal_rating: 'great',
    })
    .execute();
  const comparableRowsOf = [
    [950_000_000, 1395, 150_000],
    [1_000_000_000, 1396, 90_000],
    [880_000_000, 1394, 200_000],
  ] as const;
  await owner
    .insertInto('valuation_comparable')
    .values(
      comparableIds.map((id, index) => ({
        valuation_run_id: run.id,
        listing_id: id,
        model_id: model.id,
        model_year_sh: comparableRowsOf[index]?.[1] ?? 1395,
        mileage_km: comparableRowsOf[index]?.[2] ?? 0,
        asking_price_toman: comparableRowsOf[index]?.[0] ?? 1,
        fitted_value_toman: 990_000_000,
        is_outlier: false,
      })),
    )
    .execute();
  await owner
    .insertInto('listing_valuation_comparable')
    .values(
      comparableIds.map((id, index) => ({
        valuation_run_id: run.id,
        listing_id: listing.id,
        comparable_listing_id: id,
        position: index + 1,
        asking_price_toman: 950_000_000 + index * 10_000_000,
        adjusted_price_toman: 990_000_000 + index * 5_000_000,
      })),
    )
    .execute();
  await owner
    .insertInto('listing_photo')
    .values([
      {
        listing_id: listing.id,
        position: 2,
        url: 'https://s100.divarcdn.com/static/photo/test/2.webp',
        thumbnail_url: null,
      },
      {
        listing_id: listing.id,
        position: 1,
        url: 'https://s100.divarcdn.com/static/photo/test/1.webp',
        thumbnail_url: 'https://s100.divarcdn.com/static/photo/test/1t.webp',
      },
    ])
    .execute();
  const snapshot = await owner
    .insertInto('snapshot')
    .values({
      listing_id: listing.id,
      first_fetched_at: sql<Date>`now() - interval '2 hours'`,
      url: 'https://api.test.example/post/main',
      canonical_version: 1,
      payload: {},
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return {
    source,
    runId: run.id,
    listingId: listing.id,
    comparableIds,
    snapshotId: snapshot.id,
    modelId: model.id,
    makeId: make.id,
  };
}

/** Two price changes and the accepted facts of a usable extraction, for the listing the seed made. */
export async function seedHistoryAndFacts(owner: Kysely<DB>, data: ListingTestData): Promise<void> {
  await sql`
    INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, previous_price_type,
                                     previous_price_toman, snapshot_id)
    VALUES (${data.listingId}, now() - interval '8 days', 'asking', 1000000000, NULL, NULL, ${data.snapshotId}),
           (${data.listingId}, now() - interval '6 days', 'asking', 950000000, 'asking', 1000000000, ${data.snapshotId}),
           (${data.listingId}, now() - interval '2 days', 'asking', 900000000, 'asking', 950000000, ${data.snapshotId})`.execute(
    owner,
  );
  const answer = await owner
    .insertInto('ai_answer')
    .values({
      cache_key: randomBytes(32),
      task: 'listing.facts',
      prompt_version: '0123456789abcdef',
      provider: 'google',
      model: 'gemini-3.7-flash',
      answering_model: 'gemini-3.7-flash',
      output: {},
      cost_usd_micros: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const extraction = await owner
    .insertInto('extraction')
    .values({
      snapshot_id: data.snapshotId,
      listing_id: data.listingId,
      ai_answer_id: answer.id,
      status: 'usable',
      hold_reasons: [],
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const field = (name: string, value: string, evidence: string, confidence: number) => ({
    extraction_id: extraction.id,
    field: name,
    value,
    evidence,
    confidence,
    threshold: 0.75,
    status: confidence >= 0.75 ? ('accepted' as const) : ('needs_review' as const),
  });
  await owner
    .insertInto('extraction_field')
    .values([
      field('paint', 'around', 'دور رنگ', 0.9),
      field('chassis', 'intact', 'شاسی ها سالم', 0.95),
      field('swap', 'yes', 'برای تماس 09121234567 پیام بدهید معاوضه هم می‌کنم', 0.9),
      field('plate', 'free_zone', 'پلاک منطقه آزاد', 0.5),
      field('installment', 'no', 'قسط ندارد', 0.9),
      field('negotiable', 'not_stated', '', 0.9),
    ])
    .execute();
}

/** Removes the listings and everything that hangs on them, the run (which was the latest) and the source. */
export async function removeListingPage(
  owner: Kysely<DB>,
  data: Pick<ListingTestData, 'source' | 'runId'>,
): Promise<void> {
  await owner.transaction().execute(async (trx) => {
    await sql`SET LOCAL carshenas.purge = 'on'`.execute(trx);
    await sql`DELETE FROM listing_recheck_request WHERE listing_id IN (SELECT id FROM listing WHERE source_id = ${data.source})`.execute(
      trx,
    );
    await sql`DELETE FROM listing_valuation_comparable WHERE valuation_run_id = ${data.runId}`.execute(trx);
    await sql`DELETE FROM listing_valuation WHERE valuation_run_id = ${data.runId}`.execute(trx);
    await sql`DELETE FROM valuation_comparable WHERE valuation_run_id = ${data.runId}`.execute(trx);
    await sql`DELETE FROM valuation_coefficient WHERE valuation_run_id = ${data.runId}`.execute(trx);
    await sql`DELETE FROM valuation_segment WHERE valuation_run_id = ${data.runId}`.execute(trx);
    await sql`DELETE FROM valuation_run WHERE id = ${data.runId}`.execute(trx);
    await sql`DELETE FROM listing WHERE source_id = ${data.source}`.execute(trx);
    await sql`DELETE FROM ai_answer WHERE task = 'listing.facts' AND prompt_version = '0123456789abcdef'`.execute(
      trx,
    );
    await sql`DELETE FROM source WHERE id = ${data.source}`.execute(trx);
  });
}

export type ExpectedFigures = Map<string, readonly number[]>;

/**
 * Every figure of one listing's explanation, recomputed in SQL from the stored rows and in the SQL function's own terms
 * (valuation_rate_listing's CASE for the adjustments' variables), so it shares no code with the explanation it checks.
 */
export async function expectedFigures(db: Kysely<DB>, listingId: number): Promise<ExpectedFigures> {
  const expected: ExpectedFigures = new Map();
  const base = await sql<{
    run_id: number;
    market_value: number;
    gap: string | null;
    as_of_ms: string;
    norm: number;
    window: number;
    version: number;
    year: number | null;
    mileage: number | null;
    away: string | null;
    seg_count: number | null;
    seg_min: number | null;
    seg_max: number | null;
    seg_error: string | null;
    near_count: number;
    near_min_year: number | null;
    near_max_year: number | null;
    near_min_km: number | null;
    near_max_km: number | null;
    slope: number | null;
  }>`
    WITH run AS (SELECT * FROM valuation_run WHERE status = 'succeeded' ORDER BY as_of_date DESC, id DESC LIMIT 1)
    SELECT run.id AS run_id, v.market_value_toman AS market_value, v.price_gap_pct::text AS gap,
           (extract(epoch FROM run.as_of_date::timestamp) * 1000)::bigint::text AS as_of_ms,
           run.mileage_norm_km_per_year AS norm, run.window_days AS "window", run.method_version AS version,
           l.model_year_sh AS year, l.mileage_km AS mileage,
           abs(l.mileage_km - run.mileage_norm_km_per_year
               * greatest(greatest(run.reference_year_sh - l.model_year_sh, 0), 0.5))::text AS away,
           s.comparable_count AS seg_count, s.min_model_year_sh AS seg_min, s.max_model_year_sh AS seg_max,
           s.error_pct::text AS seg_error,
           (SELECT count(*) FROM listing_valuation_comparable c
             WHERE c.valuation_run_id = run.id AND c.listing_id = l.id)::int AS near_count,
           (SELECT min(cl.model_year_sh) FROM listing_valuation_comparable c JOIN listing cl ON cl.id = c.comparable_listing_id
             WHERE c.valuation_run_id = run.id AND c.listing_id = l.id) AS near_min_year,
           (SELECT max(cl.model_year_sh) FROM listing_valuation_comparable c JOIN listing cl ON cl.id = c.comparable_listing_id
             WHERE c.valuation_run_id = run.id AND c.listing_id = l.id) AS near_max_year,
           (SELECT min(cl.mileage_km) FROM listing_valuation_comparable c JOIN listing cl ON cl.id = c.comparable_listing_id
             WHERE c.valuation_run_id = run.id AND c.listing_id = l.id) AS near_min_km,
           (SELECT max(cl.mileage_km) FROM listing_valuation_comparable c JOIN listing cl ON cl.id = c.comparable_listing_id
             WHERE c.valuation_run_id = run.id AND c.listing_id = l.id) AS near_max_km,
           (SELECT k.coefficient FROM valuation_coefficient k
             WHERE k.valuation_run_id = run.id AND k.term = 'model_age_slope' AND k.model_id = l.model_id) AS slope
    FROM run
    JOIN listing l ON l.id = ${listingId}
    JOIN listing_valuation v ON v.valuation_run_id = run.id AND v.listing_id = l.id
    LEFT JOIN valuation_segment s ON s.valuation_run_id = run.id AND s.model_id = l.model_id`.execute(db);
  const row = base.rows[0];
  if (row === undefined) return expected;
  const put = (id: string, ...values: (number | string | null)[]) => {
    if (values.some((value) => value === null)) return;
    expected.set(id, values.map(Number));
  };
  put('market_value', row.market_value);
  put('gap', row.gap);
  put('run_date', row.as_of_ms);
  put('method_norm', row.norm);
  put('mileage_norm', row.norm);
  put('window_days', row.window);
  put('method_version', row.version);
  put('model_year', row.year);
  put('mileage', row.mileage);
  put('mileage_away', row.away);
  put('segment_count', row.seg_count);
  put('segment_years', row.seg_min, row.seg_max);
  put('segment_error', row.seg_error === null ? null : Math.max(1, Math.round(Number(row.seg_error))));
  put('near_count', row.near_count);
  put('near_years_range', row.near_min_year, row.near_max_year);
  put('near_km_range', row.near_min_km, row.near_max_km);
  put('age_slope', row.slope === null ? null : (Math.exp(row.slope) - 1) * 100);
  const adjustments = await sql<{ term: string; pct: number }>`
    SELECT k.term,
           (exp(k.coefficient * CASE k.term
              WHEN 'mileage_deviation' THEN (l.mileage_km - run.mileage_norm_km_per_year
                * greatest(greatest(run.reference_year_sh - l.model_year_sh, 0), 0.5)) / 100000.0
              WHEN 'zero_km' THEN (l.mileage_km < 1000)::int
              WHEN 'body_minor' THEN (l.body_condition = 'minor_scratches')::int
              WHEN 'body_painted' THEN (l.body_condition = 'partly_repainted')::int
              WHEN 'body_painted_around' THEN (l.body_condition = 'repainted_around')::int
              WHEN 'chassis_repainted' THEN ('repainted' = ANY (ARRAY[l.front_chassis_condition, l.rear_chassis_condition]))::int
              WHEN 'gearbox_automatic' THEN (l.gearbox = 'automatic')::int
              WHEN 'dual_fuel_aftermarket' THEN (l.fuel = 'dual_fuel_aftermarket')::int
              WHEN 'electrified' THEN (l.fuel = ANY (ARRAY['hybrid', 'plug_in_hybrid', 'electric']))::int
              WHEN 'off_colour' THEN (coalesce(co.family, 'white') <> ALL (ARRAY['white', 'black', 'silver', 'grey']))::int
              ELSE 0 END) - 1) * 100 AS pct
    FROM (SELECT * FROM valuation_run WHERE status = 'succeeded' ORDER BY as_of_date DESC, id DESC LIMIT 1) run
    JOIN listing l ON l.id = ${listingId}
    LEFT JOIN colour co ON co.code = l.colour
    JOIN valuation_coefficient k ON k.valuation_run_id = run.id AND k.model_id IS NULL
    WHERE k.term <> 'day'`.execute(db);
  for (const adjustment of adjustments.rows) put(`adjustment_${adjustment.term}`, adjustment.pct);
  return expected;
}

/** A listing that was taken down (status removed) and is not a listing any more as far as a page goes. */
export async function addRemovedListing(owner: Kysely<DB>, source: string): Promise<number> {
  const row = await owner
    .insertInto('listing')
    .values({
      source_id: source,
      source_listing_key: 'removed',
      url: 'https://test.example/removed',
      status: 'active',
      listed_at: sql<Date>`now() - interval '2 days'`,
      last_seen_at: sql<Date>`now()`,
      catalogue_match: 'unmatched',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await owner
    .updateTable('listing')
    .set({ status: 'removed', delisted_at: sql<Date>`now()` })
    .where('id', '=', row.id)
    .execute();
  return row.id;
}

/** An active listing nothing is known about but that it exists: no price, no valuation, never read. */
export async function addBareListing(owner: Kysely<DB>, source: string): Promise<number> {
  const row = await owner
    .insertInto('listing')
    .values({
      source_id: source,
      source_listing_key: 'bare',
      url: 'https://test.example/bare',
      status: 'active',
      listed_at: sql<Date>`now() - interval '1 day'`,
      last_seen_at: sql<Date>`now()`,
      catalogue_match: 'unmatched',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** A listing whose own page was last read `hoursAgo` hours ago (null: never), on the market or gone. */
export async function addCheckedListing(
  owner: Kysely<DB>,
  source: string,
  key: string,
  hoursAgo: number | null,
  status: 'active' | 'gone' = 'active',
): Promise<number> {
  const row = await owner
    .insertInto('listing')
    .values({
      source_id: source,
      source_listing_key: key,
      url: 'https://test.example/rc',
      status: 'active',
      listed_at: sql<Date>`now() - interval '9 days'`,
      last_seen_at: sql<Date>`now() - interval '6 days'`,
      last_checked_at: hoursAgo === null ? null : sql<Date>`now() - make_interval(hours => ${hoursAgo})`,
      catalogue_match: 'unmatched',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  if (status === 'gone') {
    await owner
      .updateTable('listing')
      .set({ status: 'gone', delisted_at: sql<Date>`now() - interval '6 days'` })
      .where('id', '=', row.id)
      .execute();
  }
  return row.id;
}

/** The text of valuation_rate_listing(), whose numbers the page's rule constants are checked against. */
export async function ruleDefinition(db: Kysely<DB>): Promise<string> {
  const { rows } = await sql<{ definition: string }>`
    SELECT pg_get_functiondef('valuation_rate_listing(bigint, bigint)'::regprocedure) AS definition`.execute(
    db,
  );
  return rows[0]?.definition ?? '';
}

/** Fills the re-check queue: `waiting` pending requests and `handledThisHour` handled ones made in the last hour. */
export async function fillRecheckQueue(
  owner: Kysely<DB>,
  source: string,
  counts: { waiting: number; handledThisHour: number },
): Promise<void> {
  await sql`
    WITH made AS (
      INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at, catalogue_match)
      SELECT ${source}, 'q' || g, 'https://test.example/q' || g, 'active', now() - interval '3 days', now() - interval '1 day',
             'unmatched'
      FROM generate_series(1, ${counts.waiting + counts.handledThisHour}::int) g
      RETURNING id)
    INSERT INTO listing_recheck_request (listing_id, requested_at, handled_at, outcome)
    SELECT id, now() - interval '10 minutes',
           CASE WHEN row_number() OVER (ORDER BY id) <= ${counts.waiting}::int THEN NULL ELSE now() - interval '5 minutes' END,
           CASE WHEN row_number() OVER (ORDER BY id) <= ${counts.waiting}::int THEN NULL ELSE 'queued' END
    FROM made`.execute(owner);
}

/** Removes what fillRecheckQueue made, and every other re-check request of the source's listings. */
export async function clearRecheckQueue(owner: Kysely<DB>, source: string): Promise<void> {
  await owner.transaction().execute(async (trx) => {
    await sql`SET LOCAL carshenas.purge = 'on'`.execute(trx);
    await sql`DELETE FROM listing_recheck_request WHERE listing_id IN
              (SELECT id FROM listing WHERE source_id = ${source} AND source_listing_key LIKE 'q%')`.execute(
      trx,
    );
    await sql`DELETE FROM listing WHERE source_id = ${source} AND source_listing_key LIKE 'q%'`.execute(trx);
  });
}

/**
 * A listing whose current extraction has one accepted fact, `swap`, with this evidence phrase: what the view
 * listing_fact_evidence shows of it is what a page can show of the seller's text.
 */
export async function addFactEvidence(
  owner: Kysely<DB>,
  source: string,
  key: string,
  evidence: string,
): Promise<number> {
  const listing = await owner
    .insertInto('listing')
    .values({
      source_id: source,
      source_listing_key: key,
      url: `https://test.example/${key}`,
      status: 'active',
      listed_at: sql<Date>`now() - interval '1 day'`,
      last_seen_at: sql<Date>`now()`,
      catalogue_match: 'unmatched',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const snapshot = await owner
    .insertInto('snapshot')
    .values({
      listing_id: listing.id,
      first_fetched_at: sql<Date>`now() - interval '1 hour'`,
      url: `https://api.test.example/${key}`,
      canonical_version: 1,
      payload: {},
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const answer = await owner
    .insertInto('ai_answer')
    .values({
      cache_key: randomBytes(32),
      task: 'listing.facts',
      prompt_version: '0123456789abcdef',
      provider: 'google',
      model: 'gemini-3.7-flash',
      answering_model: 'gemini-3.7-flash',
      output: {},
      cost_usd_micros: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const extraction = await owner
    .insertInto('extraction')
    .values({
      snapshot_id: snapshot.id,
      listing_id: listing.id,
      ai_answer_id: answer.id,
      status: 'usable',
      hold_reasons: [],
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await owner
    .insertInto('extraction_field')
    .values({
      extraction_id: extraction.id,
      field: 'swap',
      value: 'yes',
      evidence,
      confidence: 0.9,
      threshold: 0.75,
      status: 'accepted',
    })
    .execute();
  return listing.id;
}

/**
 * Nine more listings of the seeded model, valued in the seeded run, so a sample of ten covers every rating and the reasons
 * a listing with a market value can have no rating for. Each keeps the seeded listing's year, mileage and condition, so
 * the seeded segment and coefficients explain them.
 */
export async function seedSampleVariants(owner: Kysely<DB>, data: ListingTestData): Promise<number[]> {
  const variants = [
    { rating: 'good', asking: 960_000_000, gap: -4.5 },
    { rating: 'fair', asking: 1_000_000_000, gap: 0 },
    { rating: 'high', asking: 1_060_000_000, gap: 6 },
    { rating: 'overpriced', asking: 1_200_000_000, gap: 20 },
    { reason: 'installment_price', asking: null, gap: null },
    { reason: 'price_outlier', asking: 4_000_000_000, gap: null },
    { reason: 'dealer_new_car', asking: 1_100_000_000, gap: null },
    { rating: 'great', asking: 850_000_000, gap: -15 },
    { reason: 'no_asking_price', asking: null, gap: null },
  ] as const;
  const ids: number[] = [];
  for (const [index, variant] of variants.entries()) {
    const row = await owner
      .insertInto('listing')
      .values({
        source_id: data.source,
        source_listing_key: `var${String(index)}`,
        url: `https://test.example/var${String(index)}`,
        status: 'active',
        listed_at: sql<Date>`now() - interval '10 days'`,
        last_seen_at: sql<Date>`now() - interval '1 hour'`,
        last_checked_at: sql<Date>`now() - interval '1 hour'`,
        title: `نمونه ${String(index)}`,
        make_id: data.makeId,
        model_id: data.modelId,
        catalogue_match: 'model',
        model_year_written: 'sh',
        model_year_sh: 1395 + (index % 3),
        mileage_km: 60_000 + index * 15_000,
        price_type: variant.asking === null ? (index === 4 ? 'installment' : 'negotiable') : 'asking',
        asking_price_toman: variant.asking,
        down_payment_toman: index === 4 ? 200_000_000 : null,
        gearbox: index % 2 === 0 ? 'automatic' : 'manual',
        fuel: 'petrol',
        seller_type: index === 6 ? 'dealer' : 'private',
        body_condition: index % 3 === 0 ? 'partly_repainted' : 'minor_scratches',
        engine_condition: 'sound',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await owner
      .insertInto('listing_valuation')
      .values({
        valuation_run_id: data.runId,
        listing_id: row.id,
        asking_price_toman: 'rating' in variant ? variant.asking : null,
        market_value_toman: 1_000_000_000,
        price_gap_pct: 'rating' in variant ? variant.gap : null,
        deal_rating: 'rating' in variant ? variant.rating : null,
        no_rating_reason: 'reason' in variant ? variant.reason : null,
      })
      .execute();
    ids.push(row.id);
  }
  return ids;
}

/** The storage options of the view listing_fact_evidence (security_barrier=true). */
export async function viewOptions(db: Kysely<DB>): Promise<string[]> {
  const { rows } = await sql<{ reloptions: string[] | null }>`
    SELECT reloptions FROM pg_class WHERE relname = 'listing_fact_evidence'`.execute(db);
  return rows[0]?.reloptions ?? [];
}

/** Every re-check request now in the database: waiting, and made in the last hour (the two caps count these). */
export async function recheckCounts(db: Kysely<DB>): Promise<{ waiting: number; lastHour: number }> {
  const { rows } = await sql<{ waiting: number; last_hour: number }>`
    SELECT count(*) FILTER (WHERE handled_at IS NULL)::int AS waiting,
           count(*) FILTER (WHERE requested_at > now() - interval '1 hour')::int AS last_hour
    FROM listing_recheck_request`.execute(db);
  return { waiting: rows[0]?.waiting ?? 0, lastHour: rows[0]?.last_hour ?? 0 };
}
