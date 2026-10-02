import 'server-only';
import { MetisKeyMissingError } from '@carshenas/ai/errors';
import { queryFiltersEntry } from '@carshenas/ai/tasks/query-filters';
import {
  ModelRefused,
  queryFiltersStep,
  type QueryFiltersCall,
} from '@carshenas/ai/tasks/query-filters-step';
import type { ModelStep } from '@carshenas/search/understand/understand';
import { recordSpend, spentTodayUsd } from '@/features/search-understanding/server/model-spend';
import { webModels } from '@/server/ai/models';
import { countInWindow } from '@/server/auth/throttle';
import { env } from '@/server/env';
import { captureError, logger } from '@/server/observability/logger';

// The model's step as the web route binds it when the master switch is on (SEARCH_UNDERSTANDING_AI): the registry's
// task through the layer, held to what only a paid question needs. A question is paid for only when the answer cache
// has no answer, and the layer asks the gate then and not before: so a repeated question is never counted against a
// visitor, the cap or the slots. The gate refuses, in this order, when this process already has as many questions with
// the model as it may (`busy`), when today's cost has reached the cap (`daily_cap`), when this client address has put
// too many questions to the model this hour (`visitor_limit`). Whatever is refused or fails is answered by code
// alone, with the reason (the buyer is never shown an error because a model was slow or missing), and what a call
// cost is recorded whatever it answered. The cap is read before the call and the cost written after it, so a burst
// can pass the cap by what the questions in flight cost, at most a few cents (`SEARCH_UNDERSTANDING_CONCURRENCY`).

/** The whole deadline of a question to the model, its one re-ask included (S04: p95 of a model call 4.7 s). */
export const MODEL_DEADLINE_MS = 7_000;

export type Visitor = {
  /** The client address as the throttle keys it (clientAddress); hashed before it is stored, never logged. */
  readonly address: string;
};

const log = logger.child({ component: 'search-understanding' });

const globalForSlots = globalThis as typeof globalThis & {
  carshenasUnderstandingInFlight?: number;
  carshenasUnderstandingSpendLost?: boolean;
};

/**
 * Fails closed: a paid call whose cost could not be recorded is spending the cap cannot see, so from then on this process
 * puts no paid question to the model (code answers) until it restarts. Exported for the tests, which clear it.
 */
export function spendRecordingFailed(): boolean {
  return globalForSlots.carshenasUnderstandingSpendLost === true;
}
export function forgetLostSpend(): void {
  globalForSlots.carshenasUnderstandingSpendLost = false;
}

function takeSlot(limit: number): boolean {
  const inFlight = globalForSlots.carshenasUnderstandingInFlight ?? 0;
  if (inFlight >= limit) return false;
  globalForSlots.carshenasUnderstandingInFlight = inFlight + 1;
  return true;
}

function releaseSlot(): void {
  globalForSlots.carshenasUnderstandingInFlight = Math.max(
    0,
    (globalForSlots.carshenasUnderstandingInFlight ?? 1) - 1,
  );
}

/** Questions with the model in this process now (for the tests and the log). */
export function questionsInFlight(): number {
  return globalForSlots.carshenasUnderstandingInFlight ?? 0;
}

export function paidModelStep(visitor: Visitor, options: { readonly deadlineMs?: number } = {}): ModelStep {
  return async (input) => {
    const calls: QueryFiltersCall[] = [];
    const held = { slot: false };
    let paid: { promptVersion: string; model: string } | undefined;
    try {
      const models = await webModels();
      // Without a price the cost reads as nothing and the cap would never stop the day: no price, no question.
      if (!models.hasPrice('query.filters')) {
        log.warn('the model has no known price, so plain-Farsi search answers without it');
        return { status: 'unavailable', reason: 'unavailable' };
      }
      paid = { promptVersion: models.promptVersion('query.filters'), model: queryFiltersEntry.model.id };
      const step = queryFiltersStep(models, {
        deadlineMs: options.deadlineMs ?? MODEL_DEADLINE_MS,
        beforeRequest: async () => {
          if (spendRecordingFailed()) throw new ModelRefused('unavailable');
          if (!takeSlot(env.searchUnderstandingConcurrency)) throw new ModelRefused('busy');
          held.slot = true;
          if ((await spentTodayUsd()) >= env.searchUnderstandingDailyCapUsd)
            throw new ModelRefused('daily_cap');
          const window = await countInWindow(
            'understand_address',
            visitor.address,
            env.searchUnderstandingVisitorLimit,
          );
          if (window.status === 'throttled') throw new ModelRefused('visitor_limit');
        },
        onCall: (call) => calls.push(call),
      });
      return await step(input);
    } catch (error) {
      if (error instanceof MetisKeyMissingError) return { status: 'unavailable', reason: 'unavailable' };
      // The model only improves an answer code already has: whatever went wrong here is reported, and code answers.
      captureError(error, { message: 'asking the model for plain-Farsi search failed' });
      return { status: 'unavailable', reason: 'unavailable' };
    } finally {
      if (held.slot) releaseSlot();
      if (paid !== undefined) {
        await recordSpend(calls, paid).catch((error: unknown) => {
          globalForSlots.carshenasUnderstandingSpendLost = true;
          captureError(error, { message: 'recording what a plain-Farsi search call cost failed' });
        });
      }
    }
  };
}
