import type { SourceStatus, UpdateState, ValuationStatus } from '@/features/data-status/data-status-types';

// What the data-status page judges from its figures (CS-66): whether a source is being updated, and whether each of
// ADR-0017's freshness targets (point 6) is met by what was measured. Pure, so every rule is unit-tested.

/** The window of the page's new and gone counts: the last 24 hours. */
export const FIGURES_WINDOW_HOURS = 24;

/** ADR-0017 point 6, and CS-59's results window. */
export const FRESHNESS_TARGETS = {
  /** A new listing of a tracked model appears within an hour of being posted. */
  newListingMinutes: 60,
  /** A results page shows only listings seen within the last 48 hours… */
  resultsWindowHours: 48,
  /** …with a median under 24 hours. */
  resultsMedianMinutes: 24 * 60,
  /** Market values are recomputed daily: the latest may be yesterday's until today's run finishes. */
  valuationMaxAgeDays: 1,
} as const;

/**
 * An enabled source with nothing read for this long is delayed: discovery reads each tracked model about every 15
 * minutes (ADR-0017 point 3), so an hour of silence is four missed rounds.
 */
export const DELAYED_AFTER_MINUTES = 60;

export function sourceState(crawlState: string, lastReadAt: string | null, now: string): UpdateState {
  if (crawlState !== 'enabled') return 'not_updating';
  if (lastReadAt === null) return 'delayed';
  return Date.parse(now) - Date.parse(lastReadAt) > DELAYED_AFTER_MINUTES * 60_000 ? 'delayed' : 'live';
}

/** The whole index is live while any source is, and delayed while any is only delayed. */
export function indexState(states: readonly UpdateState[]): UpdateState {
  if (states.includes('live')) return 'live';
  if (states.includes('delayed')) return 'delayed';
  return 'not_updating';
}

export type TargetKey = 'newListing' | 'resultsMedian' | 'valuationDaily';

/** A target and what was measured against it; unmeasured when there is nothing to measure yet. */
export type TargetResult =
  | { key: TargetKey; status: 'met' | 'missed'; measured: number }
  | { key: TargetKey; status: 'unmeasured' };

function judge(key: TargetKey, measured: number | null, target: number): TargetResult {
  if (measured === null) return { key, status: 'unmeasured' };
  return { key, status: measured <= target ? 'met' : 'missed', measured };
}

/** Whole days from the values' Tehran day to today's, both ISO dates. */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round((Date.parse(toIsoDate) - Date.parse(fromIsoDate)) / 86_400_000);
}

/**
 * The three targets a visitor can check: new listings within the hour (the median from posting to storing, over every
 * source measured), results checked within a day (the whole index's median), and market values from today or
 * yesterday (days measured on Tehran's calendar).
 */
export function judgeTargets(input: {
  sources: readonly Pick<SourceStatus, 'postingToStoredMedianMinutes'>[];
  shownCheckMedianMinutes: number | null;
  valuation: Pick<ValuationStatus, 'asOfDate'> | null;
  tehranToday: string;
}): TargetResult[] {
  const postings = input.sources
    .map((source) => source.postingToStoredMedianMinutes)
    .filter((minutes) => minutes !== null);
  return [
    judge(
      'newListing',
      postings.length === 0 ? null : Math.max(...postings),
      FRESHNESS_TARGETS.newListingMinutes,
    ),
    judge('resultsMedian', input.shownCheckMedianMinutes, FRESHNESS_TARGETS.resultsMedianMinutes),
    judge(
      'valuationDaily',
      input.valuation === null ? null : daysBetween(input.valuation.asOfDate, input.tehranToday),
      FRESHNESS_TARGETS.valuationMaxAgeDays,
    ),
  ];
}
