// The five kinds of search filter (CS-58, ADR-0027, docs/specs/S02-filters-and-catalogues.md). A filter is data: its
// id and URL parameter, its Farsi label, description and buyer words, its value schema and a declarative predicate
// that names one column of listing_filter_row. The constructors below give each kind its schema, its URL encoding and
// its chip text, so a filter in filters.ts is one object and nothing else changes when one is added or removed. This
// file runs in the browser: SQL lives in sql.ts, which reads the predicates.
import { z } from 'zod';
import type { ListingFilterRow } from '@carshenas/db/db-types';
import { toLatinDigits, toPersianDigits } from '@carshenas/locale/digits';
import { formatCount, formatMileage } from '@carshenas/locale/format-number';
import { formatTomanCompact, formatTomanCompactRange, toToman } from '@carshenas/locale/toman';

/** A column of listing_filter_row (and of CS-59's search_document, which keeps its names). */
export type Column = keyof ListingFilterRow;

/** What a filter's value selects: each kind is one named helper in sql.ts. */
export type ValuePredicate =
  /** The column is one of the chosen values; `deal_rating` columns are compared as that enum. */
  | { readonly kind: 'oneOf'; readonly column: Column; readonly type?: 'deal_rating' }
  /** The column lies between the value's ends, both included; an end left out is open. */
  | { readonly kind: 'between'; readonly column: Column }
  /** The column is at least the value. */
  | { readonly kind: 'atLeast'; readonly column: Column }
  /** The instant in the column is within the value's number of days before now. */
  | { readonly kind: 'withinDays'; readonly column: Column }
  /** The Solar Hijri model year in the column is at most the value's number of years before the current year. */
  | { readonly kind: 'yearsOldAtMost'; readonly column: Column };

/** What an on/off filter selects when it is on: a fixed rule with no value of its own. */
export type FixedPredicate =
  | { readonly kind: 'isTrue'; readonly column: Column }
  /** The column is not the value: a listing that says nothing passes (IS DISTINCT FROM). */
  | { readonly kind: 'isNot'; readonly column: Column; readonly value: string }
  | { readonly kind: 'atMost'; readonly column: Column; readonly value: number }
  /** mileage_km at most kmPerYear for each year of age, a car under a year old counted as half a year (S01). */
  | { readonly kind: 'mileageForAgeAtMost'; readonly kmPerYear: number };

/** Where the filter sheet shows a filter, in this order. */
export const FILTER_GROUPS = {
  car: 'خودرو',
  price: 'قیمت و معامله',
  condition: 'بدنه و فنی',
  terms: 'شرایط فروش',
  place: 'مکان و فروشنده',
  listing: 'آگهی',
} as const;
export type FilterGroup = keyof typeof FILTER_GROUPS;

/** Where a choice's options come from when they are rows, not code: only values with active listings are offered. */
export const DATABASE_OPTIONS = ['make', 'model', 'trim', 'body_type', 'city', 'district', 'source'] as const;
export type DatabaseOptions = (typeof DATABASE_OPTIONS)[number];

export type Option<V extends string = string> = {
  readonly value: V;
  readonly label: string;
  /** Why a buyer would pick it, where the label alone does not say. */
  readonly description?: string;
};

/**
 * An option of an ordered choice, best first, with the chip that says "this or better" and, where the option is a
 * measured rule rather than the seller's own word, what it measures with its numbers.
 */
export type RankedOption<V extends string = string> = Option<V> & {
  readonly chip: string;
  readonly rule?: string;
};

type Common<Id extends string> = {
  readonly id: Id;
  /** The URL parameter: short, lower case, stable once published (links and search files keep it). */
  readonly param: string;
  /** The filter's Farsi name in the sheet and on its chip. */
  readonly label: string;
  /** One or two Farsi sentences: what the filter keeps, and what the data behind it can and cannot say. */
  readonly description: string;
  readonly group: FilterGroup;
  /** Words buyers write for it, for plain-Farsi search (CS-62) to map to this filter. */
  readonly words: readonly string[];
};

export type ChoiceFilter<Id extends string = string, V extends string = string> = Common<Id> & {
  readonly kind: 'choice';
  readonly predicate: { readonly kind: 'oneOf'; readonly column: Column; readonly type?: 'deal_rating' };
  readonly schema: z.ZodType<V[]>;
} & (
    | { readonly options: readonly Option<V>[]; readonly optionsFrom?: never }
    | { readonly optionsFrom: DatabaseOptions; readonly options?: never }
  );

export type RankedFilter<Id extends string = string, V extends string = string> = Common<Id> & {
  readonly kind: 'ranked';
  /** Best first: a value keeps listings at that rank or better. */
  readonly options: readonly RankedOption<V>[];
  readonly predicate: { readonly kind: 'oneOf'; readonly column: Column; readonly type?: 'deal_rating' };
  readonly schema: z.ZodType<V>;
};

export type Range = { min?: number; max?: number };
export const RANGE_UNITS = ['toman', 'km', 'year'] as const;
export type RangeUnit = (typeof RANGE_UNITS)[number];

export type RangeFilter<Id extends string = string> = Common<Id> & {
  readonly kind: 'range';
  readonly unit: RangeUnit;
  readonly bounds: { readonly min: number; readonly max: number };
  /** Ends the sheet offers, ascending; any whole number within the bounds is valid. */
  readonly steps: readonly number[];
  readonly predicate: { readonly kind: 'between'; readonly column: Column };
  readonly schema: z.ZodType<Range>;
};

export type LimitFilter<Id extends string = string> = Common<Id> & {
  readonly kind: 'limit';
  readonly bounds: { readonly min: number; readonly max: number };
  /** The values the sheet offers. */
  readonly choices: readonly number[];
  readonly predicate: Extract<ValuePredicate, { kind: 'atLeast' | 'withinDays' | 'yearsOldAtMost' }>;
  /** The chip for a value: «حداکثر ۱۰ سال». */
  readonly chip: (value: number) => string;
  /** What a value measures, exactly, for the info control (S02): «از سال ساخت خودرو حداکثر ۱۰ سال گذشته باشد». */
  readonly rule: (value: number) => string;
  readonly schema: z.ZodType<number>;
};

export type FlagFilter<Id extends string = string> = Common<Id> & {
  readonly kind: 'flag';
  /**
   * What the filter measures, exactly and with its numbers, for the info control (S02); built from the same constants
   * the predicate uses, so the two cannot disagree.
   */
  readonly rule: string;
  readonly predicate: FixedPredicate;
  readonly schema: z.ZodType<true>;
};

export type Filter = ChoiceFilter | RankedFilter | RangeFilter | LimitFilter | FlagFilter;

// Constructors: each takes the definition without its schema and returns it with one.

const MAX_CHOSEN = 50;

type Without<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function choice<const Id extends string, const V extends string>(
  definition: Without<ChoiceFilter<Id, V>, 'kind' | 'schema' | 'predicate'> & { readonly column: Column },
  /** For values read from the database: the shape a value has (a slug, a code, a key). */
  valuePattern?: RegExp,
): ChoiceFilter<Id, V> {
  const { column, ...rest } = definition;
  const item =
    definition.options === undefined
      ? z.string().regex(valuePattern ?? /^[a-z0-9_.-]{1,120}$/)
      : z.enum(definition.options.map((option) => option.value) as [V, ...V[]]);
  const schema = z
    .array(item)
    .min(1)
    .max(definition.options?.length ?? MAX_CHOSEN)
    .refine((values) => new Set(values).size === values.length, 'each value once');
  return { ...rest, kind: 'choice', predicate: { kind: 'oneOf', column }, schema } as ChoiceFilter<Id, V>;
}

export function ranked<const Id extends string, const V extends string>(
  definition: Omit<RankedFilter<Id, V>, 'kind' | 'schema' | 'predicate'> & {
    readonly column: Column;
    readonly type?: 'deal_rating';
  },
): RankedFilter<Id, V> {
  const { column, type, ...rest } = definition;
  const values = definition.options.map((option) => option.value) as [V, ...V[]];
  const predicate =
    type === undefined ? { kind: 'oneOf' as const, column } : { kind: 'oneOf' as const, column, type };
  return { ...rest, kind: 'ranked', predicate, schema: z.enum(values) };
}

export function range<const Id extends string>(
  definition: Omit<RangeFilter<Id>, 'kind' | 'schema' | 'predicate'> & { readonly column: Column },
): RangeFilter<Id> {
  const { column, ...rest } = definition;
  const end = z.int().min(definition.bounds.min).max(definition.bounds.max).optional();
  const schema = z
    .strictObject({ min: end, max: end })
    .refine((value) => value.min !== undefined || value.max !== undefined, 'at least one end')
    .refine(
      (value) => value.min === undefined || value.max === undefined || value.min <= value.max,
      'min at most max',
    );
  return { ...rest, kind: 'range', predicate: { kind: 'between', column }, schema };
}

export function limit<const Id extends string>(
  definition: Omit<LimitFilter<Id>, 'kind' | 'schema'>,
): LimitFilter<Id> {
  return {
    ...definition,
    kind: 'limit',
    schema: z.int().min(definition.bounds.min).max(definition.bounds.max),
  };
}

export function flag<const Id extends string>(
  definition: Omit<FlagFilter<Id>, 'kind' | 'schema'>,
): FlagFilter<Id> {
  return { ...definition, kind: 'flag', schema: z.literal(true) };
}

// URL encoding: one parameter per filter, repeated for each value of a choice («?make=peugeot&make=kia»).

const LIST_SEPARATOR = ',';
const RANGE_SEPARATOR = '..';

/** A filter's value as its URL parameter's values: one each, except a choice's. */
export function encodeValue(filter: Filter, value: unknown): string[] {
  switch (filter.kind) {
    case 'choice':
      return [...(value as readonly string[])];
    case 'ranked':
      return [value as string];
    case 'range': {
      const { min, max } = value as Range;
      return [
        `${min === undefined ? '' : String(min)}${RANGE_SEPARATOR}${max === undefined ? '' : String(max)}`,
      ];
    }
    case 'limit':
      return [String(value)];
    case 'flag':
      return ['1'];
  }
}

/**
 * A URL parameter's values as the value the filter's schema then checks: a choice also reads values joined by commas
 * («make=peugeot,kia»), a number is read in any digit script, and anything unreadable is left for the schema to refuse.
 */
export function decodeValue(filter: Filter, texts: readonly string[]): unknown {
  const [text = ''] = texts;
  switch (filter.kind) {
    case 'choice':
      return texts.flatMap((part) => part.split(LIST_SEPARATOR)).filter((part) => part !== '');
    case 'ranked':
      return text;
    case 'range': {
      const parts = text.split(RANGE_SEPARATOR);
      if (parts.length !== 2) return text;
      const [min, max] = parts.map((part) => (part === '' ? undefined : readNumber(part)));
      return { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
    }
    case 'limit':
      return readNumber(text);
    case 'flag':
      return text === '1' || text === 'true' ? true : text;
  }
}

// «۱٬۲۰۰٬۰۰۰» or «1,200,000» typed into an address: the digits, without their separators. Anything else is left as
// text for the schema to refuse.
function readNumber(text: string): number | string {
  const digits = toLatinDigits(text).replace(/[,٬،]/g, '');
  return /^\d{1,16}$/.test(digits) ? Number(digits) : text;
}

// Chips: the Farsi text of one applied value.

/** A label for a value read from the database (a make's Persian name), when the caller has one. */
export type LabelOf = (filterId: string, value: string) => string | undefined;

/** The chip for a range: «۱۳۹۸ تا ۱۴۰۲», «تا ۱ میلیارد تومان», «از ۶۰٬۰۰۰ کیلومتر». */
export function rangeText(unit: RangeUnit, value: Range): string {
  const { min, max } = value;
  if (unit === 'toman') {
    if (min !== undefined && max !== undefined) return formatTomanCompactRange(toToman(min), toToman(max));
    const end = formatTomanCompact(toToman(min ?? max ?? 0)) + TOMAN;
    return min === undefined ? `تا ${end}` : `از ${end}`;
  }
  const show = unit === 'km' ? formatMileage : (year: number) => toPersianDigits(String(year));
  if (min !== undefined && max !== undefined) {
    if (min === max) return show(min);
    // A kilometre range names its unit once, at the end: «۲۰٬۰۰۰ تا ۶۰٬۰۰۰ کیلومتر».
    return `${unit === 'km' ? formatCount(min) : show(min)} تا ${show(max)}`;
  }
  return min === undefined ? `تا ${show(max ?? 0)}` : `از ${show(min)}`;
}

// formatTomanCompact returns the scale word without the unit; the unit follows after a no-break space.
const TOMAN = String.fromCharCode(0xa0) + 'تومان';

/** The text of one chosen option, from the definition's own options or the caller's labels. */
export function optionLabel(filter: ChoiceFilter | RankedFilter, value: string, labelOf?: LabelOf): string {
  const own = filter.options?.find((option) => option.value === value);
  if (filter.kind === 'ranked') return (own as RankedOption | undefined)?.chip ?? value;
  return own?.label ?? labelOf?.(filter.id, value) ?? value;
}
