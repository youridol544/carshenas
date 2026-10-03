import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test, type TestContext } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { renderNotification } from '@carshenas/notifications/kinds';
import { SORT_IDS } from '@carshenas/search/sorts';
import { createTestSource, openScratchDatabase } from '../db/test-database.ts';
import { testWorkerDatabase } from '../test-support/runtime.ts';
import { matchSearchFiles } from './search-match.ts';
import { refreshSearch } from './search.ts';

// Proactive matching (CS-72, ADR-0034) as the worker's own role on the scratch database `pnpm db:check` migrated: a
// watching file's buyer gets one digest of what became searchable since the file's watermark, a second run of the same
// work tells nobody twice, paused, closed and muted files move on without a word, and the spacing and the daily cap hold
// a file's alert back and merge it into the next. Every test has its own make, so other tests' listings never match.

const STAND_IN_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g';

let owner: Kysely<DB>;
let worker: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
  worker = testWorkerDatabase();
});

after(async () => {
  await worker.destroy();
  await owner.destroy();
});

// A margin of zero: the rows a test indexes a moment ago are inside the run.
const NOW = { marginSeconds: 0 } as const;

type Scene = {
  readonly sourceId: string;
  readonly slug: string;
  readonly makeId: number;
  readonly modelId: number;
};

async function scene(t: TestContext): Promise<Scene> {
  const sourceId = await createTestSource(owner, t, { crawlState: 'paused' });
  const slug = `tst-${randomBytes(4).toString('hex')}`;
  const make = await owner
    .insertInto('make')
    .values({ slug, name_en: slug, name_fa: 'خودروساز آزمایشی' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const model = await owner
    .insertInto('model')
    .values({ make_id: make.id, slug: 'x', name_en: `${slug} x`, name_fa: 'مدل آزمایشی', body_type: null })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { sourceId, slug, makeId: make.id, modelId: model.id };
}

async function buyer(): Promise<number> {
  const { id } = await owner
    .insertInto('account')
    .values({ username: `buyer_${randomBytes(5).toString('hex')}`, password_hash: STAND_IN_HASH })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

const filesOf = new Map<number, number>();

async function file(
  accountId: number,
  s: Scene,
  name = 'پرونده‌ی آزمایشی',
  extra: object = {},
): Promise<number> {
  const count = filesOf.get(accountId) ?? 0;
  filesOf.set(accountId, count + 1);
  const { id } = await owner
    .insertInto('search_file')
    .values({
      account_id: accountId,
      name,
      // The same search is one file: a second file of the account needs another order.
      search: {
        v: 1,
        filters: { make: [s.slug] },
        ...(count === 0 ? {} : { sort: SORT_IDS[count % SORT_IDS.length] }),
      },
      ...extra,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

/** A searchable listing of the scene's make, built into search_document by the worker's own refresh. */
/** `rating` is the deal rating the valuation gave it: good by default, null for a listing with none. */
async function searchable(
  s: Scene,
  rating: 'good' | 'fair' | null = 'good',
  make = s.makeId,
): Promise<number> {
  const key = randomBytes(6).toString('hex');
  const row = await owner
    .insertInto('listing')
    .values({
      source_id: s.sourceId,
      source_listing_key: key,
      url: `https://test.example/${key}`,
      status: 'active',
      listed_at: sql<Date>`now() - interval '1 hour'`,
      last_seen_at: sql<Date>`now()`,
      make_id: make,
      model_id: s.modelId,
      catalogue_match: 'model',
      model_year_written: 'sh',
      model_year_sh: 1400,
      mileage_km: 50_000,
      price_type: 'asking',
      asking_price_toman: 900_000_000,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await refreshSearch(worker);
  await owner
    .updateTable('search_document')
    .set({ deal_rating: rating })
    .where('listing_id', '=', row.id)
    .execute();
  return row.id;
}

async function digests(accountId: number) {
  return owner
    .selectFrom('notification')
    .select(['id', 'payload', 'search_file_id', 'event_key', 'listing_id'])
    .where('account_id', '=', accountId)
    .where('kind', '=', 'search_file_matches')
    .orderBy('id')
    .execute();
}

async function fileRow(id: number) {
  return owner
    .selectFrom('search_file')
    .select([
      sql<boolean>`matched_through > created_at`.as('moved'),
      'last_alert_at',
      sql<string>`matched_through::text`.as('through'),
    ])
    .where('id', '=', id)
    .executeTakeFirstOrThrow();
}

test('a watching file gets one digest of the listings that became searchable since it was made, naming the file (criteria 1, 2)', async (t) => {
  const s = await scene(t);
  const account = await buyer();
  const id = await file(account, s, 'پژو ۲۰۶ تیپ ۵');
  await searchable(s);
  await searchable(s);
  await searchable(s);
  const run = await matchSearchFiles(worker, NOW);
  assert.ok(run.notified >= 1);
  const [only, ...rest] = await digests(account);
  assert.equal(rest.length, 0);
  assert.ok(only);
  assert.equal(only.search_file_id, id);
  assert.equal(only.listing_id, null);
  assert.deepEqual(only.payload, {
    searchFileId: id,
    fileName: 'پژو ۲۰۶ تیپ ۵',
    newCount: 3,
    goodCount: 3,
    dropCount: 0,
    sinceKey: (only.payload as { sinceKey: string }).sinceKey,
  });
  assert.equal(
    only.event_key,
    `search_file:${String(id)}:${(only.payload as { sinceKey: string }).sinceKey}`,
  );
  assert.match(
    (renderNotification('search_file_matches', only.payload)?.title ?? '').replace(/\p{Cf}/gu, ''),
    /^۳\sآگهی تازه برای «پژو/u,
  );
  const after = await fileRow(id);
  assert.equal(after.moved, true);
  assert.notEqual(after.last_alert_at, null);
});

test('new listings that are neither good deals nor price drops send no digest, and the file still moves on', async (t) => {
  const s = await scene(t);
  const account = await buyer();
  const id = await file(account, s);
  await searchable(s, 'fair');
  await searchable(s, null);
  const run = await matchSearchFiles(worker, NOW);
  assert.equal(run.notified, 0);
  assert.equal((await digests(account)).length, 0);
  const after = await fileRow(id);
  assert.equal(after.moved, true);
  assert.equal(after.last_alert_at, null);
  // A good one in the next batch is told alone; the plain ones before it are not counted.
  await searchable(s);
  await matchSearchFiles(worker, NOW);
  const [only] = await digests(account);
  assert.deepEqual(
    [(only?.payload as { newCount: number }).newCount, (only?.payload as { goodCount: number }).goodCount],
    [1, 1],
  );
});

test('a file made after a listing became searchable does not tell of it, and a run with nothing new tells nobody', async (t) => {
  const s = await scene(t);
  const account = await buyer();
  await searchable(s);
  const id = await file(account, s);
  const run = await matchSearchFiles(worker, NOW);
  assert.equal((await digests(account)).length, 0);
  assert.equal(run.notified, 0);
  assert.equal((await fileRow(id)).last_alert_at, null);
});

test('running the same work again tells nobody twice: the next run finds the watermark moved, and a replay of the same run finds the event', async (t) => {
  const s = await scene(t);
  const account = await buyer();
  const id = await file(account, s);
  await searchable(s);
  const fixed = new Date(Date.now() + 5_000);
  await matchSearchFiles(worker, { ...NOW, now: fixed });
  assert.equal((await digests(account)).length, 1);

  const again = await matchSearchFiles(worker, { ...NOW, now: fixed });
  assert.equal(again.notified, 0);
  assert.equal((await digests(account)).length, 1);

  // A crash after the digest but before the watermark would leave the watermark behind: the same run's event key finds
  // the digest, so the buyer is still told once. (Here the watermark is put back by hand.)
  await owner
    .updateTable('search_file')
    .set({ matched_through: sql`created_at`, last_alert_at: null })
    .where('id', '=', id)
    .execute();
  const replay = await matchSearchFiles(worker, { ...NOW, now: fixed });
  assert.equal(replay.notified, 0);
  assert.equal((await digests(account)).length, 1);
  assert.equal((await fileRow(id)).moved, true);
});

test('a paused, closed or muted file is never read, and resuming it starts its watermark afresh, so the buyer is not flooded', async (t) => {
  const s = await scene(t);
  const account = await buyer();
  const paused = await file(account, s, 'متوقف', { status: 'paused', status_changed_at: sql`now()` });
  const closed = await file(account, s, 'بسته', { status: 'closed', status_changed_at: sql`now()` });
  const muted = await file(account, s, 'بی‌صدا', { muted_at: sql`now()` });
  await searchable(s);
  await matchSearchFiles(worker, NOW);
  assert.equal((await digests(account)).length, 0);
  // Not touched at all: no idle rewrite of files nobody is waiting on.
  for (const id of [paused, closed, muted]) assert.equal((await fileRow(id)).moved, false, String(id));

  // Resumed and unmuted, they tell only of what comes next.
  await owner
    .updateTable('search_file')
    .set({ status: 'watching', muted_at: null })
    .where('account_id', '=', account)
    .execute();
  await matchSearchFiles(worker, NOW);
  assert.equal((await digests(account)).length, 0);
  await searchable(s);
  await matchSearchFiles(worker, { ...NOW, gapMinutes: 0, dailyCap: 100 });
  assert.equal((await digests(account)).length, 3);
});

test("create_notification() creates nothing for another account's file", async (t) => {
  const s = await scene(t);
  const owner1 = await buyer();
  const other = await buyer();
  const id = await file(owner1, s);
  const { rows } = await sql<{ id: number | null }>`
    SELECT create_notification(${other}, 'search_file_matches', 'search_file:9:9',
      ${JSON.stringify({ searchFileId: id, fileName: 'x', newCount: 1, goodCount: 1, dropCount: 0, sinceKey: '9' })}::jsonb,
      NULL, ${id}) AS id`.execute(worker);
  assert.equal(rows[0]?.id, null);
});

test('a run reads at most its limit of files, the oldest watermarks first, and the rest wait for the next run', async (t) => {
  const s = await scene(t);
  const account = await buyer();
  await file(account, s, 'اول');
  await file(account, s, 'دوم');
  await searchable(s);
  // Other tests' files may stand ahead in the queue of oldest watermarks: run until both of ours were reached.
  const first = await matchSearchFiles(worker, { ...NOW, maxFiles: 1, gapMinutes: 0 });
  assert.equal(first.files, 1);
  assert.ok((await digests(account)).length <= 1);
  for (let run = 0; run < 200 && (await digests(account)).length < 2; run += 1) {
    await matchSearchFiles(worker, { ...NOW, maxFiles: 1, gapMinutes: 0 });
  }
  assert.equal((await digests(account)).length, 2);
});

test('create_notification() creates nothing for a muted file, whoever asks (criterion 6)', async (t) => {
  const s = await scene(t);
  const account = await buyer();
  const id = await file(account, s, 'بی‌صدا', { muted_at: sql`now()` });
  const { rows } = await sql<{ id: number | null }>`
    SELECT create_notification(${account}, 'search_file_matches', 'search_file:1:1',
      ${JSON.stringify({ searchFileId: id, fileName: 'x', newCount: 1, goodCount: 0, dropCount: 0, sinceKey: '1' })}::jsonb,
      NULL, ${id}) AS id`.execute(worker);
  assert.equal(rows[0]?.id, null);
  assert.equal((await digests(account)).length, 0);
});

test('a file told within the gap waits and its next digest tells everything since, in one', async (t) => {
  const s = await scene(t);
  const account = await buyer();
  const id = await file(account, s);
  await searchable(s);
  await matchSearchFiles(worker, NOW);
  assert.equal((await digests(account)).length, 1);

  await searchable(s);
  await searchable(s);
  const held = await matchSearchFiles(worker, NOW);
  assert.equal(held.notified, 0);
  assert.equal((await digests(account)).length, 1);

  const later = await matchSearchFiles(worker, { ...NOW, gapMinutes: 0 });
  assert.equal(later.notified, 1, JSON.stringify(later));
  assert.equal(later.notified, 1);
  const all = await digests(account);
  assert.equal(all.length, 2);
  assert.equal((all[1]?.payload as { newCount: number }).newCount, 2);
  assert.equal(all[1]?.search_file_id, id);
});

test("an account's daily cap holds the rest of its files' digests back, with their watermarks", async (t) => {
  const s = await scene(t);
  const account = await buyer();
  const first = await file(account, s, 'اول');
  const second = await file(account, s, 'دوم');
  await searchable(s);
  const run = await matchSearchFiles(worker, { ...NOW, dailyCap: 1 });
  assert.equal(run.notified, 1);
  assert.equal(run.deferred, 1);
  assert.equal((await digests(account)).length, 1);
  const told = (await digests(account))[0]?.search_file_id;
  const waiting = told === first ? second : first;
  assert.equal((await fileRow(waiting)).moved, false);
  // Tomorrow's cap lets it through, with what it held.
  const next = await matchSearchFiles(worker, { ...NOW, dailyCap: 2 });
  assert.equal(next.notified, 1);
  assert.equal((await digests(account)).length, 2);
});

test('a price drop on a match that was already searchable is told, once, beside the new listings', async (t) => {
  const s = await scene(t);
  const account = await buyer();
  const old = await searchable(s);
  const id = await file(account, s);
  const snapshot = await owner
    .insertInto('snapshot')
    .values({
      listing_id: old,
      first_fetched_at: sql<Date>`now()`,
      url: `https://test.example/api/${old}`,
      canonical_version: 1,
      payload: { seeded: old },
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const event = (minutesAgo: number, price: number) =>
    owner
      .insertInto('listing_price_event')
      .values({
        listing_id: old,
        observed_at: sql<Date>`now() - make_interval(mins => ${minutesAgo})`,
        price_type: 'asking',
        asking_price_toman: price,
        snapshot_id: snapshot.id,
      })
      .execute();
  await event(2, 900_000_000);
  await event(1, 850_000_000);
  await searchable(s);
  await matchSearchFiles(worker, NOW);
  const [only] = await digests(account);
  assert.deepEqual(
    [
      only?.search_file_id,
      (only?.payload as { newCount: number }).newCount,
      (only?.payload as { dropCount: number }).dropCount,
    ],
    [id, 1, 1],
  );
  assert.match(renderNotification('search_file_matches', only?.payload)?.detail ?? '', /ارزان‌تر شده/);
});

test('a file whose search this build cannot read is skipped without stopping the others', async (t) => {
  const s = await scene(t);
  const account = await buyer();
  await owner
    .insertInto('search_file')
    .values({ account_id: account, name: 'ناخوانا', search: { v: 1, filters: { vanished_filter: ['x'] } } })
    .execute();
  const good = await file(account, s);
  await searchable(s);
  const run = await matchSearchFiles(worker, NOW);
  assert.ok(run.unreadable >= 1);
  assert.equal((await digests(account)).length, 1);
  assert.equal((await digests(account))[0]?.search_file_id, good);
});
