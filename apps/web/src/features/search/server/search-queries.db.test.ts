import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { isDataException } from '@carshenas/db/database-errors';
import { encodeCursor } from '@carshenas/search/cursor';
import { buildSearchDocuments, refreshFacetCounts, refreshSearchWords } from '@carshenas/search/document';
import type { SearchFilters } from '@carshenas/search/search';
import { SORTS } from '@carshenas/search/sorts';
import {
  COUNT_CAP,
  MAX_PAGE_SIZE,
  PAGE_SIZE,
  readCatalogueCounts,
  readFilterOptionCounts,
  readSearchCoverage,
  readSearchFacets,
  searchListings,
} from '@/features/search/server/search-queries';
import { answerSearch, type SearchResponse } from '@/features/search/server/search-route';
import { assertScratchDatabase, ownerDatabase } from '@/server/db/account-test-database';
import { database } from '@/server/db/database';
import { recordedLines } from '@/server/observability/recording-logger';
import {
  addBareListing,
  ageDocument,
  removeSearchData,
  seedSearchData,
  type SearchTestData,
} from '@/server/db/search-test-database';

// The search API's reads and its route (CS-59 criteria 1, 4 and 5) against the scratch database `pnpm db:check`
// migrated, through the app's own pool, as carshenas_web: rows seeded as the owner, built into search_document by the
// build the worker runs, then searched. Each test sees only its own make, so tests of other features never count.

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});

const owner = ownerDatabase();
const suffix = randomBytes(4).toString('hex');
const SMALL = 30;
const BIG = COUNT_CAP + 10;

let data: SearchTestData;
let SLUG = '';
let BIG_SLUG = '';
let ids: readonly number[] = [];
let cityA: SearchTestData['cityA'];
let cityB: SearchTestData['cityB'];
/** The filters that keep a search to this test's make. */
let OURS: SearchFilters = {};

beforeAll(async () => {
  await assertScratchDatabase(owner);
  data = await seedSearchData(owner, { suffix, small: SMALL, big: BIG });
  ({ slug: SLUG, bigSlug: BIG_SLUG, ids, cityA, cityB } = data);
  OURS = { make: [SLUG] };
  await owner
    .transaction()
    .execute((trx) => buildSearchDocuments(trx, { scope: { listingIds: [...data.ids, ...data.bigIds] } }));
  await refreshFacetCounts(owner);
  await refreshSearchWords(owner);
}, 120_000);

afterAll(async () => {
  // A seed that failed removed its own rows and left no data.
  if ((data as SearchTestData | undefined) !== undefined) await removeSearchData(owner, data);
  await database().destroy();
  await owner.destroy();
});

function search(extra: SearchFilters = {}, input: { cursor?: string; limit?: number } = {}) {
  return searchListings({ search: { filters: { ...OURS, ...extra } }, ...input });
}

async function firstPage(extra: SearchFilters = {}, input: { cursor?: string; limit?: number } = {}) {
  const result = await search(extra, input);
  if (result.status !== 'ok') throw new Error('the cursor was refused');
  return result.page;
}

async function wordsPage(q: string) {
  const result = await searchListings({ search: { q, filters: OURS } });
  if (result.status !== 'ok') throw new Error('the cursor was refused');
  return result.page;
}

/** How many of the make's listings the owner counts for a combination of columns: the check on the API's own count. */
async function countOf(where: {
  gearbox?: 'automatic';
  cityId?: number;
  maxPrice?: number;
}): Promise<number> {
  let query = owner
    .selectFrom('search_document')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('listing_id', 'in', [...ids]);
  if (where.gearbox !== undefined) query = query.where('gearbox', '=', where.gearbox);
  if (where.cityId !== undefined) query = query.where('city_id', '=', where.cityId);
  if (where.maxPrice !== undefined) query = query.where('asking_price_toman', '<=', where.maxPrice);
  return (await query.executeTakeFirstOrThrow()).n;
}

test('a page is cards: the title, price, the valuation with its date, the first photo and the click-out', async () => {
  const page = await firstPage();
  expect(page.results).toHaveLength(PAGE_SIZE);
  expect(page.total).toEqual({ count: SMALL, exact: true });
  expect(page.nextCursor).not.toBeNull();
  const card = page.results[0];
  expect(card?.make).toEqual({ key: SLUG, name: 'خودروساز آزمایشی' });
  expect(card?.source).toEqual({ key: data.source, name: 'منبع آزمایشی' });
  expect(card?.url).toMatch(/^https:\/\/test\.example\/api\d+$/);
  expect(card?.listedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(card?.askingPriceToman).toBeGreaterThan(0);
  // Best deal first: the first card is the most below its market value, from the latest succeeded run.
  expect(card?.valuation?.valuedOn).toBe(data.runDate);
  expect(card?.valuation?.priceGapPct).toBeLessThan(0);
  expect(card?.valuation?.dealRating).toBe('great');
  expect(page.results.find((row) => row.photo !== null)?.photo?.url).toMatch(
    /^https:\/\/test\.example\/photo\/\d+\.jpg$/,
  );
  expect(page.results.some((row) => row.photo === null)).toBe(true);
  // A listing the run did not rate has no valuation.
  expect(page.results.some((row) => row.valuation === null)).toBe(true);
});

test('every order puts rows without a value last, and a keyset page after a page is the next rows', async () => {
  for (const sort of SORTS) {
    const seen: number[] = [];
    const values: (number | string | null)[] = [];
    let cursor: string | undefined;
    let total: unknown;
    for (let pages = 0; pages < 20; pages += 1) {
      const result = await searchListings({
        search: { filters: OURS, sort: sort.id },
        ...(cursor === undefined ? {} : { cursor }),
        limit: 7,
      });
      if (result.status !== 'ok') throw new Error(`${sort.id}: the cursor was refused`);
      const page = result.page;
      total ??= page.total;
      // A later page repeats the first page's total: nothing is counted for it.
      expect(page.total).toEqual(total);
      for (const card of page.results) {
        seen.push(card.id);
        values.push(
          {
            best_deal: card.valuation?.priceGapPct ?? null,
            price_asc: card.askingPriceToman,
            price_desc: card.askingPriceToman,
            mileage_asc: card.mileageKm,
            newest: card.listedAt,
            year_desc: card.modelYearSh,
          }[sort.id],
        );
      }
      cursor = page.nextCursor ?? undefined;
      if (cursor === undefined) break;
    }
    expect(seen).toHaveLength(SMALL);
    expect(new Set(seen).size).toBe(SMALL);
    // Rows without a value come after every row with one.
    const firstNull = values.indexOf(null);
    const tail = firstNull === -1 ? [] : values.slice(firstNull);
    expect(tail.every((value) => value === null)).toBe(true);
    const present = values.slice(0, firstNull === -1 ? undefined : firstNull) as (number | string)[];
    const ascending = sort.orderBy[0].direction === 'asc';
    const sorted = [...present].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(present).toEqual(ascending ? sorted : sorted.reverse());
  }
});

test('a later page takes its total from the cursor: no count is run for it', async () => {
  const first = await firstPage();
  expect(first.nextCursor).not.toBeNull();
  // A cursor that carries another total gives that total back: it is not recounted.
  const carried = encodeCursor(
    'best_deal',
    { values: ['-10.00', '2099-01-01 00:00:00+00'], listingId: 1 },
    { count: 999, exact: false },
  );
  const next = await firstPage({}, { cursor: carried });
  expect(next.total).toEqual({ count: 999, exact: false });
});

test('limit 0 is a count of any filter combination, exact up to the cap and a cap above it', async () => {
  const none = await firstPage({}, { limit: 0 });
  expect(none.results).toEqual([]);
  expect(none.nextCursor).toBeNull();
  expect(none.total).toEqual({ count: SMALL, exact: true });
  // A combination of filters is counted live: gearbox, city and price together.
  const expected = await countOf({ gearbox: 'automatic', cityId: cityA.id, maxPrice: 500_000_000 });
  expect(expected).toBeGreaterThan(0);
  const counted = await firstPage(
    { gearbox: ['automatic'], city: [cityA.slug], price: { max: 500_000_000 } },
    { limit: 0 },
  );
  expect(counted.total).toEqual({ count: expected, exact: true });
  // More than the cap: counted to it, and said not to be exact («بیش از ۱٬۰۰۰»), with or without rows.
  const big = await searchListings({ search: { filters: { make: [BIG_SLUG] } }, limit: 0 });
  expect(big.status === 'ok' ? big.page.total : undefined).toEqual({ count: COUNT_CAP, exact: false });
  const bigPage = await searchListings({ search: { filters: { make: [BIG_SLUG] } }, limit: 5 });
  expect(bigPage.status === 'ok' ? bigPage.page.total : undefined).toEqual({
    count: COUNT_CAP,
    exact: false,
  });
  // A limit past the largest page is the largest page.
  const wide = await firstPage({}, { limit: 500 });
  expect(wide.results).toHaveLength(Math.min(SMALL, MAX_PAGE_SIZE));
});

test('a cursor that is altered, from another order or holds a value its column cannot is refused, never a server error', async () => {
  const handmade = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const key = (values: (string | null)[], sort = 'best_deal') => handmade({ v: 1, s: sort, k: values, i: 5 });
  const refused: { cursor: string; sort?: 'mileage_asc' }[] = [
    { cursor: 'abc' },
    { cursor: 'not a cursor!' },
    { cursor: key(['abc', null]) }, // 22P02
    { cursor: key(['1', '2026-13-45 99:99:99+00']) }, // 22007, 22008
    { cursor: key(['99999999999999999999', '2026-09-30 12:46:00+00']) },
    { cursor: key([null, '0000-01-01 00:00:00+00']) },
    { cursor: key(['1.5', 'yesterday']) },
    { cursor: key(['1', null]) },
    { cursor: key(['2147483648'], 'mileage_asc'), sort: 'mileage_asc' }, // 22003
    { cursor: handmade({ v: 2, s: 'best_deal', k: ['1', '2026-09-30 12:46:00+00'], i: 5 }) },
    { cursor: handmade({ v: 1, s: 'newest', k: ['2026-09-30 12:46:00+00'], i: 5 }) },
  ];
  for (const { cursor, sort } of refused) {
    const result = await searchListings({
      search: { filters: OURS, ...(sort === undefined ? {} : { sort }) },
      cursor,
    });
    expect(result).toEqual({ status: 'invalid_cursor' });
  }
  // And one that is valid is served.
  const fine = await search({}, { cursor: key(['-3.50', '2099-01-01 00:00:00+00']) });
  expect(fine.status).toBe('ok');
});

test('a value the database refuses is the caller’s: class 22 errors are data exceptions, the others are not', async () => {
  const failure = async (statement: Promise<unknown>) => {
    try {
      await statement;
    } catch (error) {
      return error;
    }
    return undefined;
  };
  const listing = () => database().selectFrom('listing').select('id');
  // PostgreSQL reads a parameter as its column's type: text that is no number is 22P02, a date that is none 22007 or
  // 22008, a number past the type's range 22003.
  const noNumber = await failure(
    listing()
      .where('id', '=', 'abc' as never)
      .execute(),
  );
  const noDate = await failure(
    listing()
      .where('listed_at', '=', '2026-13-45 99:99:99+00' as never)
      .execute(),
  );
  const tooBig = await failure(
    listing()
      .where('mileage_km', '=', 99_999_999_999 as never)
      .execute(),
  );
  expect(isDataException(noNumber)).toBe(true);
  expect(isDataException(noDate)).toBe(true);
  expect(isDataException(tooBig)).toBe(true);
  const noTable = await failure(
    database()
      .selectFrom('no_such_table' as never)
      .selectAll()
      .execute(),
  );
  expect(noTable).toBeDefined();
  expect(isDataException(noTable)).toBe(false);
  expect(isDataException(new Error('timeout'))).toBe(false);
  expect(isDataException(undefined)).toBe(false);
});

test('the words: a typo is replaced, an unknown word is named, punctuation is ignored', async () => {
  const noWords = await firstPage();
  expect(noWords.text).toBeNull();
  const corrected = await wordsPage('سلام');
  expect(corrected.text).toEqual({
    searchable: true,
    corrections: [{ from: 'سلام', to: 'سالم' }],
    unknown: [],
  });
  expect(corrected.total).toEqual({ count: SMALL, exact: true });
  const unknown = await wordsPage('مزدا');
  expect(unknown.text).toEqual({ searchable: true, corrections: [], unknown: ['مزدا'] });
  expect(unknown.results).toEqual([]);
  expect(unknown.total).toEqual({ count: 0, exact: true });
  const punctuation = await wordsPage('!!!');
  expect(punctuation.text).toEqual({ searchable: false, corrections: [], unknown: [] });
  expect(punctuation.results).toHaveLength(PAGE_SIZE);
  // Words narrow the search with the filters.
  const even = await wordsPage('نقدی');
  expect(even.total).toEqual({ count: SMALL / 2, exact: true });
  // The log has the words and what became of them, never who asked.
  const line = recordedLines
    .filter((entry) => entry.message === 'search served' && entry.fields['search.words'] === 'مزدا')
    .at(-1);
  expect(line?.fields['search.words_unknown']).toBe(1);
  expect(line?.fields).not.toHaveProperty('account');
});

test('a list row is seen, and counted as seen, but is not searchable until its details are read', async () => {
  const before = await readSearchCoverage();
  const bare = await addBareListing(owner, data.source, `bare-${suffix}`);
  await owner.transaction().execute((trx) => buildSearchDocuments(trx, { scope: { listingIds: [bare] } }));
  await refreshFacetCounts(owner);
  const after = await readSearchCoverage();
  expect(after.seen).toBe(before.seen + 1);
  expect(after.searchable).toBe(before.searchable);
  expect(after.seen).toBeGreaterThanOrEqual(after.searchable);
  expect(after.countedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  const found = await owner
    .selectFrom('search_document')
    .select('listing_id')
    .where('listing_id', '=', bare)
    .execute();
  expect(found).toEqual([]);
});

test('a row not seen for 48 hours is not shown or counted, even before the worker expires it', async () => {
  const stale = ids[0] ?? 0;
  expect(stale).toBeGreaterThan(0);
  await ageDocument(owner, stale, 49);
  try {
    const page = await firstPage({}, { limit: 48 });
    expect(page.results.map((card) => card.id)).not.toContain(stale);
    expect(page.total).toEqual({ count: SMALL - 1, exact: true });
  } finally {
    await ageDocument(owner, stale, 0);
  }
});

test('facets count each option without its own filter, so the other options stay visible', async () => {
  const unfiltered = await readSearchFacets({ filters: {} });
  expect(unfiltered.make.length).toBeGreaterThan(0);
  const facets = await readSearchFacets({
    filters: { ...OURS, city: [cityB.slug], gearbox: ['automatic'] },
  });
  // The city facet is counted without the city filter: both cities, with the make and the gearbox applied.
  const cities = Object.fromEntries(facets.city.map((option) => [option.value, option.count]));
  expect(cities[cityA.slug]).toBe(await countOf({ gearbox: 'automatic', cityId: cityA.id }));
  expect(cities[cityB.slug]).toBe(await countOf({ gearbox: 'automatic', cityId: cityB.id }));
  // The make facet is counted without the make filter, with the city and the gearbox applied: our make's share.
  const makes = Object.fromEntries(facets.make.map((option) => [option.value, option.count]));
  expect(makes[SLUG]).toBe(await countOf({ gearbox: 'automatic', cityId: cityB.id }));
  // The models and the rest are counted with every filter applied, and only options with listings are offered.
  expect(facets.model.every((option) => option.count > 0)).toBe(true);
  const options = await readFilterOptionCounts();
  expect(options.make.find((option) => option.value === SLUG)?.count).toBe(SMALL);
  expect(options.make.find((option) => option.value === SLUG)?.label).toBe('خودروساز آزمایشی');
  const catalogues = await readCatalogueCounts();
  expect(Object.keys(catalogues).length).toBeGreaterThanOrEqual(9);
  expect(Object.values(catalogues).every((count) => count >= 0)).toBe(true);
});

// The route.

async function route(query: string) {
  const response = await answerSearch(new Request(`https://carshenas.test/api/search?${query}`));
  return { response, body: (await response.json()) as SearchResponse & { message?: string } };
}

test('GET /api/search: the page, the total, the words and what it ignored, kept for half a minute', async () => {
  const { response, body } = await route(`make=${SLUG}&limit=5&facets=1`);
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('public, max-age=30');
  expect(body.results).toHaveLength(5);
  expect(body.total).toEqual({ count: SMALL, exact: true });
  expect(body.nextCursor).not.toBeNull();
  expect(body.ignored).toEqual([]);
  expect(body.facets?.make.some((option) => option.value === SLUG)).toBe(true);
  // The next page by its cursor, in the same call.
  const next = await route(`make=${SLUG}&limit=5&cursor=${body.nextCursor ?? ''}`);
  expect(next.response.status).toBe(200);
  expect(next.body.total).toEqual(body.total);
  expect(next.body.results.map((card) => card.id)).not.toContain(body.results[0]?.id);
});

test('GET /api/search: limit 0 is the count, and words with nothing to search are named in ignored', async () => {
  const count = await route(`make=${SLUG}&gearbox=automatic&limit=0`);
  expect(count.response.status).toBe(200);
  expect(count.body.results).toEqual([]);
  expect(count.body.total.exact).toBe(true);
  expect(count.body.total.count).toBe(await countOf({ gearbox: 'automatic' }));
  const punctuation = await route(`make=${SLUG}&q=${encodeURIComponent('!!!')}&limit=1`);
  expect(punctuation.body.ignored).toEqual(['q']);
  expect(punctuation.body.text?.searchable).toBe(false);
  const typo = await route(`make=${SLUG}&q=${encodeURIComponent('سلام')}&limit=1`);
  expect(typo.body.ignored).toEqual([]);
  expect(typo.body.text?.corrections).toEqual([{ from: 'سلام', to: 'سالم' }]);
  const unknown = await route(`make=${SLUG}&q=${encodeURIComponent('مزدا')}`);
  expect(unknown.body.text?.unknown).toEqual(['مزدا']);
  // A parameter the search could not use is named too.
  const bad = await route(`make=${SLUG}&price=expensive&limit=1`);
  expect(bad.body.ignored).toEqual(['price']);
});

test('GET /api/search: a bad limit or cursor is a 400 with a Farsi message, never a 500', async () => {
  for (const query of ['limit=49', 'limit=-1', 'limit=2.5', 'limit=many']) {
    const { response, body } = await route(`make=${SLUG}&${query}`);
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.message).toContain('۴۸');
  }
  const handmade = Buffer.from(JSON.stringify({ v: 1, s: 'best_deal', k: ['abc', null], i: 5 })).toString(
    'base64url',
  );
  for (const cursor of [handmade, 'abc']) {
    const { response, body } = await route(`make=${SLUG}&cursor=${cursor}`);
    expect(response.status).toBe(400);
    expect(body.message).toContain('فهرست');
  }
  // An empty cursor is no cursor: the first page.
  expect((await route(`make=${SLUG}&cursor=`)).response.status).toBe(200);
});
