// The public data-status page (CS-66; ADR-0017 points 6 and 9): how fresh the index is, per source and for the whole
// index, what the market values are dated and how accurate they were, and how well listing text is read. Plain,
// serialisable figures from the database; nothing a visitor should not see (no addresses fetched, errors, traces,
// accounts or stop reasons).

/**
 * live: enabled and read within the delay; delayed: enabled, but nothing read for longer; not_updating: paused or
 * stopped on a block, which the page shows without the reason (ADR-0017 point 9).
 */
export type UpdateState = 'live' | 'delayed' | 'not_updating';

export type ListingFigures = {
  /** Listings on the market now. */
  active: number;
  /** Listings the source says were posted in the last 24 hours. */
  postedLast24h: number;
  /** Listings that left the market (sold, expired, gone) in the last 24 hours. */
  goneLast24h: number;
  /** The last time a request to the source returned a listing: its latest data. Null before the first. */
  lastReadAt: string | null;
  /** When the first listing was stored: the index's age. */
  firstStoredAt: string | null;
  /** Active listings of the tracked models, which results pages draw from (CS-59). */
  trackedActive: number;
  /** Of those, the ones seen or checked within the results window, which results pages may show. */
  shown: number;
  /** The median minutes since those shown listings were last seen or checked; null when none. */
  shownCheckMedianMinutes: number | null;
};

export type FreshnessPoint = {
  measuredAt: string;
  activeListings: number;
  /** The median minutes since each active listing was last seen or checked, at that hour. */
  lastCheckMedianMinutes: number | null;
};

export type SourceStatus = {
  id: string;
  nameFa: string;
  state: UpdateState;
  /** The most requests a day the crawler may send the source (ADR-0017 point 5). */
  dailyRequestBudget: number | null;
  figures: ListingFigures;
  /** The median minutes from posting to first storing, in the latest hourly measurement; null without one. */
  postingToStoredMedianMinutes: number | null;
  /** The hourly measurements of the results window, oldest first. */
  series: FreshnessPoint[];
};

export type ModelAccuracy = {
  modelId: number;
  /** The catalogue's Persian name, or its English one while it has none. */
  name: string;
  comparables: number;
  /** The leave-one-out median absolute percentage error, in percent (6.87 is 6.87 %). */
  errorPct: number;
};

export type ValuationStatus = {
  /** The Tehran day the market values hold for, ISO ('2026-09-30'). */
  asOfDate: string;
  finishedAt: string;
  comparables: number;
  valued: number;
  rated: number;
  /** The models that rate listings, most comparables first. */
  models: ModelAccuracy[];
};

export type ExtractionEvaluation = {
  evaluatedOn: string;
  items: number;
  itemsRight: number;
  fieldsScored: number;
  fieldsRight: number;
  injectedItems: number;
  injectedHeld: number;
};

export type DataStatus = {
  /** The database's clock when the figures were read: every age on the page is measured against it. */
  measuredAt: string;
  /** Today in Tehran at measuredAt, ISO ('2026-09-30'): the market values' age is counted in these days. */
  tehranToday: string;
  index: { state: UpdateState; figures: ListingFigures };
  sources: SourceStatus[];
  valuation: ValuationStatus | null;
  extraction: ExtractionEvaluation | null;
};
