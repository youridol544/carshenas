// How a job tells the runtime what went wrong (ADR-0018 point 5). The runtime reacts to the kind, not the message:
// a problem of the source (it refused us, asked us to slow down, or is struggling) is the lane's to handle, and the
// job goes back to the queue or is retried without being blamed for it; the job's own failure is retried and then
// dead-lettered; an input that can never work is dead-lettered at once. Any other thrown error is a bug.

/** Why a source was stopped: `source.stop_reason` (ADR-0008 point 6). */
export type StopReason = 'blocked' | 'challenge' | 'rate_limited';

/** The source refused us: a 401 or 403, or a challenge page or empty answer its adapter recognised. Stops the source. */
export class SourceBlockedError extends Error {
  readonly reason: 'blocked' | 'challenge';
  readonly status: number | undefined;
  constructor(
    message: string,
    options: { reason: 'blocked' | 'challenge'; status?: number; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = 'SourceBlockedError';
    this.reason = options.reason;
    this.status = options.status;
  }
}

/** A 429: the source asks us to slow down. The lane cools down; a second one within a day stops the source. */
export class SourceThrottledError extends Error {
  readonly status = 429;
  /** What the source's Retry-After asked for, when it said. */
  readonly retryAfterMs: number | undefined;
  constructor(message: string, options: { retryAfterMs?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'SourceThrottledError';
    this.retryAfterMs = options.retryAfterMs;
  }
}

/** A timeout, a 408 or 5xx, or a dropped connection: the source is struggling. Counts toward the lane's breaker. */
export class SourceUnavailableError extends Error {
  readonly status: number | undefined;
  /** A 503's Retry-After, when it had one. */
  readonly retryAfterMs: number | undefined;
  constructor(message: string, options: { status?: number; retryAfterMs?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'SourceUnavailableError';
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
}

/** Why a lane cannot send now. */
export type LaneClosure = 'stopped' | 'paused' | 'cooling_down' | 'waiting';

/**
 * The lane cannot send now: its source is stopped or paused, it is cooling down, or its next turn is further away
 * than a job may wait. The job goes back to the queue unchanged and the lane stops claiming jobs until it can send.
 */
export class LaneClosedError extends Error {
  readonly closure: LaneClosure;
  /** When the lane expects to send again; unknown for a source only a person can resume. */
  readonly until: Date | undefined;
  constructor(message: string, options: { closure: LaneClosure; until?: Date; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = 'LaneClosedError';
    this.closure = options.closure;
    this.until = options.until;
  }
}

/** A failure that retrying cannot fix, such as input the job cannot use: the job is dead-lettered at once. */
export class PermanentJobError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'PermanentJobError';
  }
}
