import type { Listing, ListingUnparsedValue } from '@carshenas/db/db-types';
import type { ShownPrice } from './price.ts';

// What a listing says about its car, as a source's parser reads it from the listing's latest snapshot (CS-34;
// docs/design/data-model.md, "Added by CS-34"): the same shape for every source, so the write, the derive command and
// the next sources' parsers (CS-54) share one path. Every value is read by code, never by a model, and never guessed: a
// value the parser cannot read is returned as unparsed with its raw text, and its column stays null. The value lists
// are the database's own, from the generated types.

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
  readonly mileageKm: number | null;
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
};

/** A photo's addresses on the source's own photo host (ADR-0025). */
export type PhotoAddress = {
  readonly url: string;
  readonly thumbnailUrl: string | null;
};

/** A value the listing states that the parser could not read, exactly as the source wrote it. */
export type UnparsedValue = {
  readonly field: UnparsedField;
  readonly rawText: string;
};

export type DerivedListing = {
  /** The version of the parser that read it, stored as listing.parser_version. */
  readonly parserVersion: number;
  readonly attributes: ListingAttributes;
  /** In the source's order: the first is the main photo. */
  readonly photos: readonly PhotoAddress[];
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
