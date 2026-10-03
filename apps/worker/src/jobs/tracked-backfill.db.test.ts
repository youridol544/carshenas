import assert from 'node:assert/strict';
import { after, before, test, type TestContext } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { loadTrackedModels } from '../db/tracked-store.ts';
import { createTestSource, jobsOf, openScratchDatabase } from '../db/test-database.ts';
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

async function fixture(context: TestContext): Promise<Fixture> {
  const sourceId = await createTestSource(owner, context, { crawlState: 'paused' });
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
    FROM pgboss.job WHERE name = ${`crawl.${sourceId}`} AND data ->> 'kind' = 'crawl.divar-backfill'
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
      ['tokb01', 22],
      ['tokb02', 22],
      ['tokb03', 22],
      ['toka01', 21],
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
