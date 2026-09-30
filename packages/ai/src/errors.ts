// The layer's own errors. The web app and the worker may not import the AI SDK (lint, ADR-0021), so every failure a
// caller must tell apart is one of these, never an SDK class. Outcomes the model is responsible for (an invalid
// answer, a refusal, a truncated or empty answer) are not errors: they come back as values (task.ts, call.ts).

/**
 * The layer cannot run without the Metis key: a configuration error, raised when the layer is created, so a process
 * that calls models stops at start instead of failing on its first job (ADR-0019 point 1).
 */
export class MetisKeyMissingError extends Error {
  override readonly name = 'MetisKeyMissingError';

  constructor() {
    super(
      'METIS_API_KEY is not set: create a key at https://console.metisai.ir/api-keys and put it in the repository .env (git ignores it), or in the server secret store in production (ADR-0019). A process that calls models cannot start without it.',
    );
  }
}

/** Why a call got no answer from the provider at all. */
export const MODEL_CALL_FAILURE = {
  /** The attempt ran past the task's timeout. */
  timeout: 'timeout',
  /** The caller aborted: a job taken back or shut down, a visitor who left. */
  aborted: 'aborted',
  /** 429 from Metis or the provider behind it. */
  rateLimited: 'rate_limited',
  /** A network failure, or 5xx: Metis or its upstream is down. */
  unavailable: 'unavailable',
  /** 401 or 403: the key is wrong or revoked. */
  unauthorized: 'unauthorized',
  /** 402: the Metis balance is empty. */
  noCredit: 'no_credit',
  /** Any other 4xx: a request the provider will never accept (an unknown model, a schema it refuses). */
  rejected: 'rejected',
} as const;
export type ModelCallFailure = (typeof MODEL_CALL_FAILURE)[keyof typeof MODEL_CALL_FAILURE];

/** Whether trying again later can help; the others wait for a person (a key, a top-up, a code change). */
const RETRYABLE = {
  timeout: true,
  aborted: true,
  rate_limited: true,
  unavailable: true,
  unauthorized: false,
  no_credit: false,
  rejected: false,
} as const satisfies Record<ModelCallFailure, boolean>;

/**
 * No answer at all. In the worker the queue retries a retryable one with backoff (ADR-0019 point 4; the SDK's own
 * retries are off, ADR-0021 point 2.6); on the web path the step answers without the model.
 */
export class ModelCallError extends Error {
  override readonly name = 'ModelCallError';
  readonly reason: ModelCallFailure;
  /** The HTTP status Metis answered with, when there was an answer. */
  readonly status: number | undefined;
  readonly retryable: boolean;
  /**
   * What the attempts that did answer cost before the failure, set by the layer: 0 when none did, null when the model
   * has no known price. An attempt that got no answer (a timeout) reports no tokens, so a caller that caps spending
   * adds its own estimate for it.
   */
  costUsd: number | null = 0;

  constructor(reason: ModelCallFailure, options: { status?: number; cause: unknown }) {
    super(`model call failed: ${reason}${options.status === undefined ? '' : ` (${options.status})`}`, {
      cause: options.cause,
    });
    this.reason = reason;
    this.status = options.status;
    this.retryable = RETRYABLE[reason];
  }
}

/** The failure a status code means. A success the SDK could not read is a broken answer, worth another try. */
export function failureOfStatus(status: number): ModelCallFailure {
  if (status < 400) return 'unavailable';
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 402) return 'no_credit';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unavailable';
  return 'rejected';
}
