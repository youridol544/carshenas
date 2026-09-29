// Metis's live list prices (CS-43 found them about 1.1 times the makers' list prices, and ahead of models.json), and
// the cost of a call's attempts from the AI SDK's token usage. The endpoint needs no key.
import type { Attempt } from './reask.ts';

export const PRICING_URL = 'https://api.metisai.ir/api/v1/meta/providers/pricing';

type Prices = Partial<
  Record<'input_token' | 'output_token' | 'cached_input_token' | 'cache_write_token' | 'cache_write_5m_token', number>
>;
export type PriceParams = Prices & { tiers?: Array<Prices & { context_max?: number }> };
type PriceRow = { model: string; pricingRules?: { params?: PriceParams } };

export async function loadMetisPrices(): Promise<(modelId: string) => PriceParams | undefined> {
  const response = await fetch(PRICING_URL, { signal: AbortSignal.timeout(60_000) });
  const rows = Object.values((await response.json()) as Record<string, PriceRow[]>).flat();
  return (modelId) => rows.find((row) => row.model === modelId)?.pricingRules?.params;
}

/** The prices that apply to a prompt of this size: some models are priced in tiers by context length. */
function pricesFor(params: PriceParams, inputTokens: number): Prices {
  if (!params.tiers) return params;
  return params.tiers.find((tier) => tier.context_max === undefined || inputTokens <= tier.context_max) ?? {};
}

/** US dollars at Metis's live list price for every attempt of a call; reasoning tokens are billed as output. */
export function costUsd(params: PriceParams | undefined, attempts: Attempt[]): number | null {
  if (!params) return null;
  let total = 0;
  for (const { usage } of attempts) {
    if (!usage) continue;
    const price = pricesFor(params, usage.inputTokens ?? 0);
    if (price.input_token === undefined || price.output_token === undefined) return null;
    const details = usage.inputTokenDetails;
    const cacheRead = details.cacheReadTokens ?? 0;
    const cacheWrite = details.cacheWriteTokens ?? 0;
    const uncached = details.noCacheTokens ?? (usage.inputTokens ?? 0) - cacheRead - cacheWrite;
    total +=
      uncached * price.input_token +
      cacheRead * (price.cached_input_token ?? price.input_token) +
      cacheWrite * (price.cache_write_5m_token ?? price.cache_write_token ?? price.input_token) +
      (usage.outputTokens ?? 0) * price.output_token;
  }
  return Number(total.toFixed(7));
}
