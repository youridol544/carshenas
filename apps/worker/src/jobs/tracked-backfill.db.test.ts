import assert from 'node:assert/strict';
import { after, before, test, type TestContext } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { loadTrackedModels } from '../db/tracked-store.ts';
import { createTestSource, jobsOf, openScratchDatabase } from '../db/test-database.ts';
import { startStubSource } from '../test-support/stub-source.ts';
import { startTestWorker } from '../test-support/runtime.ts';
import { until } from '../test-support/wait.ts';
import { divarFreshnessJobs } from './divar-freshness.ts';

// The tracked models and their backfill (CS-53, ADR-0037) against the real queue and lane, with the source paused as
// Divar is: the planner sends the details of the tracked models' already-seen listings, newest first, a few at a time,
// by the model's priority, and they wait in the lane (nothing is sent to any site: the source is paused and no test
// here has an address to send to). The tables a test fills are shared ones, so it deletes what it made.

let owner: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
});

after(async () => {
  await owner.destroy();
});

type Fixture = {
  readonly sourceId: string;
  readonly modelA: number;
  readonly modelB: number;
  readonly modelC: number;
};

async function fixture(context: TestContext, crawlState: 'paused' | 'enabled' = 'paused'): Promise<Fixture> {
  const sourceId = await createTestSource(owner, context, { crawlState });
  const suffix = sourceId.slice(2);
  const make = await owner
    .insertInto('make')
    .values({ slug: `m-${suffix}`, name_en: `Make ${suffix}` })
    .returning('id')
    .executeTakeFirstOrThrow();
  const models: number[] = [];
  for (const name of ['a', 'b', 'c']) {
    const model = await owner
      .insertInto('model')
      .values({ make_id: make.id, slug: `${name}-${suffix}`, name_en: `Model ${name} ${suffix}` })
      .returning('id')
      .executeTakeFirstOrThrow();
    models.push(model.id);
    await owner
      .insertInto('catalogue_source_key')
      .values({
        source_id: sourceId,
        source_model_key: `Key ${name} ${suffix}`,
        level: 'model',
        make_id: make.id,
        model_id: model.id,
      })
      .execute();
  }
  context.after(async () => {
    await owner.transaction().execute(async (trx) => {
      await sql`SET LOCAL carshenas.purge = 'on'`.execute(trx);
      await trx.deleteFrom('tracked_model_change').where('model_id', 'in', models).execute();
      await trx.deleteFrom('tracked_model').where('model_id', 'in', models).execute();
      await trx.deleteFrom('crawl_request').where('model_id', 'in', models).execute();
      await trx.deleteFrom('listing').where('source_id', '=', sourceId).execute();
      await trx.deleteFrom('catalogue_source_key').where('source_id', '=', sourceId).execute();
      await trx.deleteFrom('model').where('id', 'in', models).execute();
      await trx.deleteFrom('make').where('id', '=', make.id).execute();
    });
  });
  const [modelA, modelB, modelC] = models;
  assert.ok(modelA !== undefined && modelB !== undefined && modelC !== undefined);
  return { sourceId, modelA, modelB, modelC };
}

async function listing(
  setup: Fixture,
  modelId: number,
  token: string,
  minutesAgo: number,
  extra: { checked?: boolean; status?: 'active' | 'gone' } = {},
): Promise<void> {
  const listedAt = new Date(Date.now() - minutesAgo * 60_000);
  const gone = extra.status === 'gone';
  await owner
    .insertInto('listing')
    .values({
      source_id: setup.sourceId,
      source_listing_key: token,
      url: `https://divar.ir/v/${token}`,
      status: extra.status ?? 'active',
      listed_at: listedAt,
      last_seen_at: listedAt,
      delisted_at: gone ? new Date() : null,
      last_checked_at: extra.checked === true ? listedAt : null,
      model_id: modelId,
      make_id: (
        await owner.selectFrom('model').select('make_id').where('id', '=', modelId).executeTakeFirstOrThrow()
      ).make_id,
      catalogue_match: 'model',
    })
    .execute();
}

async function track(modelId: number, priority: 'high' | 'normal' | 'low', state = 'tracking') {
  await owner
    .insertInto('tracked_model')
    .values({ model_id: modelId, origin: 'seed', priority, state: state as 'tracking' | 'paused' })
    .execute();
}

async function queuedTokens(sourceId: string): Promise<{ token: string; priority: number }[]> {
  const { rows } = await sql<{ token: string; priority: number }>`
    SELECT data -> 'payload' ->> 'token' AS token, priority
    FROM pgboss.job WHERE name = ${`crawl.${sourceId}`} AND data ->> 'kind' = 'crawl.divar-planned-backfill'
    ORDER BY priority DESC, token`.execute(owner);
  return rows;
}

test('the planner reads tracked models from the table, newest listing first, by priority, and tops the queue up only below its target', async (context) => {
  const setup = await fixture(context);
  const { sourceId, modelA, modelB, modelC } = setup;
  await track(modelB, 'high');
  await track(modelA, 'normal');
  // A paused model is not planned, and has no key the worker would sweep.
  await track(modelC, 'low', 'paused');
  await listing(setup, modelB, 'tokb01', 10);
  await listing(setup, modelB, 'tokb02', 20);
  await listing(setup, modelB, 'tokb03', 30);
  for (const [index, token] of ['toka01', 'toka02', 'toka03', 'toka04', 'toka05'].entries())
    await listing(setup, modelA, token, 5 + index * 10);
  // Read already, gone, another model's, and the paused model's: none is planned.
  await listing(setup, modelA, 'tokread', 1, { checked: true });
  await listing(setup, modelA, 'tokgone', 2, { status: 'gone' });
  await listing(setup, modelC, 'tokc01', 3);

  const tracked = await loadTrackedModels(owner, sourceId);
  assert.deepEqual(
    tracked.map((model) => [model.priority, model.modelId]),
    [
      ['high', modelB],
      ['normal', modelA],
    ],
  );

  const fresh = divarFreshnessJobs({
    sourceId,
    apiUrl: 'http://127.0.0.1:9',
    trackedModels: (db) => loadTrackedModels(db, sourceId),
    scheduled: false,
    backfill: { queueTarget: 4 },
  });
  const worker = await startTestWorker([...fresh.all]);
  context.after(() => worker.stop());
  const finished = async (id: string) =>
    (await jobsOf(owner, 'divar.plan-backfill')).some((job) => job.id === id && job.state === 'completed');
  const first = await worker.runtime.enqueue(fresh.planBackfill, {});
  await until('the planner ran', () => finished(first));

  // Room for four: the high-priority model took its share (all three of its listings), the other what was left, its
  // newest listing (the batch is chosen newest first; pg-boss starts the jobs of one transaction in no set order); every job waits in the paused source's lane.
  const queued = await queuedTokens(sourceId);
  assert.deepEqual(
    queued.map((job) => [job.token, job.priority]),
    [
      ['tokb01', 24],
      ['tokb02', 24],
      ['tokb03', 24],
      ['toka01', 23],
    ],
  );
  assert.ok((await jobsOf(owner, `crawl.${sourceId}`)).every((job) => job.state === 'created'));

  // Full: another run sends nothing, however many listings wait.
  const second = await worker.runtime.enqueue(fresh.planBackfill, {});
  await until('the planner ran again', () => finished(second));
  assert.equal((await queuedTokens(sourceId)).length, 4);
});

test('the planner fulfils an approved request whose tracked model has a read listing', async (context) => {
  const setup = await fixture(context);
  const { sourceId, modelA } = setup;
  const admin = await owner
    .insertInto('account')
    .values({
      username: `admin_${sourceId.slice(2)}`,
      password_hash:
        '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g',
      role: 'superadmin',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  context.after(async () => {
    await owner.transaction().execute(async (trx) => {
      await sql`SET LOCAL carshenas.purge = 'on'`.execute(trx);
      await trx.deleteFrom('crawl_request_decision').execute();
      await trx.deleteFrom('tracked_model_change').where('model_id', '=', modelA).execute();
      await trx.deleteFrom('tracked_model').where('model_id', '=', modelA).execute();
      await trx.deleteFrom('crawl_request').where('model_id', '=', modelA).execute();
      await trx.deleteFrom('account').where('id', '=', admin.id).execute();
    });
  });
  const request = await owner
    .insertInto('crawl_request')
    .values({ model_id: modelA })
    .returning('id')
    .executeTakeFirstOrThrow();
  await sql`SELECT decide_crawl_request(${request.id}, 'pending', 'approved', NULL, ${admin.id})`.execute(
    owner,
  );
  await listing(setup, modelA, 'toka01', 5, { checked: true });

  const fresh = divarFreshnessJobs({
    sourceId,
    apiUrl: 'http://127.0.0.1:9',
    trackedModels: (db) => loadTrackedModels(db, sourceId),
    scheduled: false,
  });
  const worker = await startTestWorker([...fresh.all]);
  context.after(() => worker.stop());
  await worker.runtime.enqueue(fresh.planBackfill, {});
  await until('the request is fulfilled', async () => {
    const row = await owner
      .selectFrom('crawl_request')
      .select('state')
      .where('id', '=', request.id)
      .executeTakeFirstOrThrow();
    return row.state === 'fulfilled';
  });
});

test("the planner keeps to its own jobs: five thousand of the sweeps' older ones in the lane do not stop it, and it sends the newest first by priority", async (context) => {
  const setup = await fixture(context);
  const { sourceId, modelA, modelB } = setup;
  await track(modelB, 'high');
  await track(modelA, 'low');
  for (let index = 0; index < 400; index += 1) {
    await listing(setup, modelB, `tokb${String(index).padStart(4, '0')}`, 10 + index);
    await listing(setup, modelA, `toka${String(index).padStart(4, '0')}`, 10 + index);
  }
  const fresh = divarFreshnessJobs({
    sourceId,
    apiUrl: 'http://127.0.0.1:9',
    trackedModels: (db) => loadTrackedModels(db, sourceId),
    scheduled: false,
  });
  const worker = await startTestWorker([...fresh.all]);
  context.after(() => worker.stop());
  // The backlog of the sweeps: five thousand older jobs of the lane, every one for a listing that is not these.
  for (let from = 0; from < 5_000; from += 250) {
    await Promise.all(
      Array.from({ length: 250 }, (_, offset) =>
        worker.runtime.enqueue(fresh.backfill, {
          token: `old${String(from + offset).padStart(6, '0')}`,
          reason: 'new',
        }),
      ),
    );
  }
  const id = await worker.runtime.enqueue(fresh.planBackfill, {});
  await until('the planner ran', async () =>
    (await jobsOf(owner, 'divar.plan-backfill')).some((job) => job.id === id && job.state === 'completed'),
  );
  const planned = await queuedTokens(sourceId);
  assert.equal(planned.length, 150);
  // High priority first, and inside a model the newest listings: the high model's share is the 112 newest, its jobs at 24.
  const high = planned.filter((job) => job.priority === 24);
  const low = planned.filter((job) => job.priority === 22);
  assert.equal(high.length + low.length, 150);
  assert.ok(high.length > low.length);
  assert.deepEqual(
    high.map((job) => job.token),
    Array.from({ length: high.length }, (_, index) => `tokb${String(index).padStart(4, '0')}`),
  );
  assert.deepEqual(
    low.map((job) => job.token),
    Array.from({ length: low.length }, (_, index) => `toka${String(index).padStart(4, '0')}`),
  );
  // The older jobs are still all there, untouched.
  const { rows } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM pgboss.job
    WHERE name = ${`crawl.${sourceId}`} AND data ->> 'kind' = 'crawl.divar-backfill'`.execute(owner);
  assert.equal(rows[0]?.n, 5_000);
});

test('a planned job whose listing is read already, off the market, or of a paused model sends no request and leaves no row', async (context) => {
  const setup = await fixture(context, 'enabled');
  const { sourceId, modelA, modelB } = setup;
  await track(modelA, 'normal');
  await track(modelB, 'normal', 'paused');
  await listing(setup, modelA, 'tokread', 5, { checked: true });
  await listing(setup, modelA, 'tokgone', 6, { status: 'gone' });
  await listing(setup, modelB, 'tokpaus', 7);
  // The listings carry their model's own key, as a sweep stores them.
  await sql`UPDATE listing SET source_model_key = 'Key a ' || ${sourceId.slice(2)} WHERE model_id = ${modelA}`.execute(
    owner,
  );
  await sql`UPDATE listing SET source_model_key = 'Key b ' || ${sourceId.slice(2)} WHERE model_id = ${modelB}`.execute(
    owner,
  );
  const requests: string[] = [];
  const stub = await startStubSource((request) => {
    requests.push(request.path);
    return { status: 404, body: '{"code": 5}' };
  });
  context.after(() => stub.close());
  const fresh = divarFreshnessJobs({
    sourceId,
    apiUrl: stub.url,
    trackedModels: (db) => loadTrackedModels(db, sourceId),
    scheduled: false,
  });
  const worker = await startTestWorker([...fresh.all]);
  context.after(() => worker.stop());
  const rows = await owner
    .selectFrom('listing')
    .select(['id', 'source_listing_key'])
    .where('source_id', '=', sourceId)
    .execute();
  await owner
    .insertInto('tracked_backfill')
    .values(rows.map((row) => ({ listing_id: row.id })))
    .execute();
  for (const row of rows)
    await worker.runtime.enqueue(fresh.plannedBackfill, { token: row.source_listing_key ?? '' });
  // The sweeps' older job for the paused model's listing is as cheap.
  await worker.runtime.enqueue(fresh.backfill, { token: 'tokpaus', reason: 'new' });
  await until('every job was settled', async () => {
    const jobs = await jobsOf(owner, `crawl.${sourceId}`);
    return jobs.length === 4 && jobs.every((job) => job.state === 'completed');
  });
  assert.deepEqual(requests, []);
  const left = await owner.selectFrom('tracked_backfill').select('listing_id').execute();
  assert.equal(left.length, 0);
});

test('a listing whose job keeps failing is remembered: planned a few times, then left alone, and a lost job is planned again', async (context) => {
  const setup = await fixture(context);
  const { sourceId, modelA } = setup;
  await track(modelA, 'normal');
  await listing(setup, modelA, 'tokpoison', 5);
  const found = await owner
    .selectFrom('listing')
    .select('id')
    .where('source_id', '=', sourceId)
    .executeTakeFirstOrThrow();
  const { backfillCandidates, BACKFILL_ATTEMPT_CAP } = await import('../db/tracked-store.ts');
  const db = (await import('../test-support/runtime.ts')).testWorkerDatabase();
  context.after(() => db.destroy());
  const candidates = async () =>
    (await backfillCandidates(db, sourceId, { modelId: modelA, trimId: null }, 10)).length;
  assert.equal(await candidates(), 1);
  // In flight: not planned again.
  await owner.insertInto('tracked_backfill').values({ listing_id: found.id }).execute();
  assert.equal(await candidates(), 0);
  // Lost (two days old, never finished): planned again.
  await sql`UPDATE tracked_backfill SET queued_at = now() - interval '3 days'`.execute(owner);
  assert.equal(await candidates(), 1);
  // Given up after its attempts: left alone, however old.
  await sql`UPDATE tracked_backfill SET attempts = ${BACKFILL_ATTEMPT_CAP}`.execute(owner);
  assert.equal(await candidates(), 0);
});
