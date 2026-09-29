import assert from 'node:assert/strict';
import { test } from 'node:test';
import { failureOfStatus, ModelCallError } from './errors.ts';
import { forbidNetwork } from './test-support/network.ts';

// What a status from Metis means for the queue: retry later, or wait for a person (ADR-0019 point 4).

forbidNetwork();

test('each status is a failure the queue retries, or one that waits for a person', () => {
  const cases = [
    [200, 'unavailable', true],
    [408, 'timeout', true],
    [429, 'rate_limited', true],
    [500, 'unavailable', true],
    [502, 'unavailable', true],
    [401, 'unauthorized', false],
    [403, 'unauthorized', false],
    [402, 'no_credit', false],
    [400, 'rejected', false],
    [404, 'rejected', false],
    [422, 'rejected', false],
  ] as const;
  for (const [status, reason, retryable] of cases) {
    const error = new ModelCallError(failureOfStatus(status), { status, cause: undefined });
    assert.deepEqual([error.reason, error.retryable], [reason, retryable], `status ${status}`);
  }
});
