import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createNotification } from '@carshenas/notifications/create-notification';
import { NOTIFICATION_KIND_IDS } from '@carshenas/notifications/kinds';
import {
  countUnreadNotifications,
  INBOX_PAGE_SIZE,
  loadInbox,
  loadKindSettings,
} from '@/features/notifications/server/notification-queries';
import {
  markAllNotificationsRead,
  markNotificationRead,
  setKindMuted,
} from '@/features/notifications/server/notification-mutations';
import { assertScratchDatabase, createAccount, ownerDatabase } from '@/server/db/account-test-database';
import { database } from '@/server/db/database';

// The inbox's reads and writes end to end (CS-68) on the scratch database `pnpm db:check` migrated, through the app's
// own pool as carshenas_web; notifications are made as a producer makes them, through create_notification().

const owner = ownerDatabase();
let listingId: number;

beforeAll(async () => {
  await assertScratchDatabase(owner);
  const token = randomBytes(6).toString('hex');
  ({ id: listingId } = await owner
    .insertInto('listing')
    .values({
      source_id: 'divar',
      source_listing_key: `q${token}`,
      url: `https://divar.ir/v/q${token}`,
      status: 'active',
      listed_at: new Date(),
      last_seen_at: new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow());
});

afterAll(async () => {
  await Promise.all([owner.destroy(), database().destroy()]);
});

async function notify(accountId: number, priceEventId: number): Promise<number> {
  const outcome = await createNotification(owner, {
    accountId,
    kind: 'listing_price_drop',
    listingId,
    payload: {
      priceEventId,
      carName: 'پژو 206 تیپ ۵',
      previousPriceToman: 850_000_000,
      priceToman: 810_000_000,
    },
  });
  if (outcome.status !== 'created') throw new Error('expected a new notification');
  return outcome.id;
}

test('every kind in the registry is a row of notification_kind, and every row a kind in the registry', async () => {
  const rows = await owner.selectFrom('notification_kind').select('id').orderBy('id').execute();
  expect(rows.map((row) => row.id)).toEqual([...NOTIFICATION_KIND_IDS].sort());
});

test("a buyer's inbox pages newest first by keyset, in Farsi, and never shows another buyer's notifications", async () => {
  const buyer = await createAccount(owner);
  const other = await createAccount(owner);
  const ids: number[] = [];
  for (let event = 1; event <= INBOX_PAGE_SIZE + 5; event += 1) ids.push(await notify(buyer.id, event));
  await notify(other.id, 1);
  // Two notifications in the same microsecond: the id decides their order.
  const { created_at } = await owner
    .selectFrom('notification')
    .select('created_at')
    .where('id', '=', ids[0] ?? 0)
    .executeTakeFirstOrThrow();
  await owner
    .updateTable('notification')
    .set({ created_at })
    .where('id', '=', ids[1] ?? 0)
    .execute();

  const now = new Date();
  const first = await loadInbox(buyer.id, undefined, now);
  const firstIds = first.days.flatMap((day) => day.items.map((item) => item.id));
  expect(firstIds).toHaveLength(INBOX_PAGE_SIZE);
  expect(first.unreadCount).toBe(INBOX_PAGE_SIZE + 5);
  expect(first.newestId).toBe(firstIds[0]);
  const item = first.days[0]?.items[0];
  expect(item?.title).toMatch(/^قیمت .*پژو ۲۰۶ تیپ ۵.* کم شد$/);
  expect(item?.link?.href).toMatch(/^https:\/\/divar\.ir\/v\//);
  expect(item?.link?.external).toBe(true);
  expect(item?.link?.sourceName).toBe('دیوار');

  const second = await loadInbox(buyer.id, first.olderCursor, now);
  const secondIds = second.days.flatMap((day) => day.items.map((entry) => entry.id));
  expect(second.olderCursor).toBeUndefined();
  expect(new Set([...firstIds, ...secondIds])).toEqual(new Set(ids));
  // Another buyer's cursor leads nowhere.
  expect((await loadInbox(other.id, first.olderCursor, now)).days).toEqual([]);
});

test('reading one, then all up to what was shown, leaves later ones unread; mutes are set, not toggled', async () => {
  const buyer = await createAccount(owner);
  const [a, b] = [await notify(buyer.id, 1), await notify(buyer.id, 2)];
  await markNotificationRead(buyer.id, a);
  await markNotificationRead(buyer.id, a);
  expect(await countUnreadNotifications(buyer.id)).toBe(1);
  const later = await notify(buyer.id, 3);
  await markAllNotificationsRead(buyer.id, b);
  expect(await countUnreadNotifications(buyer.id)).toBe(1);
  // Another buyer's id changes nothing.
  const other = await createAccount(owner);
  await markNotificationRead(other.id, later);
  expect(await countUnreadNotifications(buyer.id)).toBe(1);

  await setKindMuted(buyer.id, 'listing_price_drop', true);
  await setKindMuted(buyer.id, 'listing_price_drop', true);
  // The registry has one switch per kind (CS-71 added the second); this test is about the price drop's.
  const priceDropMuted = async () =>
    (await loadKindSettings(buyer.id)).find((setting) => setting.kind === 'listing_price_drop')?.muted;
  expect(await priceDropMuted()).toBe(true);
  await setKindMuted(buyer.id, 'listing_price_drop', false);
  expect(await priceDropMuted()).toBe(false);
});
