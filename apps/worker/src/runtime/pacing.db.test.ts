import assert from 'node:assert/strict';
import { after, before, test, type TestContext } from 'node:test';
import type { Kysely } from 'kysely';
import * as z from 'zod';
import type { DB } from '@carshenas/db/db-types';
import { acquireLane, ensureLane, releaseLane } from '../db/lane-store.ts';
import { createTestSource, jobsOf, openScratchDatabase } from '../db/test-database.ts';
import {
  startTestWorker,
  testLogger,
  testWorkerDatabase,
  TEST_USER_AGENT,
  type TestWorker,
} from '../test-support/runtime.ts';
import { startStubSource, type StubAnswer, type StubSource } from '../test-support/stub-source.ts';
import { until } from '../test-support/wait.ts';
import { LaneClosedError, type LaneClosure } from './errors.ts';
import { createSourceFetch } from './http.ts';
import { defineLaneJob, type JobDefinition } from './job.ts';
import { createLaneClient } from './lane-client.ts';
import { PACING, type PacingPolicy } from './pacing.ts';
import { laneQueue } from './queues.ts';

// Pacing on the real database, against a local stub source (ADR-0018 points 3 to 6; CS-32 criteria 7 to 10). The
// gap is the source's real floor, 3 seconds, so these tests take a while; only the cool-downs are shortened.

let owner: Kysely<DB>;
// The worker's own pool, for the tests that take leases directly; no runtime, which would claim other tests' jobs.
let worker: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
  worker = testWorkerDatabase();
});

after(async () => {
  await worker.destroy();
  await owner.destroy();
});

async function stubFor(context: TestContext, script: readonly StubAnswer[]): Promise<StubSource> {
  const stub = await startStubSource(script);
  context.after(() => stub.close());
  return stub;
}

async function laneRow(sourceId: string) {
  return owner
    .selectFrom('crawl_lane')
    .selectAll()
    .where('source_id', '=', sourceId)
    .executeTakeFirstOrThrow();
}

async function sourceRow(sourceId: string) {
  return owner
    .selectFrom('source')
    .select(['crawl_state', 'stop_reason', 'stopped_at'])
    .where('id', '=', sourceId)
    .executeTakeFirstOrThrow();
}

/** A lane client as a job gets it, for requests sent straight from the test. */
function laneClient(sourceId: string, holder: string, closures: LaneClosure[] = []) {
  const lane = createLaneClient({
    sourceId,
    holder,
    db: worker,
    policy: PACING,
    requestTimeoutMs: 5_000,
    signal: new AbortController().signal,
    log: testLogger(),
    onClosed: (closure) => closures.push(closure),
  });
  return { lane, fetch: createSourceFetch(lane, () => TEST_USER_AGENT) };
}

test('the lease is taken by one worker at a time, and the next request waits its gap from the end of this one', async (context) => {
  const sourceId = await createTestSource(owner, context);
  await ensureLane(worker, sourceId);
  const first = await acquireLane(worker, sourceId, 'one', 10_000);
  assert.equal(first?.acquired, true);
  const second = await acquireLane(worker, sourceId, 'two', 10_000);
  assert.ok(second);
  assert.equal(second.acquired, false);
  assert.equal(second.state.leaseHolder, 'one');
  const released = await releaseLane(worker, sourceId, 'one', {
    gapMs: 3_000,
    failureStreak: 0,
    cooldowns: 0,
    cooldown: null,
    throttled: false,
    stop: null,
  });
  assert.ok(released);
  const third = await acquireLane(worker, sourceId, 'two', 10_000);
  assert.ok(third);
  assert.equal(third.acquired, false);
  const waitMs = third.state.nextRequestAt.getTime() - third.state.now.getTime();
  assert.ok(waitMs > 2_900 && waitMs <= 3_000, `waits ${waitMs} ms`);
  // Only the holder can give a lease back.
  const stranger = await releaseLane(worker, sourceId, 'three', {
    gapMs: 0,
    failureStreak: 0,
    cooldowns: 0,
    cooldown: null,
    throttled: false,
    stop: null,
  });
  assert.equal(stranger, undefined);
});

test('two processes sending to one source take turns: one request at a time, each at least the interval after the last ended, longer after a slow answer', async (context) => {
  const stub = await stubFor(context, [
    { status: 200 },
    { status: 200, delayMs: 800 },
    { status: 200 },
    { status: 200 },
  ]);
  const sourceId = await createTestSource(owner, context);
  await ensureLane(worker, sourceId);
  const one = laneClient(sourceId, 'process-one');
  const two = laneClient(sourceId, 'process-two');
  await Promise.all([
    (async () => {
      await one.fetch(`${stub.url}/a`);
      await one.fetch(`${stub.url}/b`);
    })(),
    (async () => {
      await two.fetch(`${stub.url}/c`);
      await two.fetch(`${stub.url}/d`);
    })(),
  ]);
  const requests = [...stub.requests].sort((x, y) => x.receivedAt - y.receivedAt);
  assert.equal(requests.length, 4);
  for (let i = 1; i < requests.length; i++) {
    const [previous, current] = [requests[i - 1], requests[i]];
    assert.ok(previous?.answeredAt !== undefined && current);
    const gap = current.receivedAt - previous.answeredAt;
    // The second answer took 800 ms: five times that is the next gap.
    const expected = i === 2 ? 4_000 : 3_000;
    assert.ok(gap >= expected - 10, `request ${i + 1} came ${Math.round(gap)} ms after the previous answer`);
  }
});

test('nothing is sent while the source is paused', async (context) => {
  const stub = await stubFor(context, [{ status: 200 }]);
  const sourceId = await createTestSource(owner, context, { crawlState: 'paused' });
  await ensureLane(worker, sourceId);
  const closures: LaneClosure[] = [];
  const { fetch } = laneClient(sourceId, 'process-one', closures);
  await assert.rejects(
    fetch(stub.url),
    (error: unknown) => error instanceof LaneClosedError && error.closure === 'paused',
  );
  assert.deepEqual(closures, ['paused']);
  assert.equal(stub.requests.length, 0);
});

type Answered = {
  readonly sourceId: string;
  readonly url: string;
  readonly status: number;
  readonly at: number;
};

/** A lane job that sends one request to the URL in its payload and records what came of it. */
function fetchJob(answered: Answered[]): JobDefinition {
  return defineLaneJob({
    name: 'crawl.test-fetch',
    payload: z.object({ sourceId: z.string(), url: z.string() }),
    source: (job) => job.sourceId,
    // A failed attempt comes back only after the test is over.
    retry: { limit: 3, delaySeconds: 600, maxDelaySeconds: 600 },
    async run(job, context) {
      const answer = await context.fetch(job.url);
      answered.push({ sourceId: job.sourceId, url: job.url, status: answer.status, at: Date.now() });
    },
  });
}

async function workerWith(
  context: TestContext,
  jobs: readonly JobDefinition[],
  policy: Partial<PacingPolicy> = {},
) {
  const started = await startTestWorker(jobs, policy);
  context.after(() => started.stop());
  return started;
}

function laneIs(runner: TestWorker, sourceId: string, closure: LaneClosure | 'running'): boolean {
  return runner.runtime
    .lanes()
    .some(
      (lane) =>
        lane.sourceId === sourceId &&
        (closure === 'running' ? lane.state === 'running' : lane.closure === closure),
    );
}

test('a first 429 cools the lane down and doubles its gap, other sources go on, and a second 429 within the day stops the source', async (context) => {
  const stub = await stubFor(context, [
    { status: 429, headers: { 'retry-after': '1' } },
    { status: 200 },
    { status: 429 },
  ]);
  const other = await stubFor(context, [{ status: 200 }]);
  const answered: Answered[] = [];
  const job = fetchJob(answered);
  const runner = await workerWith(context, [job]);
  const sourceId = await createTestSource(owner, context);
  const otherSource = await createTestSource(owner, context);
  await until(
    'both lanes are open',
    () => laneIs(runner, sourceId, 'running') && laneIs(runner, otherSource, 'running'),
  );

  await runner.runtime.enqueue(job, { sourceId, url: `${stub.url}/first` });
  await until(
    'the 429 has cooled the lane down',
    async () => (await laneRow(sourceId)).cooldown_reason === 'rate_limited',
  );
  const cooling = await laneRow(sourceId);
  assert.ok(cooling.rate_limited_at && cooling.cooldown_until);
  // Its Retry-After of one second is shorter than the doubled gap, so the lane rests one doubled gap.
  const restMs = cooling.cooldown_until.getTime() - cooling.rate_limited_at.getTime();
  assert.ok(restMs >= 5_900 && restMs <= 6_100, `rests ${restMs} ms`);
  await until('the lane has stopped claiming', () => laneIs(runner, sourceId, 'cooling_down'));
  // The job that met the 429 went back to the queue without spending an attempt. The lane closes first, as the
  // request is recorded; the job is put back after, in its own transaction.
  await until(
    'the job has been put back',
    async () => (await jobsOf(owner, laneQueue(sourceId))).length === 2,
  );
  const [met, again] = await jobsOf(owner, laneQueue(sourceId));
  assert.deepEqual([met?.state, again?.state, again?.retryCount], ['completed', 'created', 0]);

  await runner.runtime.enqueue(job, { sourceId: otherSource, url: `${other.url}/meanwhile` });
  await until('the other source has answered', () =>
    answered.some((answer) => answer.sourceId === otherSource),
  );
  const meanwhile = answered.find((answer) => answer.sourceId === otherSource);
  assert.ok(
    meanwhile && meanwhile.at < cooling.cooldown_until.getTime(),
    'the other source waited for this one',
  );

  await until(
    'the job put back has run after the rest',
    () => answered.some((answer) => answer.sourceId === sourceId),
    20_000,
  );
  await runner.runtime.enqueue(job, { sourceId, url: `${stub.url}/third` });
  await until(
    'the second 429 has stopped the source',
    async () => (await sourceRow(sourceId)).crawl_state === 'stopped_on_block',
    20_000,
  );
  assert.equal((await sourceRow(sourceId)).stop_reason, 'rate_limited');
  await until('the lane is closed until a person resumes it', () => laneIs(runner, sourceId, 'stopped'));
  // For the day after the first 429 the gap is doubled: six seconds from the second answer to the third request.
  const [, second, third] = stub.requests;
  assert.ok(second?.answeredAt !== undefined && third);
  const gap = third.receivedAt - second.answeredAt;
  assert.ok(gap >= 5_990, `the third request came ${Math.round(gap)} ms after the second answer`);
});

test('a 403 stops the source at once; its queued jobs keep their attempts', async (context) => {
  const stub = await stubFor(context, [{ status: 403 }]);
  const answered: Answered[] = [];
  const job = fetchJob(answered);
  const runner = await workerWith(context, [job]);
  const sourceId = await createTestSource(owner, context, { crawlState: 'paused' });
  // Queued before the lane opens, so the first job meets the 403 with two more waiting behind it.
  for (const n of [1, 2, 3]) await runner.runtime.enqueue(job, { sourceId, url: `${stub.url}/${n}` });
  await owner.updateTable('source').set({ crawl_state: 'enabled' }).where('id', '=', sourceId).execute();
  await until(
    'the source has stopped',
    async () => (await sourceRow(sourceId)).crawl_state === 'stopped_on_block',
  );
  const stopped = await sourceRow(sourceId);
  assert.equal(stopped.stop_reason, 'blocked');
  await until('the lane has closed', () => laneIs(runner, sourceId, 'stopped'));
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  assert.equal(stub.requests.length, 1, 'nothing more was sent after the 403');
  const jobs = await jobsOf(owner, laneQueue(sourceId));
  assert.deepEqual(
    jobs.map((queued) => [queued.state, queued.retryCount]),
    [
      ['completed', 0],
      ['created', 0],
      ['created', 0],
      ['created', 0],
    ],
  );
  // The stop's evidence is the start of the blocked request.
  const lane = await laneRow(sourceId);
  assert.equal(stopped.stopped_at?.getTime(), lane.last_request_at?.getTime());
});

test('three failures in a row cool the lane down while other sources go on; the probe after it closes the breaker', async (context) => {
  const stub = await stubFor(context, [{ status: 503 }, { status: 502 }, { status: 504 }, { status: 200 }]);
  const other = await stubFor(context, [{ status: 200 }]);
  const answered: Answered[] = [];
  const job = fetchJob(answered);
  // A shorter first cool-down for the test: two to four seconds instead of half a minute to a minute.
  const runner = await workerWith(context, [job], { cooldownBaseMs: 4_000 });
  const sourceId = await createTestSource(owner, context);
  const otherSource = await createTestSource(owner, context);
  await until(
    'both lanes are open',
    () => laneIs(runner, sourceId, 'running') && laneIs(runner, otherSource, 'running'),
  );
  for (const n of [1, 2, 3]) await runner.runtime.enqueue(job, { sourceId, url: `${stub.url}/${n}` });
  await until(
    'the breaker has opened',
    async () => (await laneRow(sourceId)).cooldown_reason === 'unavailable',
    20_000,
  );
  const open = await laneRow(sourceId);
  assert.ok(open.cooldown_until);
  assert.deepEqual([open.failure_streak, open.cooldowns], [3, 1]);
  await until('the lane has stopped claiming', () => laneIs(runner, sourceId, 'cooling_down'));
  // Meanwhile another source's lane keeps working.
  await runner.runtime.enqueue(job, { sourceId: otherSource, url: `${other.url}/meanwhile` });
  await until('the other source has answered', () =>
    answered.some((answer) => answer.sourceId === otherSource),
  );
  const meanwhile = answered.find((answer) => answer.sourceId === otherSource);
  assert.ok(
    meanwhile && meanwhile.at < open.cooldown_until.getTime(),
    'the other source waited for this one',
  );
  // The three failed requests spent their attempts and wait for their retry (pg-boss counts a retry when it claims
  // the job again, so retry_count is still 0).
  await until('the third failure has been settled', async () =>
    (await jobsOf(owner, laneQueue(sourceId))).every((queued) => queued.state === 'retry'),
  );
  const failed = await jobsOf(owner, laneQueue(sourceId));
  assert.deepEqual(
    new Set(failed.map((queued) => `${queued.state}:${queued.retryCount}`)),
    new Set(['retry:0']),
  );
  await runner.runtime.enqueue(job, { sourceId, url: `${stub.url}/probe` });
  await until(
    'the probe has answered',
    () => answered.some((answer) => answer.sourceId === sourceId),
    20_000,
  );
  const closed = await laneRow(sourceId);
  assert.deepEqual([closed.failure_streak, closed.cooldowns, closed.cooldown_until], [0, 0, null]);
  assert.equal(stub.requests.length, 4);
});
