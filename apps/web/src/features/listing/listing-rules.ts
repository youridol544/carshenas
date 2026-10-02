import { DEAL_GAP_PCT } from '@carshenas/search/filters';
import type { DealRating } from '@carshenas/db/db-types';

// The numbers the listing page quotes from the rules of docs/specs/S01-deal-ratings.md: one named home for each, so a
// sentence of the page and the SQL it describes cannot drift unnoticed (listing-rules.db.test.ts reads them back from
// valuation_rate_listing()'s own definition). The deal bands' limits are not repeated here: they are DEAL_GAP_PCT.

/** A model needs this many comparables in a run before its listings are rated (S01, "Enough comparables" 1). */
export const MIN_COMPARABLES = 8;
/** ... and this many within two model years of the listing (rule 2). */
export const MIN_NEAR_YEAR_COMPARABLES = 3;
/** The years that count as near. */
export const NEAR_YEARS = 2;
/** ... and a segment error above this, in percent, is not rated (rule 3). */
export const MAX_SEGMENT_ERROR_PCT = 15;
/** An instalment-accepting listing this far below its value, in percent, is not rated (CS-87). */
export const INSTALLMENT_GUARD_GAP_PCT = 20;
/** A price beyond this factor of the market value is an outlier, not a rating (S01, reason price_outlier). */
export const OUTLIER_FACTOR = 3;

/** How long a read of a listing's own page stays fresh (ADR-0017 point 3; the worker's FRESHNESS_WINDOW_HOURS). */
export const FRESHNESS_WINDOW_HOURS = 6;

/** The adjustments smaller than this, in percent, are left out of the explanation: they do not move the value. */
export const MIN_ADJUSTMENT_PCT = 0.5;

/** The gauge covers this many percent either side of the market value; a price beyond it sits at the end. */
export const GAUGE_HALF_RANGE_PCT = 20;

export type GaugeBand = {
  readonly rating: DealRating;
  /** The band's share of the bar's length, from the cheap end; the shares add up to 1. */
  readonly share: number;
  /** The band's limits in percent of market value (negative below), clamped to the bar's range. */
  readonly fromPct: number;
  readonly toPct: number;
};

/**
 * The five bands of the deal ramp laid on the bar from the cheap end: each one's width is its span of price gap, from
 * S01's limits (DEAL_GAP_PCT) with the two outer ones running to the bar's ends.
 */
export function gaugeBands(): readonly GaugeBand[] {
  const limits = [
    -GAUGE_HALF_RANGE_PCT,
    DEAL_GAP_PCT.great,
    DEAL_GAP_PCT.good,
    DEAL_GAP_PCT.fair,
    DEAL_GAP_PCT.high,
    GAUGE_HALF_RANGE_PCT,
  ] as const;
  const ratings = ['great', 'good', 'fair', 'high', 'overpriced'] as const;
  return ratings.map((rating, index) => {
    const fromPct = limits[index] ?? 0;
    const toPct = limits[index + 1] ?? 0;
    return { rating, fromPct, toPct, share: (toPct - fromPct) / (2 * GAUGE_HALF_RANGE_PCT) };
  });
}

/** Where a price gap sits on the bar, 0 at the cheap end and 1 at the other, never beyond it. */
export function markerShare(gapPct: number): number {
  const clamped = Math.min(Math.max(gapPct, -GAUGE_HALF_RANGE_PCT), GAUGE_HALF_RANGE_PCT);
  return (clamped + GAUGE_HALF_RANGE_PCT) / (2 * GAUGE_HALF_RANGE_PCT);
}

/** True when the gap lies beyond the bar's range, so the marker sits at an end instead of at the price. */
export function isBeyondGauge(gapPct: number): boolean {
  return Math.abs(gapPct) > GAUGE_HALF_RANGE_PCT;
}
