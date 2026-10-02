import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import {
  analyzeValuationTables,
  failRun,
  finishRun,
  loadComparables,
  rateActiveListings,
  startRun,
  writeFit,
} from '../db/valuation-store.ts';
import { fitValuation } from './fit.ts';
import {
  METHOD_VERSION,
  MILEAGE_NORM_KM_PER_YEAR,
  PRIOR_STRENGTH,
  RETENTION_DAYS,
  WINDOW_DAYS,
} from './method.ts';

// One daily valuation (CS-51, S01 flow 1): gather the comparables, fit, store the run, then value and rate every
// active listing in SQL from what was stored, in batches. The run row is written first and marked failed if anything
// after it throws, so a failed day is visible in the table as well as in the logs; readers use the latest run marked
// succeeded, which only the last transaction does, so a half-written run is never shown.

/** The Jalali year a Tehran day falls in, from the ICU Persian calendar. */
export function jalaliYearOf(isoDate: string): number {
  const year = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T12:00:00Z`));
  const parsed = Number.parseInt(year, 10);
  if (!Number.isInteger(parsed)) throw new Error(`no Jalali year for ${isoDate}`);
  return parsed;
}

export type RunSummary = {
  readonly runId: number;
  readonly comparables: number;
  readonly outliers: number;
  readonly models: number;
  readonly ratingModels: number;
  readonly valued: number;
  readonly rated: number;
};

export type RunOptions = {
  /** Listings rated per statement; the default is the store's, a test uses a small one to prove the batches add up. */
  readonly ratingBatch?: number;
};

export async function runValuation(
  db: Kysely<DB>,
  asOfDate: string,
  options: RunOptions = {},
): Promise<RunSummary> {
  const referenceYearSh = jalaliYearOf(asOfDate);
  const comparables = await loadComparables(db, { asOfDate, windowDays: WINDOW_DAYS });
  const runId = await startRun(db, {
    asOfDate,
    methodVersion: METHOD_VERSION,
    referenceYearSh,
    mileageNormKmPerYear: MILEAGE_NORM_KM_PER_YEAR,
    windowDays: WINDOW_DAYS,
    priorStrength: PRIOR_STRENGTH,
  });
  try {
    const valuation = fitValuation(comparables, referenceYearSh);
    // The fit is committed and analysed before anything reads it: a statement planned against rows its own
    // transaction wrote, with no statistics, chose sequential scans for each listing (86 s a batch, 2026-10-02).
    await db.transaction().execute(async (tx) => {
      await writeFit(tx, runId, valuation);
    });
    await analyzeValuationTables(db, 'fit');
    const rated = await rateActiveListings(db, runId, options.ratingBatch);
    await db.transaction().execute(async (tx) => {
      await finishRun(tx, runId, { comparables: comparables.length, ...rated }, RETENTION_DAYS);
    });
    const counts = rated;
    return {
      runId,
      comparables: comparables.length,
      outliers: valuation.comparables.filter((c) => c.isOutlier).length,
      models: valuation.segments.length,
      ratingModels: valuation.segments.filter((s) => s.ratesListings).length,
      ...counts,
    };
  } catch (error) {
    await failRun(db, runId);
    throw error;
  }
}
