import { createAi } from '@carshenas/ai/ai';
import type { AnswerCache } from '@carshenas/ai/answer-cache';
import { createMetisPriceBook } from '@carshenas/ai/pricing';
import { REGISTRY } from '@carshenas/ai/registry';
import type { Logger } from '@carshenas/observability/logger';
import type { JobDefinition, WorkerModels } from './runtime/job.ts';

// The AI layer in the worker (CS-45, ADR-0021): created once at start, before any job is claimed, and only when a
// registered job declares callsModels. So a worker without such jobs, `pnpm check` and a fresh clone need no key,
// and a worker that calls models without METIS_API_KEY stops at start with the layer's message (ADR-0019 point 1).
// Its answers are cached in PostgreSQL (ai_answer) and priced at Metis's live list, refreshed daily.

export type StartModelsOptions = {
  readonly jobs: readonly JobDefinition[];
  /** env.metisApiKey. */
  readonly apiKey: string | undefined;
  readonly logger: Logger;
  /** postgresAnswerCache(db) in the worker. */
  readonly cache: AnswerCache;
  /** The global fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
};

/** The layer for the jobs that call models, or undefined when none does. Throws MetisKeyMissingError without a key. */
export async function startModels(options: StartModelsOptions): Promise<WorkerModels | undefined> {
  const callers = options.jobs.filter((job) => job.callsModels === true).map((job) => job.name);
  if (callers.length === 0) return undefined;
  const prices = createMetisPriceBook({
    logger: options.logger,
    ...(options.fetch && { fetch: options.fetch }),
  });
  // The key is checked here, before the price list or anything else is fetched.
  const models = createAi({
    apiKey: options.apiKey,
    registry: REGISTRY,
    logger: options.logger,
    cache: options.cache,
    prices,
    ...(options.fetch && { fetch: options.fetch }),
  });
  const pricesLoaded = await prices.refresh();
  options.logger.info('models ready', { jobs: callers, tasks: Object.keys(REGISTRY), pricesLoaded });
  return models;
}

const WITHOUT_MODELS =
  'this worker started without the AI layer: a job that calls models declares callsModels: true (runtime/job.ts)';

/** context.models in a worker whose jobs do not call models: any use is a mistake, and says how to fix it. */
export const NO_MODELS: WorkerModels = {
  call: () => Promise.reject(new Error(WITHOUT_MODELS)),
  promptVersion: () => {
    throw new Error(WITHOUT_MODELS);
  },
};
