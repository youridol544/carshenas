// The lane's rules, as pure functions of what the lane knew when it took its lease and what the source answered
// (ADR-0018 points 3, 5 and 6; docs/research/2026-09-29-crawl-scheduling-rate-limits-and-backoff.md). Times are
// durations here: the database anchors them at its own clock when the lease is given back (src/db/lane-store.ts).

export type PacingPolicy = {
  /** The gap after a request is this many times its duration (Heritrix's delayFactor)… */
  readonly gapPerResponseTime: number;
  /** …but never below the source's interval, nor above this unless the interval itself is longer (Heritrix's maxDelayMs). */
  readonly maxGapMs: number;
  /** After a 429, the source's interval is multiplied by this… */
  readonly throttledIntervalFactor: number;
  /** …for this long, during which a second 429 stops the source. */
  readonly throttledWindowMs: number;
  /** Transient failures in a row that open the breaker. */
  readonly breakerThreshold: number;
  /** The first cool-down; each one in a row doubles it, up to the maximum, with jitter. */
  readonly cooldownBaseMs: number;
  readonly cooldownMaxMs: number;
  /** How long a 429 without a Retry-After cools the lane down. */
  readonly throttledCooldownMs: number;
  /** The longest Retry-After honoured; a longer one is capped. */
  readonly retryAfterMaxMs: number;
  /** A lease outlives the request's own timeout by this much, so only a crashed worker's lease lapses. */
  readonly leaseMarginMs: number;
  /** The longest a job waits inside its handler for its turn; beyond it the job goes back to the queue. */
  readonly maxWaitInJobMs: number;
};

export const PACING: PacingPolicy = {
  gapPerResponseTime: 5,
  maxGapMs: 30_000,
  throttledIntervalFactor: 2,
  throttledWindowMs: 24 * 60 * 60_000,
  breakerThreshold: 3,
  cooldownBaseMs: 60_000,
  cooldownMaxMs: 60 * 60_000,
  throttledCooldownMs: 15 * 60_000,
  retryAfterMaxMs: 6 * 60 * 60_000,
  leaseMarginMs: 15_000,
  // Twice the longest gap after a 429: a job waits no longer than its lane's own spacing.
  maxWaitInJobMs: 60_000,
};

/** What the lane knew when the lease was taken, by the database's clock. */
export type LaneSnapshot = {
  readonly now: Date;
  /** `source.min_request_interval_ms`: at least 3,000 for a crawled source (source_crawl_interval_floor). */
  readonly minIntervalMs: number;
  readonly rateLimitedAt: Date | null;
  readonly failureStreak: number;
  readonly cooldowns: number;
};

/** What the source answered, as far as the lane is concerned. */
export type RequestOutcome =
  /** Any answer that is not the source's problem, a 404 or a page the job could not read included. */
  | { readonly kind: 'answered' }
  /** A timeout, a 408 or 5xx, a dropped connection. */
  | { readonly kind: 'unavailable'; readonly retryAfterMs?: number }
  /** A 429. */
  | { readonly kind: 'throttled'; readonly retryAfterMs?: number }
  /** A 401 or 403, or a challenge page or empty answer the source's adapter recognised. */
  | { readonly kind: 'blocked'; readonly reason: 'blocked' | 'challenge' };

export type Cooldown = { readonly ms: number; readonly reason: 'unavailable' | 'rate_limited' };

/** What the lane records when it gives the lease back. */
export type LaneUpdate = {
  /** The next request starts no sooner than this long after this one ended. */
  readonly gapMs: number;
  readonly failureStreak: number;
  readonly cooldowns: number;
  readonly cooldown: Cooldown | null;
  /** This answer was a 429: `rate_limited_at` becomes now. */
  readonly throttled: boolean;
  /** The source must stop, and why (ADR-0008 point 6). */
  readonly stop: 'blocked' | 'challenge' | 'rate_limited' | null;
};

function throttledRecently(snapshot: LaneSnapshot, policy: PacingPolicy): boolean {
  return (
    snapshot.rateLimitedAt !== null &&
    snapshot.now.getTime() - snapshot.rateLimitedAt.getTime() < policy.throttledWindowMs
  );
}

/** The gap after a request that took `durationMs`: slower answers mean a longer wait, within the source's bounds. */
export function gapAfter(
  durationMs: number,
  minIntervalMs: number,
  throttled: boolean,
  policy: PacingPolicy = PACING,
): number {
  const floor = minIntervalMs * (throttled ? policy.throttledIntervalFactor : 1);
  const ceiling = Math.max(floor, policy.maxGapMs);
  return Math.round(Math.min(ceiling, Math.max(floor, durationMs * policy.gapPerResponseTime)));
}

/**
 * The length of the `nth` cool-down in a row (1 for the first): the base doubled each time, capped, then "equal
 * jitter" (between half and all of it, Brooker 2015), so a probe never comes early and two lanes never keep step.
 */
export function cooldownLength(nth: number, random: () => number, policy: PacingPolicy = PACING): number {
  const ceiling = Math.min(policy.cooldownMaxMs, policy.cooldownBaseMs * 2 ** Math.max(0, nth - 1));
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

function honoured(
  retryAfterMs: number | undefined,
  floorMs: number,
  policy: PacingPolicy,
): number | undefined {
  if (retryAfterMs === undefined) return undefined;
  return Math.min(policy.retryAfterMaxMs, Math.max(floorMs, retryAfterMs));
}

/** How the lane changes after one request (ADR-0018). */
export function afterRequest(
  snapshot: LaneSnapshot,
  outcome: RequestOutcome,
  durationMs: number,
  random: () => number,
  policy: PacingPolicy = PACING,
): LaneUpdate {
  const recentlyThrottled = throttledRecently(snapshot, policy);
  switch (outcome.kind) {
    case 'answered':
      return {
        gapMs: gapAfter(durationMs, snapshot.minIntervalMs, recentlyThrottled, policy),
        failureStreak: 0,
        cooldowns: 0,
        cooldown: null,
        throttled: false,
        stop: null,
      };
    case 'unavailable': {
      const failureStreak = snapshot.failureStreak + 1;
      const gapMs = gapAfter(durationMs, snapshot.minIntervalMs, recentlyThrottled, policy);
      // A probe after a cool-down that fails again cools the lane down at once, for longer.
      const opens = snapshot.cooldowns > 0 || failureStreak >= policy.breakerThreshold;
      if (!opens) {
        return { gapMs, failureStreak, cooldowns: 0, cooldown: null, throttled: false, stop: null };
      }
      const cooldowns = snapshot.cooldowns + 1;
      const length = Math.max(
        cooldownLength(cooldowns, random, policy),
        honoured(outcome.retryAfterMs, gapMs, policy) ?? 0,
      );
      return {
        gapMs,
        failureStreak,
        cooldowns,
        cooldown: { ms: length, reason: 'unavailable' },
        throttled: false,
        stop: null,
      };
    }
    case 'throttled': {
      const gapMs = gapAfter(durationMs, snapshot.minIntervalMs, true, policy);
      if (recentlyThrottled) {
        return {
          gapMs,
          failureStreak: 0,
          cooldowns: 0,
          cooldown: null,
          throttled: true,
          stop: 'rate_limited',
        };
      }
      const length = honoured(outcome.retryAfterMs, gapMs, policy) ?? policy.throttledCooldownMs;
      return {
        gapMs,
        failureStreak: 0,
        cooldowns: snapshot.cooldowns,
        cooldown: { ms: length, reason: 'rate_limited' },
        throttled: true,
        stop: null,
      };
    }
    case 'blocked':
      return {
        gapMs: gapAfter(durationMs, snapshot.minIntervalMs, recentlyThrottled, policy),
        failureStreak: 0,
        cooldowns: 0,
        cooldown: null,
        throttled: false,
        stop: outcome.reason,
      };
  }
}
