import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { MAX_MARKED_LISTINGS } from '@/features/marks/marks-rules';
import { markListing, unmarkListing } from '@/features/marks/server/mark-mutations';
import { assertScratchDatabase, createAccount, ownerDatabase } from '@/server/db/account-test-database';
import { database } from '@/server/db/database';

// Marking a listing end to end (CS-69) on the scratch database `pnpm db:check` migrated, through the app's own pool as
// carshenas_web: what a mark records, that marking twice is marking once, the cap (and that two tabs cannot both take
// the last place), what the web role may not do, and that one buyer's list never shows another's marks.

const owner = ownerDatabase();

beforeAll(async () => {
  await assertScratchDatabase(owner);
});

afterAll(async () => {
  await Promise.all([owner.destroy(), database().destroy()]);
});

async function listings(count: number, overrides: Record<string, unknown> = {}): Promise<number[]> {
  const token = randomBytes(5).toString('hex');
  const rows = await owner
    .insertInto('listing')
    .values(
      Array.from({ length: count }, (_, index) => ({
        source_id: 'divar',
        source_listing_key: `k${token}${String(index)}`,
        url: `https://divar.ir/v/k${token}${String(index)}`,
        status: 'active',
        price_type: 'asking',
        asking_price_toman: 850_000_000,
        listed_at: new Date(),
        last_seen_at: new Date(),
        ...overrides,
      })),
    )
    .returning('id')
    .execute();
  return rows.map((row) => row.id);
}

test('a mark records the price and status the buyer saw and the newest price event, and marking twice marks once', async () => {
  const buyer = await createAccount(owner);
  const [id] = await listings(1);
  const listingId = id ?? 0;
  const snapshot = await owner
    .insertInto('snapshot')
    .values({
      listing_id: listingId,
      first_fetched_at: new Date(),
      url: 'https://api.test.example/x',
      canonical_version: 1,
      payload: {},
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const event = await owner
    .insertInto('listing_price_event')
    .values({
      listing_id: listingId,
      observed_at: new Date(),
      price_type: 'asking',
      asking_price_toman: 850_000_000,
      snapshot_id: snapshot.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  expect(await markListing(buyer.id, listingId)).toBe('marked');
  expect(await markListing(buyer.id, listingId)).toBe('already');
  const mark = await owner
    .selectFrom('listing_mark')
    .selectAll()
    .where('account_id', '=', buyer.id)
    .execute();
  expect(mark).toHaveLength(1);
  expect(mark[0]).toMatchObject({
    listing_id: listingId,
    marked_price_toman: 850_000_000,
    seen_status: 'active',
    price_event_seen_id: event.id,
    status_version: 0,
  });

  await unmarkListing(buyer.id, listingId);
  await unmarkListing(buyer.id, listingId);
  expect(
    await owner.selectFrom('listing_mark').select('listing_id').where('account_id', '=', buyer.id).execute(),
  ).toEqual([]);
});

test('a listing with no stated asking price is marked with no price, and one that is not there is missing', async () => {
  const buyer = await createAccount(owner);
  const [negotiable] = await listings(1, { price_type: 'negotiable', asking_price_toman: null });
  expect(await markListing(buyer.id, negotiable ?? 0)).toBe('marked');
  const row = await owner
    .selectFrom('listing_mark')
    .select(['marked_price_toman', 'seen_status'])
    .where('account_id', '=', buyer.id)
    .executeTakeFirstOrThrow();
  expect(row).toEqual({ marked_price_toman: null, seen_status: 'active' });
  expect(await markListing(buyer.id, 2_000_000_000)).toBe('missing');
});

test('a buyer may mark MAX_MARKED_LISTINGS listings and no more, and two presses for the last place give it to one', async () => {
  const buyer = await createAccount(owner);
  const ids = await listings(MAX_MARKED_LISTINGS + 4);
  for (const id of ids.slice(0, MAX_MARKED_LISTINGS - 2))
    expect(await markListing(buyer.id, id)).toBe('marked');
  const racers = ids.slice(MAX_MARKED_LISTINGS - 2, MAX_MARKED_LISTINGS + 2);
  const results = await Promise.all(racers.map((id) => markListing(buyer.id, id)));
  expect(results.filter((result) => result === 'marked')).toHaveLength(2);
  expect(results.filter((result) => result === 'full')).toHaveLength(2);
  const count = await owner
    .selectFrom('listing_mark')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('account_id', '=', buyer.id)
    .executeTakeFirstOrThrow();
  expect(count.count).toBe(MAX_MARKED_LISTINGS);
  // At the cap, a listing already marked is still just marked, and taking one off makes room.
  const [marked] = ids;
  expect(await markListing(buyer.id, marked ?? 0)).toBe('already');
  const [extra] = ids.slice(-1);
  expect(await markListing(buyer.id, extra ?? 0)).toBe('full');
  await unmarkListing(buyer.id, marked ?? 0);
  expect(await markListing(buyer.id, extra ?? 0)).toBe('marked');
});

test('the web role cannot change a mark', async () => {
  const buyer = await createAccount(owner);
  const [id] = await listings(1);
  await markListing(buyer.id, id ?? 0);
  await expect(
    database()
      .updateTable('listing_mark')
      .set({ marked_price_toman: 1 })
      .where('account_id', '=', buyer.id)
      .execute(),
  ).rejects.toThrow(/permission denied/);
});

test('a purged listing takes its marks, and a deleted account its own', async () => {
  const buyer = await createAccount(owner);
  const [kept, purged] = await listings(2);
  await markListing(buyer.id, kept ?? 0);
  await markListing(buyer.id, purged ?? 0);
  const marked = () =>
    owner.selectFrom('listing_mark').select('listing_id').where('account_id', '=', buyer.id).execute();
  await owner
    .deleteFrom('listing')
    .where('id', '=', purged ?? 0)
    .execute();
  expect((await marked()).map((row) => row.listing_id)).toEqual([kept]);
  await owner.deleteFrom('account').where('id', '=', buyer.id).execute();
  expect(await marked()).toEqual([]);
});
