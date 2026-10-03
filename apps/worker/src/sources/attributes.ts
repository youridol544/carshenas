import type { Listing, ListingUnparsedValue } from '@carshenas/db/db-types';
import type { ShownPrice } from './price.ts';

// What a listing says about its car, as a source's parser reads it from the listing's latest snapshot (CS-34;
// docs/design/data-model.md, "Added by CS-34"): the same shape for every source, so the write, the derive command and
// the next sources' parsers (CS-54) share one path. Every value is read by code, never by a model, and never guessed: a
// value the parser cannot read is returned as unparsed with its raw text, and its column stays null; so is a figure it
// can read but cannot believe (a mileage too low for the car's age, CS-86), with its reason. The value lists are the
// database's own, from the generated types.

export type Fuel = NonNullable<Listing['fuel']>;
export type Gearbox = NonNullable<Listing['gearbox']>;
export type SellerType = NonNullable<Listing['seller_type']>;
export type BodyCondition = NonNullable<Listing['body_condition']>;
/** An engine's or a gearbox's rating. */
export type PartCondition = NonNullable<Listing['engine_condition']>;
export type ChassisCondition = NonNullable<Listing['front_chassis_condition']>;
export type UnparsedField = ListingUnparsedValue['field'];

/**
 * What reading one stated value gave: a value; a form that means unknown (read, but with no value); or text the parser
 * cannot read, which is kept as unparsed.
 */
export type Read<T> =
  | { readonly outcome: 'value'; readonly value: T }
  | { readonly outcome: 'unknown' }
  | { readonly outcome: 'unparsed' };

export const UNKNOWN = { outcome: 'unknown' } as const;
export const UNPARSED = { outcome: 'unparsed' } as const;

export function valueOf<T>(value: T): Read<T> {
  return { outcome: 'value', value };
}

/** A model year as the listing stated it (ADR-0014 point 7). */
export type ModelYear =
  | { readonly written: 'sh'; readonly sh: number }
  | { readonly written: 'ad'; readonly ad: number; readonly sh: number }
  | { readonly written: 'both'; readonly sh: number; readonly ad: number };

/** The years the database accepts in each calendar (listing_model_year_sh_range, listing_model_year_ad_range). */
const SOLAR_YEARS = { first: 1300, last: 1500 } as const;
const GREGORIAN_YEARS = { first: 1921, last: 2121 } as const;
/** How Divar pairs the two calendars («۱۴۰۴ - ۲۰۲۵»), and what ADR-0014 derives a Gregorian-only year's solar year by. */
const CALENDAR_GAP = 621;

function within(year: number, years: { readonly first: number; readonly last: number }): boolean {
  return Number.isInteger(year) && year >= years.first && year <= years.last;
}

/**
 * The model year that one stated year is, in whichever calendar it falls, or undefined when it falls in neither. A
 * Gregorian year also gets its solar year, minus 621 (ADR-0014).
 */
export function yearStatedAlone(year: number): ModelYear | undefined {
  if (within(year, SOLAR_YEARS)) return { written: 'sh', sh: year };
  if (within(year, GREGORIAN_YEARS) && within(year - CALENDAR_GAP, SOLAR_YEARS)) {
    return { written: 'ad', ad: year, sh: year - CALENDAR_GAP };
  }
  return undefined;
}

/**
 * The model year two stated years are, in either order, or undefined unless one is a solar year and the other a
 * Gregorian year 621 or 622 later (listing_model_year_calendars_agree).
 */
export function yearsStatedTogether(first: number, second: number): ModelYear | undefined {
  const [sh, ad] = first < second ? [first, second] : [second, first];
  if (!within(sh, SOLAR_YEARS) || !within(ad, GREGORIAN_YEARS)) return undefined;
  const gap = ad - sh;
  return gap === CALENDAR_GAP || gap === CALENDAR_GAP + 1 ? { written: 'both', sh, ad } : undefined;
}

/** What a listing states about its car; null wherever it states nothing this parser can read. */
export type ListingAttributes = {
  readonly title: string | null;
  /** The source's own make, model and trim value (Divar's brand_model). */
  readonly sourceModelKey: string | null;
  readonly modelYear: ModelYear | null;
  /** The mileage every reader uses: as written, or the assumed one when the figure was read in thousands (CS-101). */
  readonly mileageKm: number | null;
  /** How a figure under the floor was read, with the figure the seller wrote; null for any other mileage. */
  readonly mileageReading: MileageReading | null;
  readonly fuel: Fuel | null;
  readonly gearbox: Gearbox | null;
  readonly insuranceMonthsLeft: number | null;
  /** Asking, negotiable or a placeholder; an installment offer is read from the text (CS-52). */
  readonly price: ShownPrice | null;
  readonly acceptsSwap: boolean | null;
  readonly acceptsInstallments: boolean | null;
  readonly sellerType: SellerType | null;
  readonly bodyCondition: BodyCondition | null;
  readonly engineCondition: PartCondition | null;
  readonly gearboxCondition: PartCondition | null;
  readonly frontChassisCondition: ChassisCondition | null;
  readonly rearChassisCondition: ChassisCondition | null;
  /** The colour's code in the catalogue's code table (CS-50). */
  readonly colour: string | null;
  /** The city the post is in, by the source's own slug and Persian name (CS-50). */
  readonly city: { readonly slug: string; readonly nameFa: string } | null;
  /** The district as the post names it. */
  readonly districtFa: string | null;
};

/** A photo's addresses on the source's own photo host (ADR-0025). */
export type PhotoAddress = {
  readonly url: string;
  readonly thumbnailUrl: string | null;
};

/**
 * Why a value the parser could read is kept as unparsed text all the same: `implausible` is a figure that cannot mean
 * what it says for this listing (isImplausibleMileage). A value the parser could not read has no reason.
 */
export type UnparsedReason = 'implausible';

/** A value the listing states that the parser could not read or would not accept, exactly as the source wrote it. */
export type UnparsedValue = {
  readonly field: UnparsedField;
  readonly rawText: string;
  readonly reason?: UnparsedReason;
};

// A mileage too low for the car's age (CS-86). Sellers often type the mileage in thousands of kilometres («۱۰۹» for a
// car that has run 109,000 km), and nobody who sells a car that is not new means a few kilometres. The parser does not
// guess the thousands: a reading it cannot prove is a guess, and a wrong number behind a «عالی» rating costs more than
// a missing one. So the figure is kept as the text the seller wrote, its reason named, and the mileage is unknown.

/** Under this many kilometres a stated mileage is a new car's: the same 1,000 km the valuation calls zero-km. */
export const NEW_CAR_MILEAGE_BELOW_KM = 1_000;
/**
 * A car is new while its model year is the Jalali year its snapshot was fetched in or one of the two before it; at
 * this age or more, a few kilometres is not a mileage a seller means.
 */
export const NOT_NEW_AT_MODEL_YEARS = 3;

/**
 * Whether a stated mileage is too low for the car to be believed: under 1,000 km on a car that is three or more model
 * years old when its snapshot was fetched. `ageInModelYears` is that age (Jalali years, as model years are stated), or
 * undefined when the listing does not say.
 */
export function isImplausibleMileage(mileageKm: number, ageInModelYears: number | undefined): boolean {
  return (
    mileageKm < NEW_CAR_MILEAGE_BELOW_KM &&
    ageInModelYears !== undefined &&
    ageInModelYears >= NOT_NEW_AT_MODEL_YEARS
  );
}

/**
 * A mileage under the floor and what the code made of it (CS-101, ADR-0040): `really_low` and `thousands_text` rest on
 * the listing's own words; `unread` is a figure neither the words nor (yet) the price settle; the valuation run turns
 * an unread one into `thousands_price` when the asking price fits the car at 1,000 times the figure. The figure the
 * seller wrote is kept with the reading.
 */
export type MileageReading = {
  readonly reading: 'really_low' | 'thousands_text' | 'unread';
  /** What the seller wrote, 0 to 999. */
  readonly writtenKm: number;
  /** The words of the text the reading rests on; null for `unread`. */
  readonly wording: string | null;
};

/**
 * The most a car is believed to drive in a year when a mileage is assumed to count thousands: 999 read as 999,000 km on
 * a car of five years is not a mileage anybody means, so the figure stays unread. 40,000 km is above the 99th
 * percentile of the 3,852 stated mileages of cars three or more model years old (37,000 km a year, of 2026-10-03).
 */
export const MOST_ASSUMED_KM_PER_YEAR = 40_000;

/**
 * Whether `writtenKm` read in thousands is a mileage a car of this age (model years, 0 for a new one) can have: at most
 * MOST_ASSUMED_KM_PER_YEAR for each year of its age, counted from the middle of its model year (a car of the year 1402
 * has been on the road about three and a half years in the autumn of 1405). Unknown ages are given the benefit of the
 * doubt: the rule that reads thousands needs an age to have been asked at all.
 */
export function isPlausibleAsThousands(writtenKm: number, ageInModelYears: number | undefined): boolean {
  if (writtenKm < 1) return false;
  return (
    ageInModelYears === undefined ||
    writtenKm * 1000 <= MOST_ASSUMED_KM_PER_YEAR * (Math.max(ageInModelYears, 0) + 0.5)
  );
}

export type DerivedListing = {
  /** The version of the parser that read it, stored as listing.parser_version. */
  readonly parserVersion: number;
  readonly attributes: ListingAttributes;
  /** In the source's order: the first is the main photo. */
  readonly photos: readonly PhotoAddress[];
  /** Values the listing states that the parser could not read or would not accept (the latter carry their reason). */
  readonly unparsed: readonly UnparsedValue[];
  /**
   * Fields the listing stated in a form that means unknown, such as Divar's 1,000,000 km or «قبل از ۱۳۶۶»: read, so
   * not unparsed, but with no value.
   */
  readonly statedUnknown: readonly UnparsedField[];
  /** Labels this parser does not know: a source that renames or adds a row shows up here, for the counts. */
  readonly unknownLabels: readonly string[];
  /** Photo and thumbnail addresses left out: not https, or not on the source's own photo host. */
  readonly skippedPhotos: number;
};
