import 'server-only';
import type { QueryFiltersCall } from '@carshenas/ai/tasks/query-filters-step';
import { recordQuerySpend, spendTodayQueryUsdMicros } from '@/server/db/query-ai-functions';

// What plain-Farsi search's paid calls cost (model_spend, CS-52's table), the sum the day's cap is held to and the
// row each paid call leaves, whatever came back: an answer, an answer sent to review, a call that got none. An answer
// from the cache costs nothing and has no row, and neither has a question a limit refused. A cost the layer could not
// measure (an attempt that timed out, a model with no price) is counted at an estimate, so the cap never reads a
// missing price as free.

export const SPEND_TASK = 'query.filters';

// What a call that reported no cost is counted at: twice the mean of a measured call (US$0.0015 on 2026-10-02), so a
// run of failures cannot slip under the cap. An attempt that was cut off may be billed besides what it reported.
export const FAILED_CALL_ESTIMATE_USD = 0.003;

/** What this task's paid calls cost since midnight in Tehran, in US dollars (the database function sums it). */
export async function spentTodayUsd(): Promise<number> {
  return (await spendTodayQueryUsdMicros()) / 1_000_000;
}

/** The row a call leaves, or none: a stored answer and a refused question cost nothing. */
type SpendRow = Parameters<typeof recordQuerySpend>[0];

export function spendRowOf(
  call: QueryFiltersCall,
  paid: { readonly promptVersion: string; readonly model: string },
): SpendRow | undefined {
  if (call.cached || call.outcome === 'refused') return undefined;
  // A deadline that cut the call off is the caller's own abort to the layer; the request may be billed all the same.
  const cutOff = call.errorReason === 'timeout' || call.errorReason === 'aborted';
  const counted = (call.costUsd ?? FAILED_CALL_ESTIMATE_USD) + (cutOff ? FAILED_CALL_ESTIMATE_USD : 0);
  return {
    promptVersion: call.promptVersion === '' ? paid.promptVersion : call.promptVersion,
    model: paid.model,
    outcome: call.outcome,
    errorReason: call.errorReason ?? null,
    costUsdMicros: Math.round(counted * 1_000_000),
    estimated: call.costUsd === null || cutOff,
  };
}

/** Records the paid calls of one question, each in a statement of its own, so they count even if the answer is lost. */
export async function recordSpend(
  calls: readonly QueryFiltersCall[],
  paid: { readonly promptVersion: string; readonly model: string },
): Promise<void> {
  for (const call of calls) {
    const row = spendRowOf(call, paid);
    if (row !== undefined) await recordQuerySpend(row);
  }
}
