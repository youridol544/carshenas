import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { after, before, test, type TestContext } from 'node:test';
import type { Kysely } from 'kysely';
import * as z from 'zod';
import type { DB } from '@carshenas/db/db-types';
import { createErrorCapture } from '@carshenas/observability/capture';
import { createTestSource, jobsOf, openScratchDatabase, setCrawlState } from '../db/test-database.ts';
import { env } from '../env.ts';
import { startTestWorker, testLogger, type TestWorker } from '../test-support/runtime.ts';
import { until } from '../test-support/wait.ts';
import { createBoss } from './boss.ts';
import { defineLaneJob, type JobDefinition } from './job.ts';
import { laneQueue } from './queues.ts';

// Lanes on the real queue (ADR-0018 point 2; CS-32 criterion 3): one job of a source at a time whichever process
// claims it, sources side by side, a source's kinds in priority order, and a lane that claims nothing while its
// source cannot run.

type Run = { source: string; worker: string; kind: string; n: number; start: number; end: number };

let owner: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
});

after(async () => {
  await owner.destroy();
});

/** Workers that stop when the test ends: a worker left running would take the next test's lanes too. */
async function workersFor(
  context: TestContext,
  ...registries: (readonly JobDefinition[])[]
): Promise<TestWorker[]> {
  const started = await Promise.all(registries.map((jobs) => startTestWorker(jobs)));
  context.after(() => Promise.all(started.map((worker) => worker.stop())));
  return started;
}

const payload = z.object({ sourceId: z.string(), n: z.int(), holdMs: z.int() });

/** A lane job that does nothing but hold its lane for a while, recording when and where it ran. */
function holdJobs(worker: string, runs: Run[]) {
  const make = (name: string, priority: number) =>
    defineLaneJob({
      name,
      priority,
      payload,
      source: (job) => job.sourceId,
      async run(job) {
        const start = performance.now();
        await sleep(job.holdMs);
        runs.push({ source: job.sourceId, worker, kind: name, n: job.n, start, end: performance.now() });
      },
    });
  return [make('crawl.test-hold', 0), make('crawl.test-urgent', 10)] as const;
}

function overlaps(a: Run, b: Run): boolean {
  return a.start < b.end && b.start < a.end;
}

test('two worker processes never run two jobs of one source at once, and two sources run side by side', async (context) => {
  const runs: Run[] = [];
  const [holdOne] = holdJobs('one', runs);
  const [holdTwo] = holdJobs('two', runs);
  const [one, two] = await workersFor(context, holdJobs('one', runs), holdJobs('two', runs));
  assert.ok(one && two);
  const sourceA = await createTestSource(owner, context);
  const sourceB = await createTestSource(owner, context);
  await until('both workers have both lanes open', () =>
    [one, two].every((worker) =>
      [sourceA, sourceB].every((source) =>
        worker.runtime.lanes().some((lane) => lane.sourceId === source && lane.state === 'running'),
      ),
    ),
  );
  for (let n = 0; n < 12; n++) {
    await one.runtime.enqueue(holdOne, { sourceId: sourceA, n, holdMs: 80 + ((n * 37) % 70) });
    await two.runtime.enqueue(holdTwo, { sourceId: sourceB, n, holdMs: 80 + ((n * 53) % 70) });
  }
  await until('every job has run', () => runs.length === 24, 30_000);

  for (const source of [sourceA, sourceB]) {
    const lane = runs.filter((run) => run.source === source).sort((x, y) => x.start - y.start);
    assert.equal(lane.length, 12);
    for (let i = 1; i < lane.length; i++) {
      const [previous, current] = [lane[i - 1], lane[i]];
      assert.ok(previous && current);
      assert.ok(!overlaps(previous, current), `${source}: jobs ${previous.n} and ${current.n} overlapped`);
    }
  }
  const sideBySide = runs.some(
    (a) => a.source === sourceA && runs.some((b) => b.source === sourceB && overlaps(a, b)),
  );
  assert.ok(sideBySide, 'the two sources never ran at the same time');
  // Nothing claimed was lost or spent: every job completed on its first attempt.
  for (const source of [sourceA, sourceB]) {
    const jobs = await jobsOf(owner, laneQueue(source));
    assert.deepEqual(new Set(jobs.map((job) => `${job.state}:${job.retryCount}`)), new Set(['completed:0']));
  }
});

test('a lane runs the kinds of its source in priority order', async (context) => {
  const runs: Run[] = [];
  const [worker] = await workersFor(context, holdJobs('solo', runs));
  assert.ok(worker);
  const [hold, urgent] = holdJobs('solo', runs);
  // Paused, so every job is queued before the lane can take the first.
  const source = await createTestSource(owner, context, { crawlState: 'paused' });
  for (let n = 0; n < 4; n++) await worker.runtime.enqueue(hold, { sourceId: source, n, holdMs: 10 });
  for (let n = 0; n < 4; n++) await worker.runtime.enqueue(urgent, { sourceId: source, n, holdMs: 10 });
  await setCrawlState(owner, source, 'enabled');
  await until('the lane has drained', () => runs.length === 8);
  assert.deepEqual(
    runs.map((run) => run.kind),
    [...Array<string>(4).fill('crawl.test-urgent'), ...Array<string>(4).fill('crawl.test-hold')],
  );
});

test('a paused source claims nothing, its queued jobs keep their attempts, and resuming it drains them', async (context) => {
  const runs: Run[] = [];
  const [worker] = await workersFor(context, holdJobs('solo', runs));
  assert.ok(worker);
  const [hold] = holdJobs('solo', runs);
  const source = await createTestSource(owner, context, { crawlState: 'paused' });
  await until('the lane is known and closed', () =>
    worker.runtime.lanes().some((lane) => lane.sourceId === source && lane.closure === 'paused'),
  );
  for (let n = 0; n < 3; n++) await worker.runtime.enqueue(hold, { sourceId: source, n, holdMs: 10 });
  // Several polls and lane checks go by.
  await sleep(1_500);
  assert.equal(runs.length, 0);
  assert.deepEqual(
    (await jobsOf(owner, laneQueue(source))).map((job) => [job.state, job.retryCount]),
    [
      ['created', 0],
      ['created', 0],
      ['created', 0],
    ],
  );
  await setCrawlState(owner, source, 'enabled');
  await until('the queued jobs have run', () => runs.length === 3);
  await setCrawlState(owner, source, 'paused');
  await until('the lane is closed again', () =>
    worker.runtime.lanes().some((lane) => lane.sourceId === source && lane.state === 'paused'),
  );
});

test('while a job of a lane runs, another process asking that lane for work gets nothing', async (context) => {
  const runs: Run[] = [];
  const [worker] = await workersFor(context, holdJobs('one', runs));
  assert.ok(worker);
  const [hold] = holdJobs('one', runs);
  // A second process with no lanes of its own, which only asks.
  const other = createBoss({
    connectionString: env.databaseUrl,
    logger: testLogger(),
    errors: createErrorCapture(testLogger()),
  });
  await other.start();
  context.after(() => other.stop({ graceful: false }));
  const source = await createTestSource(owner, context);
  await until('the lane is open', () =>
    worker.runtime.lanes().some((lane) => lane.sourceId === source && lane.state === 'running'),
  );
  await worker.runtime.enqueue(hold, { sourceId: source, n: 1, holdMs: 2_000 });
  await worker.runtime.enqueue(hold, { sourceId: source, n: 2, holdMs: 10 });
  await until('the first job is running', async () =>
    (await jobsOf(owner, laneQueue(source))).some((job) => job.state === 'active'),
  );
  // Five claims at once from the other process: the lane's unique index refuses every one.
  const claims = await Promise.all(Array.from({ length: 5 }, () => other.fetch(laneQueue(source))));
  assert.deepEqual(
    claims.map((claimed) => claimed.length),
    [0, 0, 0, 0, 0],
  );
  assert.deepEqual(
    (await jobsOf(owner, laneQueue(source))).map((job) => job.state),
    ['active', 'created'],
  );
  await until('both jobs have run, one after the other', () => runs.length === 2);
  const [first, second] = runs;
  assert.ok(first && second && !overlaps(first, second));
});
