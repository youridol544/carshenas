import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import {
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
// active listing in SQL from what was stored. The run row is written first and marked failed if anything after it
// throws, so a failed day is visible in the table as well as in the logs.

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

export async function runValuation(db: Kysely<DB>, asOfDate: string): Promise<RunSummary> {
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
    const counts = await db.transaction().execute(async (tx) => {
      await writeFit(tx, runId, valuation);
      const rated = await rateActiveListings(tx, runId);
      await finishRun(tx, runId, { comparables: comparables.length, ...rated }, RETENTION_DAYS);
      return rated;
    });
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
