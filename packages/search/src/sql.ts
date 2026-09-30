// A search as SQL (CS-58, ADR-0027): each declarative predicate of a filter becomes one named helper below, each
// tested on fixtures in test/filters.db.test.ts, over a table or view that follows listing_filter_row's columns (the
// view itself, or CS-59's search_document). Values are always parameters; column names come from the definitions,
// never from input. Runs in Node only (the web app's server and the worker).
import { sql, type RawBuilder } from 'kysely';
import { FILTERS, type AnyFilter } from './filters.ts';
import type { Column, FixedPredicate, Range } from './kinds.ts';
import type { SearchFilters } from './search.ts';
import { DEFAULT_SORT, sortById, type SortId } from './sorts.ts';
import { solarHijriYear } from './year.ts';

export type SqlContext = {
  /** The alias the query gives listing_filter_row or search_document: `selectFrom('listing_filter_row as r')`. */
  readonly alias: string;
  /** Today, for a car's age; the database's clock decides "the last N days". Defaults to the process's clock. */
  readonly now?: Date;
};

type Condition = RawBuilder<boolean>;

function ref(context: SqlContext, column: Column) {
  return sql.ref(`${context.alias}.${column}`);
}

// The named helpers, one per kind of predicate.

/**
 * column = any(the values as one array parameter), so the statement's text is the same however many values are chosen
 * (one entry in pg_stat_statements, one cached plan). A deal_rating column is compared as that enum.
 */
export function isOneOf(
  column: RawBuilder<unknown>,
  values: readonly string[],
  type: 'text' | 'deal_rating' = 'text',
): Condition {
  if (values.length === 0) return sql<boolean>`false`;
  return type === 'deal_rating'
    ? sql<boolean>`${column} = any(${values}::deal_rating[])`
    : sql<boolean>`${column} = any(${values}::text[])`;
}

/** column BETWEEN the range's ends, both included; an open end is no bound. NULL never matches. */
export function isBetween(column: RawBuilder<unknown>, range: Range): Condition {
  if (range.min !== undefined && range.max !== undefined) {
    return sql<boolean>`${column} BETWEEN ${range.min} AND ${range.max}`;
  }
  if (range.min !== undefined) return sql<boolean>`${column} >= ${range.min}`;
  if (range.max !== undefined) return sql<boolean>`${column} <= ${range.max}`;
  return sql<boolean>`${column} IS NOT NULL`;
}

export function isAtLeast(column: RawBuilder<unknown>, value: number): Condition {
  return sql<boolean>`${column} >= ${value}`;
}

export function isAtMost(column: RawBuilder<unknown>, value: number): Condition {
  return sql<boolean>`${column} <= ${value}`;
}

export function isTrue(column: RawBuilder<unknown>): Condition {
  return sql<boolean>`${column} IS TRUE`;
}

/** The column is not the value; NULL (the listing says nothing) passes. */
export function isNot(column: RawBuilder<unknown>, value: string): Condition {
  return sql<boolean>`${column} IS DISTINCT FROM ${value}`;
}

/** An instant within the last `days` days by the database's clock. */
export function isWithinDays(column: RawBuilder<unknown>, days: number): Condition {
  return sql<boolean>`${column} >= now() - make_interval(days => ${days})`;
}

/** A Solar Hijri model year at most `years` before the current one: model_year_sh >= current - years. */
export function isYearsOldAtMost(
  column: RawBuilder<unknown>,
  years: number,
  currentYearSh: number,
): Condition {
  return sql<boolean>`${column} >= ${currentYearSh - years}`;
}

/**
 * Mileage at most `kmPerYear` for each year of age, the age floored at half a year as the valuation counts it (S01):
 * a 1405 car in 1405 may have 6,000 km at 12,000 a year. A listing without mileage or year never matches.
 */
export function isMileageForAgeAtMost(
  mileage: RawBuilder<unknown>,
  modelYear: RawBuilder<unknown>,
  kmPerYear: number,
  currentYearSh: number,
): Condition {
  return sql<boolean>`${mileage} <= ${kmPerYear}::numeric * greatest(${currentYearSh}::integer - ${modelYear}, 0.5)`;
}

// Filters to conditions.

function fixed(predicate: FixedPredicate, context: SqlContext, currentYearSh: number): Condition {
  switch (predicate.kind) {
    case 'isTrue':
      return isTrue(ref(context, predicate.column));
    case 'isNot':
      return isNot(ref(context, predicate.column), predicate.value);
    case 'atMost':
      return isAtMost(ref(context, predicate.column), predicate.value);
    case 'mileageForAgeAtMost':
      return isMileageForAgeAtMost(
        ref(context, 'mileage_km'),
        ref(context, 'model_year_sh'),
        predicate.kmPerYear,
        currentYearSh,
      );
  }
}

/** One filter's value as its condition. */
export function filterCondition(filter: AnyFilter, value: unknown, context: SqlContext): Condition {
  const currentYearSh = solarHijriYear(context.now ?? new Date());
  switch (filter.kind) {
    case 'choice':
      return isOneOf(
        ref(context, filter.predicate.column),
        value as string[],
        filter.predicate.type ?? 'text',
      );
    case 'ranked': {
      // A rank keeps its own and every better one: the options up to it, best first.
      const values = filter.options.map((option) => option.value as string);
      return isOneOf(
        ref(context, filter.predicate.column),
        values.slice(0, values.indexOf(value as string) + 1),
        filter.predicate.type ?? 'text',
      );
    }
    case 'range':
      return isBetween(ref(context, filter.predicate.column), value as Range);
    case 'limit': {
      const column = ref(context, filter.predicate.column);
      const amount = value as number;
      switch (filter.predicate.kind) {
        case 'atLeast':
          return isAtLeast(column, amount);
        case 'withinDays':
          return isWithinDays(column, amount);
        case 'yearsOldAtMost':
          return isYearsOldAtMost(column, amount, currentYearSh);
      }
      break;
    }
    case 'flag':
      return fixed(filter.predicate, context, currentYearSh);
  }
}

/** Every applied filter ANDed, in the definitions' order; `true` when none is applied. */
export function searchWhere(filters: SearchFilters, context: SqlContext): Condition {
  const conditions: Condition[] = [];
  for (const filter of FILTERS) {
    const value: unknown = filters[filter.id];
    if (value !== undefined) conditions.push(filterCondition(filter, value, context));
  }
  if (conditions.length === 0) return sql<boolean>`true`;
  return sql<boolean>`(${sql.join(conditions, sql` AND `)})`;
}

/** The ORDER BY list of a sort, ending on listing_id so equal rows keep one order (keyset pagination). */
export function searchOrderBy(sortId: SortId | undefined, context: SqlContext): RawBuilder<unknown> {
  const sort = sortById(sortId ?? DEFAULT_SORT);
  const terms = sort.orderBy.map((term) =>
    term.direction === 'asc'
      ? sql`${ref(context, term.column)} ASC NULLS LAST`
      : sql`${ref(context, term.column)} DESC NULLS LAST`,
  );
  return sql`${sql.join([...terms, sql`${ref(context, 'listing_id')} DESC`])}`;
}

// Keyset pagination: the next page starts after the last row shown, whatever the order, with no OFFSET.

/** Where a page ended: the last row's values of its order's columns, as text (a timestamp keeps its microseconds). */
export type SortKey = {
  readonly values: readonly (string | null)[];
  readonly listingId: number;
};

/** A row's sort key as one text[] column: select it beside the row, and hand the last row's to searchAfter. */
export function sortKeyOf(sortId: SortId | undefined, context: SqlContext): RawBuilder<(string | null)[]> {
  const sort = sortById(sortId ?? DEFAULT_SORT);
  return sql<(string | null)[]>`ARRAY[${sql.join(
    sort.orderBy.map((term) => sql`${ref(context, term.column)}::text`),
  )}]::text[]`;
}

/**
 * The rows after a key in an order, spelled out term by term, because an order mixes directions (best deal: gap
 * ascending, then newest first, then listing id descending) and puts rows without a value last, which a row
 * comparison cannot say. For a term with a value v: beyond v (greater ascending, smaller descending), or equal to v
 * and after on the remaining terms, or without a value (those come last). For a term without a value: also without
 * one, and after on the remaining terms. The listing id, never null, ends every order descending.
 */
export function searchAfter(sortId: SortId | undefined, key: SortKey, context: SqlContext): Condition {
  const sort = sortById(sortId ?? DEFAULT_SORT);
  if (key.values.length !== sort.orderBy.length) {
    throw new RangeError(`a ${sort.id} key has ${String(sort.orderBy.length)} values, not ${String(key.values.length)}`);
  }
  let after: Condition = sql<boolean>`${ref(context, 'listing_id')} < ${key.listingId}`;
  for (let index = sort.orderBy.length - 1; index >= 0; index -= 1) {
    const term = sort.orderBy[index];
    const value = key.values[index];
    if (term === undefined || value === undefined) throw new RangeError('a sort key shorter than its order');
    const column = ref(context, term.column);
    if (value === null) {
      after = sql<boolean>`(${column} IS NULL AND ${after})`;
      continue;
    }
    const beyond = term.direction === 'asc' ? sql`${column} > ${value}` : sql`${column} < ${value}`;
    after = sql<boolean>`(${beyond} OR (${column} = ${value} AND ${after}) OR ${column} IS NULL)`;
  }
  return after;
}

// The rules every read of search_document adds to a search's filters.

/**
 * Seen within the freshness window (ADR-0017 point 6): the worker drops older rows every minute, and this keeps a
 * row that aged out since off the page meanwhile.
 */
export function isFresh(context: SqlContext, hours: number): Condition {
  return sql<boolean>`${ref(context, 'last_seen_at')} >= now() - make_interval(hours => ${hours})`;
}

/** The row's text matches a tsquery that search_tsquery() built (passed as text, parsed once as a constant). */
export function matchesText(tsquery: string, context: SqlContext): Condition {
  return sql<boolean>`${sql.ref(`${context.alias}.text_vector`)} @@ ${tsquery}::tsquery`;
}
