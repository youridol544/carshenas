import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { renderNotification } from '@carshenas/notifications/kinds';
import { notifyMarkEvents } from '../db/mark-store.ts';
import { openScratchDatabase } from '../db/test-database.ts';
import { startTestWorker, testWorkerDatabase } from '../test-support/runtime.ts';
import { until } from '../test-support/wait.ts';
import { markJobs } from './marks.ts';

// What buyers are told about the listings they marked (CS-69, ADR-0026), on the worker's role: a price drop, a sale or
// disappearance and a return each notify once, a repeat run tells nothing twice, a muted kind is skipped, and a listing
// nobody marked produces nothing.

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

type Seed = { listingId: number; snapshotId: number };

async function listing(): Promise<Seed> {
  const token = randomBytes(6).toString('hex');
  const { id } = await owner
    .insertInto('listing')
    .values({
      source_id: 'divar',
      source_listing_key: `m${token}`,
      url: `https://divar.ir/v/m${token}`,
      status: 'active',
      title: 'پژو 206 تیپ 5',
      model_year_sh: 1399,
      model_year_written: 'sh',
      price_type: 'asking',
      asking_price_toman: 850_000_000,
      listed_at: new Date(),
      last_seen_at: new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const snapshot = await owner
    .insertInto('snapshot')
    .values({
      listing_id: id,
      first_fetched_at: new Date(),
      url: 'https://api.test.example/post/main',
      canonical_version: 1,
      payload: {},
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { listingId: id, snapshotId: snapshot.id };
}

let minute = 0;
/** Records a price (a later one than any before in this test) and returns the event's id. */
async function priceEvent(seed: Seed, priceToman: number | null): Promise<number> {
  minute += 1;
  const { rows } = await sql<{ id: number }>`
    INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, snapshot_id)
    VALUES (${seed.listingId}, now() + make_interval(mins => ${minute}),
            ${priceToman === null ? 'negotiable' : 'asking'}, ${priceToman}, ${seed.snapshotId})
    RETURNING id`.execute(owner);
  return rows[0]?.id ?? 0;
}

async function mark(accountId: number, seed: Seed): Promise<void> {
  const { rows } = await sql<{ newest: number }>`
    SELECT coalesce(max(id), 0)::int AS newest FROM listing_price_event WHERE listing_id = ${seed.listingId}`.execute(
    owner,
  );
  await sql`
    INSERT INTO listing_mark (account_id, listing_id, marked_price_toman, seen_status, price_event_seen_id)
    VALUES (${accountId}, ${seed.listingId}, 850000000, 'active', ${rows[0]?.newest ?? 0})`.execute(owner);
}

async function told(accountId: number): Promise<{ kind: string; event_key: string }[]> {
  const { rows } = await sql<{ kind: string; event_key: string }>`
    SELECT kind, event_key FROM notification WHERE account_id = ${accountId} ORDER BY id`.execute(owner);
  return rows;
}

async function setStatus(seed: Seed, status: 'active' | 'sold' | 'expired' | 'gone'): Promise<void> {
  await sql`
    UPDATE listing SET status = ${status}, delisted_at = ${status === 'active' ? null : sql`now()`}
    WHERE id = ${seed.listingId}`.execute(owner);
}

async function runAll(): Promise<void> {
  for (let batch = 0; batch < 20; batch += 1) {
    if (!(await notifyMarkEvents(worker, 100)).more) return;
  }
}

test('a price drop after the mark notifies once; a rise, an earlier drop and a repeat run notify nothing', async () => {
  const accountId = await buyer();
  const seed = await listing();
  await priceEvent(seed, 900_000_000);
  await priceEvent(seed, 850_000_000); // a drop, but before the buyer marked it: they saw this price
  await mark(accountId, seed);

  await runAll();
  assert.deepEqual(await told(accountId), []);

  await priceEvent(seed, 860_000_000); // a rise
  const drop = await priceEvent(seed, 810_000_000);
  const summary = await notifyMarkEvents(worker, 100);
  assert.equal(summary.priceDrops, 1);
  const rows = await told(accountId);
  assert.deepEqual(rows, [{ kind: 'listing_price_drop', event_key: `price_event:${String(drop)}` }]);
  const { rows: stored } = await sql<{ payload: unknown }>`
    SELECT payload FROM notification WHERE account_id = ${accountId}`.execute(owner);
  const text = renderNotification('listing_price_drop', stored[0]?.payload);
  assert.match(text?.title ?? '', /کم شد$/);
  assert.deepEqual(text?.priceChange, { fromToman: 860_000_000, toToman: 810_000_000 });

  assert.equal((await notifyMarkEvents(worker, 100)).priceDrops, 0);
  assert.equal((await told(accountId)).length, 1);

  await priceEvent(seed, 790_000_000);
  await runAll();
  assert.equal((await told(accountId)).length, 2);
});

test('only the buyers who marked the listing are told, each once, and a muted kind is skipped', async () => {
  const [first, second, muted, nobody] = [await buyer(), await buyer(), await buyer(), await buyer()];
  const seed = await listing();
  const other = await listing();
  await priceEvent(seed, 850_000_000);
  for (const accountId of [first, second, muted]) await mark(accountId, seed);
  await mark(nobody, other);
  await sql`INSERT INTO notification_mute (account_id, kind) VALUES (${muted}, 'listing_price_drop')`.execute(
    owner,
  );
  await priceEvent(seed, 800_000_000);
  await runAll();
  await runAll();
  assert.equal((await told(first)).length, 1);
  assert.equal((await told(second)).length, 1);
  assert.equal((await told(muted)).length, 0);
  assert.equal((await told(nobody)).length, 0);
  // The muted buyer's mark moved on anyway: turning the kind back on does not replay old drops.
  await sql`DELETE FROM notification_mute WHERE account_id = ${muted}`.execute(owner);
  await runAll();
  assert.equal((await told(muted)).length, 0);
});

test('a listing that leaves the market, comes back and leaves again notifies each time, and a change between reasons does not', async () => {
  const accountId = await buyer();
  const seed = await listing();
  await mark(accountId, seed);

  await setStatus(seed, 'expired');
  await runAll();
  await runAll();
  await setStatus(seed, 'active');
  await runAll();
  await setStatus(seed, 'gone');
  await runAll();
  assert.deepEqual(
    (await told(accountId)).map((row) => `${row.kind} ${row.event_key}`),
    [
      `listing_off_market listing_status:${String(seed.listingId)}:1`,
      `listing_relisted listing_status:${String(seed.listingId)}:2`,
      `listing_off_market listing_status:${String(seed.listingId)}:3`,
    ],
  );
  // The text says why it left, from the status it had then.
  const { rows } = await sql<{ payload: unknown }>`
    SELECT payload FROM notification WHERE account_id = ${accountId} AND kind = 'listing_off_market' ORDER BY id`.execute(
    owner,
  );
  assert.match(renderNotification('listing_off_market', rows[0]?.payload)?.title ?? '', /منقضی شد$/);
  assert.match(
    renderNotification('listing_off_market', rows[1]?.payload)?.title ?? '',
    /دیگر در دیوار نیست$/,
  );

  // gone and then expired is still off the market: nothing to say, and the mark follows the listing.
  await sql`UPDATE listing SET status = 'active', delisted_at = NULL WHERE id = ${seed.listingId}`.execute(
    owner,
  );
  await runAll();
  assert.equal((await told(accountId)).length, 4);
});

test('a mark made on a listing already off the market tells nothing until it changes', async () => {
  const accountId = await buyer();
  const seed = await listing();
  await setStatus(seed, 'expired');
  await sql`
    INSERT INTO listing_mark (account_id, listing_id, seen_status) VALUES (${accountId}, ${seed.listingId}, 'expired')`.execute(
    owner,
  );
  await runAll();
  assert.deepEqual(await told(accountId), []);
  await setStatus(seed, 'active');
  await runAll();
  assert.deepEqual(
    (await told(accountId)).map((row) => row.kind),
    ['listing_relisted'],
  );
});

test('the marks.notify job runs the same pass from the queue', async () => {
  const accountId = await buyer();
  const seed = await listing();
  await priceEvent(seed, 800_000_000);
  await mark(accountId, seed);
  await priceEvent(seed, 700_000_000);
  const job = markJobs({ scheduled: false });
  const running = await startTestWorker([job]);
  try {
    await running.runtime.enqueue(job, {});
    await until('the drop is announced', async () => (await told(accountId)).length === 1, 10_000);
  } finally {
    await running.stop();
  }
});
