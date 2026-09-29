import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as z from 'zod';
import { defineLaneJob } from './job.ts';
import { DEAD_LETTER_QUEUE, putBackOptions, sendOptions } from './queues.ts';

const read = defineLaneJob({
  name: 'crawl.read-listing',
  priority: 30,
  payload: z.object({ sourceId: z.string() }),
  retry: { limit: 3, delaySeconds: 60, maxDelaySeconds: 3_600 },
  source: (payload) => payload.sourceId,
  run: () => Promise.resolve(),
});

test('a job sent back keeps its priority and only the retries it had left', () => {
  const options = putBackOptions(read, { priority: 30, retryCount: 2 });
  assert.equal(options.priority, 30);
  assert.equal(options.retryLimit, 1);
  assert.equal(putBackOptions(read, { priority: 30, retryCount: 5 }).retryLimit, 0);
  assert.equal(putBackOptions(read, { priority: 30, retryCount: 0 }).retryLimit, 3);
});

test("every send carries its kind's full options, and never a singletonKey", () => {
  const options = sendOptions(read);
  assert.equal(options.retryBackoff, true);
  assert.equal(options.deadLetter, DEAD_LETTER_QUEUE);
  assert.equal(options.heartbeatSeconds, 30);
  assert.equal(options.retentionSeconds, 30 * 86_400);
  assert.equal('singletonKey' in options, false);
});

test("a kind this worker does not know goes back with its queue's defaults", () => {
  assert.deepEqual(putBackOptions(undefined, { priority: 5, retryCount: 1 }), {
    priority: 5,
    deadLetter: DEAD_LETTER_QUEUE,
  });
});
