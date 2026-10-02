import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { isDataException } from '@carshenas/db/database-errors';
import { CATALOGUE_IDS, type CatalogueId } from '@carshenas/search/catalogues';
import { decodeCursorPage, encodeCursor, type CursorTotal } from '@carshenas/search/cursor';
import { DATABASE_OPTIONS, type DatabaseOptions } from '@carshenas/search/kinds';
import { canonical, isCatalogueUnchanged, type Search } from '@carshenas/search/search';
import {
  searchableWhere,
  searchFacetCountsSql,
  searchOrderBy,
  searchPageSql,
  searchQuerySql,
  type SearchRead,
  type SortKey,
  type SqlContext,
} from '@carshenas/search/sql';
import type {
  CatalogueCounts,
  DealRating,
  FacetOption,
  ListingCard,
  SearchCoverage,
  SearchFacets,
  SearchPage,
  SearchText,
  SearchTotal,
} from '@/features/search/search-types';
import { readDatabase } from '@/server/db/database';
import { nameOf } from '@/server/db/sql-helpers';
import { logger } from '@/server/observability/logger';
import { loggableWords } from './loggable-words';

// The search API (CS-59, ADR-0028): a search of @carshenas/search (CS-58) run on search_document, the table the worker
// keeps fresh, never on the view. Results come in the search's order, a page at a time, continued by a cursor (keyset,
// no OFFSET, a page costs the rows it shows at any depth). The total is read from search_facet_count when the search
// is one the worker has counted (everything, or a catalogue as it is), counted live up to a cap otherwise, and not
// counted for a page after the first (the cursor carries it); the facets of a filtered search are counted live. Plans
// measured with EXPLAIN (ANALYZE, BUFFERS) are in docs/evidence/search-api/.

/** Results on a page unless the caller asks for fewer or more. */
export const PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 48;

/**
 * A total above this is shown as «بیش از …»: a filter sheet's live count and a results header need no more, and
 * counting every match of a broad search costs more than it tells (6 to 16 ms against a 0.9 ms page).
 */
export const COUNT_CAP = 1_000;
/**
 * The cap of a count a page shows beside rail or sheet counts that are exact (CS-61): the header's count and the apply
 * bar's must never read «بیش از ۱٬۰۰۰» next to a list that says ۱٬۲۰۵. One count, stopped at this many rows, is a few
 * milliseconds on the index (measured on 6,000 listings), and above it «بیش از» is honest again.
 */
export const PAGE_COUNT_CAP = 50_000;

/** The alias search_document and the page's rows are read under, which the package's SQL helpers are given. */
const ALIAS = 'r';

export type SearchResult =
  | { readonly status: 'ok'; readonly page: SearchPage }
  /** The cursor was made for another order, was altered, or holds a value its column cannot: start from the first page. */
  | { readonly status: 'invalid_cursor' };

type Prepared = {
  readonly search: Search;
  readonly context: SqlContext;
  readonly read: SearchRead;
  readonly text: SearchText | null;
};

/** What the database made of the words: the tsquery they search, the words it replaced, the words that match nothing. */
async function prepare(search: Search): Promise<Prepared> {
  const form = canonical(search);
  const context = { alias: ALIAS, now: new Date() };
  if (form.q === undefined)
    return { search: form, context, read: { filters: form.filters, tsquery: null }, text: null };
  const plan = await readDatabase().selectFrom(searchQuerySql(form.q).as('q')).selectAll().executeTakeFirst();
  const tsquery = plan?.tsquery_text ?? null;
  return {
    search: form,
    context,
    read: { filters: form.filters, tsquery },
    text: {
      searchable: tsquery !== null,
      corrections: plan?.corrections ?? [],
      unknown: plan?.unmatched ?? [],
    },
  };
}

function hasNoFilter(prepared: Prepared): boolean {
  return prepared.read.tsquery === null && Object.keys(prepared.search.filters).length === 0;
}

type ResultRow = {
  id: number;
  title: string | null;
  url: string | null;
  source_id: string;
  source_name: string;
  make_key: string | null;
  make_name: string | null;
  model_key: string | null;
  model_name: string | null;
  trim_key: string | null;
  trim_name: string | null;
  body_type: string | null;
  body_name: string | null;
  model_year_sh: number | null;
  model_year_ad: number | null;
  mileage_km: number | null;
  km_per_year: number | null;
  price_type: string;
  asking_price_toman: number | null;
  market_value_toman: number | null;
  price_gap_pct: string | null;
  deal_rating: DealRating | null;
  valued_on: string | null;
  gearbox: string | null;
  fuel: string | null;
  colour_family: string | null;
  city_key: string | null;
  city_name: string | null;
  district_fa: string | null;
  seller_type: string | null;
  body_condition: string | null;
  engine_condition: string | null;
  gearbox_condition: string | null;
  chassis_condition: string | null;
  paint_free: boolean | null;
  accident: string | null;
  listed_at: Date;
  last_seen_at: Date;
  photo_count: number;
  cover_photo_url: string | null;
  cover_thumbnail_url: string | null;
  sort_key: (string | null)[];
};

function named(key: string | null, name: string | null): { key: string; name: string } | null {
  return key === null || name === null ? null : { key, name };
}

function cardOf(row: ResultRow): ListingCard {
  return {
    id: row.id,
    title: row.title,
    name: row.trim_name ?? row.model_name ?? row.make_name ?? row.title ?? '',
    url: row.url ?? '',
    source: { key: row.source_id, name: row.source_name },
    make: named(row.make_key, row.make_name),
    model: named(row.model_key, row.model_name),
    trim: named(row.trim_key, row.trim_name),
    bodyType: named(row.body_type, row.body_name),
    modelYearSh: row.model_year_sh,
    modelYearAd: row.model_year_ad,
    mileageKm: row.mileage_km,
    kmPerYear: row.km_per_year,
    priceType: row.price_type,
    askingPriceToman: row.asking_price_toman,
    valuation:
      row.market_value_toman === null || row.valued_on === null
        ? null
        : {
            marketValueToman: row.market_value_toman,
            priceGapPct: row.price_gap_pct === null ? null : Number(row.price_gap_pct),
            dealRating: row.deal_rating,
            valuedOn: row.valued_on,
          },
    gearbox: row.gearbox,
    fuel: row.fuel,
    colourFamily: row.colour_family,
    city: named(row.city_key, row.city_name),
    district: row.district_fa,
    sellerType: row.seller_type,
    condition: {
      body: row.body_condition,
      engine: row.engine_condition,
      gearbox: row.gearbox_condition,
      chassis: row.chassis_condition,
      paintFree: row.paint_free,
      accident: row.accident,
    },
    listedAt: row.listed_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    photo:
      row.cover_photo_url === null
        ? null
        : { url: row.cover_photo_url, thumbnailUrl: row.cover_thumbnail_url, count: row.photo_count },
  };
}

/**
 * One page's rows, and the key the next page continues from. The page's rows are read first, from search_document alone
 * and in the order (each branch of a keyset page is one range of an order's index); the names are joined to those rows
 * only. With the joins in the same query, a filter the planner underestimates (clean-and-easy: 1 estimated, 888 found)
 * made it loop over the catalogue tables for every match (270 ms against 8 ms).
 */
async function readPage(prepared: Prepared, key: SortKey | undefined, limit: number) {
  const page = searchPageSql({
    read: prepared.read,
    sort: prepared.search.sort,
    key,
    limit: limit + 1,
    context: prepared.context,
  });
  const rows: ResultRow[] = await readDatabase()
    .with(
      (cte) => cte('page').materialized(),
      (db) => db.selectFrom(page.as('p')).selectAll(),
    )
    .selectFrom('page as r')
    .innerJoin('listing as l', 'l.id', 'r.listing_id')
    .innerJoin('source as s', 's.id', 'r.source_id')
    .leftJoin('make as mk', 'mk.id', 'r.make_id')
    .leftJoin('model as m', 'm.id', 'r.model_id')
    .leftJoin('trim as t', 't.id', 'r.trim_id')
    .leftJoin('city as c', 'c.id', 'r.city_id')
    .leftJoin('body_type as b', 'b.code', 'r.body_type')
    .select([
      'r.listing_id as id',
      'l.title',
      'l.url',
      'r.source_id',
      's.name_fa as source_name',
      'r.make_key',
      nameOf('mk').as('make_name'),
      'r.model_key',
      nameOf('m').as('model_name'),
      'r.trim_key',
      nameOf('t').as('trim_name'),
      'r.body_type',
      'b.label_fa as body_name',
      'r.model_year_sh',
      'l.model_year_ad',
      'r.mileage_km',
      'r.km_per_year',
      'r.price_type',
      'r.asking_price_toman',
      'r.market_value_toman',
      'r.price_gap_pct',
      'r.deal_rating',
      'r.valued_on',
      'r.gearbox',
      'r.fuel',
      'r.colour_family',
      'r.city_key',
      'c.name_fa as city_name',
      'r.district_fa',
      'r.seller_type',
      'r.body_condition',
      'r.engine_condition',
      'r.gearbox_condition',
      'r.chassis_condition',
      'r.paint_free',
      'r.accident',
      'r.listed_at',
      'r.last_seen_at',
      'r.photo_count',
      'r.cover_photo_url',
      'r.cover_thumbnail_url',
      'r.sort_key',
    ])
    .orderBy(searchOrderBy(prepared.search.sort, prepared.context))
    .execute();
  const shown = rows.slice(0, limit);
  const last = shown.at(-1);
  return {
    results: shown.map(cardOf),
    last:
      rows.length > limit && last !== undefined ? { values: last.sort_key, listingId: last.id } : undefined,
  };
}

async function countMatches(prepared: Prepared, cap: number): Promise<SearchTotal> {
  const { search } = prepared;
  if (hasNoFilter(prepared)) return { count: (await readCountedTotal()) ?? 0, exact: true };
  if (prepared.read.tsquery === null && search.catalogue !== undefined && isCatalogueUnchanged(search)) {
    return { count: (await readCatalogueCounts())[search.catalogue], exact: true };
  }
  const where = searchableWhere(prepared.read, prepared.context);
  const row = await readDatabase()
    .selectFrom((db) =>
      db
        .selectFrom('search_document as r')
        .select((eb) => eb.lit(1).as('one'))
        .where(where)
        .limit(cap + 1)
        .as('capped'),
    )
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return row.count > cap ? { count: cap, exact: false } : { count: row.count, exact: true };
}

/**
 * One page of a search's results, in its order, and how many match. `cursor` continues from the previous page; a cursor
 * from another order, an altered one or one holding a value its column cannot is refused (invalid_cursor), never
 * answered with a server error. With `limit` 0 only the count is read: a live count of any filter combination, exact
 * up to 1,000 and then «بیش از ۱٬۰۰۰», for a filter sheet. Each search is logged (its words, filters, order and count,
 * never who searched) for plain-Farsi search's labelled queries (CS-62) and the demand the superadmin sees.
 */
export async function searchListings(input: {
  readonly search: Search;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
  /** Count up to this many matches before saying «more than»; COUNT_CAP unless a page asks for its own. */
  readonly countCap?: number | undefined;
  /** A read the product makes for itself (the home page's rows), not a buyer's search: it is not logged as one. */
  readonly quiet?: boolean | undefined;
}): Promise<SearchResult> {
  const started = performance.now();
  const prepared = await prepare(input.search);
  const limit = Math.min(Math.max(input.limit ?? PAGE_SIZE, 0), MAX_PAGE_SIZE);
  const sort = prepared.search.sort;
  const countOnly = limit === 0;
  const continued =
    input.cursor === undefined || countOnly ? undefined : decodeCursorPage(input.cursor, sort);
  if (input.cursor !== undefined && !countOnly && continued === undefined)
    return { status: 'invalid_cursor' };

  // A later page repeats the first page's total: nothing is counted for it. A cursor from before totals travelled in
  // it (none has been issued) is counted.
  const carried: CursorTotal | undefined = continued?.total;
  let found: { results: ListingCard[]; last: SortKey | undefined };
  let total: SearchTotal;
  try {
    [found, total] = await Promise.all([
      countOnly ? { results: [], last: undefined } : readPage(prepared, continued?.key, limit),
      carried ?? countMatches(prepared, input.countCap ?? COUNT_CAP),
    ]);
  } catch (error) {
    // A backstop to the cursor's own checks: a value the database refuses is the caller's, not ours.
    if (continued !== undefined && isDataException(error)) return { status: 'invalid_cursor' };
    throw error;
  }
  const page: SearchPage = {
    results: found.results,
    nextCursor: found.last === undefined ? null : encodeCursor(sort, found.last, total),
    total,
    text: prepared.text,
  };
  if (input.quiet !== true)
    logger.info('search served', {
      'search.words': loggableWords(prepared.search.q),
      'search.words_matched': prepared.read.tsquery !== null,
      'search.words_corrected': prepared.text?.corrections.length ?? 0,
      'search.words_unknown': prepared.text?.unknown.length ?? 0,
      'search.filters': Object.keys(prepared.search.filters),
      'search.sort': sort ?? 'best_deal',
      'search.catalogue': prepared.search.catalogue,
      'search.page': continued === undefined ? 1 : 'next',
      'search.count_only': countOnly,
      'search.results': page.results.length,
      'search.total': total.count,
      durationMs: Math.round(performance.now() - started),
    });
  return { status: 'ok', page };
}

// Counted by the worker (search_facet_count), read at most once a minute per server.

type CountedRow = { facet: string; value: string; label_fa: string; listing_count: number };

async function readCounted(): Promise<CountedRow[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('search-counts');
  return readDatabase()
    .selectFrom('search_facet_count')
    .select(['facet', 'value', 'label_fa', 'listing_count'])
    .orderBy('facet')
    .orderBy('position')
    .execute();
}

async function readCountsBuiltAt(): Promise<string | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag('search-counts');
  const row = await readDatabase()
    .selectFrom('search_build_event')
    .select('happened_at')
    .where('event', '=', 'counts_built')
    .executeTakeFirst();
  return row?.happened_at.toISOString() ?? null;
}

async function readCountedTotal(): Promise<number | undefined> {
  const rows = await readCounted();
  return rows.find((row) => row.facet === 'total')?.listing_count;
}

/** How many searchable listings each catalogue holds, as of the worker's last count. */
export async function readCatalogueCounts(): Promise<CatalogueCounts> {
  const rows = await readCounted();
  const counts = Object.fromEntries(CATALOGUE_IDS.map((id) => [id, 0])) as Record<CatalogueId, number>;
  for (const row of rows) {
    if (row.facet === 'catalogue' && (CATALOGUE_IDS as readonly string[]).includes(row.value))
      counts[row.value as CatalogueId] = row.listing_count;
  }
  return counts;
}

/**
 * What a crawl sees and what is searchable, as of the worker's last count: the listings seen within the freshness
 * window, the share of them whose details have been read, and when it was counted. For a data-status page (CS-66).
 */
export async function readSearchCoverage(): Promise<SearchCoverage> {
  const [rows, countedAt] = await Promise.all([readCounted(), readCountsBuiltAt()]);
  const count = (facet: string) => rows.find((row) => row.facet === facet)?.listing_count ?? 0;
  return { searchable: count('total'), seen: count('seen'), countedAt };
}

/**
 * Every option of the filters whose options are rows, with its Persian name and how many searchable listings have it,
 * in the order the filter sheet lists them: the labels chips and the filter sheet show (CS-61).
 */
export async function readFilterOptionCounts(): Promise<SearchFacets> {
  const rows = await readCounted();
  const options = Object.fromEntries(DATABASE_OPTIONS.map((kind) => [kind, [] as FacetOption[]])) as Record<
    DatabaseOptions,
    FacetOption[]
  >;
  for (const row of rows) {
    if ((DATABASE_OPTIONS as readonly string[]).includes(row.facet))
      options[row.facet as DatabaseOptions].push({
        value: row.value,
        label: row.label_fa,
        count: row.listing_count,
      });
  }
  return options;
}

/**
 * The facets of a search: for each filter whose options are rows, how many of the search's matches each option has,
 * counted without the filter's own values (so choosing one make still shows the others). Everything, unfiltered, is
 * read from the worker's counts; any other search is counted live, one grouped scan per facet.
 */
export async function readSearchFacets(search: Search): Promise<SearchFacets> {
  const prepared = await prepare(search);
  const everything = await readFilterOptionCounts();
  if (hasNoFilter(prepared)) return everything;
  const rows = await readDatabase()
    .selectFrom(searchFacetCountsSql(prepared.read, prepared.context).as('facets'))
    .selectAll()
    .execute();
  const counted = new Map(rows.map((row) => [`${row.facet}:${row.value}`, row.count]));
  const result = {} as Record<DatabaseOptions, FacetOption[]>;
  for (const kind of DATABASE_OPTIONS) {
    const options = everything[kind].flatMap((option) => {
      const count = counted.get(`${kind}:${option.value}`);
      return count === undefined ? [] : [{ ...option, count }];
    });
    // Body types keep the catalogue's order; the others are listed most matched first, as the worker lists them.
    result[kind] = kind === 'body_type' ? options : options.sort((a, b) => b.count - a.count);
  }
  return result;
}
