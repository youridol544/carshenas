import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { CompiledQuery, Kysely } from 'kysely';
import * as z from 'zod';
import type { DB } from '@carshenas/db/db-types';
import { logFetch, openCrawlRun } from '../db/crawl-store.ts';
import { ensureLane } from '../db/lane-store.ts';
import { createTestSource, openScratchDatabase } from '../db/test-database.ts';
import { crawlStep } from '../jobs/crawl-step.ts';
import { startTestWorker, testLogger, testWorkerDatabase } from '../test-support/runtime.ts';
import { startStubSource } from '../test-support/stub-source.ts';
import { until } from '../test-support/wait.ts';
import { SourceBlockedError } from './errors.ts';
import { defineLaneJob } from './job.ts';
import { createLaneClient } from './lane-client.ts';
import { PACING } from './pacing.ts';

// The runtime's bookkeeping when the database fails it (CS-35, carried from CS-33's reviews): a request's own result
// survives a lane that could not record it, so the step still logs it and a block still stops its source; and a run
// is closed whatever became of the transaction that called succeed().

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

/**
 * The worker's pool, except that statements containing `failing` throw, as if the database went away for them. The
 * lane's statements run through sql`…`.execute(db), which asks the database for its executor.
 */
function failingOn(db: Kysely<DB>, failing: string): Kysely<DB> {
  // Kysely keeps private fields, so every method runs on the real object, never on the proxy.
  const forward = (target: object, property: string | symbol): unknown => {
    const value: unknown = Reflect.get(target, property, target);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
  };
  return new Proxy(db, {
    get(target, property) {
      if (property !== 'getExecutor') return forward(target, property);
      return () => {
        const executor = target.getExecutor();
        return new Proxy(executor, {
          get(inner, key) {
            if (key !== 'executeQuery') return forward(inner, key);
            return (query: CompiledQuery, queryOptions?: Parameters<typeof executor.executeQuery>[1]) =>
              query.sql.includes(failing)
                ? Promise.reject(new Error(`the database failed: ${failing}`))
                : executor.executeQuery(query, queryOptions);
          },
        });
      };
    },
  });
}

function laneClientOn(db: Kysely<DB>, sourceId: string) {
  return createLaneClient({
    sourceId,
    holder: 'hardening-test',
    priority: 60,
    db,
    policy: PACING,
    requestTimeoutMs: 5_000,
    signal: new AbortController().signal,
    log: testLogger(),
    onClosed: () => undefined,
  });
}

test('an answer comes back to the job even when the lane cannot give its lease back', async (context) => {
  const sourceId = await createTestSource(owner, context);
  await ensureLane(worker, sourceId);
  const lane = laneClientOn(failingOn(worker, 'lease_holder = NULL'), sourceId);
  assert.equal(await lane.request(() => Promise.resolve('answered')), 'answered');
  // The lease was not given back: it lapses by itself, so the next request waits for it, never overlaps.
  const row = await owner
    .selectFrom('crawl_lane')
    .select(['lease_holder', 'budget_spent'])
    .where('source_id', '=', sourceId)
    .executeTakeFirstOrThrow();
  assert.ok(row.lease_holder?.startsWith('hardening-test/'));
  assert.equal(row.budget_spent, 1);
});

test('a block the lane could not record still reaches the job, and logging it stops the source', async (context) => {
  const sourceId = await createTestSource(owner, context);
  await ensureLane(worker, sourceId);
  const lane = laneClientOn(failingOn(worker, 'stop_source'), sourceId);
  const blocked = new SourceBlockedError('403', {
    reason: 'blocked',
    status: 403,
    request: { url: 'https://test.example/list', startedAt: new Date(), durationMs: 5 },
  });
  await assert.rejects(
    lane.request(() => Promise.reject(blocked)),
    (error: unknown) => error === blocked,
  );
  assert.equal(
    (
      await owner
        .selectFrom('source')
        .select('crawl_state')
        .where('id', '=', sourceId)
        .executeTakeFirstOrThrow()
    ).crawl_state,
    'enabled',
  );
  // What the crawl step then does with the refusal: its fetch_log row stops the source through the trigger.
  const opened = await openCrawlRun(worker, sourceId, 'sweep');
  assert.equal(opened.status, 'opened');
  const startedAt = blocked.request?.startedAt ?? new Date();
  await logFetch(worker, {
    sourceId,
    runId: opened.runId,
    url: 'https://test.example/list',
    method: 'http_get',
    requestedAt: startedAt,
    durationMs: 5,
    httpStatus: 403,
    outcome: 'blocked',
  });
  const source = await owner
    .selectFrom('source')
    .select(['crawl_state', 'stop_reason'])
    .where('id', '=', sourceId)
    .executeTakeFirstOrThrow();
  assert.deepEqual([source.crawl_state, source.stop_reason], ['stopped_on_block', 'blocked']);
  const run = await owner
    .selectFrom('crawl_run')
    .select('status')
    .where('id', '=', opened.runId)
    .executeTakeFirstOrThrow();
  assert.equal(run.status, 'stopped_on_block');
});

test('a run whose succeed() was rolled back is still closed when its step returns', async (context) => {
  const stub = await startStubSource([{ status: 200, body: '{}' }]);
  context.after(() => stub.close());
  const sourceId = await createTestSource(owner, context);
  const job = defineLaneJob({
    name: 'crawl.test-rolled-back',
    payload: z.strictObject({ sourceId: z.string() }),
    source: (payload) => payload.sourceId,
    async run(_payload, jobContext) {
      await crawlStep(jobContext, 'check', async (run) => {
        const answer = await run.fetch(`${stub.url}/page`, { method: 'GET' });
        try {
          await jobContext.db.transaction().execute(async (trx) => {
            await run.logAnswer(trx, answer, 'ok');
            await run.succeed(trx);
            throw new Error('rolled back after succeed()');
          });
        } catch {
          // The step handles its own failure and returns: nothing it wrote in that transaction was kept.
        }
      });
    },
  });
  const testWorker = await startTestWorker([job]);
  context.after(() => testWorker.stop());
  await until('the lane is open', () =>
    testWorker.runtime.lanes().some((lane) => lane.sourceId === sourceId && lane.state === 'running'),
  );
  await testWorker.runtime.enqueue(job, { sourceId });
  await until('the run is closed', async () => {
    const runs = await owner
      .selectFrom('crawl_run')
      .select('status')
      .where('source_id', '=', sourceId)
      .execute();
    return runs.length === 1 && runs[0]?.status !== 'running';
  });
  const [run] = await owner
    .selectFrom('crawl_run')
    .select('status')
    .where('source_id', '=', sourceId)
    .execute();
  assert.equal(run?.status, 'succeeded');
  // The request is logged all the same, once.
  const fetches = await owner
    .selectFrom('fetch_log')
    .select('outcome')
    .where('source_id', '=', sourceId)
    .execute();
  assert.deepEqual(
    fetches.map((fetch) => fetch.outcome),
    ['ok'],
  );
});
