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
    dailyBudget: 12_000,
    spentToday: 0,
    budgetResetsAt: new Date('2026-09-29T20:30:00Z'),
    now: NOW,
    ...overrides,
  };
}

test('a lane whose source is stopped or paused cannot send, however soon its turn', () => {
  assert.deepEqual(turnOf(state({ crawlState: 'stopped_on_block' }), PACING, 60), { closure: 'stopped' });
  assert.deepEqual(turnOf(state({ crawlState: 'paused' }), PACING, 60), { closure: 'paused' });
});

test('a cooling lane closes until its cool-down ends', () => {
  assert.deepEqual(turnOf(state({ cooldownUntil: at(90_000), cooldownReason: 'unavailable' }), PACING, 60), {
    closure: 'cooling_down',
    until: at(90_000),
  });
});

test('a turn at most one gap away is waited for; a later one sends the job back', () => {
  assert.deepEqual(turnOf(state({ nextRequestAt: at(2_500) }), PACING, 60), { wait: 2_500 });
  assert.deepEqual(turnOf(state({ leaseHolder: 'other', leaseUntil: at(4_000) }), PACING, 60), {
    wait: 4_000,
  });
  assert.deepEqual(turnOf(state({ nextRequestAt: at(PACING.maxWaitInJobMs + 1) }), PACING, 60), {
    closure: 'waiting',
    until: at(PACING.maxWaitInJobMs + 1),
  });
});

test('a source with a long interval makes its jobs wait one gap, not go round the queue', () => {
  const slow = state({ minIntervalMs: 120_000, nextRequestAt: at(110_000) });
  assert.deepEqual(turnOf(slow, PACING, 60), { wait: 110_000 });
  // Twice the interval is the longest gap such a lane sets (after a 429); a turn beyond it is an anomaly.
  assert.deepEqual(turnOf(state({ minIntervalMs: 120_000, nextRequestAt: at(250_000) }), PACING, 60), {
    closure: 'waiting',
    until: at(250_000),
  });
});

test("a spent budget closes the lane for a job's tier until the next Tehran day, and never for discovery first", () => {
  const resets = new Date('2026-09-29T20:30:00Z');
  // 12,000 a day: the untracked sweep (priority 10) keeps 30 % for the rest, so it stops at 8,400.
  assert.deepEqual(turnOf(state({ spentToday: 8_399, nextRequestAt: at(2_500) }), PACING, 10), {
    wait: 2_500,
  });
  assert.deepEqual(turnOf(state({ spentToday: 8_400, nextRequestAt: at(2_500) }), PACING, 10), {
    closure: 'over_budget',
    until: resets,
  });
  // Discovery spends to the last request.
  assert.deepEqual(turnOf(state({ spentToday: 11_999, nextRequestAt: at(2_500) }), PACING, 60), {
    wait: 2_500,
  });
  assert.deepEqual(turnOf(state({ spentToday: 12_000 }), PACING, 60), {
    closure: 'over_budget',
    until: resets,
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
