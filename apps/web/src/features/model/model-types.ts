import type { DealRating } from '@carshenas/db/db-types';

// What the model page shows, as plain serialisable data (CS-67). Every number comes from the database; prices are whole
// tomans, dates are ISO days (YYYY-MM-DD, Tehran), and a figure that cannot be stated is null, never a guess.

export type ModelRef = {
  readonly id: number;
  /** The address segments: /models/<makeSlug>/<slug>. */
  readonly makeSlug: string;
  readonly slug: string;
  /** The key search filters use: «peugeot.206». */
  readonly key: string;
  readonly makeName: string;
  /** The catalogue's Persian name, which includes the make: «پژو ۲۰۶». */
  readonly name: string;
  readonly bodyType: { readonly code: string; readonly label: string } | null;
};

export type ModelStats = {
  /** Listings a buyer can find in the search now. */
  readonly count: number;
  /** Those with an asking price (not negotiable, not an instalment sale). */
  readonly priced: number;
  readonly medianToman: number | null;
  /** The middle share of the asking prices (RANGE_*_FRACTION). */
  readonly lowToman: number | null;
  readonly highToman: number | null;
  /** The median of the listings' own market values: the value of the typical listed car. */
  readonly marketValueToman: number | null;
  readonly valued: number;
  readonly medianMileageKm: number | null;
  /** The model's rank by listings (1 = the most listed), when it is one of the search's popular models. */
  readonly popularRank: number | null;
  readonly firstYear: number | null;
  readonly lastYear: number | null;
  readonly ratings: Readonly<Record<DealRating, number>>;
  /** How many have no rating (no asking price, too few comparables, ...). */
  readonly unrated: number;
  /** Condition and seller facts: how many listings state each, and how many of those say the good thing. */
  readonly facts: {
    readonly paintFree: { readonly of: number; readonly yes: number };
    readonly automatic: { readonly of: number; readonly yes: number };
    readonly privateSeller: { readonly of: number; readonly yes: number };
  };
};

export type YearRow = {
  readonly year: number;
  readonly count: number;
  readonly medianToman: number | null;
  readonly marketValueToman: number | null;
  readonly medianMileageKm: number | null;
};

export type TrimRow = {
  /** The search key «make.model.trim», or null for the listings that name the model only. */
  readonly key: string | null;
  readonly name: string | null;
  readonly count: number;
  readonly medianToman: number | null;
};

/** One day of the valuation's history for one model year. */
export type TrendDay = {
  readonly date: string;
  readonly count: number;
  readonly medianToman: number;
  readonly lowToman: number;
  readonly highToman: number;
  readonly marketValueToman: number | null;
};

export type ModelOverview = {
  readonly stats: ModelStats;
  readonly years: readonly YearRow[];
  /** The newest valuation run, as the market values' date; null before the first. */
  readonly valuedOn: string | null;
};

export type PopularModel = {
  readonly makeSlug: string;
  readonly slug: string;
  readonly name: string;
  readonly bodyType: string | null;
  readonly count: number;
  readonly medianToman: number | null;
};

export type ModelIndexEntry = PopularModel & { readonly makeName: string };
