import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { nameOnScreen } from '@carshenas/locale/names';
import { SEARCH_FRESHNESS_HOURS } from '@carshenas/search/freshness';
import { POPULAR_MODEL_RANK } from '@carshenas/search/filters';
import { searchListings } from '@/features/search/server/search-queries';
import type { ListingCard } from '@/features/search/search-types';
import {
  BAND_HIGH_FRACTION,
  DEALS_COUNT,
  BAND_LOW_FRACTION,
  RANGE_HIGH_FRACTION,
  RANGE_LOW_FRACTION,
} from '@/features/model/model-rules';
import type {
  ModelIndexEntry,
  ModelOverview,
  ModelRef,
  ModelStats,
  PopularModel,
  TrendDay,
  TrimRow,
  YearRow,
} from '@/features/model/model-types';
import { readDatabase } from '@/server/db/database';
import { equalsLiteral, isoDateText, nameOf, percentile, secondsAgo } from '@/server/db/sql-helpers';

// What the model page, the models index and the home page's popular models read (CS-67). The figures of «now» come
// from search_document, the table the search reads, inside the search's own freshness window, so «۱٬۲۳۴ آگهی» here is the
// number the search finds for the model. The trend comes from the valuation's own daily runs (listing_valuation, kept
// 90 days): each day's rated listings of one model year, the median of their asking prices. It is not read from the
// listings' posting dates: a listing that sold before the crawl began is not in the table, so the older a week is, the
// more it shows only the unsold, and the buyers of those weeks paid less (measured 2026-10-03: 61 to 136 listings
// posted a day before the crawl began against 370 to 500 after it). Everything is cached for two minutes (under five, so
// the build never bakes figures in), tagged with the search's counts. Plans measured with EXPLAIN (ANALYZE, BUFFERS)
// are in CS-67's notes.

const FRESHNESS_SECONDS = SEARCH_FRESHNESS_HOURS * 3_600;
const CACHE = { stale: 120, revalidate: 120, expire: 240 } as const;

const round = (value: number | null): number | null => (value === null ? null : Math.round(value));

/** The catalogue model an address names, or null: nothing is guessed from a near spelling. */
export async function readModelRef(makeSlug: string, modelSlug: string): Promise<ModelRef | null> {
  'use cache';
  cacheLife({ stale: 300, revalidate: 300, expire: 900 });
  cacheTag('search-counts');
  const row = await readDatabase()
    .selectFrom('model as m')
    .innerJoin('make as mk', 'mk.id', 'm.make_id')
    .leftJoin('body_type as b', 'b.code', 'm.body_type')
    .select([
      'm.id',
      'mk.slug as make_slug',
      'm.slug',
      nameOf('mk').as('make_name'),
      nameOf('m').as('name'),
      'b.code as body_code',
      'b.label_fa as body_label',
    ])
    .where('mk.slug', '=', makeSlug)
    .where('m.slug', '=', modelSlug)
    .executeTakeFirst();
  if (row === undefined) return null;
  return {
    id: row.id,
    makeSlug: row.make_slug,
    slug: row.slug,
    key: `${row.make_slug}.${row.slug}`,
    makeName: nameOnScreen(row.make_name ?? row.make_slug),
    name: nameOnScreen(row.name ?? row.slug),
    bodyType:
      row.body_code === null || row.body_label === null
        ? null
        : { code: row.body_code, label: row.body_label },
  };
}

/** The figures of one model now, and its years: for a model year (`year`) or for all of them (null). */
export async function readModelOverview(modelKey: string, year: number | null): Promise<ModelOverview> {
  'use cache';
  cacheLife(CACHE);
  cacheTag('search-counts');
  const database = readDatabase();
  const fresh = secondsAgo(FRESHNESS_SECONDS);
  const [stats, years, run] = await Promise.all([
    database
      .selectFrom('search_document as r')
      .select((eb) => [
        eb.fn.countAll<number>().as('count'),
        eb.fn.count<number>('r.asking_price_toman').as('priced'),
        percentile('r.asking_price_toman', 0.5).as('median'),
        percentile('r.asking_price_toman', RANGE_LOW_FRACTION).as('low'),
        percentile('r.asking_price_toman', RANGE_HIGH_FRACTION).as('high'),
        percentile('r.market_value_toman', 0.5).as('value'),
        eb.fn.count<number>('r.market_value_toman').as('valued'),
        percentile('r.mileage_km', 0.5).as('mileage'),
        eb.fn.min('r.model_rank').as('rank'),
        eb.fn.min('r.model_year_sh').as('first_year'),
        eb.fn.max('r.model_year_sh').as('last_year'),
        eb.fn.countAll<number>().filterWhere(equalsLiteral('r.deal_rating', 'great')).as('great'),
        eb.fn.countAll<number>().filterWhere(equalsLiteral('r.deal_rating', 'good')).as('good'),
        eb.fn.countAll<number>().filterWhere(equalsLiteral('r.deal_rating', 'fair')).as('fair'),
        eb.fn.countAll<number>().filterWhere(equalsLiteral('r.deal_rating', 'high')).as('high_rating'),
        eb.fn.countAll<number>().filterWhere(equalsLiteral('r.deal_rating', 'overpriced')).as('overpriced'),
        eb.fn.count<number>('r.paint_free').as('paint_known'),
        eb.fn.countAll<number>().filterWhere('r.paint_free', '=', true).as('paint_free'),
        eb.fn.count<number>('r.gearbox').as('gearbox_known'),
        eb.fn.countAll<number>().filterWhere(equalsLiteral('r.gearbox', 'automatic')).as('automatic'),
        eb.fn.count<number>('r.seller_type').as('seller_known'),
        eb.fn.countAll<number>().filterWhere(equalsLiteral('r.seller_type', 'private')).as('private_seller'),
      ])
      .where('r.model_key', '=', modelKey)
      .where('r.last_seen_at', '>=', fresh)
      .$if(year !== null, (query) => query.where('r.model_year_sh', '=', year ?? 0))
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('search_document as r')
      .select((eb) => [
        'r.model_year_sh as year',
        eb.fn.countAll<number>().as('count'),
        percentile('r.asking_price_toman', 0.5).as('median'),
        percentile('r.market_value_toman', 0.5).as('value'),
        percentile('r.mileage_km', 0.5).as('mileage'),
      ])
      .where('r.model_key', '=', modelKey)
      .where('r.last_seen_at', '>=', fresh)
      .where('r.model_year_sh', 'is not', null)
      .groupBy('r.model_year_sh')
      .orderBy('r.model_year_sh', 'desc')
      .execute(),
    database
      .selectFrom('valuation_run')
      .select(isoDateText('as_of_date').as('as_of_date'))
      .where('status', '=', 'succeeded')
      .orderBy('as_of_date', 'desc')
      .limit(1)
      .executeTakeFirst(),
  ]);
  const rated = stats.great + stats.good + stats.fair + stats.high_rating + stats.overpriced;
  const modelStats: ModelStats = {
    count: stats.count,
    priced: stats.priced,
    medianToman: round(stats.median),
    lowToman: round(stats.low),
    highToman: round(stats.high),
    marketValueToman: round(stats.value),
    valued: stats.valued,
    medianMileageKm: round(stats.mileage),
    popularRank: stats.rank,
    firstYear: stats.first_year,
    lastYear: stats.last_year,
    ratings: {
      great: stats.great,
      good: stats.good,
      fair: stats.fair,
      high: stats.high_rating,
      overpriced: stats.overpriced,
    },
    unrated: stats.count - rated,
    facts: {
      paintFree: { of: stats.paint_known, yes: stats.paint_free },
      automatic: { of: stats.gearbox_known, yes: stats.automatic },
      privateSeller: { of: stats.seller_known, yes: stats.private_seller },
    },
  };
  return {
    stats: modelStats,
    years: years.flatMap((row): YearRow[] =>
      row.year === null
        ? []
        : [
            {
              year: row.year,
              count: row.count,
              medianToman: round(row.median),
              marketValueToman: round(row.value),
              medianMileageKm: round(row.mileage),
            },
          ],
    ),
    valuedOn: run?.as_of_date ?? null,
  };
}

/** The trims of a model (its listings that name one) with their counts and median asking prices. */
export async function readModelTrims(modelKey: string, year: number | null): Promise<TrimRow[]> {
  'use cache';
  cacheLife(CACHE);
  cacheTag('search-counts');
  const rows = await readDatabase()
    .selectFrom('search_document as r')
    .leftJoin('trim as t', 't.id', 'r.trim_id')
    .select((eb) => [
      'r.trim_key as key',
      nameOf('t').as('name'),
      eb.fn.countAll<number>().as('count'),
      percentile('r.asking_price_toman', 0.5).as('median'),
    ])
    .where('r.model_key', '=', modelKey)
    .where('r.last_seen_at', '>=', secondsAgo(FRESHNESS_SECONDS))
    .$if(year !== null, (query) => query.where('r.model_year_sh', '=', year ?? 0))
    .groupBy(['r.trim_key', 't.name_fa', 't.name_en'])
    .orderBy('count', 'desc')
    .execute();
  return rows.map((row) => ({
    key: row.key,
    name: row.name === null ? null : nameOnScreen(row.name),
    count: row.count,
    medianToman: round(row.median),
  }));
}

/**
 * The valuation's history for one model year: for each succeeded run (the last of a day), the rated listings of the
 * model year, their median asking price, the middle half of them, their median market value and how many they were.
 * Days are Tehran days (valuation_run.as_of_date). Newest runs last; nothing older than the runs are kept.
 */
export async function readModelTrend(modelId: number, year: number): Promise<TrendDay[]> {
  'use cache';
  cacheLife(CACHE);
  cacheTag('search-counts');
  const rows = await readDatabase()
    .selectFrom('listing_valuation as v')
    .innerJoin('valuation_run as r', 'r.id', 'v.valuation_run_id')
    .innerJoin('listing as l', 'l.id', 'v.listing_id')
    .select((eb) => [
      isoDateText('r.as_of_date').as('date'),
      eb.fn.countAll<number>().as('count'),
      percentile('v.asking_price_toman', 0.5).as('median'),
      percentile('v.asking_price_toman', BAND_LOW_FRACTION).as('low'),
      percentile('v.asking_price_toman', BAND_HIGH_FRACTION).as('high'),
      percentile('v.market_value_toman', 0.5).as('value'),
    ])
    .where('l.model_id', '=', modelId)
    .where('l.model_year_sh', '=', year)
    .where('v.deal_rating', 'is not', null)
    .where('r.status', '=', 'succeeded')
    .where('r.id', 'in', (eb) =>
      eb
        .selectFrom('valuation_run as last')
        .select((inner) => inner.fn.max('last.id').as('id'))
        .where('last.status', '=', 'succeeded')
        .groupBy('last.as_of_date'),
    )
    .groupBy('r.as_of_date')
    .orderBy('r.as_of_date')
    .execute();
  return rows.flatMap((row): TrendDay[] =>
    row.median === null || row.low === null || row.high === null
      ? []
      : [
          {
            date: row.date,
            count: row.count,
            medianToman: Math.round(row.median),
            lowToman: Math.round(row.low),
            highToman: Math.round(row.high),
            marketValueToman: round(row.value),
          },
        ],
  );
}

const MODEL_COLUMNS = ['mk.slug as make_slug', 'm.slug as slug', 'm.body_type as body_type'] as const;

/** The models with the most listings now, as the search's own «مدل پرطرفدار» filter counts them. */
export async function readPopularModels(): Promise<PopularModel[]> {
  'use cache';
  cacheLife(CACHE);
  cacheTag('search-counts');
  const rows = await readDatabase()
    .selectFrom('search_document as r')
    .innerJoin('model as m', 'm.id', 'r.model_id')
    .innerJoin('make as mk', 'mk.id', 'm.make_id')
    .select((eb) => [
      ...MODEL_COLUMNS,
      nameOf('m').as('name'),
      eb.fn.countAll<number>().as('count'),
      percentile('r.asking_price_toman', 0.5).as('median'),
    ])
    .where('r.model_rank', '<=', POPULAR_MODEL_RANK)
    .where('r.last_seen_at', '>=', secondsAgo(FRESHNESS_SECONDS))
    .groupBy(['mk.slug', 'm.slug', 'm.body_type', 'm.name_fa', 'm.name_en'])
    .orderBy('count', 'desc')
    .orderBy('m.slug')
    .execute();
  return rows.map((row) => ({
    makeSlug: row.make_slug,
    slug: row.slug,
    name: nameOnScreen(row.name ?? row.slug),
    bodyType: row.body_type,
    count: row.count,
    medianToman: round(row.median),
  }));
}

/** Every model that has listings now, for the models index: most listings first within a make. */
export async function readModelIndex(): Promise<ModelIndexEntry[]> {
  'use cache';
  cacheLife(CACHE);
  cacheTag('search-counts');
  const rows = await readDatabase()
    .selectFrom('search_document as r')
    .innerJoin('model as m', 'm.id', 'r.model_id')
    .innerJoin('make as mk', 'mk.id', 'm.make_id')
    .select((eb) => [
      ...MODEL_COLUMNS,
      nameOf('mk').as('make_name'),
      nameOf('m').as('name'),
      eb.fn.countAll<number>().as('count'),
      percentile('r.asking_price_toman', 0.5).as('median'),
    ])
    .where('r.last_seen_at', '>=', secondsAgo(FRESHNESS_SECONDS))
    .groupBy(['mk.slug', 'mk.name_fa', 'mk.name_en', 'm.slug', 'm.body_type', 'm.name_fa', 'm.name_en'])
    .orderBy('count', 'desc')
    .execute();
  return rows.map((row) => ({
    makeSlug: row.make_slug,
    makeName: nameOnScreen(row.make_name ?? row.make_slug),
    slug: row.slug,
    name: nameOnScreen(row.name ?? row.slug),
    bodyType: row.body_type,
    count: row.count,
    medianToman: round(row.median),
  }));
}

/** The model's listings with the best deals first, the search's own «بهترین معامله» order, as the same cards. */
export async function readModelDeals(
  modelKey: string,
  year: number | null,
): Promise<{ readonly now: string; readonly cards: readonly ListingCard[] }> {
  'use cache';
  cacheLife(CACHE);
  cacheTag('search-counts');
  const result = await searchListings({
    search: { filters: { model: [modelKey], ...(year === null ? {} : { year: { min: year, max: year } }) } },
    limit: DEALS_COUNT,
    quiet: true,
  });
  // Only a request with a cursor can be refused for it, and this one has none.
  if (result.status !== 'ok') throw new Error('the best deals of a model were refused');
  return { now: new Date().toISOString(), cards: result.page.results };
}
