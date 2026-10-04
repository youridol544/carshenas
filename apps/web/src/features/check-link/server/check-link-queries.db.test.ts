import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { currentAccount } from '@/server/auth/current-account';
import type { CheckAnswer, ModelRequest } from '@/features/check-link/check-link-types';
import { answerPastedLink } from '@/features/check-link/server/check-link-queries';
import { forgetLexicon } from '@/features/search-understanding/server/lexicon';
import { assertScratchDatabase, createAccount, ownerDatabase } from '@/server/db/account-test-database';
import { askForModelFromLink } from '@/server/db/crawl-request-mutations';
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
  trackModel,
  untrackModel,
  wantedLinks,
  webRoleCannotWrite,
} from '@/server/db/paste-test-database';
import { pasteRateListing, recordPasteRequest } from '@/server/db/sql-helpers';
import { toStoredSearch } from '@carshenas/search/search';

// A pasted Divar link answered from our own database (CS-65, CS-115) against the scratch database `pnpm db:check` migrated,
// through the app's own pool as carshenas_web: a listing the daily run rated, a listing it did not (rated on the spot by
// paste_rate_listing from the run's stored numbers), a listing whose details were never read, a listing that left, a token
// we have never seen whose title names a car Carshenas reads (queued) or does not (outside), a link that names no car,
// and the caps and counts the database keeps. Nothing is ever fetched.

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});
// The viewer: nobody, unless a test says otherwise (the session cookie needs a request).
vi.mock('@/server/auth/current-account', () => ({ currentAccount: vi.fn() }));

// The suggestions come from the search API (cached with 'use cache', which a plain test run has no runtime for); the
// browser tests read them for real.
const searchListings = vi.hoisted(() => vi.fn());
vi.mock('@/features/search/server/search-queries', () => ({ searchListings }));

const owner = ownerDatabase();
let data: ListingTestData;
let suffix: string;
const key = (name: string) => `tst${name}${suffix}`;
const modelKey = () => `tst-lp-${suffix}.one`;
// The seeded make and model are named in Persian so the catalogue's names read them from a link's title. The scratch
// database may hold the makes and models of earlier runs (the seed removes its listings, not its catalogue rows), so each
// run gives its own a name of its own, in letters only (a digit in a name is shown in Persian digits).
let MAKE_NAME = '';
let MODEL_NAME = '';
let TITLE_OF_MODEL = '';
const slugOf = (name: string) => name.replaceAll(' ', '-');

const answer = (token: string, slug: string | null = null) => answerPastedLink({ token, slug });

function expectKind<K extends CheckAnswer['kind']>(
  result: CheckAnswer,
  kind: K,
): Extract<CheckAnswer, { kind: K }> {
  expect(result.kind).toBe(kind);
  return result as Extract<CheckAnswer, { kind: K }>;
}

/** The request an outside answer for a named model shows the viewer, and whether the viewer is signed in. */
function viewOf(result: CheckAnswer): { request: ModelRequest; signedIn: boolean } {
  const outside = expectKind(result, 'outside');
  if (outside.target.kind !== 'model') throw new Error('the answer names no model');
  return { request: outside.target.request, signedIn: outside.signedIn };
}

beforeAll(async () => {
  await assertScratchDatabase(owner);
  suffix = randomBytes(3).toString('hex');
  data = await seedListingPage(owner, suffix);
  const word = Array.from(suffix, (digit) => 'ghijkmnpqrstuvwxyz'[Number.parseInt(digit, 16)]).join('');
  MAKE_NAME = `خودروساز آزمایشی ${word}`;
  MODEL_NAME = `مدل آزمایشی ${word}`;
  TITLE_OF_MODEL = slugOf(MODEL_NAME);
  await owner.updateTable('make').set({ name_fa: MAKE_NAME }).where('id', '=', data.makeId).execute();
  await owner.updateTable('model').set({ name_fa: MODEL_NAME }).where('id', '=', data.modelId).execute();
  // The catalogue's names are read once and kept: the seeded make and model must be in them.
  forgetLexicon();
});

beforeEach(() => {
  searchListings.mockResolvedValue({ status: 'ok', page: { results: [] } });
  vi.mocked(currentAccount).mockResolvedValue(null);
});

afterAll(async () => {
  await untrackModel(owner, data);
  await removePasteRows(owner, data);
  await removeListingPage(owner, data);
  await owner
    .deleteFrom('model')
    .where('slug', 'in', ['alpha', 'beta'])
    .where('name_en', 'like', `%${suffix}`)
    .execute();
  await owner.deleteFrom('make').where('slug', '=', `tst-mk-${suffix}`).execute();
  await owner.destroy();
});

test('a listing the run did not rate is rated on the spot from the run’s stored numbers, and counts as demand for its model', async () => {
  const id = await addDivarListing(owner, data, key('fresh'), { price: 900_000_000 });
  const before = await pasteDemand(owner, data);
  const found = expectKind(await answer(key('fresh')), 'found');
  expect(found.page.listing.id).toBe(id);
  // No stored valuation row exists for it, yet the page carries one, from paste_rate_listing.
  expect(await storedValuations(owner, id)).toBe(0);
  expect(found.page.valuation?.marketValueToman).toBeGreaterThan(0);
  expect(found.page.valuation?.run.methodVersion).toBe(96);
  expect(await pasteDemand(owner, data)).toBe(before + 1);
});

test('the same link pasted twice adds two to the day’s count, in one row', async () => {
  const before = await pasteDemand(owner, data);
  await answer(key('fresh'));
  expect(await pasteDemand(owner, data)).toBe(before + 1);
  expect(await demandRows(owner, data)).toBe(1);
});

test('an ad seen only on a list page, of a car Carshenas does not read, is outside: the limit, the way forward, no price', async () => {
  await untrackModel(owner, data);
  await addDivarListing(owner, data, key('unread'), { price: null });
  const before = await pasteDemand(owner, data);
  const outside = expectKind(await answer(key('unread')), 'outside');
  expect(outside.target).toMatchObject({ kind: 'model', model: { key: modelKey() } });
  expect(viewOf(outside)).toEqual({
    request: { status: 'none', mine: false, reason: null, fileId: null },
    signedIn: false,
  });
  expect(await pasteDemand(owner, data)).toBe(before + 1);
});

test('the same ad of a car Carshenas reads is queued, and says it was seen; the best deals of its model are offered', async () => {
  await trackModel(owner, data);
  await addDivarListing(owner, data, key('seen'), { price: null });
  const queued = expectKind(await answer(key('seen')), 'queued');
  expect(queued.seen).toBe(true);
  expect(queued.car.key).toBe(modelKey());
  expect(queued.crawlPaused).toBe(true);
  expect(queued.grantedToViewer).toBe(false);
  expect(searchListings).toHaveBeenLastCalledWith(
    expect.objectContaining({ search: { filters: { model: [modelKey()] } } }),
  );
});

test('an ad seen with no catalogue model and a link with no title is not told, and counts for no model', async () => {
  await addDivarListing(owner, data, key('nomodel'), { price: null, withModel: false });
  const before = await pasteDemand(owner, data);
  expect(expectKind(await answer(key('nomodel')), 'unreadable').reason).toBe('no_title');
  expect(await pasteDemand(owner, data)).toBe(before);
});

test('a listing that left the market is answered as one that left', async () => {
  await addDivarListing(owner, data, key('gone'), { price: 800_000_000, gone: true });
  expect((await answer(key('gone'))).kind).toBe('off_market');
});

test('an ad never seen whose title names a car Carshenas does not read is outside, counted for that car, and nothing is fetched', async () => {
  await untrackModel(owner, data);
  const before = await pasteDemand(owner, data);
  const token = key('titled');
  const outside = expectKind(await answer(token, TITLE_OF_MODEL), 'outside');
  expect(outside.target).toMatchObject({ kind: 'model', model: { key: modelKey() } });
  expect(outside.link).toBe(`https://divar.ir/v/${encodeURIComponent(TITLE_OF_MODEL)}/${token}`);
  expect(await pasteDemand(owner, data)).toBe(before + 1);
  // The link is kept as a wanted one, once per paste; the crawl is paused: no request of any kind is logged.
  await answer(token, TITLE_OF_MODEL);
  expect(await wantedLinks(owner, token)).toEqual([{ source_id: 'divar', request_count: 2 }]);
  expect(await pasteDemand(owner, data)).toBe(before + 2);
  expect(await recentFetches(owner)).toBe(0);
});

test('the same link for a car Carshenas reads is queued, and the answer says reading is paused while it is', async () => {
  await trackModel(owner, data);
  const queued = expectKind(await answer(key('titledq'), TITLE_OF_MODEL), 'queued');
  expect(queued.seen).toBe(false);
  expect(queued.sourceUrl).toBeNull();
  expect(queued.crawlPaused).toBe(true);
  expect(queued.car.name).toBe(MODEL_NAME);
});

test('a link with no title, or a title that names no car, is not told: never called unsupported', async () => {
  const short = expectKind(await answer(key('short')), 'unreadable');
  expect(short).toMatchObject({ reason: 'no_title', make: null });
  const nothing = expectKind(await answer(key('nothing'), 'فروش-فوری-خودرو'), 'unreadable');
  expect(nothing.reason).toBe('no_car');
  // Both are kept as wanted links for the crawler, as any link nobody has seen is.
  expect(await wantedLinks(owner, key('short'))).toEqual([{ source_id: 'divar', request_count: 1 }]);
});

test('what the viewer asked is shown on the answer: placed, then declined with its reason; a visitor sees the model as asked by none', async () => {
  await untrackModel(owner, data);
  const buyer = await createAccount(owner);
  const admin = await createAccount(owner, 'superadmin');
  const token = key('asked');
  const asked = await askForModelFromLink(buyer.id, data.modelId, {
    name: MODEL_NAME,
    search: toStoredSearch({ filters: { model: [modelKey()] } }),
  });
  expect(asked.status).toBe('asked');
  const fileId = asked.status === 'asked' ? asked.fileId : -1;
  vi.mocked(currentAccount).mockResolvedValue({ id: buyer.id, username: buyer.username, role: 'buyer' });
  expect(viewOf(await answer(token, TITLE_OF_MODEL))).toEqual({
    request: { status: 'pending', mine: true, reason: null, fileId },
    signedIn: true,
  });
  // A visitor sees that a request exists, and that it is not theirs.
  vi.mocked(currentAccount).mockResolvedValue(null);
  expect(viewOf(await answer(token, TITLE_OF_MODEL))).toMatchObject({
    request: { status: 'pending', mine: false },
    signedIn: false,
  });
  // The superadmin declines it: the reason is the answer's, for the buyer and for anyone.
  const request = await owner
    .selectFrom('crawl_request')
    .select('id')
    .where('model_id', '=', data.modelId)
    .executeTakeFirstOrThrow();
  await owner
    .selectNoFrom((eb) =>
      eb
        .fn('decide_crawl_request', [
          eb.val(request.id),
          eb.val('pending'),
          eb.val('declined'),
          eb.val('ظرفیت نداریم'),
          eb.val(admin.id),
        ])
        .as('outcome'),
    )
    .execute();
  vi.mocked(currentAccount).mockResolvedValue({ id: buyer.id, username: buyer.username, role: 'buyer' });
  expect(viewOf(await answer(token, TITLE_OF_MODEL)).request).toMatchObject({
    status: 'declined',
    mine: true,
    reason: 'ظرفیت نداریم',
  });
});

test('a title that names only a make none of whose models is read is outside: the make’s models to choose among, and the ones the viewer asked for shown with their state', async () => {
  // A make of its own (the seeded model may have been asked for and declined by the tests above): two models with Latin names only.
  const makeName = `برند آزمایشی ${MODEL_NAME.split(' ').at(-1) ?? ''}`;
  const make = await owner
    .insertInto('make')
    .values({ slug: `tst-mk-${suffix}`, name_en: `tst-mk-${suffix}`, name_fa: makeName })
    .returning('id')
    .executeTakeFirstOrThrow();
  const [alpha, beta] = await Promise.all(
    ['alpha', 'beta'].map((word) =>
      owner
        .insertInto('model')
        .values({ make_id: make.id, slug: word, name_en: `${word} ${suffix}` })
        .returning('id')
        .executeTakeFirstOrThrow(),
    ),
  );
  if (alpha === undefined || beta === undefined) throw new Error('two models were made');
  // The catalogue's names are kept for a while: read them again, now that the make is in them.
  forgetLexicon();
  const keyOf = (word: string) => `tst-mk-${suffix}.${word}`;
  const buyer = await createAccount(owner);
  const token = key('make');
  const title = slugOf(makeName);
  const made = expectKind(await answer(token, title), 'outside');
  expect(made.target).toMatchObject({
    kind: 'make',
    name: makeName,
    models: [
      { key: keyOf('alpha'), name: `alpha ${suffix}` },
      { key: keyOf('beta'), name: `beta ${suffix}` },
    ],
    asked: [],
  });
  // The buyer asks for one: it leaves the models to choose among and is shown with where its request stands.
  const asked = await askForModelFromLink(buyer.id, alpha.id, {
    name: `alpha ${suffix}`,
    search: toStoredSearch({ filters: { model: [keyOf('alpha')] } }),
  });
  expect(asked.status).toBe('asked');
  vi.mocked(currentAccount).mockResolvedValue({ id: buyer.id, username: buyer.username, role: 'buyer' });
  const after = expectKind(await answer(token, title), 'outside');
  expect(after.target).toMatchObject({
    kind: 'make',
    models: [{ key: keyOf('beta') }],
    asked: [{ key: keyOf('alpha'), request: { status: 'pending', mine: true } }],
  });
  // Another visitor sees both still to choose: someone asking is not their asking.
  vi.mocked(currentAccount).mockResolvedValue(null);
  expect(expectKind(await answer(token, title), 'outside').target).toMatchObject({
    kind: 'make',
    models: [{ key: keyOf('alpha') }, { key: keyOf('beta') }],
    asked: [],
  });
  await owner.deleteFrom('crawl_request').where('model_id', 'in', [alpha.id, beta.id]).execute();
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
  expect((await answer(key('late'))).kind).toBe('unreadable');
  expect(await wantedLinks(owner, key('late'))).toEqual([{ source_id: 'divar', request_count: 1 }]);
  // A link asked for twice survives the next clearing; the oldest junk is what goes.
  await answer(key('late'));
  expect(await wantedLinks(owner, key('late'))).toEqual([{ source_id: 'divar', request_count: 2 }]);
});

test('a missing source or token is invalid, never an error; an id that names no model counts nothing', async () => {
  const answerOf = async (source: string | null, token: string | null, modelId: number | null = null) =>
    (
      await database()
        .selectNoFrom(recordPasteRequest(source, token, modelId).as('answer'))
        .executeTakeFirstOrThrow()
    ).answer;
  expect(await answerOf('divar', null)).toBe('invalid');
  expect(await answerOf(null, 'abcdefgh')).toBe('invalid');
  expect(await answerOf('divar', key('nomodelid'), 2_000_000_000)).toBe('wanted');
});

test('an unknown id costs no rating: the function answers nothing at once', async () => {
  const started = performance.now();
  const rows = await owner.selectFrom(pasteRateListing(2_000_000_000)).selectAll().execute();
  expect(rows).toEqual([]);
  expect(performance.now() - started).toBeLessThan(50);
});
