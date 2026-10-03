import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { answerPastedToken } from '@/features/check-link/server/check-link-queries';
import { assertScratchDatabase, ownerDatabase } from '@/server/db/account-test-database';
import { database } from '@/server/db/database';
import { removeListingPage, seedListingPage, type ListingTestData } from '@/server/db/listing-test-database';
import {
  addDivarListing,
  demandRows,
  fillWantedLinks,
  pasteDemand,
  recentFetches,
  removePasteRows,
  storedValuations,
  wantedLinks,
  webRoleCannotWrite,
} from '@/server/db/paste-test-database';
import { pasteRateListing, recordPasteRequest } from '@/server/db/sql-helpers';

// A pasted Divar link answered from our own database (CS-65) against the scratch database `pnpm db:check` migrated, through
// the app's own pool as carshenas_web: a listing the daily run rated, a listing it did not (rated on the spot by
// paste_rate_listing from the run's stored numbers), a listing whose details were never read, a listing that left, a token
// we have never seen (kept as a wanted link, nothing fetched), and the caps and counts the database keeps.

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});

// The suggestions come from the search API (cached with 'use cache', which a plain test run has no runtime for); the
// browser tests read them for real.
const searchListings = vi.hoisted(() => vi.fn());
vi.mock('@/features/search/server/search-queries', () => ({ searchListings }));

const owner = ownerDatabase();
let data: ListingTestData;
let suffix: string;
const key = (name: string) => `tst${name}${suffix}`;

beforeAll(async () => {
  searchListings.mockResolvedValue({ status: 'ok', page: { results: [] } });
  await assertScratchDatabase(owner);
  suffix = randomBytes(3).toString('hex');
  data = await seedListingPage(owner, suffix);
});

afterAll(async () => {
  await removePasteRows(owner, data);
  await removeListingPage(owner, data);
  await owner.destroy();
});

test('a listing the run did not rate is rated on the spot from the run’s stored numbers, and counts as demand for its model', async () => {
  const id = await addDivarListing(owner, data, key('fresh'), { price: 900_000_000 });
  const before = await pasteDemand(owner, data);
  const answer = await answerPastedToken(key('fresh'));
  expect(answer.kind).toBe('found');
  if (answer.kind !== 'found') return;
  expect(answer.page.listing.id).toBe(id);
  // No stored valuation row exists for it, yet the page carries one, from paste_rate_listing.
  expect(await storedValuations(owner, id)).toBe(0);
  expect(answer.page.valuation?.marketValueToman).toBeGreaterThan(0);
  expect(answer.page.valuation?.run.methodVersion).toBe(96);
  expect(await pasteDemand(owner, data)).toBe(before + 1);
});

test('the same link pasted twice adds two to the day’s count, in one row', async () => {
  const before = await pasteDemand(owner, data);
  await answerPastedToken(key('fresh'));
  expect(await pasteDemand(owner, data)).toBe(before + 1);
  expect(await demandRows(owner, data)).toBe(1);
});

test('a listing seen only on a list page has no price to rate: it is unread, counted for its model, and offers rated listings of it', async () => {
  await addDivarListing(owner, data, key('unread'), { price: null });
  const before = await pasteDemand(owner, data);
  expect(await answerPastedToken(key('unread'))).toMatchObject({ kind: 'unread', counted: true });
  expect(await pasteDemand(owner, data)).toBe(before + 1);
  expect(searchListings).toHaveBeenLastCalledWith(
    expect.objectContaining({ search: { filters: { model: [`tst-lp-${suffix}.one`] } } }),
  );
});

test('a listing without a catalogue model is unread and counts for no model', async () => {
  await addDivarListing(owner, data, key('nomodel'), { price: null, withModel: false });
  const before = await pasteDemand(owner, data);
  expect(await answerPastedToken(key('nomodel'))).toMatchObject({ kind: 'unread', counted: false });
  expect(await pasteDemand(owner, data)).toBe(before);
});

test('a listing that left the market is answered as one that left', async () => {
  await addDivarListing(owner, data, key('gone'), { price: 800_000_000, gone: true });
  expect((await answerPastedToken(key('gone'))).kind).toBe('off_market');
});

test('a token we have never seen becomes one wanted link, counted each time it is pasted, and nothing is fetched', async () => {
  const token = key('never');
  expect(await answerPastedToken(token)).toMatchObject({ kind: 'not_found', recorded: true });
  expect(await answerPastedToken(token)).toMatchObject({ kind: 'not_found', recorded: true });
  expect(await wantedLinks(owner, token)).toEqual([{ source_id: 'divar', request_count: 2 }]);
  // The crawl is paused: no request of any kind is logged because of a paste.
  expect(await recentFetches(owner)).toBe(0);
});

test('the database refuses tokens that cannot be Divar’s, and the web role cannot write the tables itself', async () => {
  const answerOf = async (source: string, token: string) =>
    (await database().selectNoFrom(recordPasteRequest(source, token).as('answer')).executeTakeFirstOrThrow())
      .answer;
  expect(await answerOf('divar', 'bad token!')).toBe('invalid');
  expect(await answerOf('divar', 'abc')).toBe('invalid');
  expect(await answerOf('no_such_source', 'abcdefgh')).toBe('invalid');
  const errors = await webRoleCannotWrite(database());
  expect(errors).toHaveLength(3);
  for (const error of errors) expect(error).toMatchObject({ code: '42501' });
});

test('junk cannot lock real links out: a full table drops its oldest once-asked links, and a link asked twice is kept', async () => {
  // 5,100 junk tokens (more than the cap, as a crowd could leave), then real ones.
  await fillWantedLinks(owner, 5100);
  expect(await answerPastedToken(key('late'))).toMatchObject({ kind: 'not_found', recorded: true });
  expect(await wantedLinks(owner, key('late'))).toEqual([{ source_id: 'divar', request_count: 1 }]);
  // A link asked for twice survives the next clearing; the oldest junk is what goes.
  expect(await answerPastedToken(key('late'))).toMatchObject({ recorded: true });
  expect(await wantedLinks(owner, key('never'))).toEqual([{ source_id: 'divar', request_count: 2 }]);
});

test('a missing source or token is invalid, never an error', async () => {
  const answerOf = async (source: string | null, token: string | null) =>
    (await database().selectNoFrom(recordPasteRequest(source, token).as('answer')).executeTakeFirstOrThrow())
      .answer;
  expect(await answerOf('divar', null)).toBe('invalid');
  expect(await answerOf(null, 'abcdefgh')).toBe('invalid');
});

test('an unknown id costs no rating: the function answers nothing at once', async () => {
  const started = performance.now();
  const rows = await owner.selectFrom(pasteRateListing(2_000_000_000)).selectAll().execute();
  expect(rows).toEqual([]);
  expect(performance.now() - started).toBeLessThan(50);
});
