// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import { askToAddModelAction } from '@/features/check-link/check-link-actions';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import { findKnownListing, readLinkCar } from '@/features/check-link/server/check-link-queries';
import { currentAccount } from '@/server/auth/current-account';
import { readCatalogueModel, readModelRequest } from '@/server/db/coverage-reads';
import { askForModelFromLink } from '@/server/db/crawl-request-mutations';
import { captureError } from '@/server/observability/logger';
import { resetBuckets } from '@/server/token-bucket';

// What the ask to add a model answers (CS-115): who may ask, which model the link names and Carshenas does not read, and what
// the database's own answers come to. The action is a public endpoint, so each answer here is one a hand-made POST can get.
// The queries and the database are the boundary: they are replaced; the end-to-end paths run against a real database in
// src/server/db/ask-from-link.db.test.ts and in the browser tests.

const request = vi.hoisted(() => ({
  headers: new Headers({ 'sec-fetch-site': 'same-origin' }),
  refresh: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(request.headers) }));
vi.mock('next/cache', () => ({ refresh: request.refresh }));
vi.mock('@/server/auth/current-account', () => ({ currentAccount: vi.fn() }));
vi.mock('@/features/check-link/server/check-link-queries', () => ({
  findKnownListing: vi.fn(),
  readLinkCar: vi.fn(),
}));
vi.mock('@/server/db/coverage-reads', () => ({ readCatalogueModel: vi.fn(), readModelRequest: vi.fn() }));
vi.mock('@/server/db/crawl-request-mutations', () => ({ askForModelFromLink: vi.fn() }));
vi.mock('@/server/db/database', () => ({ readDatabase: () => ({}) }));
vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});

const ERRORS = CHECK_COPY.outside.errors;
const LINK = 'https://divar.ir/v/%D9%BE-301/gX1mAYqN';
const MODEL = { id: 31, key: 'peugeot.301', makeKey: 'peugeot', modelSlug: '301', name: 'پژو ۳۰۱' };
const NO_REQUEST = { status: 'none', reason: null, fileId: null } as const;

function outsideModel(): void {
  vi.mocked(findKnownListing).mockResolvedValue(null);
  vi.mocked(readLinkCar).mockResolvedValue({
    car: { kind: 'model', modelKey: MODEL.key, covered: false },
    covered: [],
    lexicon: null,
  });
  vi.mocked(readCatalogueModel).mockResolvedValue(MODEL);
  vi.mocked(readModelRequest).mockResolvedValue(NO_REQUEST);
}

beforeEach(() => {
  vi.resetAllMocks();
  resetBuckets();
  request.headers = new Headers({ 'sec-fetch-site': 'same-origin' });
  vi.mocked(currentAccount).mockResolvedValue({ id: 5, username: 'ali', role: 'buyer' });
});

test('a request from another site is refused outright, and a hand-made input is refused before anything is read', async () => {
  request.headers = new Headers({ 'sec-fetch-site': 'cross-site' });
  await expect(askToAddModelAction({ link: LINK })).rejects.toThrow('outside this site');
  request.headers = new Headers({ 'sec-fetch-site': 'same-origin' });
  for (const input of [
    null,
    {},
    { link: '' },
    { link: LINK, extra: 1 },
    { link: LINK, modelKey: 'not a key' },
  ]) {
    expect(await askToAddModelAction(input)).toEqual({
      status: 'refused',
      message: ERRORS.failed,
      retry: true,
    });
  }
  expect(readLinkCar).not.toHaveBeenCalled();
});

test('a visitor is told to sign in, and nothing about the link is read', async () => {
  vi.mocked(currentAccount).mockResolvedValue(null);
  expect(await askToAddModelAction({ link: LINK })).toEqual({ status: 'signed_out' });
  expect(readLinkCar).not.toHaveBeenCalled();
  expect(askForModelFromLink).not.toHaveBeenCalled();
});

test('a link that is no Divar listing, or whose car cannot be told, is unreadable and asks nothing', async () => {
  expect((await askToAddModelAction({ link: 'https://example.com/x' })).status).toBe('unreadable');
  vi.mocked(findKnownListing).mockResolvedValue(null);
  vi.mocked(readLinkCar).mockResolvedValue({
    car: { kind: 'unreadable', reason: 'no_car', makeKey: null },
    covered: [],
    lexicon: null,
  });
  expect(await askToAddModelAction({ link: LINK })).toEqual({
    status: 'unreadable',
    message: ERRORS.unreadable,
  });
  expect(askForModelFromLink).not.toHaveBeenCalled();
});

test('a car Carshenas reads already has nothing to ask', async () => {
  outsideModel();
  vi.mocked(readLinkCar).mockResolvedValue({
    car: { kind: 'model', modelKey: MODEL.key, covered: true },
    covered: [],
    lexicon: null,
  });
  expect(await askToAddModelAction({ link: LINK })).toEqual({ status: 'covered' });
  expect(askForModelFromLink).not.toHaveBeenCalled();
});

test('the buyer asks for the model the link names: the file and the request are made for the account, never for the client', async () => {
  outsideModel();
  vi.mocked(askForModelFromLink).mockResolvedValue({ status: 'asked', count: 1, fileId: 9, madeFile: true });
  expect(await askToAddModelAction({ link: LINK })).toEqual({ status: 'asked', fileId: 9, madeFile: true });
  expect(askForModelFromLink).toHaveBeenCalledExactlyOnceWith(5, 31, {
    name: 'پژو ۳۰۱',
    search: { v: 1, filters: { model: ['peugeot.301'] } },
  });
  expect(request.refresh).toHaveBeenCalledOnce();
});

test('when only the make is told, the buyer’s choice is taken only for a model of that make that exists', async () => {
  outsideModel();
  vi.mocked(readLinkCar).mockResolvedValue({
    car: { kind: 'make_outside', makeKey: 'hyundai' },
    covered: [],
    lexicon: null,
  });
  // No choice, or a model of another make: nothing is asked.
  expect((await askToAddModelAction({ link: LINK })).status).toBe('unreadable');
  expect((await askToAddModelAction({ link: LINK, modelKey: 'kia.cerato' })).status).toBe('unreadable');
  expect(askForModelFromLink).not.toHaveBeenCalled();
  // A model of the make the catalogue does not have.
  vi.mocked(readCatalogueModel).mockResolvedValueOnce(undefined);
  expect((await askToAddModelAction({ link: LINK, modelKey: 'hyundai.nothing' })).status).toBe('unreadable');
  // The model chosen among the make's.
  vi.mocked(readCatalogueModel).mockResolvedValueOnce({
    ...MODEL,
    id: 77,
    key: 'hyundai.elantra',
    makeKey: 'hyundai',
  });
  vi.mocked(askForModelFromLink).mockResolvedValue({ status: 'asked', count: 1, fileId: 4, madeFile: false });
  expect(await askToAddModelAction({ link: LINK, modelKey: 'hyundai.elantra' })).toMatchObject({
    status: 'asked',
  });
  expect(askForModelFromLink).toHaveBeenCalledExactlyOnceWith(
    5,
    77,
    expect.objectContaining({ search: { v: 1, filters: { model: ['hyundai.elantra'] } } }),
  );
});

test('a buyer who asked before is told so, and a declined request is not asked again; neither writes anything', async () => {
  outsideModel();
  vi.mocked(readModelRequest).mockResolvedValueOnce({ status: 'pending', reason: null, fileId: 12 });
  expect(await askToAddModelAction({ link: LINK })).toEqual({ status: 'already', fileId: 12 });
  vi.mocked(readModelRequest).mockResolvedValueOnce({
    status: 'declined',
    reason: 'ظرفیت نداریم',
    fileId: null,
  });
  expect(await askToAddModelAction({ link: LINK })).toEqual({ status: 'declined', reason: 'ظرفیت نداریم' });
  expect(askForModelFromLink).not.toHaveBeenCalled();
});

test('the database’s limits come back as messages, and only a failure a retry may help is offered one', async () => {
  outsideModel();
  const refused = [
    ['no_room_for_file', ERRORS.noRoom],
    ['file_limit', ERRORS.noRoom],
    ['account_limit', ERRORS.accountLimit],
  ] as const;
  for (const [status, message] of refused) {
    vi.mocked(askForModelFromLink).mockResolvedValueOnce({ status });
    expect(await askToAddModelAction({ link: LINK })).toEqual({ status: 'refused', message, retry: false });
  }
  // A request declined between the read and the ask.
  vi.mocked(askForModelFromLink).mockResolvedValueOnce({ status: 'declined' });
  expect(await askToAddModelAction({ link: LINK })).toMatchObject({ status: 'declined' });
  expect(request.refresh).not.toHaveBeenCalled();
});

test('an account may ask for a handful of models in a row and then waits', async () => {
  outsideModel();
  vi.mocked(askForModelFromLink).mockResolvedValue({ status: 'asked', count: 1, fileId: 1, madeFile: false });
  for (let press = 0; press < 5; press += 1) {
    expect((await askToAddModelAction({ link: LINK })).status).toBe('asked');
  }
  expect(await askToAddModelAction({ link: LINK })).toEqual({
    status: 'refused',
    message: ERRORS.slow,
    retry: true,
  });
});

test('a database that does not answer is reported once and told as a failure a retry may help', async () => {
  outsideModel();
  const lost = new Error('Connection terminated unexpectedly');
  vi.mocked(askForModelFromLink).mockRejectedValueOnce(lost);
  expect(await askToAddModelAction({ link: LINK })).toEqual({
    status: 'refused',
    message: ERRORS.failed,
    retry: true,
  });
  expect(captureError).toHaveBeenCalledExactlyOnceWith(lost, {
    message: 'asking to add a model failed',
    fields: { accountId: 5 },
  });
});
