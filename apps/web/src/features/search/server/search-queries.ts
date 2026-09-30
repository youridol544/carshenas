import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { CATALOGUE_IDS, type CatalogueId } from '@carshenas/search/catalogues';
import { decodeCursor, encodeCursor } from '@carshenas/search/cursor';
import { FILTERS } from '@carshenas/search/filters';
import { SEARCH_FRESHNESS_HOURS } from '@carshenas/search/freshness';
import { DATABASE_OPTIONS, type DatabaseOptions } from '@carshenas/search/kinds';
import { canonical, isCatalogueUnchanged, type Search } from '@carshenas/search/search';
import {
  isFresh,
  matchesText,
  searchAfter,
  searchOrderBy,
  searchWhere,
  sortKeyOf,
  type SqlContext,
} from '@carshenas/search/sql';
import type {
  CatalogueCounts,
  DealRating,
  FacetOption,
  ListingCard,
  SearchFacets,
  SearchPage,
  SearchTotal,
} from '@/features/search/search-types';
import { readDatabase } from '@/server/db/database';
import { columnPresent, columnRef, columnText, nameOf, searchTsquery, textValue } from '@/server/db/sql-helpers';
import { logger } from '@/server/observability/logger';

// The search API (CS-59): a search of @carshenas/search (CS-58) run on search_document, the table the worker keeps
// fresh, never on the view. Results come in the search's order, a page at a time, continued by a cursor (keyset, no
// OFFSET); the total and the facets are read from search_facet_count when the search is one the worker has counted
// (everything, or a catalogue as it is), and counted live otherwise, the total capped. Plans measured with EXPLAIN
// (ANALYZE, BUFFERS) on 23,360 listings are in CS-59's notes and docs/evidence/search-api/.

/** Results on a page unless the caller asks for fewer or more. */
export const PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 48;

/** A total above this is shown as «بیش از …»: counting every match of a broad search costs more than it tells. */
export const COUNT_CAP = 50_000;

const ALIAS = 'r';

/** The search's words as the tsquery search_tsquery() builds, or null when no searchable word is left. */
async function textQuery(words: string | undefined): Promise<string | null> {
  if (words === undefined) return null;
  const row = await readDatabase()
    .selectNoFrom(searchTsquery(words).as('query'))
    .executeTakeFirst();
  return row?.query ?? null;
}

type Prepared = {
  readonly search: Search;
  readonly context: SqlContext;
  readonly tsquery: string | null;
};

async function prepare(search: Search): Promise<Prepared> {
  const form = canonical(search);
  return { search: form, context: { alias: ALIAS, now: new Date() }, tsquery: await textQuery(form.q) };
}

/** The conditions every read adds: the filters, freshness and the words; a filter can be left out for its facet. */
function conditions(prepared: Prepared, without?: string) {
  const filters = without === undefined ? prepared.search.filters : { ...prepared.search.filters, [without]: undefined };
  const all = [searchWhere(filters, prepared.context), isFresh(prepared.context, SEARCH_FRESHNESS_HOURS)];
  if (prepared.tsquery !== null) all.push(matchesText(prepared.tsquery, prepared.context));
  return all;
}

function hasNoFilter(prepared: Prepared): boolean {
  return prepared.tsquery === null && Object.keys(prepared.search.filters).length === 0;
}

export type SearchResult =
  | { readonly status: 'ok'; readonly page: SearchPage }
  /** The cursor was made for another order or was altered: start from the first page. */
  | { readonly status: 'invalid_cursor' };

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
  price_type: string | null;
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

async function readPage(prepared: Prepared, cursor: string | undefined, limit: number) {
  const key = cursor === undefined ? undefined : decodeCursor(cursor, prepared.search.sort);
  if (cursor !== undefined && key === undefined) return undefined;
  const where = conditions(prepared);
  if (key !== undefined) where.push(searchAfter(prepared.search.sort, key, prepared.context));
  // The page's rows first, from search_document alone and in its order; the names are joined to those rows only. With
  // the joins in the same query, a filter the planner underestimates (clean-and-easy: 1 estimated, 888 found) made it
  // loop over the catalogue tables for every match (270 ms against 19 ms).
  const rows = await readDatabase()
    .with(
      (cte) => cte('page').materialized(),
      (db) =>
        db
          .selectFrom('search_document as r')
          .select([
            'r.listing_id',
            'r.source_id',
            'r.make_id',
            'r.model_id',
            'r.trim_id',
            'r.city_id',
            'r.make_key',
            'r.model_key',
            'r.trim_key',
            'r.body_type',
            'r.model_year_sh',
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
            sortKeyOf(prepared.search.sort, prepared.context).as('sort_key'),
          ])
          .where((eb) => eb.and(where))
          .orderBy(searchOrderBy(prepared.search.sort, prepared.context))
          .limit(limit + 1),
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
      columnText(ALIAS, 'valued_on').as('valued_on'),
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
  const shown = (rows as ResultRow[]).slice(0, limit);
  const last = shown.at(-1);
  const nextCursor =
    rows.length > limit && last !== undefined
      ? encodeCursor(prepared.search.sort, { values: last.sort_key, listingId: last.id })
      : null;
  return { results: shown.map(cardOf), nextCursor };
}

async function countMatches(prepared: Prepared): Promise<SearchTotal> {
  const { search } = prepared;
  if (hasNoFilter(prepared)) return { count: (await readCountedTotal()) ?? 0, exact: true };
  if (prepared.tsquery === null && search.catalogue !== undefined && isCatalogueUnchanged(search)) {
    return { count: (await readCatalogueCounts())[search.catalogue], exact: true };
  }
  const where = conditions(prepared);
  const row = await readDatabase()
    .selectFrom((db) =>
      db
        .selectFrom('search_document as r')
        .select((eb) => eb.lit(1).as('one'))
        .where((eb) => eb.and(where))
        .limit(COUNT_CAP + 1)
        .as('capped'),
    )
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  const count = row.count;
  return count > COUNT_CAP ? { count: COUNT_CAP, exact: false } : { count, exact: true };
}

// Keeps a typed query's digits out of the log when they could be a phone number.
function loggableWords(words: string | undefined): string | undefined {
  return words?.replace(/[0-9۰-۹٠-٩]{7,}/g, '#');
}

/**
 * One page of a search's results, in its order, and how many match. `cursor` continues from the previous page; a
 * cursor from another order or an altered one is refused. Each search is logged (its words, filters, order and count,
 * never who searched) for plain-Farsi search's labelled queries (CS-62) and the demand the superadmin sees.
 */
export async function searchListings(input: {
  readonly search: Search;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}): Promise<SearchResult> {
  const started = performance.now();
  const prepared = await prepare(input.search);
  const limit = Math.min(Math.max(input.limit ?? PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const [page, total] = await Promise.all([readPage(prepared, input.cursor, limit), countMatches(prepared)]);
  if (page === undefined) return { status: 'invalid_cursor' };
  logger.info('search served', {
    'search.words': loggableWords(prepared.search.q),
    'search.words_matched': prepared.tsquery !== null,
    'search.filters': Object.keys(prepared.search.filters),
    'search.sort': prepared.search.sort ?? 'best_deal',
    'search.catalogue': prepared.search.catalogue,
    'search.page': input.cursor === undefined ? 1 : 'next',
    'search.results': page.results.length,
    'search.total': total.count,
    durationMs: Math.round(performance.now() - started),
  });
  return { status: 'ok', page: { ...page, total } };
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

async function readCountedTotal(): Promise<number | undefined> {
  const rows = await readCounted();
  return rows.find((row) => row.facet === 'total')?.listing_count;
}

/** How many searchable listings each catalogue holds, as of the worker's last refresh. */
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
      options[row.facet as DatabaseOptions].push({ value: row.value, label: row.label_fa, count: row.listing_count });
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
  const facets = DATABASE_OPTIONS.flatMap((kind) => {
    const filter = FILTERS.find((candidate) => 'optionsFrom' in candidate && candidate.optionsFrom === kind);
    return filter === undefined || !('predicate' in filter) || !('column' in filter.predicate)
      ? []
      : [{ kind, filterId: filter.id, column: filter.predicate.column }];
  });
  const queries = facets.map((facet) => {
    const where = conditions(prepared, facet.filterId);
    return readDatabase()
      .selectFrom('search_document as r')
      .select((eb) => [
        textValue(facet.kind).as('facet'),
        columnText(ALIAS, facet.column).as('value'),
        eb.fn.countAll<number>().as('count'),
      ])
      .where((eb) => eb.and([...where, columnPresent(ALIAS, facet.column)]))
      .groupBy(columnRef(ALIAS, facet.column));
  });
  const [first, ...rest] = queries;
  const rows = first === undefined ? [] : await rest.reduce((union, query) => union.unionAll(query), first).execute();
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
