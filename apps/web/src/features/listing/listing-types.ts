import type { DealRating } from '@carshenas/db/db-types';

// What the listing page reads (CS-64), as plain serialisable data: the one shape that the page, its explanation and
// the pages that build on it (a pasted link's result, CS-65; the model page, CS-67) share. Every number comes from the
// database; prices are whole tomans, instants ISO-8601, dates YYYY-MM-DD. server/listing-page-data.ts makes it.

export type { DealRating };

export type ListingStatus = 'active' | 'sold' | 'expired' | 'gone' | 'removed';

/** Why a priced listing has a market value or none but no rating (S01, "Price gap and ratings"). */
export type NoRatingReason =
  | 'unmatched_model'
  | 'missing_attributes'
  | 'excluded_condition'
  | 'too_few_comparables'
  | 'uncertain_segment'
  | 'year_out_of_range'
  | 'unknown_price'
  | 'no_asking_price'
  | 'placeholder_price'
  | 'installment_price'
  | 'dealer_new_car'
  | 'price_outlier';

/** The terms of the fitted price model that apply to one car by their own value (S01, "The price model"). */
export type AdjustmentTerm =
  | 'mileage_deviation'
  | 'zero_km'
  | 'body_minor'
  | 'body_painted'
  | 'body_painted_around'
  | 'chassis_repainted'
  | 'gearbox_automatic'
  | 'dual_fuel_aftermarket'
  | 'electrified'
  | 'off_colour';

export type Named = { readonly key: string; readonly name: string };

/** The offer itself, as stored. */
export type ListingFacts = {
  readonly id: number;
  /** The seller's title; null before the listing's own page was read. */
  readonly title: string | null;
  /** The car as the catalogue names it: the trim, else the model, else the make. */
  readonly name: string;
  readonly make: Named | null;
  readonly model: Named | null;
  readonly trim: Named | null;
  /** The listing on its source: the click-out. */
  readonly url: string;
  readonly source: Named;
  readonly status: ListingStatus;
  readonly listedAt: string;
  readonly lastSeenAt: string;
  /** When its own page was last read; null when only ever seen in a list. */
  readonly lastCheckedAt: string | null;
  /** When it left the market; null while it is on it. */
  readonly delistedAt: string | null;
  readonly modelYearSh: number | null;
  readonly modelYearAd: number | null;
  readonly mileageKm: number | null;
  readonly fuel: string | null;
  readonly gearbox: string | null;
  readonly colour: string | null;
  readonly colourFamily: string | null;
  readonly city: string | null;
  readonly district: string | null;
  readonly sellerType: string | null;
  readonly insuranceMonthsLeft: number | null;
  readonly priceType: string | null;
  readonly askingPriceToman: number | null;
  /** The shown price of an instalment sale: a down payment, not the price of the car. */
  readonly downPaymentToman: number | null;
  readonly acceptsInstallments: boolean | null;
  readonly acceptsSwap: boolean | null;
  /** What the seller declared, as value codes. */
  readonly declared: {
    readonly body: string | null;
    readonly engine: string | null;
    readonly gearbox: string | null;
    readonly frontChassis: string | null;
    readonly rearChassis: string | null;
  };
};

export type PhotoAddress = { readonly url: string; readonly thumbnailUrl: string | null };

/** The latest succeeded valuation run's verdict on this listing, with what explains it. */
export type ValuationFacts = {
  readonly run: {
    readonly asOfDate: string;
    readonly methodVersion: number;
    readonly referenceYearSh: number;
    readonly mileageNormKmPerYear: number;
    readonly windowDays: number;
  };
  readonly marketValueToman: number;
  /** The asking price the run rated; null for a negotiable or instalment listing. */
  readonly ratedPriceToman: number | null;
  /** Negative below market value; stored only for a rated listing. */
  readonly priceGapPct: number | null;
  readonly dealRating: DealRating | null;
  readonly noRatingReason: NoRatingReason | null;
  /** The model's segment in the run: how many comparables, which years, how accurate. */
  readonly segment: {
    readonly comparableCount: number;
    readonly minModelYearSh: number;
    readonly maxModelYearSh: number;
    /** The model's median absolute percentage error in leave-one-out, as stored (two decimals). */
    readonly errorPct: number | null;
    readonly ratesListings: boolean;
  } | null;
  /** The fitted log-scale coefficients that belong to this car's kind of adjustment, and its model's age slope. */
  readonly coefficients: Readonly<Partial<Record<AdjustmentTerm, number>>>;
  readonly modelAgeSlope: number | null;
};

/** One of the (up to ten) nearest comparables behind the market value. */
export type Comparable = {
  readonly position: number;
  readonly listingId: number;
  readonly name: string;
  readonly modelYearSh: number | null;
  readonly mileageKm: number | null;
  readonly status: ListingStatus;
  readonly askingPriceToman: number;
  /** Its price adjusted to this listing's year, mileage and condition (price × this value ÷ its value). */
  readonly adjustedPriceToman: number;
};

/** A change of the asking price (or of what the listing states as its price), from the first one we saw. */
export type PriceEvent = {
  readonly observedAt: string;
  readonly priceType: string;
  readonly askingPriceToman: number | null;
  readonly previousPriceType: string | null;
  readonly previousPriceToman: number | null;
};

/** A fact the listing's text states (CS-52), accepted at its confidence threshold, with the phrase it was read from. */
export type FactEvidence = {
  readonly field: string;
  readonly value: string;
  /** The phrase of the text the fact was read from; null when it was long or looked like a phone number. */
  readonly evidence: string | null;
};

/** A listing the page offers when this one has left the market. */
export type SimilarListing = {
  readonly id: number;
  readonly name: string;
  readonly modelYearSh: number | null;
  readonly mileageKm: number | null;
  readonly askingPriceToman: number | null;
  readonly dealRating: DealRating | null;
  readonly priceGapPct: number | null;
  readonly photoUrl: string | null;
};

export type ListingPageData = {
  /** The database's clock when the page was read: every "ago" on the page is measured against it. */
  readonly now: string;
  readonly listing: ListingFacts;
  readonly photos: readonly PhotoAddress[];
  readonly valuation: ValuationFacts | null;
  readonly comparables: readonly Comparable[];
  readonly priceHistory: readonly PriceEvent[];
  readonly evidence: readonly FactEvidence[];
  /** Only for a listing that has left the market: the nearest listings still on it. */
  readonly similar: readonly SimilarListing[];
};

export type ListingPageResult =
  { readonly status: 'found'; readonly page: ListingPageData } | { readonly status: 'missing' };

/** What the re-check action answers: asked (or already asked), or a Farsi reason it could not be recorded. */
export type RecheckResult =
  { readonly status: 'queued' } | { readonly status: 'failed'; readonly message: string };
