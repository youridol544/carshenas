import type { DealRating } from '@carshenas/db/db-types';
import type { CatalogueId } from '@carshenas/search/catalogues';
import type { DatabaseOptions } from '@carshenas/search/kinds';

// What the search API returns (CS-59): plain, serialisable data for the search page (CS-61), the home page (CS-63),
// search files (CS-70) and plain-Farsi search (CS-62). Every number comes from the database; prices are whole tomans,
// instants ISO-8601, dates YYYY-MM-DD.

export type { DealRating };

/** A catalogue name at one level: the value a URL uses and the Persian name (the English one where none yet). */
export type Named = { readonly key: string; readonly name: string };

/** One result: what a card shows, and the click-out to the source. */
export type ListingCard = {
  readonly id: number;
  /** The seller's title when the listing's page was read; else null, and `name` is the title to show. */
  readonly title: string | null;
  /** The car as the catalogue names it: the trim's name, else the model's, else the make's. */
  readonly name: string;
  /** The listing on its source: the click-out. */
  readonly url: string;
  readonly source: Named;
  readonly make: Named | null;
  readonly model: Named | null;
  readonly trim: Named | null;
  readonly bodyType: Named | null;
  readonly modelYearSh: number | null;
  readonly modelYearAd: number | null;
  readonly mileageKm: number | null;
  /** How a mileage under the floor was read (CS-101): the figure the seller wrote and what the code made of it. */
  readonly mileageReading: 'really_low' | 'thousands_text' | 'thousands_price' | 'unread' | null;
  readonly mileageWrittenKm: number | null;
  /** Kilometres a year of age, a car under a year counted as half a year. */
  readonly kmPerYear: number | null;
  /** asking, negotiable, installment (the price shown is a down payment) or placeholder, as the source states it. */
  readonly priceType: string | null;
  readonly askingPriceToman: number | null;
  /** The valuation (CS-51's latest succeeded run), or null when the listing is not rated. */
  readonly valuation: {
    readonly marketValueToman: number;
    /** Negative below market value. */
    readonly priceGapPct: number | null;
    readonly dealRating: DealRating | null;
    /** The run's date: market values are shown with their date (ADR-0017 point 6). */
    readonly valuedOn: string;
  } | null;
  readonly gearbox: string | null;
  readonly fuel: string | null;
  readonly colourFamily: string | null;
  readonly city: Named | null;
  readonly district: string | null;
  readonly sellerType: string | null;
  /** The seller's declared condition merged with what the text says (listing_filter_row), as value codes. */
  readonly condition: {
    readonly body: string | null;
    readonly engine: string | null;
    readonly gearbox: string | null;
    readonly chassis: string | null;
    readonly paintFree: boolean | null;
    readonly accident: string | null;
  };
  readonly listedAt: string;
  readonly lastSeenAt: string;
  /** The first photo, on the source's own host (ADR-0025); null when the listing has none. */
  readonly photo: {
    readonly url: string;
    readonly thumbnailUrl: string | null;
    readonly count: number;
  } | null;
};

/** How many listings match: exact, or at least `count` when counting further would cost more than it tells. */
export type SearchTotal = { readonly count: number; readonly exact: boolean };

/** What the search did with the words the buyer typed (the search's `q`). */
export type SearchText = {
  /**
   * False when the words had nothing to search (only punctuation): they were ignored, and every listing that the
   * filters allow matched. The page says so, as it says for any parameter it ignored.
   */
  readonly searchable: boolean;
  /** Words no listing has, replaced by a close, common word: the page says «نتایج برای …». */
  readonly corrections: readonly { readonly from: string; readonly to: string }[];
  /** Words that match no listing and were not replaced: the page says which word found nothing. */
  readonly unknown: readonly string[];
};

export type SearchPage = {
  readonly results: readonly ListingCard[];
  /** The next page's cursor, or null on the last page. */
  readonly nextCursor: string | null;
  /**
   * How many listings match. A later page repeats the first page's total (the cursor carries it): nothing is counted
   * for it. With `limit` 0 the call is only this count.
   */
  readonly total: SearchTotal;
  /** About the words: null when the search has none. */
  readonly text: SearchText | null;
};

export type FacetOption = { readonly value: string; readonly label: string; readonly count: number };

/**
 * For each filter whose options are rows, its options with how many listings each would give: counted without that
 * filter's own values, so the other makes stay visible while one is chosen. Options without listings are left out.
 */
export type SearchFacets = Readonly<Record<DatabaseOptions, readonly FacetOption[]>>;

/**
 * What is searchable, for a data-status page (CS-66): the listings a crawl saw within the freshness window, and how many
 * of them have had their details read, which is what makes a listing searchable. The rest enter by themselves when
 * their details are read.
 */
export type SearchCoverage = {
  readonly searchable: number;
  readonly seen: number;
  /** When the worker last counted these, ISO-8601; null before the first count. */
  readonly countedAt: string | null;
};

/** How many searchable listings each catalogue holds, for its row on the home page. */
export type CatalogueCounts = Readonly<Record<CatalogueId, number>>;
