import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { countListings } from '@/features/search-understanding/server/sentence-reader';
import { leftOut, settleReading } from '@/features/search-understanding/server/sentence-search';
import { assertScratchDatabase, ownerDatabase } from '@/server/db/account-test-database';
import { database } from '@/server/db/database';
import { removeSearchData, seedSearchData, type SearchTestData } from '@/server/db/search-test-database';
import { buildSearchDocuments, refreshFacetCounts, refreshSearchWords } from '@carshenas/search/document';
import { canonical, type Search } from '@carshenas/search/search';
import type { Understanding, UnusedWords } from '@carshenas/search/understand/types';

// A sentence settled against the real counts (CS-111, ADR-0043): the words no filter could name are looked for in the
// listings' text, and dropped when they would leave nothing. Against the scratch database `pnpm db:check` migrated,
// through the app's own pool and the search API's count: thirty listings of one make whose titles say «پژوی آزمایشی
// سالم <number>», every second one «نقدی». Each test sees only its own make.

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});

const owner = ownerDatabase();
const suffix = randomBytes(4).toString('hex');
let data: SearchTestData;
let ours: Search = { filters: {} };

beforeAll(async () => {
  await assertScratchDatabase(owner);
  data = await seedSearchData(owner, { suffix, small: 30, big: 10 });
  ours = { filters: { make: [data.slug] } };
  await owner
    .transaction()
    .execute((trx) => buildSearchDocuments(trx, { scope: { listingIds: [...data.ids, ...data.bigIds] } }));
  await refreshFacetCounts(owner);
  await refreshSearchWords(owner);
}, 120_000);

afterAll(async () => {
  if ((data as SearchTestData | undefined) !== undefined) await removeSearchData(owner, data);
  await database().destroy();
  await owner.destroy();
});

const group = (words: string, reason: UnusedWords['reason'] = 'unknown'): UnusedWords => ({
  words,
  reason,
  topic: null,
  asText: null,
});

/** The reading of a sentence that named this make and left these groups of words unread. */
function reading(...unused: UnusedWords[]): Understanding {
  return {
    query: '',
    search: ours,
    chips: [],
    intents: [],
    suggestions: [],
    unused,
    notes: [],
    explanation: '',
    textSearch: false,
    modelUsed: false,
    degraded: null,
  };
}

test('the count says whether a search finds anything, for filters, for words and for both', async () => {
  expect(await countListings(ours)).toBeGreaterThan(0);
  expect(await countListings({ ...ours, q: 'نقدی' })).toBeGreaterThan(0);
  expect(await countListings({ ...ours, q: 'zzqnoword' })).toBe(0);
  expect(await countListings({ filters: { make: ['no-such-make'] } })).toBe(0);
});

test('a word the listings say is looked for in their text and kept', async () => {
  const settled = await settleReading(reading(group('نقدی')), countListings);
  expect(settled.search).toEqual(canonical({ ...ours, q: 'نقدی' }));
  expect(settled.dropped).toEqual([]);
});

test('a word no listing says is dropped, and the make stays', async () => {
  const settled = await settleReading(reading(group('zzqnoword')), countListings);
  expect(settled.search).toEqual(ours);
  expect(settled.dropped.map((one) => one.words)).toEqual(['zzqnoword']);
});

test('of two groups the one that finds listings stays', async () => {
  const settled = await settleReading(reading(group('zzqnoword'), group('نقدی')), countListings);
  expect(settled.search).toEqual(canonical({ ...ours, q: 'نقدی' }));
  expect(settled.dropped.map((one) => one.words)).toEqual(['zzqnoword']);
});

test('what the page says is left out is counted against the search it shows', async () => {
  const said = await leftOut(ours, reading(group('zzqnoword'), group('نقدی')), countListings);
  // The word that finds listings is the buyer's to add, the word that finds none is said.
  expect(said.map((one) => one.words)).toEqual(['zzqnoword']);
  expect(said[0]?.put).toEqual(canonical({ ...ours, q: 'zzqnoword' }));
  expect(await leftOut({ ...ours, q: 'zzqnoword' }, reading(group('zzqnoword')), countListings)).toEqual([]);
});

test('a make with no listing at all keeps the words as written, and drops nothing', async () => {
  const none: Search = { filters: { make: ['no-such-make'] } };
  const settled = await settleReading({ ...reading(group('نقدی')), search: none }, countListings);
  expect(settled.search).toEqual(canonical({ ...none, q: 'نقدی' }));
  expect(settled.dropped).toEqual([]);
});
