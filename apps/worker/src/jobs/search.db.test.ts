import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { after, before, test, type TestContext } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import {
  buildSearchDocuments,
  readBuildState,
  takeStaleListings,
  tryLockSearchBuild,
} from '@carshenas/search/document';
import { createTestSource, openScratchDatabase } from '../db/test-database.ts';
import { startTestWorker, testWorkerDatabase } from '../test-support/runtime.ts';
import { until } from '../test-support/wait.ts';
import { queueSearchRebuildIfDue, rebuildSearch, refreshSearch, searchJobs } from './search.ts';

// Keeping search_document fresh (CS-59 criterion 3, ADR-0028): the triggers mark the listings whose rows may change,
// search.refresh as the worker's own role rebuilds exactly those rows, expires the aged ones and recounts, a part that
// failed is rebuilt by the next run, and search.rebuild rebuilds every row. A build never holds up a writer: a crawl or
// a derivation that writes while a build is in flight is neither made to wait nor loses its mark. On the scratch
// database `pnpm db:check` migrated.

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

type Scene = { readonly sourceId: string; readonly makeId: number; readonly modelId: number };

/** A source of its own with a make and a model the catalogue knows. */
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
  return { sourceId, makeId: make.id, modelId: model.id };
}

/** A listing a crawl saw; with `detailed` false it is a list row, with no details read. */
async function addListing(
  s: Scene,
  values: { readonly title?: string; readonly detailed?: boolean } = {},
): Promise<number> {
  const key = randomBytes(6).toString('hex');
  const detailed = values.detailed ?? true;
  const row = await owner
    .insertInto('listing')
    .values({
      source_id: s.sourceId,
      source_listing_key: key,
      url: `https://test.example/${key}`,
      status: 'active',
      listed_at: sql<Date>`now() - interval '1 hour'`,
      last_seen_at: sql<Date>`now()`,
      make_id: s.makeId,
      model_id: s.modelId,
      catalogue_match: 'model',
      ...(detailed
        ? {
            model_year_written: 'sh' as const,
            model_year_sh: 1400,
            mileage_km: 50_000,
            price_type: 'asking' as const,
            asking_price_toman: 900_000_000,
          }
        : {}),
      ...(values.title === undefined ? {} : { title: values.title }),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function marked(ids: readonly number[]): Promise<number[]> {
  const rows = await owner
    .selectFrom('search_document_stale')
    .select('listing_id')
    .where('listing_id', 'in', [...ids])
    .orderBy('listing_id')
    .execute();
  return [...new Set(rows.map((row) => row.listing_id))];
}

async function unmark(ids: readonly number[]): Promise<void> {
  await owner
    .deleteFrom('search_document_stale')
    .where('listing_id', 'in', [...ids])
    .execute();
}

async function inTable(id: number): Promise<boolean> {
  const row = await owner
    .selectFrom('search_document')
    .select('listing_id')
    .where('listing_id', '=', id)
    .executeTakeFirst();
  return row !== undefined;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Holds the build lock in a transaction of its own until released. */
function holdBuildLock() {
  const gate = deferred<true>();
  const acquired = deferred<true>();
  const done = owner.transaction().execute(async (trx) => {
    assert.ok(await tryLockSearchBuild(trx), 'the lock was free');
    acquired.resolve(true);
    await gate.promise;
  });
  return {
    taken: acquired.promise,
    release: () => {
      gate.resolve(true);
    },
    done,
  };
}

test('a listing, a photo, a text fact or a successful valuation run marks the listings whose rows may change, written as the worker', async (t) => {
  const s = await scene(t);
  const bare = await addListing(s, { detailed: false });
  assert.deepEqual(await marked([bare]), [], 'a list row is not searchable, so it is not marked');
  await owner
    .updateTable('listing')
    .set({ last_seen_at: sql<Date>`now() - interval '5 minutes'` })
    .where('id', '=', bare)
    .execute();
  assert.deepEqual(await marked([bare]), [], 'nor when a sweep sees it again');

  const id = await addListing(s);
  assert.deepEqual(await marked([id]), [id], 'a listing with its details');
  await unmark([id]);

  // The writers are the crawler and the derivation: the worker's role, which has no grant on the marks.
  await worker.updateTable('listing').set({ mileage_km: 50_000 }).where('id', '=', id).execute();
  assert.deepEqual(await marked([id]), [], 'an update that changes nothing marks nothing');
  await worker.updateTable('listing').set({ mileage_km: 51_000 }).where('id', '=', id).execute();
  assert.deepEqual(await marked([id]), [id], 'a changed value, written by the worker');
  await unmark([id]);

  await worker
    .updateTable('listing')
    .set({ price_type: 'asking', asking_price_toman: 800_000_000, title: 'خودروی تازه' })
    .where('id', '=', bare)
    .execute();
  assert.deepEqual(await marked([bare]), [bare], 'reading its details marks a list row');
  await unmark([bare]);

  await worker
    .insertInto('listing_photo')
    .values({ listing_id: id, position: 1, url: 'https://test.example/1.jpg' })
    .execute();
  assert.deepEqual(await marked([id]), [id], 'a photo');
  await unmark([id]);

  const snapshot = await owner
    .insertInto('snapshot')
    .values({
      listing_id: id,
      first_fetched_at: sql<Date>`now()`,
      url: 'https://test.example/api',
      canonical_version: 1,
      payload: { id },
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const answer = await owner
    .insertInto('ai_answer')
    .values({
      cache_key: randomBytes(32),
      task: 'listing.facts',
      prompt_version: '0123456789abcdef',
      provider: 'google',
      model: 'test-model',
      answering_model: 'test-model',
      output: { paint: 'none' },
      cost_usd_micros: 0,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const extraction = await owner
    .insertInto('extraction')
    .values({
      snapshot_id: snapshot.id,
      listing_id: id,
      ai_answer_id: answer.id,
      status: 'usable',
      hold_reasons: [],
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  assert.deepEqual(await marked([id]), [], 'an extraction without facts yet');
  await worker
    .insertInto('extraction_field')
    .values({
      extraction_id: extraction.id,
      field: 'paint',
      value: 'none',
      evidence: 'بدون رنگ',
      confidence: '0.9',
      threshold: '0.75',
      status: 'accepted',
    })
    .execute();
  assert.deepEqual(await marked([id]), [id], 'a text fact, written by the worker');
  await unmark([id]);

  const run = await owner
    .insertInto('valuation_run')
    .values({
      as_of_date: '2098-01-01',
      method_version: 99,
      status: 'running',
      reference_year_sh: 1405,
      mileage_norm_km_per_year: 20_000,
      window_days: 30,
      prior_strength: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  t.after(() => owner.deleteFrom('valuation_run').where('id', '=', run.id).execute());
  assert.deepEqual(await marked([id, bare]), [], 'a run still running');
  await worker
    .updateTable('valuation_run')
    .set({
      status: 'succeeded',
      finished_at: sql<Date>`now()`,
      comparable_count: 0,
      valued_count: 0,
      rated_count: 0,
    })
    .where('id', '=', run.id)
    .execute();
  assert.deepEqual(
    await marked([id, bare]),
    [id, bare].sort((a, b) => a - b),
    'a run that succeeded marks every searchable listing',
  );
  await unmark([id, bare]);
});

test('search.refresh, as the worker, builds the marked listings’ rows, drains the marks, expires aged rows and recounts', async (t) => {
  const s = await scene(t);
  const word = `zq${randomBytes(4).toString('hex')}`;
  const first = await addListing(s, { title: `${word} تمیز` });
  const second = await addListing(s);
  const bare = await addListing(s, { detailed: false });

  const refreshed = await refreshSearch(worker);
  assert.equal(refreshed.skipped, 0);
  assert.ok(refreshed.written >= 2);
  assert.deepEqual(await marked([first, second, bare]), []);
  assert.ok((await inTable(first)) && (await inTable(second)));
  assert.ok(!(await inTable(bare)), 'a list row is seen, not searchable');

  const counted = async (facet: string, value: string) =>
    (
      await owner
        .selectFrom('search_facet_count')
        .select('listing_count')
        .where('facet', '=', facet as 'model')
        .where('value', '=', value)
        .executeTakeFirst()
    )?.listing_count;
  const modelKey = (
    await owner
      .selectFrom('search_document')
      .select('model_key')
      .where('listing_id', '=', first)
      .executeTakeFirstOrThrow()
  ).model_key;
  assert.equal(await counted('model', modelKey ?? ''), 2, 'the model has its two searchable listings');
  const vocabulary = await owner
    .selectFrom('search_word')
    .select('listing_count')
    .where('word', '=', word)
    .executeTakeFirst();
  assert.equal(vocabulary?.listing_count, 1, 'and its words are in the vocabulary');

  // Nothing marked, nothing aged: the next minute writes no row and no count.
  const quiet = await refreshSearch(worker);
  assert.deepEqual(
    {
      written: quiet.written,
      removed: quiet.removed,
      expired: quiet.expired,
      marks: quiet.marks,
      words: quiet.words,
    },
    { written: 0, removed: 0, expired: 0, marks: 0, words: 0 },
  );

  // Sold: its row leaves at the next refresh.
  await owner
    .updateTable('listing')
    .set({ status: 'gone', delisted_at: sql<Date>`now()` })
    .where('id', '=', second)
    .execute();
  assert.equal((await refreshSearch(worker)).removed, 1);
  assert.ok(!(await inTable(second)));

  // Not seen for 48 hours, with no write to the listing: the minute expires the row by itself, and the counts follow.
  await owner
    .updateTable('search_document')
    .set({ last_seen_at: sql<Date>`now() - interval '49 hours'` })
    .where('listing_id', '=', first)
    .execute();
  const aged = await refreshSearch(worker);
  assert.ok(aged.expired >= 1);
  assert.ok(!(await inTable(first)));
  assert.equal(
    await counted('model', modelKey ?? ''),
    undefined,
    'the model has none left, so it is not offered',
  );
});

test('the search table carries how a mileage was read, so a card can say it was assumed (CS-101)', async (t) => {
  const s = await scene(t);
  const id = await addListing(s);
  await owner
    .updateTable('listing')
    .set({
      mileage_km: 100_000,
      mileage_written_km: 100,
      mileage_reading: 'thousands_price',
      mileage_ask_ratio: 0.93,
    })
    .where('id', '=', id)
    .execute();
  await refreshSearch(worker);
  const row = await owner
    .selectFrom('search_document')
    .select(['mileage_km', 'mileage_reading', 'mileage_written_km'])
    .where('listing_id', '=', id)
    .executeTakeFirstOrThrow();
  assert.deepEqual(row, { mileage_km: 100_000, mileage_reading: 'thousands_price', mileage_written_km: 100 });
});

test('a run that failed after its rows is repaired by the next, whatever the next changes', async (t) => {
  const s = await scene(t);
  const word = `zq${randomBytes(4).toString('hex')}`;
  await refreshSearch(worker);
  const id = await addListing(s, { title: word });
  await unmark([id]);
  // The failed run: its rows committed (and so the change recorded), the counts and the vocabulary never written.
  await owner.transaction().execute(async (trx) => {
    assert.ok(await tryLockSearchBuild(trx));
    assert.equal((await buildSearchDocuments(trx, { scope: { listingIds: [id] } })).written, 1);
  });
  const stale = await readBuildState(owner);
  assert.ok(stale.documentsChangedAt !== null);
  assert.equal(
    (await owner.selectFrom('search_word').select('word').where('word', '=', word).executeTakeFirst()) ===
      undefined,
    true,
    'the vocabulary lacks the word',
  );
  // The next run has no mark and no change of its own, and still builds the vocabulary and the counts.
  const next = await refreshSearch(worker);
  assert.equal(next.marks, 0);
  assert.ok(next.words > 0, 'the vocabulary was rebuilt although this run changed no row');
  assert.ok(
    (await owner.selectFrom('search_word').select('word').where('word', '=', word).executeTakeFirst()) !==
      undefined,
  );
  const state = await readBuildState(owner);
  assert.ok(state.vocabularyBuiltAt !== null && state.documentsChangedAt !== null);
  assert.ok(state.vocabularyBuiltAt >= state.documentsChangedAt);
  assert.ok(state.countsBuiltAt !== null && state.countsBuiltAt >= state.documentsChangedAt);
});

test('search.rebuild, as the worker, rebuilds every row, the counts and the vocabulary, and records the full rebuild', async (t) => {
  const s = await scene(t);
  const id = await addListing(s, { title: 'بازسازی کامل' });
  const started = (await readBuildState(owner)).now;
  const chunks: number[] = [];
  const built = await rebuildSearch(worker, { onChunk: (chunk) => chunks.push(chunk.index) });
  assert.equal(built.skipped, 0);
  assert.ok(chunks.length >= 1);
  assert.ok(await inTable(id));
  assert.ok(built.words > 0);
  const state = await readBuildState(owner);
  assert.ok(state.fullRebuildAt !== null && state.fullRebuildAt >= started, 'the full rebuild was recorded');
  assert.equal(
    (await rebuildSearch(worker)).written,
    0,
    'a rebuild that finds nothing changed writes no row',
  );
});

test('a refresh that finds a build running skips its tick at once and keeps its marks', async (t) => {
  const s = await scene(t);
  const id = await addListing(s);
  const lock = holdBuildLock();
  await lock.taken;
  try {
    const started = Date.now();
    const skipped = await refreshSearch(worker);
    assert.equal(skipped.skipped, 1);
    assert.ok(Date.now() - started < 1_000, 'it did not wait for the lock');
    assert.deepEqual(await marked([id]), [id], 'its marks are kept for the next tick');
    assert.ok(!(await inTable(id)));
  } finally {
    lock.release();
    await lock.done;
  }
  assert.equal((await refreshSearch(worker)).skipped, 0);
  assert.ok(await inTable(id), 'the next tick builds it');
});

test('a rebuild waits for a build to finish, and gives up at its limit instead of failing', async (t) => {
  const s = await scene(t);
  const id = await addListing(s);
  // Held for half a second: the rebuild waits it out, within its limit.
  const brief = holdBuildLock();
  await brief.taken;
  const waiting = rebuildSearch(worker, { lockWaitMs: 10_000 });
  await sleep(500);
  brief.release();
  await brief.done;
  const built = await waiting;
  assert.equal(built.skipped, 0);
  assert.ok(await inTable(id));

  // Held longer than its limit: the rebuild comes back skipped, at its limit, without an error.
  const long = holdBuildLock();
  await long.taken;
  try {
    const started = Date.now();
    const skipped = await rebuildSearch(worker, { lockWaitMs: 400 });
    const spent = Date.now() - started;
    assert.equal(skipped.skipped, 1);
    assert.ok(spent >= 350 && spent < 2_500, `it gave up after ${String(spent)} ms`);
  } finally {
    long.release();
    await long.done;
  }
});

test('a build in flight never holds up a writer, and a change made meanwhile keeps its mark', async (t) => {
  const s = await scene(t);
  const ids = [await addListing(s), await addListing(s), await addListing(s)];
  const hold = deferred<true>();
  const midway = deferred<number[]>();
  // A refresh in the middle of its work: the lock held, its marks taken (deleted, not yet committed), and the rows it
  // built written (locked), all uncommitted.
  const build = owner.transaction().execute(async (trx) => {
    assert.ok(await tryLockSearchBuild(trx));
    const taken = await takeStaleListings(trx, 1_000_000);
    assert.ok(ids.every((id) => taken.listingIds.includes(id)));
    await buildSearchDocuments(trx, { scope: { listingIds: taken.listingIds } });
    midway.resolve(taken.listingIds);
    await hold.promise;
  });
  await midway.promise;
  // The writers, as the crawler and the derivation are, with a lock timeout of 300 ms: waiting is a failure.
  const writer = async (work: (trx: Kysely<DB>) => Promise<unknown>) => {
    const started = Date.now();
    await worker.transaction().execute(async (trx) => {
      await sql`SET LOCAL lock_timeout = '300ms'`.execute(trx);
      await work(trx);
    });
    assert.ok(Date.now() - started < 300, `a write waited ${String(Date.now() - started)} ms`);
  };
  const [first, second] = ids;
  assert.ok(first !== undefined && second !== undefined);
  // The listing the build took the mark of, and built the row of: a new price.
  await writer((trx) =>
    trx.updateTable('listing').set({ asking_price_toman: 850_000_000 }).where('id', '=', first).execute(),
  );
  await writer((trx) =>
    trx
      .insertInto('listing_photo')
      .values({ listing_id: second, position: 1, url: 'https://test.example/flight.jpg' })
      .execute(),
  );
  // A new listing with its details, and a valuation run that marks every searchable listing.
  const added = await addListing(s);
  assert.ok(added > 0);
  const run = await owner
    .insertInto('valuation_run')
    .values({
      as_of_date: '2097-01-01',
      method_version: 98,
      status: 'running',
      reference_year_sh: 1405,
      mileage_norm_km_per_year: 20_000,
      window_days: 30,
      prior_strength: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  t.after(() => owner.deleteFrom('valuation_run').where('id', '=', run.id).execute());
  await writer((trx) =>
    trx
      .updateTable('valuation_run')
      .set({
        status: 'succeeded',
        finished_at: sql<Date>`now()`,
        comparable_count: 0,
        valued_count: 0,
        rated_count: 0,
      })
      .where('id', '=', run.id)
      .execute(),
  );
  hold.resolve(true);
  await build;
  // The marks written while the build was in flight are not the ones it deleted: they are still there.
  assert.deepEqual(
    await marked([...ids, added]),
    [...ids, added].sort((a, b) => a - b),
  );
  const next = await refreshSearch(worker);
  assert.equal(next.skipped, 0);
  assert.deepEqual(await marked([...ids, added]), []);
  const price = await owner
    .selectFrom('search_document')
    .select('asking_price_toman')
    .where('listing_id', '=', first)
    .executeTakeFirstOrThrow();
  assert.equal(
    price.asking_price_toman,
    850_000_000,
    'the change made meanwhile is in the table after the next tick',
  );
});

test('the search jobs run in the worker, and a worker that finds the table empty queues one rebuild', async (t) => {
  const s = await scene(t);
  const id = await addListing(s);
  const jobs = searchJobs({ scheduled: false });
  const running = await startTestWorker(jobs.all);
  t.after(() => running.stop());
  const openRebuilds = async () =>
    (
      await sql<{ n: number }>`
        SELECT count(*)::integer AS n FROM pgboss.job
        WHERE name = 'search.rebuild' AND state IN ('created', 'retry', 'active')`.execute(owner)
    ).rows[0]?.n;
  // Due because no full rebuild was recorded after the table was last emptied; whichever reason, one job is queued
  // and a second call, with it still open or its work done, queues no other.
  await owner.deleteFrom('search_build_event').where('event', '=', 'full_rebuild').execute();
  const before_ =
    (
      await sql<{
        n: number;
      }>`SELECT count(*)::integer AS n FROM pgboss.job WHERE name = 'search.rebuild'`.execute(owner)
    ).rows[0]?.n ?? 0;
  const reason = await queueSearchRebuildIfDue(running.db, running.runtime.enqueue, jobs.rebuild);
  assert.ok(reason === 'never' || reason === 'empty', `queued because ${String(reason)}`);
  const second = await queueSearchRebuildIfDue(running.db, running.runtime.enqueue, jobs.rebuild);
  assert.equal(second, undefined, 'one is queued already, or has run and was recorded');
  await until(
    'the rebuild ran and was recorded',
    async () => (await readBuildState(owner)).fullRebuildAt !== null,
  );
  assert.ok(await inTable(id), 'and the listing is searchable');
  assert.equal(
    (
      await sql<{
        n: number;
      }>`SELECT count(*)::integer AS n FROM pgboss.job WHERE name = 'search.rebuild'`.execute(owner)
    ).rows[0]?.n,
    before_ + 1,
    'one rebuild job was sent',
  );
  // Recorded and the table not empty: nothing is due.
  await until('no rebuild is open', async () => (await openRebuilds()) === 0);
  assert.equal(await queueSearchRebuildIfDue(running.db, running.runtime.enqueue, jobs.rebuild), undefined);
});
