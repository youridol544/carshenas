// query.filters as the step plain-Farsi search asks (CS-62, ADR-0021 point 2.6): one attempt within a deadline, a
// reading that passed the layer's checks or the reason there is none. The web route and the evaluation bind it the same
// way, so what is measured is what runs. It never throws for a call that got no answer: a visitor is never shown an
// error because a model was slow, the step answers without it and says why. Nothing here logs a prompt, a query or an
// answer; the layer's own line holds the task, version, tokens, cost and latency.
import type { QueryFiltersInput } from '@carshenas/search/understand/model-input';
import type { QueryReading } from '@carshenas/search/understand/reading';
import type { DegradedReason } from '@carshenas/search/understand/types';
import type { ModelStep } from '@carshenas/search/understand/understand';
import type { AiResult, CallOptions } from '../ai.ts';
import { ModelCallError } from '../errors.ts';

/** The one method of the AI layer the step needs, so a test or an evaluation can pass its own. */
export type QueryFiltersCaller = {
  call(
    task: 'query.filters',
    input: QueryFiltersInput,
    options?: CallOptions,
  ): Promise<AiResult<QueryReading>>;
};

/**
 * Thrown by a caller's `beforeRequest` to refuse a paid question (a visitor over the limit, the day's cap reached, too
 * many questions with the model at once): the step answers without the model, saying this reason.
 */
export class ModelRefused extends Error {
  readonly reason: DegradedReason;
  constructor(reason: DegradedReason) {
    super(`the question was not put to the model: ${reason}`);
    this.name = 'ModelRefused';
    this.reason = reason;
  }
}

/** What one call cost and took: for a spending cap and a report, never shown to a buyer. */
export type QueryFiltersCall = {
  readonly promptVersion: string;
  /** `refused`: no request was made (a limit or the cap held it), so nothing was spent. */
  readonly outcome: AiResult<QueryReading>['outcome'] | 'error' | 'refused';
  readonly cached: boolean;
  readonly attempts: number;
  readonly latencyMs: number;
  /** At Metis's price, every attempt included; 0 from the cache; null when the model has no known price. */
  readonly costUsd: number | null;
  readonly tokens: {
    readonly input: number;
    readonly cacheRead: number;
    readonly output: number;
    readonly reasoning: number;
  };
  /** Set when no answer came at all. */
  readonly errorReason?: ModelCallError['reason'];
  /** The answer when the outcome is ok, for an evaluation's records. */
  readonly reading?: QueryReading;
};

/** Why a call with no answer is answered without the model: a slow call is a timeout, anything else unavailable. */
export function degradedReasonOf(error: ModelCallError): DegradedReason {
  return error.reason === 'timeout' || error.reason === 'aborted' ? 'timeout' : 'unavailable';
}

export function queryFiltersStep(
  caller: QueryFiltersCaller,
  options: {
    /** The whole deadline for the call and its one re-ask: past it the step answers without the model. */
    readonly deadlineMs: number;
    /** Held to what only a paid request needs (a limit, a cap): throws ModelRefused to refuse it. */
    readonly beforeRequest?: () => void | Promise<void>;
    readonly onCall?: (call: QueryFiltersCall) => void;
  },
): ModelStep {
  return async (input) => {
    const started = performance.now();
    try {
      const result = await caller.call('query.filters', input, {
        signal: AbortSignal.timeout(options.deadlineMs),
        ...(options.beforeRequest ? { beforeRequest: options.beforeRequest } : {}),
      });
      const usage = result.attempts.map((attempt) => attempt.usage);
      const sum = (pick: (one: (typeof usage)[number]) => number) =>
        usage.reduce((total, one) => total + pick(one), 0);
      options.onCall?.({
        promptVersion: result.promptVersion,
        outcome: result.outcome,
        cached: result.cached,
        attempts: result.attempts.length,
        latencyMs: Math.round(performance.now() - started),
        costUsd: result.costUsd,
        tokens: {
          input: sum((one) => one.inputTokens),
          cacheRead: sum((one) => one.cacheReadTokens),
          output: sum((one) => one.outputTokens),
          reasoning: sum((one) => one.reasoningTokens),
        },
        ...(result.outcome === 'ok' ? { reading: result.value } : {}),
      });
      return result.outcome === 'ok'
        ? { status: 'ok', reading: result.value, cached: result.cached }
        : { status: 'unavailable', reason: 'invalid_answer' };
    } catch (error) {
      if (error instanceof ModelRefused) {
        options.onCall?.({
          promptVersion: '',
          outcome: 'refused',
          cached: false,
          attempts: 0,
          latencyMs: Math.round(performance.now() - started),
          costUsd: 0,
          tokens: { input: 0, cacheRead: 0, output: 0, reasoning: 0 },
        });
        return { status: 'unavailable', reason: error.reason };
      }
      if (!(error instanceof ModelCallError)) throw error;
      options.onCall?.({
        promptVersion: '',
        outcome: 'error',
        cached: false,
        attempts: 0,
        latencyMs: Math.round(performance.now() - started),
        costUsd: error.costUsd,
        tokens: { input: 0, cacheRead: 0, output: 0, reasoning: 0 },
        errorReason: error.reason,
      });
      return { status: 'unavailable', reason: degradedReasonOf(error) };
    }
  };
}
