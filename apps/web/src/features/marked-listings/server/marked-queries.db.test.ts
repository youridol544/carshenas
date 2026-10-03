import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { countMarkedListings, listMarkedListings } from '@/features/marked-listings/server/marked-queries';
import { markListing, unmarkListing } from '@/features/marks/server/mark-mutations';
import { assertScratchDatabase, createAccount, ownerDatabase } from '@/server/db/account-test-database';
import { database } from '@/server/db/database';

// The marked page's reads (CS-69) on the scratch database `pnpm db:check` migrated, through the app's own pool as
// carshenas_web: each buyer sees their own marks, newest first, with what the listing says now beside what it said when
// marked, and nobody else's.

const owner = ownerDatabase();

beforeAll(async () => {
  await assertScratchDatabase(owner);
});

afterAll(async () => {
  await Promise.all([owner.destroy(), database().destroy()]);
});

async function listing(price: number): Promise<number> {
  const token = randomBytes(6).toString('hex');
  const { id } = await owner
    .insertInto('listing')
    .values({
      source_id: 'divar',
      source_listing_key: `q${token}`,
      url: `https://divar.ir/v/q${token}`,
      status: 'active',
      price_type: 'asking',
      asking_price_toman: price,
      listed_at: new Date(),
      last_seen_at: new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

test("lists the buyer's own marks newest first, with the price now and the price when marked, and nobody else's", async () => {
  const [first, second] = [await createAccount(owner), await createAccount(owner)];
  const [older, newer] = [await listing(850_000_000), await listing(900_000_000)];
  await markListing(first.id, older);
  await markListing(first.id, newer);
  await markListing(second.id, older);
  // The older one drops after it was marked: the mark keeps the price the buyer saw.
  await owner
    .updateTable('listing')
    .set({ asking_price_toman: 800_000_000 })
    .where('id', '=', older)
    .execute();

  const rows = await listMarkedListings(first.id);
  expect(rows.map((row) => row.listingId)).toEqual([newer, older]);
  expect(rows[1]).toMatchObject({
    markedPriceToman: 850_000_000,
    askingPriceToman: 800_000_000,
    status: 'active',
  });
  expect(await countMarkedListings(first.id)).toBe(2);
  expect(await countMarkedListings(second.id)).toBe(1);
  expect((await listMarkedListings(second.id)).map((row) => row.listingId)).toEqual([older]);

  // Unmarking is for the account that marked: another buyer's unmark changes nothing.
  await unmarkListing(second.id, newer);
  expect(await countMarkedListings(first.id)).toBe(2);
  expect(await listMarkedListings(await createAccount(owner).then((buyer) => buyer.id))).toEqual([]);
});
