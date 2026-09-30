// How a job tells the runtime what went wrong (ADR-0018 point 5). The runtime reacts to the kind, not the message:
// a problem of the source (it refused us, asked us to slow down, or is struggling) is the lane's to handle, and the
// job goes back to the queue or is retried without being blamed for it; the job's own failure is retried and then
// dead-lettered; an input that can never work is dead-lettered at once. Any other thrown error is a bug.

/** Why a source was stopped: `source.stop_reason` (ADR-0008 point 6). */
export type StopReason = 'blocked' | 'challenge' | 'rate_limited';

/**
 * The request a source's problem was met on, as its fetch_log row records it (CS-33). A job logs every request it
 * sent, the refused ones included, and a stopped source's evidence is the request whose start is its stopped_at.
 */
export type SourceRequest = {
  readonly url: string;
  /** When the lane let the request start, by the database's clock: fetch_log.requested_at and a stop's stopped_at. */
  readonly startedAt: Date;
  readonly durationMs: number;
};

/**
 * What a refusal that did not say so looked like: the start of the answer and its JSON keys, so a person reading the
 * stop can tell a block from an answer the adapter did not know (CS-33: Divar's first stop was the latter).
 */
export type RefusedAnswer = {
  readonly contentType: string | undefined;
  readonly bytes: number;
  /** Its first characters, redacted with the rest of the line. */
  readonly start: string;
  /** Its top-level keys, when it is a JSON object. */
  readonly jsonKeys: readonly string[] | undefined;
};

/** The source refused us: a 401 or 403, or a challenge page or empty answer its adapter recognised. Stops the source. */
export class SourceBlockedError extends Error {
  readonly reason: 'blocked' | 'challenge';
  readonly status: number | undefined;
  readonly request: SourceRequest | undefined;
  /** The answer, when an adapter recognised the refusal in it rather than its status saying so. */
  readonly answer: RefusedAnswer | undefined;
  constructor(
    message: string,
    options: {
      reason: 'blocked' | 'challenge';
      status?: number;
      request?: SourceRequest;
      answer?: RefusedAnswer;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = 'SourceBlockedError';
    this.reason = options.reason;
    this.status = options.status;
    this.request = options.request;
    this.answer = options.answer;
  }
}

/** A 429: the source asks us to slow down. The lane cools down; a second one within a day stops the source. */
export class SourceThrottledError extends Error {
  readonly status = 429;
  /** What the source's Retry-After asked for, when it said. */
  readonly retryAfterMs: number | undefined;
  readonly request: SourceRequest | undefined;
  constructor(
    message: string,
    options: { retryAfterMs?: number; request?: SourceRequest; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'SourceThrottledError';
    this.retryAfterMs = options.retryAfterMs;
    this.request = options.request;
  }
}

/** A timeout, a 408 or 5xx, or a dropped connection: the source is struggling. Counts toward the lane's breaker. */
export class SourceUnavailableError extends Error {
  readonly status: number | undefined;
  /** A 503's Retry-After, when it had one. */
  readonly retryAfterMs: number | undefined;
  readonly request: SourceRequest | undefined;
  constructor(
    message: string,
    options: { status?: number; retryAfterMs?: number; request?: SourceRequest; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'SourceUnavailableError';
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
    this.request = options.request;
  }
}

/**
 * Why a lane cannot send now: its source stopped on a block, paused by a person, cooling down, its next turn too far
 * away, its reading of the source's robots.txt and terms out of date (ADR-0008 point 1: read again every 30 days), or
 * the day's request budget spent for the job's tier (ADR-0017 point 5), until the next Tehran day.
 */
export type LaneClosure =
  'stopped' | 'paused' | 'cooling_down' | 'waiting' | 'policy_expired' | 'over_budget';

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
