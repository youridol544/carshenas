import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { renderNotification } from '@carshenas/notifications/kinds';
import { loadCrawlRequests } from '@/features/admin/server/crawl-request-queries';
import { decideCrawlRequest } from '@/features/admin/server/crawl-request-mutations';
import { assertScratchDatabase, createAccount, ownerDatabase } from '@/server/db/account-test-database';
import { adminDatabase } from '@/server/db/admin-database';

// The superadmin's decision end to end (CS-71 #2, #3, #5, #6) on the scratch database `pnpm db:check` migrated, through
// the section's own pool as carshenas_admin: an approval records who and when, notifies each buyer whose file raised
// the request once (two files of one buyer are one notice), a repeated press notifies no one, a decline gives its
// reason, a buyer who muted the kind is not notified, and a person who is not a superadmin changes nothing.

vi.mock('@/server/auth/current-account', () => ({
  requireSuperadmin: () => Promise.resolve({ id: 0, username: 'admin', role: 'superadmin' }),
}));

const owner = ownerDatabase();
let makeId: number;
let admin: { id: number; username: string };

beforeAll(async () => {
  await assertScratchDatabase(owner);
  admin = await createAccount(owner, 'superadmin');
  ({ id: makeId } = await owner
    .insertInto('make')
    .values({ slug: `d${randomBytes(4).toString('hex')}`, name_en: 'Decide', name_fa: 'تصمیم' })
    .returning('id')
    .executeTakeFirstOrThrow());
});

afterAll(async () => {
  await Promise.all([owner.destroy(), adminDatabase().destroy()]);
});

async function newRequest(buyers: { id: number }[]): Promise<{ id: number; files: number[] }> {
  const slug = `y${randomBytes(4).toString('hex')}`;
  const { id: modelId } = await owner
    .insertInto('model')
    .values({ make_id: makeId, slug, name_en: `Decide ${slug}`, name_fa: `پژو ۴۰۵ ${slug}` })
    .returning('id')
    .executeTakeFirstOrThrow();
  const { id } = await owner
    .insertInto('crawl_request')
    .values({ model_id: modelId })
    .returning('id')
    .executeTakeFirstOrThrow();
  const files: number[] = [];
  for (const buyer of buyers) {
    const { id: fileId } = await owner
      .insertInto('search_file')
      .values({
        account_id: buyer.id,
        name: 'پرونده',
        search: { v: 1, filters: {}, q: randomBytes(5).toString('hex') },
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await owner
      .insertInto('crawl_request_file')
      .values({ crawl_request_id: id, search_file_id: fileId })
      .execute();
    files.push(fileId);
  }
  return { id, files };
}

function notificationsOf(accountId: number) {
  return owner
    .selectFrom('notification')
    .select(['kind', 'event_key', 'payload'])
    .where('account_id', '=', accountId)
    .where('kind', '=', 'crawl_request_decided')
    .orderBy('id')
    .execute();
}

const approve = (requestId: number, seenState: 'pending' | 'approved' | 'declined' = 'pending') =>
  ({ requestId, seenState, decision: 'approved', reason: null }) as const;

test('an approval is recorded with who and when, and tells each buyer once, a buyer with two files once', async () => {
  const [ali, sara] = await Promise.all([createAccount(owner), createAccount(owner)]);
  const request = await newRequest([ali, sara, ali]);
  expect(await decideCrawlRequest(approve(request.id), admin.id)).toBe('changed');

  const row = await owner
    .selectFrom('crawl_request')
    .select(['state', 'decided_by_account_id', 'decided_at'])
    .where('id', '=', request.id)
    .executeTakeFirstOrThrow();
  expect(row).toMatchObject({ state: 'approved', decided_by_account_id: admin.id });
  expect(row.decided_at).toBeInstanceOf(Date);

  const aliNotices = await notificationsOf(ali.id);
  expect(aliNotices).toHaveLength(1);
  expect(aliNotices[0]?.event_key).toBe(`crawl_request:${String(request.id)}:approved`);
  // The notice opens the buyer's first file of the request, and reads as an approval.
  const text = renderNotification('crawl_request_decided', aliNotices[0]?.payload);
  expect(text?.href).toBe(`/account/searches/${String(request.files[0])}`);
  expect(text?.title).toContain('تأیید شد');
  expect(await notificationsOf(sara.id)).toHaveLength(1);

  // The same press again is a repeat: nothing changes and no one is told twice.
  expect(await decideCrawlRequest(approve(request.id), admin.id)).toBe('unchanged');
  expect(await notificationsOf(ali.id)).toHaveLength(1);
  // A person who saw it pending after it was approved is stale, and changes nothing.
  expect(
    await decideCrawlRequest(
      { requestId: request.id, seenState: 'pending', decision: 'declined', reason: 'دیر شد' },
      admin.id,
    ),
  ).toBe('stale');
});

test('a decline gives its reason to the buyers, and a reconsidered request tells them again', async () => {
  const buyer = await createAccount(owner);
  const request = await newRequest([buyer]);
  expect(
    await decideCrawlRequest(
      {
        requestId: request.id,
        seenState: 'pending',
        decision: 'declined',
        reason: 'این مدل خارج از بازار تهران است',
      },
      admin.id,
    ),
  ).toBe('changed');
  const [declined] = await notificationsOf(buyer.id);
  expect(renderNotification('crawl_request_decided', declined?.payload)?.detail).toBe(
    'دلیل: این مدل خارج از بازار تهران است',
  );
  expect(await decideCrawlRequest(approve(request.id, 'declined'), admin.id)).toBe('changed');
  const notices = await notificationsOf(buyer.id);
  expect(notices.map((notice) => notice.event_key)).toEqual([
    `crawl_request:${String(request.id)}:declined`,
    `crawl_request:${String(request.id)}:approved`,
  ]);
  const decisions = await owner
    .selectFrom('crawl_request_decision')
    .select(['decision', 'from_state'])
    .where('crawl_request_id', '=', request.id)
    .orderBy('id')
    .execute();
  expect(decisions).toEqual([
    { decision: 'declined', from_state: 'pending' },
    { decision: 'approved', from_state: 'declined' },
  ]);
});

test('a buyer who muted the kind is not told, and the decision stands', async () => {
  const buyer = await createAccount(owner);
  await owner
    .insertInto('notification_mute')
    .values({ account_id: buyer.id, kind: 'crawl_request_decided' })
    .execute();
  const request = await newRequest([buyer]);
  expect(await decideCrawlRequest(approve(request.id), admin.id)).toBe('changed');
  expect(await notificationsOf(buyer.id)).toEqual([]);
});

test('an account that is not a superadmin changes nothing and tells no one', async () => {
  const buyer = await createAccount(owner);
  const request = await newRequest([buyer]);
  await expect(decideCrawlRequest(approve(request.id), buyer.id)).rejects.toMatchObject({
    constraint: 'crawl_request_decision_by_superadmin',
  });
  const row = await owner
    .selectFrom('crawl_request')
    .select('state')
    .where('id', '=', request.id)
    .executeTakeFirstOrThrow();
  expect(row.state).toBe('pending');
  expect(await notificationsOf(buyer.id)).toEqual([]);
});

test('the screen lists a request with its buyers and files, most wanted first, and the decision in its row', async () => {
  const buyers = await Promise.all([createAccount(owner), createAccount(owner), createAccount(owner)]);
  const popular = await newRequest(buyers);
  const quiet = await newRequest([buyers[0] as { id: number }]);
  await decideCrawlRequest(approve(quiet.id), admin.id);
  const all = await loadCrawlRequests('all');
  const ids = all.requests.map((request) => request.id);
  // The queue first (pending), then the answered.
  expect(ids.indexOf(popular.id)).toBeLessThan(ids.indexOf(quiet.id));
  const row = all.requests.find((request) => request.id === popular.id);
  expect(row).toMatchObject({ buyers: 3, fileCount: 3, state: 'pending' });
  expect(row?.files.map((file) => file.buyer).sort()).toEqual(
    buyers.map((buyer) => buyer.username ?? '').sort(),
  );
  const decided = (await loadCrawlRequests('approved')).requests.find((request) => request.id === quiet.id);
  expect(decided).toMatchObject({ decidedBy: admin.username, state: 'approved' });
  expect(all.demand.length).toBeGreaterThan(0);
});
