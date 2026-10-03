import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { jalaliYearOf as jalaliYearAt } from '@carshenas/locale/jalali';
import {
  analyzeValuationTables,
  clearUntestedMileageReadings,
  failRun,
  finishRun,
  loadComparables,
  loadMileageCandidates,
  rateActiveListings,
  startRun,
  writeFit,
  writeMileageDecisions,
} from '../db/valuation-store.ts';
import { fitValuation } from './fit.ts';
import { decideMileage } from './mileage.ts';
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

/** The Jalali year a Tehran day falls in: the locale package's, asked at noon UTC, which is 15:30 on that day in Tehran. */
export function jalaliYearOf(isoDate: string): number {
  return jalaliYearAt(new Date(`${isoDate}T12:00:00Z`));
}

export type RunSummary = {
  readonly runId: number;
  readonly comparables: number;
  readonly outliers: number;
  readonly models: number;
  readonly ratingModels: number;
  readonly valued: number;
  readonly rated: number;
  /** Listings whose mileage the run tested in thousands (CS-101), and how many it read so. */
  readonly mileageTested: number;
  readonly mileageThousands: number;
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
    // CS-101: a mileage under the floor that the listing's words did not settle is read in thousands when the asking price
    // fits the car at 1,000 times the figure under this run's own fit; the ratings below then use that mileage.
    const decisions = (await loadMileageCandidates(db, { asOfDate, windowDays: WINDOW_DAYS })).map((candidate) =>
      decideMileage(valuation.model, candidate, referenceYearSh),
    );
    await writeMileageDecisions(db, decisions);
    await clearUntestedMileageReadings(
      db,
      decisions.map((decision) => decision.listingId),
    );
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
      mileageTested: decisions.length,
      mileageThousands: decisions.filter((decision) => decision.thousands).length,
      ...counts,
    };
  } catch (error) {
    await failRun(db, runId);
    throw error;
  }
}
