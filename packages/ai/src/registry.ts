// The registry (ADR-0021 point 2.1): every AI task the product runs, with the model it runs on, its fallback and its
// settings. CS-46 chose a model and a fallback for each AI step (STEP_MODELS, in step-models.ts); the task that
// implements a step takes both from there, CS-82 switches to the fallback in an outage, and CS-52 confirmed
// extraction's model on its labelled set.
import { listingFactsEntry } from './tasks/listing-facts.ts';
import { queryFiltersEntry } from './tasks/query-filters.ts';
import type { Registry } from './task.ts';

export { AI_STEPS, STEP_MODELS, type AiStep, type StepModels } from './step-models.ts';

/**
 * The tasks the product runs. listing.facts (CS-52) entered on 2026-09-30 with its evaluation at prompt version
 * 571b413f827bf546 (docs/evidence/listing-facts/2026-09-30/); query.filters (CS-62, plain-Farsi search) entered on
 * 2026-10-02 at 64b3c6e03ee174cb (docs/evidence/query-understanding/2026-10-02/). A changed prompt version needs a new
 * evaluation first (registry.test.ts).
 */
export const REGISTRY = {
  'listing.facts': listingFactsEntry,
  'query.filters': queryFiltersEntry,
} as const satisfies Registry;
export type ProductRegistry = typeof REGISTRY;
