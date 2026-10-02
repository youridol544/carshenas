import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { createNotification } from '@carshenas/notifications/create-notification';
import { openScratchDatabase } from '../db/test-database.ts';
import { startTestWorker, testWorkerDatabase } from '../test-support/runtime.ts';
import { until } from '../test-support/wait.ts';
import { notificationJobs } from './notifications.ts';

// The inbox's producers and upkeep on the worker's role (CS-68, ADR-0026): a producer notifies through the shared
// helper inside its own transaction, twice without a second row, and the nightly job deletes what retention says.

const STAND_IN_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g';

let owner: Kysely<DB>;
let worker: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
  worker = testWorkerDatabase();
});

after(async () => {
  await Promise.all([owner.destroy(), worker.destroy()]);
});

async function buyer(): Promise<number> {
  const { id } = await owner
    .insertInto('account')
    .values({ username: `buyer_${randomBytes(5).toString('hex')}`, password_hash: STAND_IN_HASH })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

async function listing(): Promise<number> {
  const token = randomBytes(6).toString('hex');
  const { id } = await owner
    .insertInto('listing')
    .values({
      source_id: 'divar',
      source_listing_key: `t${token}`,
      url: `https://divar.ir/v/t${token}`,
      status: 'active',
      listed_at: new Date(),
      last_seen_at: new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

function priceDrop(priceEventId: number) {
  return {
    carName: 'پژو ۲۰۶ تیپ ۵',
    priceEventId,
    previousPriceToman: 850_000_000,
    priceToman: 810_000_000,
  };
}

async function notificationsOf(accountId: number): Promise<number> {
  const { rows } = await sql<{ count: number }>`
    SELECT count(*)::int AS count FROM notification WHERE account_id = ${accountId}`.execute(owner);
  return rows[0]?.count ?? 0;
}

test('a producer on the worker notifies once per event, and not at all when its transaction rolls back', async () => {
  const accountId = await buyer();
  const listingId = await listing();
  const input = { accountId, kind: 'listing_price_drop', listingId, payload: priceDrop(1) } as const;
  assert.equal((await createNotification(worker, input)).status, 'created');
  assert.deepEqual(await createNotification(worker, input), { status: 'skipped' });
  await assert.rejects(
    worker.transaction().execute(async (trx) => {
      await createNotification(trx, { ...input, payload: priceDrop(2) });
      throw new Error('the event failed to record');
    }),
    /the event failed to record/,
  );
  assert.equal(await notificationsOf(accountId), 1);
  // A payload that does not fit its kind is the producer's bug: it throws before the database sees it.
  await assert.rejects(
    createNotification(worker, { ...input, payload: { ...priceDrop(3), priceToman: 900_000_000 } }),
  );
});

test('the nightly job deletes notifications read over 90 days ago and any over a year old, and keeps the rest', async () => {
  const accountId = await buyer();
  const listingId = await listing();
  const ids: number[] = [];
  for (let event = 10; event < 14; event += 1) {
    const outcome = await createNotification(worker, {
      accountId,
      kind: 'listing_price_drop',
      listingId,
      payload: priceDrop(event),
    });
    assert.equal(outcome.status, 'created');
    ids.push(outcome.id);
  }
  const [readLongAgo, readRecently, veryOld, fresh] = ids;
  await sql`UPDATE notification SET created_at = now() - interval '200 days', read_at = now() - interval '91 days'
            WHERE id = ${readLongAgo}`.execute(owner);
  await sql`UPDATE notification SET created_at = now() - interval '200 days', read_at = now() - interval '89 days'
            WHERE id = ${readRecently}`.execute(owner);
  await sql`UPDATE notification SET created_at = now() - interval '366 days' WHERE id = ${veryOld}`.execute(
    owner,
  );

  const job = notificationJobs({ scheduled: false, batch: 1 });
  const running = await startTestWorker([job]);
  try {
    await running.runtime.enqueue(job, {});
    await until(
      'the expired notifications are gone',
      async () => (await notificationsOf(accountId)) === 2,
      10_000,
    );
  } finally {
    await running.stop();
  }
  const kept = await owner
    .selectFrom('notification')
    .select('id')
    .where('account_id', '=', accountId)
    .execute();
  assert.deepEqual(kept.map((row) => row.id).sort(), [readRecently, fresh].sort());
});
