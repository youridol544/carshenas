import 'server-only';
import { createAi, type Ai } from '@carshenas/ai/ai';
import { postgresAnswerCache } from '@carshenas/ai/answer-store';
import { createMetisPriceBook } from '@carshenas/ai/pricing';
import { queryFiltersEntry } from '@carshenas/ai/tasks/query-filters';
import { database } from '@/server/db/database';
import { env } from '@/server/env';
import { logger } from '@/server/observability/logger';

// The AI layer in the web app (ADR-0021, CS-62): created on the first question that needs it, never at start, so a
// page, a build and a deployment with the master switch off (SEARCH_UNDERSTANDING_AI, off by default) need no key and
// make no request of any kind. Its answers are cached in PostgreSQL (ai_answer, the web role may read and add) and its
// calls priced at Metis's list, which is read once here and again daily by the price book itself. The web path makes
// one attempt within a deadline (query-filters-step.ts); nothing here retries, schedules or runs in the background
// except that price-list fetch, which asks for no model.

const REGISTRY = { 'query.filters': queryFiltersEntry } as const;
export type WebModels = Ai<typeof REGISTRY>;

// How long the first question waits for the price list; without a price the cap cannot count, so a question that
// finds none is answered by code (hasPrice).
const PRICES_WAIT_MS = 2_000;

const globalForModels = globalThis as typeof globalThis & { carshenasWebModels?: Promise<WebModels> };

async function start(): Promise<WebModels> {
  const prices = createMetisPriceBook({
    logger: logger.child({ component: 'ai' }),
    ...(env.metisPricingUrl === undefined ? {} : { url: env.metisPricingUrl }),
  });
  // The key is checked here, before anything is fetched: a missing key is MetisKeyMissingError.
  const models = createAi({
    apiKey: env.metisApiKey,
    registry: REGISTRY,
    logger: logger.child({ component: 'ai' }),
    cache: postgresAnswerCache(database()),
    prices,
  });
  await Promise.race([
    prices.refresh(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, PRICES_WAIT_MS).unref();
    }),
  ]);
  return models;
}

/**
 * The layer, once per process. Throws MetisKeyMissingError without a key; the caller answers without the model. A
 * layer that failed to start is not kept, so a key set later is found by the next question.
 */
export function webModels(): Promise<WebModels> {
  const started = (globalForModels.carshenasWebModels ??= start());
  started.catch(() => {
    globalForModels.carshenasWebModels = undefined;
  });
  return started;
}
