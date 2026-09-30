import 'server-only';
import { cacheLife } from 'next/cache';
import { tehranIsoDate } from '@carshenas/locale/format-date';
import { FRESHNESS_TARGETS, indexState, sourceState } from '@/features/data-status/data-status-rules';
import type {
  DataStatus,
  ExtractionEvaluation,
  FreshnessPoint,
  ListingFigures,
  ValuationStatus,
} from '@/features/data-status/data-status-types';
import { readDatabase } from '@/server/db/database';
import {
  databaseNow,
  equalsLiteral,
  isoDateText,
  laterOf,
  medianMinutesSince,
  rollup,
  secondsAgo,
} from '@/server/db/sql-helpers';

// The public data-status page's figures (CS-66), read as carshenas_web: sources, listings, the hourly freshness
// measurements, the latest valuation run and the latest published evaluation. Nothing technical leaves this file: no
// fetched addresses, errors, traces, accounts or stop reasons. Five reads in parallel; the plans, measured with
// EXPLAIN (ANALYZE, BUFFERS) on a copy of the crawler's data, are in CS-66's notes.

/** The AI step whose evaluation the page shows: reading condition and price facts from listing text (CS-52). */
const EXTRACTION_TASK = 'listing.facts';

const DAY_SECONDS = 86_400;
const RESULTS_WINDOW_SECONDS = FRESHNESS_TARGETS.resultsWindowHours * 3_600;

type FigureRow = {
  source_id: string | null;
  now: Date;
  active: number;
  posted: number;
  gone: number;
  last_read_at: Date | null;
  first_stored_at: Date | null;
  tracked_active: number;
  shown: number;
  shown_check_median_minutes: number | null;
};

const NO_LISTINGS: ListingFigures = {
  active: 0,
  postedLast24h: 0,
  goneLast24h: 0,
  lastReadAt: null,
  firstStoredAt: null,
  trackedActive: 0,
  shown: 0,
  shownCheckMedianMinutes: null,
};

function toFigures(row: FigureRow | undefined): ListingFigures {
  if (row === undefined) return NO_LISTINGS;
  return {
    active: row.active,
    postedLast24h: row.posted,
    goneLast24h: row.gone,
    lastReadAt: row.last_read_at?.toISOString() ?? null,
    firstStoredAt: row.first_stored_at?.toISOString() ?? null,
    trackedActive: row.tracked_active,
    shown: row.shown,
    shownCheckMedianMinutes: row.shown_check_median_minutes,
  };
}

/**
 * Every figure the page shows, cached for a minute so a burst of visitors costs one set of reads. The lifetime is
 * short on purpose: under five minutes of expiry the page never bakes figures into the build; it reads them when
 * asked, then serves them for a minute and refreshes them in the background for two more.
 */
export async function loadDataStatus(): Promise<DataStatus> {
  'use cache';
  cacheLife({ stale: 60, revalidate: 60, expire: 180 });

  const database = readDatabase();
  const lastRead = laterOf('listing.last_seen_at', 'listing.last_checked_at');
  const since24h = secondsAgo(DAY_SECONDS);

  const [sources, figures, measurements, valuationRun, segments, evaluation] = await Promise.all([
    database
      .selectFrom('source')
      .select(['id', 'name_fa', 'crawl_state', 'daily_request_budget'])
      .where('access_method', '=', 'crawl')
      .orderBy('id')
      .execute(),
    // One pass over the listings, per source and for the whole index (ROLLUP). A results page draws on the active
    // listings of the tracked models (the keys of each source's latest freshness measurement, through the catalogue
    // model each names, so its trims count) and shows those read within the results window (CS-59 criterion 5).
    database
      .with('tracked', (db) =>
        db
          .selectFrom('freshness_measurement as measured')
          .innerJoin('catalogue_source_key', (join) =>
            join
              .onRef('catalogue_source_key.source_id', '=', 'measured.source_id')
              .onRef('catalogue_source_key.source_model_key', '=', 'measured.source_model_key'),
          )
          .select(['catalogue_source_key.source_id', 'catalogue_source_key.model_id'])
          .distinct()
          .where('measured.source_model_key', 'is not', null)
          .where('measured.measured_at', '=', (eb) =>
            eb
              .selectFrom('freshness_measurement as latest')
              .select((inner) => inner.fn.max('latest.measured_at').as('measured_at'))
              .whereRef('latest.source_id', '=', 'measured.source_id')
              .where('latest.source_model_key', 'is', null),
          ),
      )
      .selectFrom('listing')
      .leftJoin('tracked', (join) =>
        join
          .onRef('tracked.source_id', '=', 'listing.source_id')
          .onRef('tracked.model_id', '=', 'listing.model_id'),
      )
      .select((eb) => {
        const trackedActive = eb.and([
          equalsLiteral('listing.status', 'active'),
          eb('tracked.model_id', 'is not', null),
        ]);
        const shown = eb.and([trackedActive, eb(lastRead, '>', secondsAgo(RESULTS_WINDOW_SECONDS))]);
        return [
          'listing.source_id',
          databaseNow().as('now'),
          eb.fn.countAll<number>().filterWhere(equalsLiteral('listing.status', 'active')).as('active'),
          eb.fn.countAll<number>().filterWhere('listing.listed_at', '>', since24h).as('posted'),
          eb.fn.countAll<number>().filterWhere('listing.delisted_at', '>', since24h).as('gone'),
          eb.fn.max(lastRead).as('last_read_at'),
          eb.fn.min('listing.created_at').as('first_stored_at'),
          eb.fn.countAll<number>().filterWhere(trackedActive).as('tracked_active'),
          eb.fn.countAll<number>().filterWhere(shown).as('shown'),
          medianMinutesSince(lastRead, shown).as('shown_check_median_minutes'),
        ];
      })
      .groupBy(rollup('listing.source_id'))
      .execute(),
    // Each source's hourly measurements over the results window, on freshness_measurement_once_unique.
    database
      .selectFrom('freshness_measurement')
      .select([
        'source_id',
        'measured_at',
        'active_listings',
        'posting_to_first_seen_p50_minutes',
        'last_seen_age_p50_minutes',
      ])
      .where('source_model_key', 'is', null)
      .where('measured_at', '>', secondsAgo(RESULTS_WINDOW_SECONDS))
      .orderBy('source_id')
      .orderBy('measured_at')
      .execute(),
    // The latest succeeded run, on valuation_run_succeeded_unique.
    database
      .selectFrom('valuation_run')
      .select([
        'id',
        isoDateText('as_of_date').as('as_of_date'),
        'finished_at',
        'comparable_count',
        'valued_count',
        'rated_count',
      ])
      .where(equalsLiteral('status', 'succeeded'))
      .orderBy('as_of_date', 'desc')
      .orderBy('method_version', 'desc')
      .limit(1)
      .executeTakeFirst(),
    // Its models that rate listings, with their leave-one-out error, without waiting for the run's row.
    database
      .selectFrom('valuation_segment')
      .innerJoin('model', 'model.id', 'valuation_segment.model_id')
      .select([
        'valuation_segment.valuation_run_id',
        'valuation_segment.model_id',
        'model.name_fa',
        'model.name_en',
        'valuation_segment.comparable_count',
        'valuation_segment.error_pct',
      ])
      .where('valuation_segment.valuation_run_id', '=', (eb) =>
        eb
          .selectFrom('valuation_run')
          .select('valuation_run.id')
          .where(equalsLiteral('valuation_run.status', 'succeeded'))
          .orderBy('valuation_run.as_of_date', 'desc')
          .orderBy('valuation_run.method_version', 'desc')
          .limit(1),
      )
      .where('valuation_segment.rates_listings', '=', true)
      .where('valuation_segment.error_pct', 'is not', null)
      .orderBy('valuation_segment.comparable_count', 'desc')
      .orderBy('valuation_segment.model_id')
      .execute(),
    database
      .selectFrom('ai_evaluation')
      .select([
        isoDateText('evaluated_on').as('evaluated_on'),
        'items',
        'items_right',
        'fields_scored',
        'fields_right',
        'injected_items',
        'injected_held',
      ])
      .where('task', '=', EXTRACTION_TASK)
      .orderBy('evaluated_on', 'desc')
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst(),
  ]);

  // ROLLUP always returns the whole index's row, even over no listings.
  const total = figures.find((row) => row.source_id === null);
  const now = (total ?? figures[0])?.now.toISOString() ?? '';
  const bySource = new Map(figures.flatMap((row) => (row.source_id === null ? [] : [[row.source_id, row]])));
  const sourceStatuses = sources.map((source) => {
    const sourceFigures = toFigures(bySource.get(source.id));
    const own = measurements.filter((row) => row.source_id === source.id);
    const series: FreshnessPoint[] = own.map((row) => ({
      measuredAt: row.measured_at.toISOString(),
      activeListings: row.active_listings,
      lastCheckMedianMinutes: row.last_seen_age_p50_minutes,
    }));
    const latest = own.at(-1);
    return {
      id: source.id,
      nameFa: source.name_fa,
      state: sourceState(source.crawl_state, sourceFigures.lastReadAt, now),
      dailyRequestBudget: source.daily_request_budget,
      figures: sourceFigures,
      postingToStoredMedianMinutes: latest?.posting_to_first_seen_p50_minutes ?? null,
      series,
    };
  });

  const valuation: ValuationStatus | null =
    valuationRun === undefined ||
    valuationRun.finished_at === null ||
    valuationRun.valued_count === null ||
    valuationRun.rated_count === null ||
    valuationRun.comparable_count === null
      ? null
      : {
          asOfDate: valuationRun.as_of_date,
          finishedAt: valuationRun.finished_at.toISOString(),
          comparables: valuationRun.comparable_count,
          valued: valuationRun.valued_count,
          rated: valuationRun.rated_count,
          models: segments
            .filter((segment) => segment.valuation_run_id === valuationRun.id)
            .flatMap((segment) =>
              segment.error_pct === null
                ? []
                : [
                    {
                      modelId: segment.model_id,
                      name: segment.name_fa ?? segment.name_en,
                      comparables: segment.comparable_count,
                      errorPct: Number(segment.error_pct),
                    },
                  ],
            ),
        };

  const extraction: ExtractionEvaluation | null =
    evaluation === undefined
      ? null
      : {
          evaluatedOn: evaluation.evaluated_on,
          items: evaluation.items,
          itemsRight: evaluation.items_right,
          fieldsScored: evaluation.fields_scored,
          fieldsRight: evaluation.fields_right,
          injectedItems: evaluation.injected_items,
          injectedHeld: evaluation.injected_held,
        };

  return {
    measuredAt: now,
    tehranToday: tehranIsoDate(now),
    index: {
      state: indexState(sourceStatuses.map((source) => source.state)),
      figures: toFigures(total),
    },
    sources: sourceStatuses,
    valuation,
    extraction,
  };
}
