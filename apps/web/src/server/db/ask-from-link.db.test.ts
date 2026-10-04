import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { toStoredSearch } from '@carshenas/search/search';
import { assertScratchDatabase, createAccount, ownerDatabase } from '@/server/db/account-test-database';
import { MAX_OPEN_REQUESTS_PER_ACCOUNT } from '@/lib/crawl-requests-rules';
import { askForModelFromLink } from '@/server/db/crawl-request-mutations';
import { database } from '@/server/db/database';

// A buyer asks for a model from a pasted link (CS-115, ADR-0046) on the scratch database `pnpm db:check` migrated, through
// the app's own pool as carshenas_web: the buyer's file for the model and the model's request are made together, found when
// they are there, shared by two buyers asking at the same moment, and refused by the database's own limits without leaving a
// file or a request behind.

const owner = ownerDatabase();
let makeId: number;
let makeSlug: string;

beforeAll(async () => {
  await assertScratchDatabase(owner);
  makeSlug = `m${randomBytes(4).toString('hex')}`;
  ({ id: makeId } = await owner
    .insertInto('make')
    .values({ slug: makeSlug, name_en: 'Link test make' })
    .returning('id')
    .executeTakeFirstOrThrow());
});

afterAll(async () => {
  await Promise.all([owner.destroy(), database().destroy()]);
});

async function model(): Promise<{ id: number; key: string }> {
  const slug = `x${randomBytes(4).toString('hex')}`;
  const { id } = await owner
    .insertInto('model')
    .values({ make_id: makeId, slug, name_en: slug })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id, key: `${makeSlug}.${slug}` };
}

const fileFor = (key: string) => ({
  name: `مدل ${key}`,
  search: toStoredSearch({ filters: { model: [key] } }),
});

async function filesOf(accountId: number): Promise<number> {
  const rows = await owner
    .selectFrom('search_file')
    .select('id')
    .where('account_id', '=', accountId)
    .execute();
  return rows.length;
}

async function requestOf(modelId: number): Promise<{ id: number; links: number } | undefined> {
  const row = await owner
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
    .executeTakeFirst();
  return row === undefined ? undefined : { id: row.id, links: row.links ?? 0 };
}

test('asking makes the buyer’s file and the model’s request together, and asking again finds both', async () => {
  const buyer = await createAccount(owner);
  const car = await model();
  const first = await askForModelFromLink(buyer.id, car.id, fileFor(car.key));
  expect(first).toMatchObject({ status: 'asked', count: 1, madeFile: true });
  expect(await filesOf(buyer.id)).toBe(1);
  expect((await requestOf(car.id))?.links).toBe(1);
  // The same press again, as a double tap or a page that came back: the same file, the same request, nothing added.
  const again = await askForModelFromLink(buyer.id, car.id, fileFor(car.key));
  expect(again).toMatchObject({
    status: 'asked',
    count: 0,
    madeFile: false,
    fileId: first.status === 'asked' ? first.fileId : -1,
  });
  expect(await filesOf(buyer.id)).toBe(1);
  expect((await requestOf(car.id))?.links).toBe(1);
});

test('two buyers asking for one model at the same moment get one request and a file each', async () => {
  const car = await model();
  const [first, second] = await Promise.all([createAccount(owner), createAccount(owner)]);
  const outcomes = await Promise.all([
    askForModelFromLink(first.id, car.id, fileFor(car.key)),
    askForModelFromLink(second.id, car.id, fileFor(car.key)),
  ]);
  expect(outcomes.map((outcome) => outcome.status)).toEqual(['asked', 'asked']);
  expect((await requestOf(car.id))?.links).toBe(2);
  expect(await filesOf(first.id)).toBe(1);
  expect(await filesOf(second.id)).toBe(1);
});

test('a buyer who keeps the most files has no room for a new one, and a refused ask leaves nothing behind', async () => {
  const buyer = await createAccount(owner);
  await owner
    .insertInto('search_file')
    .values(
      Array.from({ length: 30 }, (_, index) => ({
        account_id: buyer.id,
        name: `پرونده ${String(index)}`,
        search: { v: 1, filters: {}, q: `کلمه${String(index)}` },
      })),
    )
    .execute();
  const car = await model();
  expect(await askForModelFromLink(buyer.id, car.id, fileFor(car.key))).toEqual({
    status: 'no_room_for_file',
  });
  expect(await requestOf(car.id)).toBeUndefined();
  expect(await filesOf(buyer.id)).toBe(30);
  // The file the buyer already keeps for the model takes the ask even at the limit: the limit runs before the unique
  // check, so the file is found first.
  await owner
    .deleteFrom('search_file')
    .where('account_id', '=', buyer.id)
    .where('name', '=', 'پرونده 0')
    .execute();
  expect(await askForModelFromLink(buyer.id, car.id, fileFor(car.key))).toMatchObject({
    status: 'asked',
    madeFile: true,
  });
  expect(await askForModelFromLink(buyer.id, car.id, fileFor(car.key))).toMatchObject({
    status: 'asked',
    count: 0,
  });
});

test('a declined request is not joined, and the file made for the ask is not kept', async () => {
  const car = await model();
  const admin = await createAccount(owner, 'superadmin');
  const [first, second] = await Promise.all([createAccount(owner), createAccount(owner)]);
  await askForModelFromLink(first.id, car.id, fileFor(car.key));
  const request = await requestOf(car.id);
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
  expect(await askForModelFromLink(second.id, car.id, fileFor(car.key))).toEqual({ status: 'declined' });
  expect(await filesOf(second.id)).toBe(0);
  expect((await requestOf(car.id))?.links).toBe(1);
});

test('an account has at most ten requests waiting: the eleventh is refused and leaves no file', async () => {
  const buyer = await createAccount(owner);
  const cars = await Promise.all(Array.from({ length: MAX_OPEN_REQUESTS_PER_ACCOUNT + 1 }, () => model()));
  for (const car of cars.slice(0, MAX_OPEN_REQUESTS_PER_ACCOUNT)) {
    expect(await askForModelFromLink(buyer.id, car.id, fileFor(car.key))).toMatchObject({ status: 'asked' });
  }
  const last = cars[MAX_OPEN_REQUESTS_PER_ACCOUNT];
  if (last === undefined) throw new Error('eleven cars were made');
  expect(await askForModelFromLink(buyer.id, last.id, fileFor(last.key))).toEqual({
    status: 'account_limit',
  });
  expect(await requestOf(last.id)).toBeUndefined();
  expect(await filesOf(buyer.id)).toBe(MAX_OPEN_REQUESTS_PER_ACCOUNT);
});
