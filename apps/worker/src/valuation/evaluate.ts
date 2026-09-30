import type { LoadedComparable } from '../db/valuation-store.ts';
import { fitValuation, predictLn, type Comparable } from './fit.ts';
import { at } from './linear-algebra.ts';

// The accuracy report of S01 ("Accuracy"; CS-51 criterion 5): the fit is learned on one part of the comparables and
// scored on the rest, with the same rules a rating needs (a model that rates listings, three learned comparables
// within two model years). Two splits: by time, learning only from listings posted before the cut, which is how the
// product works and the harder test; and a seeded random 80/20 split, comparable with other entrants' reports.

export type SplitScore = {
  readonly modelId: number;
  readonly tested: number;
  /** Median absolute percentage error of the predicted value against the asking price. */
  readonly mdapePct: number;
  /** Share of tested listings within 10 % of their asking price. */
  readonly within10Pct: number;
};

export type SplitReport = {
  readonly split: 'time' | 'random';
  readonly learned: number;
  readonly candidates: number;
  readonly overall: SplitScore | undefined;
  readonly models: readonly SplitScore[];
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? at(sorted, middle) : (at(sorted, middle - 1) + at(sorted, middle)) / 2;
}

function score(modelId: number, errors: readonly number[]): SplitScore {
  return {
    modelId,
    tested: errors.length,
    mdapePct: Math.round(median(errors) * 100) / 100,
    within10Pct: Math.round((errors.filter((error) => error <= 10).length * 10_000) / errors.length) / 100,
  };
}

function scoreSplit(
  split: SplitReport['split'],
  learn: readonly Comparable[],
  test: readonly Comparable[],
  referenceYearSh: number,
): SplitReport {
  const valuation = fitValuation(learn, referenceYearSh);
  const rating = new Set(valuation.segments.filter((s) => s.ratesListings).map((s) => s.modelId));
  const learnedYears = new Map<number, number[]>();
  for (const { comparable, isOutlier } of valuation.comparables) {
    if (isOutlier) continue;
    const years = learnedYears.get(comparable.modelId) ?? [];
    years.push(comparable.attributes.modelYearSh);
    learnedYears.set(comparable.modelId, years);
  }
  const errors = new Map<number, number[]>();
  for (const listing of test) {
    if (!rating.has(listing.modelId)) continue;
    const near = (learnedYears.get(listing.modelId) ?? []).filter(
      (year) => Math.abs(year - listing.attributes.modelYearSh) <= 2,
    );
    if (near.length < 3) continue;
    const ln = predictLn(valuation.model, listing, referenceYearSh);
    if (ln === undefined) continue;
    const error = (Math.abs(Math.exp(ln) - listing.askingPriceToman) * 100) / listing.askingPriceToman;
    const list = errors.get(listing.modelId) ?? [];
    list.push(error);
    errors.set(listing.modelId, list);
  }
  const all = [...errors.values()].flat();
  return {
    split,
    learned: learn.length,
    candidates: test.length,
    overall: all.length > 0 ? score(0, all) : undefined,
    models: [...errors].map(([modelId, list]) => score(modelId, list)).sort((a, b) => b.tested - a.tested),
  };
}

/** Days between two ISO dates, b − a. */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * The time split: learn from comparables posted before `cutDate`, valued as of the day before it; score those posted
 * on or after it, each valued for its own day (the market trend carried forward).
 */
export function timeSplit(
  comparables: readonly LoadedComparable[],
  asOfDate: string,
  cutDate: string,
  referenceYearSh: number,
): SplitReport {
  const shift = daysBetween(cutDate, asOfDate) + 1;
  const rebase = (c: LoadedComparable): Comparable => ({
    ...c,
    attributes: { ...c.attributes, daysBeforeAsOf: c.attributes.daysBeforeAsOf - shift },
  });
  const learn = comparables.filter((c) => c.listedDate < cutDate).map(rebase);
  const test = comparables.filter((c) => c.listedDate >= cutDate).map(rebase);
  return scoreSplit('time', learn, test, referenceYearSh);
}

/** A seeded 80/20 split of the same comparables, each valued for its own day. */
export function randomSplit(
  comparables: readonly Comparable[],
  referenceYearSh: number,
  seed = 51,
): SplitReport {
  let state = seed >>> 0;
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const learn: Comparable[] = [];
  const test: Comparable[] = [];
  for (const comparable of comparables) (next() < 0.8 ? learn : test).push(comparable);
  return scoreSplit('random', learn, test, referenceYearSh);
}
