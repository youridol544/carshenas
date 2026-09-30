// A worked example for the ai-features skill (references/cost.md), never the product's: a cost report built from the
// layer's own log lines, the way a run is costed and the month is reconciled with Metis's rial invoice. Every call
// writes one `model call completed` line with its task, prompt version, models, outcome, attempts, latency, tokens
// split by what each part costs, and the cost at Metis's live list (ADR-0021 point 2.5), and never its prompt, input
// or answer. This reads those lines, JSON as the worker writes them, and sums them per task, prompt version and model.
import { z } from 'zod';

const count = z.number().int().nonnegative();

/** The fields of the layer's line a report needs; other lines, and lines that are not JSON, are skipped. */
const CallLine = z.object({
  msg: z.literal('model call completed'),
  task: z.string(),
  promptVersion: z.string(),
  provider: z.string(),
  model: z.string(),
  outcome: z.string(),
  cached: z.boolean(),
  attempts: count,
  latencyMs: z.number().nonnegative(),
  inputTokens: count,
  cacheReadTokens: count,
  cacheWriteTokens: count,
  outputTokens: count,
  reasoningTokens: count,
  costUsd: z.number().nonnegative().nullable(),
});
type CallLine = z.infer<typeof CallLine>;

export type CostRow = {
  readonly task: string;
  readonly promptVersion: string;
  /** `provider/model` as requested, as logs and the cache name a model; answeringModel says when Metis routed it on. */
  readonly modelName: string;
  readonly calls: number;
  /** Calls answered from ai_answer, which sent no request and cost nothing. */
  readonly cachedCalls: number;
  /** Requests sent: each call's first answer and its re-ask. */
  readonly requests: number;
  readonly outcomes: Readonly<Record<string, number>>;
  /** Input at the full price, from the provider's cache, and written to it; output with the reasoning inside it. */
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  /** Null when any call was unpriced: a model Metis lists no price for, or a price list that did not load. */
  readonly costUsd: number | null;
  readonly costPer1000CallsUsd: number | null;
  /** Over the calls that sent a request; a cache hit's latency says nothing about the model. */
  readonly p50Ms: number | undefined;
  readonly p95Ms: number | undefined;
};

/** The value below which `share` of the values fall (nearest rank). */
function percentile(values: readonly number[], share: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1)];
}

function parse(line: string): CallLine | undefined {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return undefined; // a plain-text startup line, as `jq 'fromjson? // empty'` skips it
  }
  const parsed = CallLine.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

function row(calls: readonly CallLine[]): CostRow {
  const [first] = calls;
  if (!first) throw new Error('a row needs at least one call');
  const sum = (pick: (call: CallLine) => number) => calls.reduce((total, call) => total + pick(call), 0);
  const outcomes: Record<string, number> = {};
  for (const call of calls) outcomes[call.outcome] = (outcomes[call.outcome] ?? 0) + 1;
  const priced = calls.every((call) => call.costUsd !== null);
  const cost = priced ? Number(sum((call) => call.costUsd ?? 0).toFixed(9)) : null;
  const asked = calls.filter((call) => !call.cached).map((call) => call.latencyMs);
  return {
    task: first.task,
    promptVersion: first.promptVersion,
    modelName: `${first.provider}/${first.model}`,
    calls: calls.length,
    cachedCalls: calls.filter((call) => call.cached).length,
    requests: sum((call) => call.attempts),
    outcomes,
    inputTokens: sum((call) => call.inputTokens),
    cacheReadTokens: sum((call) => call.cacheReadTokens),
    cacheWriteTokens: sum((call) => call.cacheWriteTokens),
    outputTokens: sum((call) => call.outputTokens),
    reasoningTokens: sum((call) => call.reasoningTokens),
    costUsd: cost,
    costPer1000CallsUsd: cost === null ? null : Number(((cost / calls.length) * 1000).toFixed(6)),
    p50Ms: percentile(asked, 0.5),
    p95Ms: percentile(asked, 0.95),
  };
}

/** One row per task, prompt version and model, in the order each first appears in the lines. */
export function costReport(lines: Iterable<string>): CostRow[] {
  const groups = new Map<string, CallLine[]>();
  for (const line of lines) {
    const call = parse(line);
    if (!call) continue;
    const key = JSON.stringify([call.task, call.promptVersion, call.provider, call.model]);
    const group = groups.get(key);
    if (group) group.push(call);
    else groups.set(key, [call]);
  }
  return [...groups.values()].map(row);
}

/** One line per row: what a run cost, and what drove it. */
export function formatCostReport(rows: readonly CostRow[]): string[] {
  return rows.map((r) => {
    const input = r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens;
    const providerCache = input === 0 ? 0 : r.cacheReadTokens / input;
    const outcomes = Object.entries(r.outcomes)
      .map(([outcome, n]) => `${outcome} ${n}`)
      .join(', ');
    const cost =
      r.costUsd === null || r.costPer1000CallsUsd === null
        ? 'not priced'
        : `US$${r.costUsd.toFixed(4)}, US$${r.costPer1000CallsUsd.toFixed(2)} per 1,000 calls`;
    return [
      `${r.task} ${r.promptVersion} ${r.modelName}: ${r.calls} calls (${r.cachedCalls} from the cache), ${r.requests} requests (${outcomes})`,
      `tokens in ${input} (${(100 * providerCache).toFixed(0)}% from the provider cache), out ${r.outputTokens} (${r.reasoningTokens} reasoning)`,
      cost,
      `p50 ${r.p50Ms ?? '-'} ms, p95 ${r.p95Ms ?? '-'} ms`,
    ].join('; ');
  });
}
