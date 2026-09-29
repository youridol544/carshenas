import { setTimeout as sleep } from 'node:timers/promises';
import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { Logger } from '@carshenas/observability/logger';
import { acquireLane, releaseLane, stopSource, type LaneState } from '../db/lane-store.ts';
import {
  LaneClosedError,
  SourceBlockedError,
  SourceThrottledError,
  SourceUnavailableError,
  type LaneClosure,
} from './errors.ts';
import type { LaneClient, LaneRequest } from './job.ts';
import { afterRequest, type PacingPolicy, type RequestOutcome } from './pacing.ts';

// A lane, as one job sees it (ADR-0018 points 3 to 6): every request takes the lane's lease in the database first,
// waits for its turn only as long as one gap, and gives the lease back with what the source answered. When the lane
// cannot send (its source is stopped or paused, it is cooling down, or its turn is too far away), the job is told
// with LaneClosedError and the lane supervisor is told to stop claiming the lane's jobs.

export type LaneClientOptions = {
  readonly sourceId: string;
  /** Who holds the lease while a request runs: the process and the job. */
  readonly holder: string;
  readonly db: Kysely<DB>;
  readonly policy: PacingPolicy;
  /** The longest one request may take; the lease covers it with a margin. */
  readonly requestTimeoutMs: number;
  /** The job's signal: aborted on shutdown or a lost claim. */
  readonly signal: AbortSignal;
  readonly log: Logger;
  /** Called when the lane cannot send until `until` (or until a person resumes its source). */
  readonly onClosed: (closure: LaneClosure, until: Date | undefined) => void;
  readonly random?: () => number;
};

type Turn = { readonly wait: number } | { readonly closure: LaneClosure; readonly until?: Date };

/** Why a lane that refused its lease refused it, and whether waiting one gap is enough. */
export function turnOf(state: LaneState, policy: PacingPolicy): Turn {
  if (state.crawlState === 'stopped_on_block') return { closure: 'stopped' };
  if (state.crawlState === 'paused') return { closure: 'paused' };
  const now = state.now.getTime();
  if (state.cooldownUntil && state.cooldownUntil.getTime() > now) {
    return { closure: 'cooling_down', until: state.cooldownUntil };
  }
  const wait = Math.max(
    state.nextRequestAt.getTime() - now,
    state.leaseUntil ? state.leaseUntil.getTime() - now : 0,
    0,
  );
  if (wait > policy.maxWaitInJobMs) return { closure: 'waiting', until: new Date(now + wait) };
  return { wait };
}

/** What a failed request says about the source; anything but the three source errors is the job's own failure. */
export function outcomeOf(error: unknown): RequestOutcome {
  if (error instanceof SourceBlockedError) return { kind: 'blocked', reason: error.reason };
  if (error instanceof SourceThrottledError) return { kind: 'throttled', retryAfterMs: error.retryAfterMs };
  if (error instanceof SourceUnavailableError) {
    return { kind: 'unavailable', retryAfterMs: error.retryAfterMs };
  }
  return { kind: 'answered' };
}

const CLOSURE_MESSAGE = {
  stopped: 'the source is stopped until a person resumes it',
  paused: 'the source is paused',
  cooling_down: 'the lane is cooling down',
  waiting: 'the next turn of the lane is further away than a job waits',
} as const satisfies Record<LaneClosure, string>;

async function takeTurn(options: LaneClientOptions): Promise<LaneState> {
  const leaseMs = options.requestTimeoutMs + options.policy.leaseMarginMs;
  for (;;) {
    const attempt = await acquireLane(options.db, options.sourceId, options.holder, leaseMs);
    if (!attempt) throw new Error(`source ${options.sourceId} has no lane`);
    if (attempt.acquired) return attempt.state;
    const turn = turnOf(attempt.state, options.policy);
    if ('wait' in turn) {
      // Its turn is less than one gap away: wait for it here, rather than send the job round the queue.
      await sleep(turn.wait + 5, undefined, { signal: options.signal });
      continue;
    }
    options.onClosed(turn.closure, turn.until);
    throw new LaneClosedError(CLOSURE_MESSAGE[turn.closure], turn);
  }
}

async function recordOutcome(
  options: LaneClientOptions,
  state: LaneState,
  outcome: RequestOutcome,
  durationMs: number,
): Promise<void> {
  const update = afterRequest(state, outcome, durationMs, options.random ?? Math.random, options.policy);
  const fields = { source: options.sourceId, outcome: outcome.kind, durationMs: Math.round(durationMs) };
  if (update.stop) {
    // The start of the blocked request is the stop's evidence: the fetch_log row at stopped_at (ADR-0008 point 6).
    const stopped = await stopSource(options.db, options.sourceId, update.stop, state.now);
    options.log.warn('source stopped', { ...fields, reason: update.stop, stoppedNow: stopped });
  }
  const released = await releaseLane(options.db, options.sourceId, options.holder, update);
  if (!released) {
    options.log.warn('lane lease lapsed before its request ended', { ...fields, holder: options.holder });
  }
  if (update.stop) {
    options.onClosed('stopped', undefined);
  } else if (update.cooldown) {
    const until = released?.cooldownUntil ?? new Date(Date.now() + update.cooldown.ms);
    options.log.warn('lane cooling down', {
      ...fields,
      reason: update.cooldown.reason,
      cooldownMs: update.cooldown.ms,
      until,
      failureStreak: update.failureStreak,
    });
    options.onClosed('cooling_down', until);
  }
}

export function createLaneClient(options: LaneClientOptions): LaneClient {
  return {
    sourceId: options.sourceId,
    async request<Result>(send: (request: LaneRequest) => Promise<Result>): Promise<Result> {
      const state = await takeTurn(options);
      const request: LaneRequest = {
        signal: AbortSignal.any([options.signal, AbortSignal.timeout(options.requestTimeoutMs)]),
        startedAt: state.now,
      };
      const started = performance.now();
      let settled: { ok: true; value: Result } | { ok: false; error: unknown };
      try {
        settled = { ok: true, value: await send(request) };
      } catch (error) {
        settled = { ok: false, error };
      }
      await recordOutcome(
        options,
        state,
        settled.ok ? { kind: 'answered' } : outcomeOf(settled.error),
        performance.now() - started,
      );
      if (settled.ok) return settled.value;
      if (settled.error instanceof Error) throw settled.error;
      throw new Error('the request failed with a value that is not an Error', { cause: settled.error });
    },
  };
}
