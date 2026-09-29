// What a call cost at Metis's live list price (ADR-0019 point 3, ADR-0021 point 2.5). The pricing endpoint needs no
// key and lists US dollars per token, about 1.1 times the makers' list prices (CS-43); models.json is stale and is not
// used. Which price Metis actually bills is checked against the dashboard (docs/research/2026-09-29-metis-ai.md).
import { z } from 'zod';
import type { Logger } from '@carshenas/observability/logger';
import type { TokenUsage } from './call.ts';

export const METIS_PRICING_URL = 'https://api.metisai.ir/api/v1/meta/providers/pricing';

const rate = z.number().nonnegative();
const Rates = z.object({
  input_token: rate.optional(),
  output_token: rate.optional(),
  cached_input_token: rate.optional(),
  /** A cache write where the model has one price for it (GPT-5.6). */
  cache_write_token: rate.optional(),
  /** Anthropic's five-minute and one-hour cache writes. */
  cache_write_5m_token: rate.optional(),
  cache_write_1h_token: rate.optional(),
});
const ModelPricesSchema = Rates.extend({
  /** Priced by prompt length (gpt-5.6-luna): the first tier whose context_max the prompt fits, else the last. */
  tiers: z.array(Rates.extend({ context_max: z.number().int().positive().optional() })).optional(),
});
export type ModelPrices = z.infer<typeof ModelPricesSchema>;
type Rate = z.infer<typeof Rates>;

const PricingRow = z.object({
  model: z.string(),
  pricingRules: z.object({ params: ModelPricesSchema.optional() }).optional(),
});
const PricingResponse = z.record(z.string(), z.array(z.unknown()));

export type PriceBook = {
  /** Metis's prices for a model id as its routes take it (`claude-haiku-4-5`), if it lists them. */
  pricesOf(modelId: string): ModelPrices | undefined;
};

/** A fixed price list: tests, and a run that must not change prices halfway. */
export function priceBookOf(prices: Readonly<Record<string, ModelPrices>>): PriceBook {
  return { pricesOf: (modelId) => prices[modelId] };
}

/** The pricing endpoint's answer as a price list; rows it cannot read are skipped, not guessed. */
export function parseMetisPricing(body: unknown): Record<string, ModelPrices> {
  const prices: Record<string, ModelPrices> = {};
  for (const row of Object.values(PricingResponse.parse(body)).flat()) {
    const parsed = PricingRow.safeParse(row);
    const params = parsed.success ? parsed.data.pricingRules?.params : undefined;
    if (parsed.success && params) prices[parsed.data.model] = params;
  }
  return prices;
}

export async function loadMetisPrices(
  options: { fetch?: typeof globalThis.fetch; signal?: AbortSignal } = {},
): Promise<Record<string, ModelPrices>> {
  const response = await (options.fetch ?? globalThis.fetch)(METIS_PRICING_URL, {
    signal: options.signal ?? AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Metis pricing answered ${response.status}`);
  return parseMetisPricing(await response.json());
}

export type MetisPriceBook = PriceBook & {
  /** Loads the list now; false when it could not, and the previous list (possibly none) stays. */
  refresh(): Promise<boolean>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The live list, loaded by `refresh()` at start and again in the background once it is older than a day. A call
 * priced before the first load, or for a model Metis does not list, logs a null cost rather than a guess.
 */
export function createMetisPriceBook(options: {
  logger: Logger;
  fetch?: typeof globalThis.fetch;
  maxAgeMs?: number;
  now?: () => number;
}): MetisPriceBook {
  const now = options.now ?? (() => performance.timeOrigin + performance.now());
  const maxAgeMs = options.maxAgeMs ?? DAY_MS;
  let prices: Readonly<Record<string, ModelPrices>> = {};
  let loadedAt: number | undefined;
  let loading: Promise<boolean> | undefined;

  function refresh(): Promise<boolean> {
    loading ??= loadMetisPrices({ fetch: options.fetch })
      .then((loaded) => {
        prices = loaded;
        loadedAt = now();
        return true;
      })
      .catch((error: unknown) => {
        options.logger.warn('metis prices not loaded', { err: error });
        return false;
      })
      .finally(() => {
        loading = undefined;
      });
    return loading;
  }

  return {
    refresh,
    pricesOf(modelId) {
      if (loadedAt !== undefined && now() - loadedAt > maxAgeMs) void refresh();
      return prices[modelId];
    },
  };
}

function ratesFor(prices: ModelPrices, promptTokens: number): Rate {
  if (!prices.tiers || prices.tiers.length === 0) return prices;
  return (
    prices.tiers.find((tier) => tier.context_max === undefined || promptTokens <= tier.context_max) ??
    prices.tiers.at(-1) ??
    prices
  );
}

/**
 * US dollars for the attempts of one call, at the rate of each kind of token: uncached input, cache reads, cache
 * writes at the lifetime the task asked for, and output with its reasoning. Null when the model has no price.
 */
export function costUsd(
  prices: ModelPrices | undefined,
  usages: readonly TokenUsage[],
  cacheTtl: '5m' | '1h' = '5m',
): number | null {
  if (!prices) return null;
  let total = 0;
  for (const usage of usages) {
    const rates = ratesFor(prices, usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens);
    if (rates.input_token === undefined || rates.output_token === undefined) return null;
    const write =
      (cacheTtl === '1h' ? rates.cache_write_1h_token : rates.cache_write_5m_token) ??
      rates.cache_write_token ??
      rates.input_token;
    total +=
      usage.inputTokens * rates.input_token +
      usage.cacheReadTokens * (rates.cached_input_token ?? rates.input_token) +
      usage.cacheWriteTokens * write +
      usage.outputTokens * rates.output_token;
  }
  return Number(total.toFixed(9));
}
