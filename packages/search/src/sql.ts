// A search as SQL (CS-58, ADR-0027): each declarative predicate of a filter becomes one named helper below, each
// tested on fixtures in test/filters.db.test.ts, over a table or view that follows listing_filter_row's columns (the
// view itself, or CS-59's search_document). Values are always parameters; column names come from the definitions,
// never from input. Runs in Node only (the web app's server and the worker).
import { sql, type RawBuilder, type Selectable } from 'kysely';
import type { SearchDocument } from '@carshenas/db/db-types';
import { FILTERS, type AnyFilter, type FilterId } from './filters.ts';
import { SEARCH_FRESHNESS_HOURS } from './freshness.ts';
import type { Column, FixedPredicate, Range } from './kinds.ts';
import type { SearchFilters } from './search.ts';
import type { DatabaseOptions } from './kinds.ts';
import { DEFAULT_SORT, sortById, type SortId, type SortType } from './sorts.ts';
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

type Term = {
  readonly column: Column;
  readonly direction: 'asc' | 'desc';
  readonly notNull: boolean;
  readonly type: SortType;
};

/** The order's terms, then listing_id descending: never null, and what makes the order total. */
function termsOf(sortId: SortId | undefined): Term[] {
  const sort = sortById(sortId ?? DEFAULT_SORT);
  return [
    ...sort.orderBy.map((term) => ({
      column: term.column,
      direction: term.direction,
      notNull: term.notNull,
      type: term.type,
    })),
    { column: 'listing_id', direction: 'desc', notNull: true, type: 'bigint' },
  ];
}

/** A key's text as a value of its column's type: a typed parameter, so a comparison and an index see one type. */
function typed(value: string | number, type: SortType): RawBuilder<unknown> {
  return sql`${value}::${sql.raw(type)}`;
}

function allOf(conditions: readonly Condition[]): Condition {
  return conditions.length === 0 ? sql<boolean>`true` : sql<boolean>`(${sql.join(conditions, sql` AND `)})`;
}

/**
 * The rows after a key in an order, as the branches whose union they are; each branch is one range of the order's
 * index, so a page costs the rows it shows however deep it is (a single OR condition cannot start an index scan, and
 * read 20,000 buffers at 90 % depth where a branch reads 32). A term with a value v gives the rows beyond v on it
 * (greater ascending, smaller descending) and, when the column can be null, the rows without a value, which go last;
 * the rows equal to v then continue on the next term. A term without a value (the key is in the null tail) gives
 * nothing beyond it and continues on the rows without one. Where the terms left all run one way and only the first
 * can be null, they are one row comparison, ((listed_at, listing_id) < (…)), which an index range starts from.
 * The caller runs each branch ordered and limited, then orders and limits their union.
 */
export function searchAfterBranches(
  sortId: SortId | undefined,
  key: SortKey,
  context: SqlContext,
): Condition[] {
  const terms = termsOf(sortId);
  const values: (string | number | null)[] = [...key.values, key.listingId];
  if (values.length !== terms.length) {
    throw new RangeError(
      `a ${sortId ?? DEFAULT_SORT} key has ${String(terms.length - 1)} values, not ${String(key.values.length)}`,
    );
  }
  const branches: Condition[] = [];
  const equal: Condition[] = [];
  for (let index = 0; index < terms.length; index += 1) {
    const term = terms[index];
    const value = values[index];
    if (term === undefined || value === undefined) throw new RangeError('a sort key shorter than its order');
    const column = ref(context, term.column);
    if (value === null) {
      if (term.notNull) throw new RangeError(`${term.column} is never null: a key cannot be without it`);
      equal.push(sql<boolean>`${column} IS NULL`);
      continue;
    }
    const rest = terms.slice(index);
    const uniform =
      rest.every((candidate) => candidate.direction === term.direction) &&
      rest.slice(1).every((candidate) => candidate.notNull);
    if (uniform) {
      const rowValues = rest.map((candidate, offset) => {
        const text = values[index + offset];
        if (text === null || text === undefined) {
          throw new RangeError(`${candidate.column} is never null: a key cannot be without it`);
        }
        return typed(text, candidate.type);
      });
      const operator = term.direction === 'asc' ? sql`>` : sql`<`;
      const comparison =
        rest.length === 1
          ? sql<boolean>`${column} ${operator} ${rowValues[0]}`
          : sql<boolean>`(${sql.join(rest.map((candidate) => ref(context, candidate.column)))}) ${operator} (${sql.join(rowValues)})`;
      branches.push(allOf([...equal, comparison]));
      if (!term.notNull) branches.push(allOf([...equal, sql<boolean>`${column} IS NULL`]));
      return branches;
    }
    const beyond =
      term.direction === 'asc'
        ? sql<boolean>`${column} > ${typed(value, term.type)}`
        : sql<boolean>`${column} < ${typed(value, term.type)}`;
    branches.push(allOf([...equal, beyond]));
    if (!term.notNull) branches.push(allOf([...equal, sql<boolean>`${column} IS NULL`]));
    equal.push(sql<boolean>`${column} = ${typed(value, term.type)}`);
  }
  return branches;
}

/** The rows after a key as one condition, the branches ORed: for a check of a key, not for a page (see above). */
export function searchAfter(sortId: SortId | undefined, key: SortKey, context: SqlContext): Condition {
  const branches = searchAfterBranches(sortId, key, context);
  const [only] = branches;
  return only !== undefined && branches.length === 1
    ? only
    : sql<boolean>`(${sql.join(branches, sql` OR `)})`;
}

// What a read of search_document adds to a search's filters, and the one place the pieces are put together.

/**
 * Seen within the freshness window (ADR-0017 point 6): the worker expires older rows every minute, and this keeps a
 * row that aged out since off the page meanwhile.
 */
export function isFresh(context: SqlContext, hours: number): Condition {
  return sql<boolean>`${ref(context, 'last_seen_at')} >= now() - make_interval(hours => ${hours})`;
}

/** The row's text matches a tsquery that search_query() built (passed as text, parsed once as a constant). */
export function matchesText(tsquery: string, context: SqlContext): Condition {
  return sql<boolean>`${sql.ref(`${context.alias}.text_vector`)} @@ ${tsquery}::tsquery`;
}

/** What a search reads of search_document: its filters and the tsquery of its words (null: no words). */
export type SearchRead = {
  readonly filters: SearchFilters;
  readonly tsquery: string | null;
};

/**
 * Every condition a search puts on search_document, in one function, so a page, a count, a facet and the worker's
 * matcher of search files (CS-72) cannot drift apart: the filters, the freshness window and the words. `without`
 * leaves one filter out, to count how many listings each of its options would give.
 */
export function searchableWhere(
  read: SearchRead,
  context: SqlContext,
  options: { readonly without?: FilterId; readonly freshnessHours?: number } = {},
): Condition {
  const filters =
    options.without === undefined ? read.filters : { ...read.filters, [options.without]: undefined };
  const parts: Condition[] = [
    searchWhere(filters, context),
    isFresh(context, options.freshnessHours ?? SEARCH_FRESHNESS_HOURS),
  ];
  if (read.tsquery !== null) parts.push(matchesText(read.tsquery, context));
  return sql<boolean>`(${sql.join(parts, sql` AND `)})`;
}

/** What search_query() made of a buyer's words. */
export type TextPlanRow = {
  /** The tsquery as text, or null when no searchable word is left. */
  tsquery_text: string | null;
  /** The words replaced by a close, common word. */
  corrections: { from: string; to: string }[];
  /** The words no listing has and that were not replaced. */
  unmatched: string[];
};

/** `selectFrom(searchQuerySql(words).as('q')).selectAll()`: one row, what the database made of the words. */
export function searchQuerySql(words: string): RawBuilder<TextPlanRow> {
  return sql<TextPlanRow>`search_query(${words})`;
}

// A page of results.

/** The columns of search_document a result card reads, with the order's own. */
export const PAGE_COLUMNS = [
  'listing_id',
  'source_id',
  'make_id',
  'model_id',
  'trim_id',
  'city_id',
  'make_key',
  'model_key',
  'trim_key',
  'body_type',
  'model_year_sh',
  'mileage_km',
  'km_per_year',
  'price_type',
  'asking_price_toman',
  'market_value_toman',
  'price_gap_pct',
  'deal_rating',
  'valued_on',
  'gearbox',
  'fuel',
  'colour_family',
  'city_key',
  'district_fa',
  'seller_type',
  'body_condition',
  'engine_condition',
  'gearbox_condition',
  'chassis_condition',
  'paint_free',
  'accident',
  'listed_at',
  'last_seen_at',
  'photo_count',
  'cover_photo_url',
  'cover_thumbnail_url',
] as const satisfies readonly (keyof SearchDocument)[];

/** A page's row: the columns above (the date as text), and the key a next page continues from. */
export type PageRow = {
  [Column in Exclude<(typeof PAGE_COLUMNS)[number], 'valued_on'>]: Selectable<SearchDocument>[Column];
} & { valued_on: string | null; sort_key: (string | null)[] };

/**
 * The rows of one page, in the order, after the key when there is one, as one parenthesised statement for
 * `selectFrom(searchPageSql(…).as('page'))`. With one branch it is a plain ordered, limited read. With several, each
 * branch is its own ordered, limited read of an index range and the statement orders and limits their union, so a
 * page at any depth costs the rows it shows (searchAfterBranches). The caller asks for one row more than it shows, to
 * know whether a next page exists.
 */
export function searchPageSql(input: {
  readonly read: SearchRead;
  readonly sort: SortId | undefined;
  readonly key?: SortKey | undefined;
  readonly limit: number;
  readonly context: SqlContext;
}): RawBuilder<PageRow> {
  const { context } = input;
  const docRef = (column: string) => sql.ref(`${context.alias}.${column}`);
  const where = searchableWhere(input.read, context);
  const order = searchOrderBy(input.sort, context);
  const table = sql.table(context.alias);
  const innerSelect = sql.join([
    ...PAGE_COLUMNS.map((column) =>
      column === 'valued_on' ? sql`${docRef(column)}::text AS valued_on` : docRef(column),
    ),
    sql`${sortKeyOf(input.sort, context)} AS sort_key`,
  ]);
  const member = (after: Condition | undefined) =>
    sql`SELECT ${innerSelect} FROM search_document AS ${table}
        WHERE ${after === undefined ? where : sql`${where} AND ${after}`} ORDER BY ${order} LIMIT ${input.limit}`;
  const branches = input.key === undefined ? [] : searchAfterBranches(input.sort, input.key, context);
  const [only] = branches;
  // In parentheses: the statement is a subquery, `selectFrom(searchPageSql(…).as('page'))`.
  if (branches.length <= 1) return sql<PageRow>`(${member(only)})`;
  const outerSelect = sql.join([...PAGE_COLUMNS.map(docRef), docRef('sort_key')]);
  return sql<PageRow>`(SELECT ${outerSelect}
    FROM (${sql.join(
      branches.map((branch) => sql`(${member(branch)})`),
      sql` UNION ALL `,
    )}) AS ${table}
    ORDER BY ${order} LIMIT ${input.limit})`;
}

// The facets of a filtered search.

/** One option of a filter with options from rows: how many of the search's matches have it. */
export type FacetCountRow = { facet: DatabaseOptions; value: string; count: number };

type FacetSource = { readonly kind: DatabaseOptions; readonly filterId: FilterId; readonly column: Column };

/** The filters whose options are rows, with the column each is counted by (the definitions say both). */
const FACET_SOURCES: readonly FacetSource[] = FILTERS.flatMap((filter): FacetSource[] =>
  'optionsFrom' in filter && filter.optionsFrom !== undefined && 'column' in filter.predicate
    ? [{ kind: filter.optionsFrom, filterId: filter.id, column: filter.predicate.column }]
    : [],
);

/**
 * How many of a search's matches each option of the row-backed filters has, counted without that filter's own values so
 * choosing one make still shows the others (disjunctive facets). The facets whose filter is not in the search share one
 * scan: one read of the matches, narrow rows into a materialised CTE, grouped once for each; a facet whose filter is in
 * the search needs its own scan, because its matches differ. Seven scans of the table took 94 to 173 ms on 25,000 rows,
 * one or two take a few. As a subquery: `selectFrom(searchFacetCountsSql(…).as('facets'))`.
 */
export function searchFacetCountsSql(read: SearchRead, context: SqlContext): RawBuilder<FacetCountRow> {
  const table = sql.table(context.alias);
  const active = (facet: FacetSource) =>
    (read.filters as Record<string, unknown>)[facet.filterId] !== undefined;
  const shared = FACET_SOURCES.filter((facet) => !active(facet));
  const own = FACET_SOURCES.filter(active);
  const count = (facet: FacetSource, from: RawBuilder<unknown>, where: RawBuilder<boolean>) => {
    const column = sql.ref(`${context.alias}.${facet.column}`);
    return sql`(SELECT ${facet.kind}::text AS facet, ${column}::text AS value, count(*)::integer AS count
                FROM ${from} WHERE ${where} AND ${column} IS NOT NULL GROUP BY 2)`;
  };
  const withShared =
    shared.length === 0
      ? sql``
      : sql`WITH shared AS MATERIALIZED (
          SELECT ${sql.join(shared.map((facet) => ref(context, facet.column)))}
          FROM search_document AS ${table} WHERE ${searchableWhere(read, context)}) `;
  const sharedScans = shared.map((facet) => count(facet, sql`shared AS ${table}`, sql<boolean>`true`));
  const ownScans = own.map((facet) =>
    count(
      facet,
      sql`search_document AS ${table}`,
      searchableWhere(read, context, { without: facet.filterId }),
    ),
  );
  return sql<FacetCountRow>`(${withShared}${sql.join([...sharedScans, ...ownScans], sql` UNION ALL `)})`;
}
