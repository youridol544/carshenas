import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { assertScratchDatabase, createAccount, ownerDatabase } from '@/server/db/account-test-database';
import { askForCrawl } from '@/server/db/crawl-request-mutations';
import { database } from '@/server/db/database';
import { MAX_OPEN_REQUESTS_PER_ACCOUNT, MAX_REQUESTS_PER_FILE } from '@/lib/crawl-requests-rules';

// A buyer's ask for a deeper crawl end to end (CS-71 #1, #6) on the scratch database `pnpm db:check` migrated, through
// the app's own pool as carshenas_web: two buyers asking for one model at the same moment get one request, a limit or
// a declined request comes back as a result, and a refused ask leaves no request behind.

const owner = ownerDatabase();
let makeId: number;

beforeAll(async () => {
  await assertScratchDatabase(owner);
  ({ id: makeId } = await owner
    .insertInto('make')
    .values({ slug: `m${randomBytes(4).toString('hex')}`, name_en: 'Test make' })
    .returning('id')
    .executeTakeFirstOrThrow());
});

afterAll(async () => {
  await Promise.all([owner.destroy(), database().destroy()]);
});

async function model(): Promise<number> {
  const slug = `x${randomBytes(4).toString('hex')}`;
  const { id } = await owner
    .insertInto('model')
    .values({ make_id: makeId, slug, name_en: slug })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

async function file(accountId: number): Promise<number> {
  const { id } = await owner
    .insertInto('search_file')
    .values({
      account_id: accountId,
      name: 'پرونده',
      search: { v: 1, filters: {}, q: randomBytes(5).toString('hex') },
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

async function requestsOf(modelId: number): Promise<{ id: number; links: number }[]> {
  const rows = await owner
    .selectFrom('crawl_request as r')
    .select((eb) => [
      'r.id',
      eb
        .selectFrom('crawl_request_file as l')
        .select((inner) => inner.fn.countAll<number>().as('n'))
        .whereRef('l.crawl_request_id', '=', 'r.id')
        .as('links'),
    ])
    .where('r.model_id', '=', modelId)
    .execute();
  return rows.map((row) => ({ id: row.id, links: row.links ?? 0 }));
}

test('two buyers asking for one model at the same moment get one request with both files', async () => {
  const modelId = await model();
  const [first, second] = await Promise.all([createAccount(owner), createAccount(owner)]);
  const [firstFile, secondFile] = await Promise.all([file(first.id), file(second.id)]);
  const target = [{ modelId, trimId: null }];
  const outcomes = await Promise.all([
    askForCrawl(first.id, firstFile, target),
    askForCrawl(second.id, secondFile, target),
  ]);
  expect(outcomes).toEqual([
    { status: 'asked', count: 1 },
    { status: 'asked', count: 1 },
  ]);
  const requests = await requestsOf(modelId);
  expect(requests).toHaveLength(1);
  expect(requests[0]?.links).toBe(2);
  // Asking again changes nothing: the file is already one of the request's files.
  expect(await askForCrawl(first.id, firstFile, target)).toEqual({ status: 'asked', count: 0 });
  expect((await requestsOf(modelId))[0]?.links).toBe(2);
});

test('a file of another buyer is never linked, whatever the caller names', async () => {
  const modelId = await model();
  const owner_ = await createAccount(owner);
  const stranger = await createAccount(owner);
  const theirs = await file(owner_.id);
  expect(await askForCrawl(stranger.id, theirs, [{ modelId, trimId: null }])).toEqual({ status: 'gone' });
  expect(await requestsOf(modelId)).toEqual([]);
});

test('a file asks for at most three models, and the refused ask leaves no request behind', async () => {
  const buyer = await createAccount(owner);
  const aFile = await file(buyer.id);
  const models = await Promise.all(Array.from({ length: MAX_REQUESTS_PER_FILE + 1 }, () => model()));
  const outcome = await askForCrawl(
    buyer.id,
    aFile,
    models.map((modelId) => ({ modelId, trimId: null })),
  );
  expect(outcome).toEqual({ status: 'file_limit' });
  for (const modelId of models) expect(await requestsOf(modelId)).toEqual([]);
});

test('an account has at most ten requests waiting, and the eleventh is refused', async () => {
  const buyer = await createAccount(owner);
  const models = await Promise.all(Array.from({ length: MAX_OPEN_REQUESTS_PER_ACCOUNT + 1 }, () => model()));
  let fileId = 0;
  for (const [index, modelId] of models.slice(0, MAX_OPEN_REQUESTS_PER_ACCOUNT).entries()) {
    if (index % MAX_REQUESTS_PER_FILE === 0) fileId = await file(buyer.id);
    expect(await askForCrawl(buyer.id, fileId, [{ modelId, trimId: null }])).toEqual({
      status: 'asked',
      count: 1,
    });
  }
  const last = models[MAX_OPEN_REQUESTS_PER_ACCOUNT] ?? 0;
  expect(await askForCrawl(buyer.id, await file(buyer.id), [{ modelId: last, trimId: null }])).toEqual({
    status: 'account_limit',
  });
  expect(await requestsOf(last)).toEqual([]);
});

test('a declined request cannot be joined', async () => {
  const modelId = await model();
  const admin = await createAccount(owner, 'superadmin');
  const [first, second] = await Promise.all([createAccount(owner), createAccount(owner)]);
  const [firstFile, secondFile] = await Promise.all([file(first.id), file(second.id)]);
  await askForCrawl(first.id, firstFile, [{ modelId, trimId: null }]);
  const [request] = await requestsOf(modelId);
  await owner
    .selectNoFrom((eb) =>
      eb
        .fn('decide_crawl_request', [
          eb.val(request?.id ?? 0),
          eb.val('pending'),
          eb.val('declined'),
          eb.val('ظرفیت نداریم'),
          eb.val(admin.id),
        ])
        .as('outcome'),
    )
    .execute();
  expect(await askForCrawl(second.id, secondFile, [{ modelId, trimId: null }])).toEqual({
    status: 'declined',
  });
  expect((await requestsOf(modelId))[0]?.links).toBe(1);
});
