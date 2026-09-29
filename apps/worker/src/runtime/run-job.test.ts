import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import * as z from 'zod';
import { createErrorCapture } from '@carshenas/observability/capture';
import { createLogger } from '@carshenas/observability/logger';
import { registerTracing } from '@carshenas/observability/tracing';
import { createWorkerDatabase } from '../db/database.ts';
import { LaneClosedError, PermanentJobError, SourceBlockedError, SourceUnavailableError } from './errors.ts';
import { defineJob, defineLaneJob, type JobDefinition } from './job.ts';
import { runAttempt, type Attempt, type AttemptDeps } from './run-job.ts';

// One attempt, end to end but without a queue: what it logs (one line, with the job's fields and trace id) and how
// it tells pg-boss to settle it. The queue-backed behaviour is in the *.db.test.ts files.

registerTracing({ service: 'carshenas-worker', version: 'test', environment: 'test' });

type Line = Record<string, unknown> & { level: string; msg: string };
const lines: Line[] = [];
const logger = createLogger({
  service: 'carshenas-worker',
  version: 'test',
  environment: 'test',
  level: 'trace',
  destination: {
    write(line: string) {
      lines.push(JSON.parse(line) as Line);
    },
  },
});
const errors = createErrorCapture(logger);
// Never connected: these attempts do not touch the database.
const db = createWorkerDatabase(
  { connectionString: 'postgres://nobody@127.0.0.1:1/none', logSql: false, logParameters: false },
  logger,
  errors,
);

const parse = defineJob({
  name: 'listing.parse',
  payload: z.object({ listingId: z.int() }),
  async run(payload, context) {
    context.count('fields', 12);
    if (payload.listingId === 0) throw new TypeError('snapshot.price is undefined');
    if (payload.listingId === -1) throw new PermanentJobError('the listing has no snapshot');
    if (payload.listingId === 7) await context.enqueue(parse, { listingId: 8 });
    await Promise.resolve();
  },
});

const read = defineLaneJob({
  name: 'crawl.read-listing',
  payload: z.object({ sourceId: z.string(), outcome: z.enum(['ok', 'closed', 'blocked', 'unavailable']) }),
  source: (payload) => payload.sourceId,
  async run(payload, context) {
    await Promise.resolve();
    context.count('requests');
    if (payload.outcome === 'closed') {
      throw new LaneClosedError('the lane is cooling down', {
        closure: 'cooling_down',
        until: new Date('2026-09-29T09:00:00Z'),
      });
    }
    if (payload.outcome === 'blocked')
      throw new SourceBlockedError('the source answered 403', { reason: 'blocked', status: 403 });
    if (payload.outcome === 'unavailable')
      throw new SourceUnavailableError('the source answered 503', { status: 503 });
  },
});

const enqueued: unknown[] = [];
const putBacks: { startAfter: Date | undefined; putBacks: number | undefined }[] = [];

function deps(overrides: Partial<AttemptDeps> = {}): AttemptDeps {
  return {
    registry: new Map<string, JobDefinition>([
      [parse.name, parse],
      [read.name, read],
    ]),
    db,
    logger,
    errors,
    maxPutBacks: 25,
    unknownKindDelayMs: 60_000,
    enqueue: (job, payload, _options, parent) => {
      enqueued.push({ job: job.name, payload, parent });
      return Promise.resolve('child-job');
    },
    putBack: (_attempt, envelope, _definition, startAfter) => {
      putBacks.push({ startAfter, putBacks: envelope.meta.putBacks });
      return Promise.resolve('next-job');
    },
    lane: () => ({
      lane: {
        sourceId: 'stub',
        request: (send) => send({ signal: new AbortController().signal, startedAt: new Date() }),
      },
      fetch: () => Promise.reject(new Error('no requests in these tests')),
    }),
    ...overrides,
  };
}

function attempt(data: unknown, retryCount = 0): Attempt {
  return {
    id: 'job-1',
    queue: 'listing.parse',
    data,
    retryCount,
    retryLimit: 2,
    priority: 0,
    signal: new AbortController().signal,
  };
}

const envelope = (kind: string, payload: unknown, meta: Record<string, unknown> = {}) => ({
  kind,
  payload,
  meta,
});

beforeEach(() => {
  lines.length = 0;
  enqueued.length = 0;
  putBacks.length = 0;
});

test('a finished job writes one line with its counts, its fields and its trace id, and completes', async () => {
  const disposition = await runAttempt(attempt(envelope('listing.parse', { listingId: 3 })), deps());
  assert.deepEqual(disposition, { status: 'completed', output: { counts: { fields: 12 } } });
  assert.equal(lines.length, 1);
  const [line] = lines;
  assert.ok(line);
  assert.equal(line.msg, 'job completed');
  assert.equal(line.level, 'info');
  assert.deepEqual(line.counts, { fields: 12 });
  assert.equal(line.jobId, 'job-1');
  assert.equal(line.job, 'listing.parse');
  assert.equal(line.attempt, 1);
  assert.match(String(line.trace_id), /^[0-9a-f]{32}$/);
  assert.equal(typeof line.durationMs, 'number');
});

test('a follow-up job carries the job and trace it came from', async () => {
  await runAttempt(attempt(envelope('listing.parse', { listingId: 7 })), deps());
  assert.deepEqual(enqueued, [
    {
      job: 'listing.parse',
      payload: { listingId: 8 },
      parent: { jobId: 'job-1', traceId: lines[0]?.trace_id },
    },
  ]);
});

test('an unexpected error is logged once, with its stack and trace id, and the job fails so pg-boss retries it', async () => {
  const disposition = await runAttempt(attempt(envelope('listing.parse', { listingId: 0 })), deps());
  assert.equal(disposition.status, 'failed');
  assert.equal((disposition.output as { type: string }).type, 'TypeError');
  assert.equal(lines.length, 1);
  const [line] = lines;
  assert.ok(line);
  assert.equal(line.level, 'error');
  assert.equal(line.msg, 'job failed');
  assert.equal(line.willRetry, true);
  assert.equal(line.deadLettered, false);
  assert.match(String(line.trace_id), /^[0-9a-f]{32}$/);
  const err = line.err as { type: string; stack: string };
  assert.equal(err.type, 'TypeError');
  // The stack points at the TypeScript file, from the repository root (ADR-0016).
  assert.match(err.stack, /run-job\.test\.ts:\d+:\d+/);
});

test('on its last attempt the same failure says it goes to the dead-letter queue', async () => {
  await runAttempt(attempt(envelope('listing.parse', { listingId: 0 }), 2), deps());
  const [line] = lines;
  assert.ok(line);
  assert.equal(line.willRetry, false);
  assert.equal(line.deadLettered, true);
  assert.equal(line.attempt, 3);
});

test('a failure retrying cannot fix is dead-lettered at once', async () => {
  const disposition = await runAttempt(attempt(envelope('listing.parse', { listingId: -1 })), deps());
  assert.equal(disposition.status, 'deadletter');
  assert.deepEqual(
    lines.map((line) => [line.level, line.msg]),
    [['error', 'job dead-lettered']],
  );
});

test('data that is not a job, or a bad payload, is dead-lettered without running', async () => {
  for (const data of [{ listingId: 1 }, envelope('listing.parse', { listingId: 'x' })]) {
    lines.length = 0;
    const disposition = await runAttempt(attempt(data), deps());
    assert.equal(disposition.status, 'deadletter');
    assert.deepEqual(
      lines.map((line) => [line.level, line.msg]),
      [['error', 'job dead-lettered']],
    );
  }
});

test('a kind this worker does not know goes back for a worker that knows it, and is dead-lettered only after many tries', async () => {
  const disposition = await runAttempt(attempt(envelope('listing.renamed', {})), deps());
  assert.equal(disposition.status, 'completed');
  assert.equal(putBacks.length, 1);
  const [putBack] = putBacks;
  assert.ok(putBack?.startAfter && putBack.startAfter.getTime() > Date.now() + 50_000);
  assert.deepEqual(
    lines.map((line) => [line.level, line.msg, line.job]),
    [['warn', 'job of an unknown kind put back', 'listing.renamed']],
  );
  lines.length = 0;
  const tooOften = await runAttempt(attempt(envelope('listing.renamed', {}, { putBacks: 25 })), deps());
  assert.equal(tooOften.status, 'deadletter');
});

test('a lane that cannot send puts the job back unblamed, to come back when the lane expects to send', async () => {
  const disposition = await runAttempt(
    attempt(envelope('crawl.read-listing', { sourceId: 'divar', outcome: 'closed' }, { putBacks: 2 })),
    deps(),
  );
  assert.equal(disposition.status, 'completed');
  assert.deepEqual(putBacks, [{ startAfter: new Date('2026-09-29T09:00:00Z'), putBacks: 2 }]);
  assert.deepEqual(
    lines.map((line) => [line.level, line.msg, line.reason, line.nextJobId, line.source]),
    [['info', 'job put back', 'cooling_down', 'next-job', 'divar']],
  );
});

test('a source that refuses the request puts the job back too; the lane has stopped the source', async () => {
  const disposition = await runAttempt(
    attempt(envelope('crawl.read-listing', { sourceId: 'divar', outcome: 'blocked' })),
    deps(),
  );
  assert.equal(disposition.status, 'completed');
  assert.equal(putBacks.length, 1);
  assert.equal(lines[0]?.reason, 'SourceBlockedError');
});

test('a job put back too often fails instead, so nothing circles the queue forever', async () => {
  const disposition = await runAttempt(
    attempt(envelope('crawl.read-listing', { sourceId: 'divar', outcome: 'closed' }, { putBacks: 25 })),
    deps(),
  );
  assert.equal(disposition.status, 'failed');
  assert.equal(putBacks.length, 0);
  assert.equal(lines[0]?.msg, 'job failed');
});

test('a struggling source spends the attempt, with a warning rather than an error', async () => {
  const disposition = await runAttempt(
    attempt(envelope('crawl.read-listing', { sourceId: 'divar', outcome: 'unavailable' })),
    deps(),
  );
  assert.equal(disposition.status, 'failed');
  assert.deepEqual(
    lines.map((line) => [line.level, line.msg, line.reason]),
    [['warn', 'job failed', 'source unavailable']],
  );
});
