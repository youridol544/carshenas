import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LaneState } from '../db/lane-store.ts';
import { SourceBlockedError, SourceThrottledError, SourceUnavailableError } from './errors.ts';
import { outcomeOf, turnOf } from './lane-client.ts';
import { PACING } from './pacing.ts';

const NOW = new Date('2026-09-29T08:00:00Z');
const at = (ms: number) => new Date(NOW.getTime() + ms);

function state(overrides: Partial<LaneState> = {}): LaneState {
  return {
    sourceId: 'divar',
    crawlState: 'enabled',
    minIntervalMs: 3_000,
    nextRequestAt: NOW,
    cooldownUntil: null,
    cooldownReason: null,
    leaseHolder: null,
    leaseUntil: null,
    rateLimitedAt: null,
    failureStreak: 0,
    cooldowns: 0,
    now: NOW,
    ...overrides,
  };
}

test('a lane whose source is stopped or paused cannot send, however soon its turn', () => {
  assert.deepEqual(turnOf(state({ crawlState: 'stopped_on_block' }), PACING), { closure: 'stopped' });
  assert.deepEqual(turnOf(state({ crawlState: 'paused' }), PACING), { closure: 'paused' });
});

test('a cooling lane closes until its cool-down ends', () => {
  assert.deepEqual(turnOf(state({ cooldownUntil: at(90_000), cooldownReason: 'unavailable' }), PACING), {
    closure: 'cooling_down',
    until: at(90_000),
  });
});

test('a turn at most one gap away is waited for; a later one sends the job back', () => {
  assert.deepEqual(turnOf(state({ nextRequestAt: at(2_500) }), PACING), { wait: 2_500 });
  assert.deepEqual(turnOf(state({ leaseHolder: 'other', leaseUntil: at(4_000) }), PACING), { wait: 4_000 });
  assert.deepEqual(turnOf(state({ nextRequestAt: at(PACING.maxWaitInJobMs + 1) }), PACING), {
    closure: 'waiting',
    until: at(PACING.maxWaitInJobMs + 1),
  });
});

test('only the three source errors say anything about the source', () => {
  assert.deepEqual(outcomeOf(new SourceBlockedError('403', { reason: 'challenge' })), {
    kind: 'blocked',
    reason: 'challenge',
  });
  assert.deepEqual(outcomeOf(new SourceThrottledError('429', { retryAfterMs: 5_000 })), {
    kind: 'throttled',
    retryAfterMs: 5_000,
  });
  assert.deepEqual(outcomeOf(new SourceUnavailableError('503')), {
    kind: 'unavailable',
    retryAfterMs: undefined,
  });
  assert.deepEqual(outcomeOf(new SyntaxError('Unexpected token < in JSON')), { kind: 'answered' });
});
