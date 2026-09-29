import assert from 'node:assert/strict';
import { after, before, test, type TestContext } from 'node:test';
import type { Kysely } from 'kysely';
import * as z from 'zod';
import type { DB } from '@carshenas/db/db-types';
import { jobsOf, openScratchDatabase } from '../db/test-database.ts';
import { startTestWorker } from '../test-support/runtime.ts';
import { until } from '../test-support/wait.ts';
import { PermanentJobError } from './errors.ts';
import { defineJob, type JobDefinition } from './job.ts';
import { DEAD_LETTER_QUEUE } from './queues.ts';
import { SCHEDULE_TIME_ZONE } from './runtime.ts';

// The queue's guarantees on the real database (CS-32 criteria 3 and 5): a follow-up job exists exactly when the
// rows it needs commit; a payload is checked before it is queued; a job's own failure is retried with backoff and
// then dead-lettered, never dropped; input that can never work is dead-lettered at once; schedules run in Tehran.

let owner: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
});

after(async () => {
  await owner.destroy();
});

/** A queue name of its own per test, so tests never share jobs. */
function uniqueName(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

async function workerWith(context: TestContext, jobs: readonly JobDefinition[]) {
  const started = await startTestWorker(jobs);
  context.after(() => started.stop());
  return started;
}

test('a job enqueued in a transaction exists exactly when the transaction commits', async (context) => {
  const job = defineJob({
    name: uniqueName('test.follow-up'),
    payload: z.object({ listingId: z.int() }),
    run: () => Promise.resolve(),
  });
  // Paused by never subscribing: the worker below knows no jobs, so nothing claims this queue.
  const worker = await workerWith(context, []);
  await assert.rejects(
    worker.db.transaction().execute(async (transaction) => {
      await worker.runtime.enqueue(job, { listingId: 1 }, { transaction });
      throw new Error('the rows it needed were not written');
    }),
    /were not written/,
  );
  assert.equal((await jobsOf(owner, job.name)).length, 0);
  await worker.db.transaction().execute(async (transaction) => {
    await worker.runtime.enqueue(job, { listingId: 2 }, { transaction });
  });
  const jobs = await jobsOf(owner, job.name);
  assert.equal(jobs.length, 1);
  assert.deepEqual(jobs[0]?.data, { kind: job.name, payload: { listingId: 2 }, meta: {} });
});

test('a payload that breaks its schema is refused before it reaches the queue', async (context) => {
  const job = defineJob({
    name: uniqueName('test.checked'),
    payload: z.object({ listingId: z.int().positive() }),
    run: () => Promise.resolve(),
  });
  const worker = await workerWith(context, []);
  await assert.rejects(worker.runtime.enqueue(job, { listingId: -1 }), z.ZodError);
  assert.equal((await jobsOf(owner, job.name)).length, 0);
});

test('a job that keeps failing is retried with backoff, then dead-lettered with its error, never dropped', async (context) => {
  let runs = 0;
  const job = defineJob({
    name: uniqueName('test.flaky'),
    payload: z.object({ n: z.int() }),
    retry: { limit: 1, delaySeconds: 1, maxDelaySeconds: 1 },
    run() {
      runs += 1;
      return Promise.reject(new TypeError('snapshot.price is undefined'));
    },
  });
  const worker = await workerWith(context, [job]);
  const id = await worker.runtime.enqueue(job, { n: 1 });
  await until(
    'the job is dead-lettered',
    async () =>
      // The dead-letter queue is shared: this test's entry is the one of its own kind.
      (await jobsOf(owner, DEAD_LETTER_QUEUE)).some(
        (dead) => (dead.data as { kind?: string }).kind === job.name && dead.id !== id,
      ),
    20_000,
  );
  assert.equal(runs, 2);
  const [original] = await jobsOf(owner, job.name);
  assert.ok(original);
  assert.equal(original.state, 'failed');
  assert.equal((original.output as { type?: string }).type, 'TypeError');
});

test('a job that can never work is dead-lettered on its first attempt', async (context) => {
  let runs = 0;
  const job = defineJob({
    name: uniqueName('test.hopeless'),
    payload: z.object({ n: z.int() }),
    retry: { limit: 5, delaySeconds: 1, maxDelaySeconds: 1 },
    run() {
      runs += 1;
      return Promise.reject(new PermanentJobError('the listing has no snapshot'));
    },
  });
  const worker = await workerWith(context, [job]);
  await worker.runtime.enqueue(job, { n: 7 });
  await until('the job has failed', async () => (await jobsOf(owner, job.name))[0]?.state === 'failed');
  assert.equal(runs, 1);
  const dead = (await jobsOf(owner, DEAD_LETTER_QUEUE)).filter(
    (candidate) => (candidate.data as { kind?: string }).kind === job.name,
  );
  assert.equal(dead.length, 1);
});

test('a follow-up job knows the job it came from', async (context) => {
  const child = defineJob({
    name: uniqueName('test.child'),
    payload: z.object({ n: z.int() }),
    run: () => Promise.resolve(),
  });
  const parent = defineJob({
    name: uniqueName('test.parent'),
    payload: z.object({ n: z.int() }),
    async run(payload, jobContext) {
      await jobContext.enqueue(child, { n: payload.n + 1 });
    },
  });
  const worker = await workerWith(context, [parent]);
  const parentId = await worker.runtime.enqueue(parent, { n: 1 });
  await until('the child is queued', async () => (await jobsOf(owner, child.name)).length === 1);
  const [queued] = await jobsOf(owner, child.name);
  const meta = (queued?.data as { meta: { parentJobId?: string; parentTraceId?: string } }).meta;
  assert.equal(meta.parentJobId, parentId);
  assert.match(meta.parentTraceId ?? '', /^[0-9a-f]{32}$/);
});

test('schedules are kept in Tehran time and removed when their job no longer declares them', async (context) => {
  const name = uniqueName('test.tick');
  const ticking = defineJob({
    name,
    payload: z.object({ scope: z.string() }),
    schedules: [{ key: 'quarter-hourly', cron: '*/15 * * * *', payload: { scope: 'tracked' } }],
    run: () => Promise.resolve(),
  });
  const first = await startTestWorker([ticking]);
  const schedules = await first.boss.getSchedules(name);
  await first.stop();
  assert.deepEqual(
    schedules.map((schedule) => [schedule.key, schedule.cron, schedule.timezone]),
    [[`${name}/quarter-hourly`, '*/15 * * * *', SCHEDULE_TIME_ZONE]],
  );
  const quiet = defineJob({ name, payload: ticking.payload, run: () => Promise.resolve() });
  const second = await workerWith(context, [quiet]);
  assert.deepEqual(await second.boss.getSchedules(name), []);
});
