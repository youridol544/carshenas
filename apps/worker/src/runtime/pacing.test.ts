import assert from 'node:assert/strict';
import { test } from 'node:test';
import { afterRequest, cooldownLength, gapAfter, PACING, type LaneSnapshot } from './pacing.ts';

const NOW = new Date('2026-09-29T08:00:00Z');
const HOUR = 60 * 60_000;

function snapshot(overrides: Partial<LaneSnapshot> = {}): LaneSnapshot {
  return {
    now: NOW,
    minIntervalMs: 3_000,
    rateLimitedAt: null,
    failureStreak: 0,
    cooldowns: 0,
    ...overrides,
  };
}

const middle = () => 0.5;

test('the gap is five times the response time, never below the source interval nor above 30 s', () => {
  assert.equal(gapAfter(200, 3_000, false), 3_000);
  assert.equal(gapAfter(1_000, 3_000, false), 5_000);
  assert.equal(gapAfter(20_000, 3_000, false), 30_000);
  // A source whose own interval is longer than the ceiling keeps its interval.
  assert.equal(gapAfter(200, 45_000, false), 45_000);
});

test('for a day after a 429 the interval is doubled', () => {
  assert.equal(gapAfter(200, 3_000, true), 6_000);
  const update = afterRequest(
    snapshot({ rateLimitedAt: new Date(NOW.getTime() - HOUR) }),
    { kind: 'answered' },
    200,
    middle,
  );
  assert.equal(update.gapMs, 6_000);
  const dayLater = afterRequest(
    snapshot({ rateLimitedAt: new Date(NOW.getTime() - 25 * HOUR) }),
    { kind: 'answered' },
    200,
    middle,
  );
  assert.equal(dayLater.gapMs, 3_000);
});

test('each cool-down in a row doubles, up to an hour, with jitter between half and all of it', () => {
  assert.equal(
    cooldownLength(1, () => 1),
    60_000,
  );
  assert.equal(
    cooldownLength(1, () => 0),
    30_000,
  );
  assert.equal(
    cooldownLength(2, () => 1),
    120_000,
  );
  assert.equal(
    cooldownLength(3, () => 1),
    240_000,
  );
  assert.equal(
    cooldownLength(12, () => 1),
    PACING.cooldownMaxMs,
  );
  assert.equal(
    cooldownLength(12, () => 0),
    PACING.cooldownMaxMs / 2,
  );
});

test('an answer closes the breaker and forgets the failures', () => {
  const update = afterRequest(
    snapshot({ failureStreak: 2, cooldowns: 3 }),
    { kind: 'answered' },
    150,
    middle,
  );
  assert.deepEqual(update, {
    gapMs: 3_000,
    failureStreak: 0,
    cooldowns: 0,
    cooldown: null,
    throttled: false,
    stop: null,
  });
});

test('three transient failures in a row open the breaker; fewer only lengthen the streak', () => {
  const first = afterRequest(snapshot(), { kind: 'unavailable' }, 500, middle);
  assert.equal(first.failureStreak, 1);
  assert.equal(first.cooldown, null);
  const third = afterRequest(snapshot({ failureStreak: 2 }), { kind: 'unavailable' }, 500, () => 1);
  assert.equal(third.failureStreak, 3);
  assert.equal(third.cooldowns, 1);
  assert.deepEqual(third.cooldown, { ms: 60_000, reason: 'unavailable' });
  assert.equal(third.stop, null);
});

test('a probe that fails after a cool-down cools the lane down again at once, for longer', () => {
  const update = afterRequest(
    snapshot({ failureStreak: 3, cooldowns: 1 }),
    { kind: 'unavailable' },
    500,
    () => 1,
  );
  assert.equal(update.cooldowns, 2);
  assert.deepEqual(update.cooldown, { ms: 120_000, reason: 'unavailable' });
});

test('a Retry-After on a failing source lengthens its cool-down, within six hours', () => {
  const longer = afterRequest(
    snapshot({ failureStreak: 2 }),
    { kind: 'unavailable', retryAfterMs: 10 * 60_000 },
    500,
    () => 1,
  );
  assert.deepEqual(longer.cooldown, { ms: 10 * 60_000, reason: 'unavailable' });
  const capped = afterRequest(
    snapshot({ failureStreak: 2 }),
    { kind: 'unavailable', retryAfterMs: 48 * HOUR },
    500,
    () => 1,
  );
  assert.equal(capped.cooldown?.ms, PACING.retryAfterMaxMs);
});

test('a first 429 cools the lane down for its Retry-After or 15 minutes and marks the lane throttled', () => {
  const plain = afterRequest(snapshot(), { kind: 'throttled' }, 200, middle);
  assert.deepEqual(plain.cooldown, { ms: 15 * 60_000, reason: 'rate_limited' });
  assert.equal(plain.throttled, true);
  assert.equal(plain.stop, null);
  assert.equal(plain.gapMs, 6_000);
  const asked = afterRequest(snapshot(), { kind: 'throttled', retryAfterMs: 120_000 }, 200, middle);
  assert.equal(asked.cooldown?.ms, 120_000);
  // Never shorter than the lane's own gap.
  const tooShort = afterRequest(snapshot(), { kind: 'throttled', retryAfterMs: 1_000 }, 200, middle);
  assert.equal(tooShort.cooldown?.ms, 6_000);
});

test('a second 429 within 24 hours stops the source; after them it only cools down again', () => {
  const again = afterRequest(
    snapshot({ rateLimitedAt: new Date(NOW.getTime() - 3 * HOUR) }),
    { kind: 'throttled' },
    200,
    middle,
  );
  assert.equal(again.stop, 'rate_limited');
  assert.equal(again.cooldown, null);
  const nextDay = afterRequest(
    snapshot({ rateLimitedAt: new Date(NOW.getTime() - 25 * HOUR) }),
    { kind: 'throttled' },
    200,
    middle,
  );
  assert.equal(nextDay.stop, null);
  assert.equal(nextDay.cooldown?.reason, 'rate_limited');
});

test('a block stops the source with its reason', () => {
  assert.equal(afterRequest(snapshot(), { kind: 'blocked', reason: 'blocked' }, 90, middle).stop, 'blocked');
  assert.equal(
    afterRequest(snapshot(), { kind: 'blocked', reason: 'challenge' }, 90, middle).stop,
    'challenge',
  );
});
