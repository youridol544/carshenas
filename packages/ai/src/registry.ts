// The registry (ADR-0021 point 2.1): every AI task the product runs, with the model it runs on, its fallback and its
// settings. Switching a task's model is changing its `model` line here. CS-46 chose a model and a fallback for each
// AI step (STEP_MODELS below); the task that implements a step takes both from there, CS-82 switches to the fallback
// in an outage, and CS-52 confirms extraction's model on its labelled set.
//
//   'listing.facts': {
//     task: listingFacts,
//     model: STEP_MODELS.extraction.model,
//     fallback: STEP_MODELS.extraction.fallback,
//     settings: { maxOutputTokens: 4096, timeoutMs: 30_000, maxReasks: 1 },
//   },
import { anthropic, google, openai, type ModelChoice } from './metis.ts';
import type { Registry } from './task.ts';

/** The product's AI steps (ADR-0019, ADR-0021): extraction (CS-52), duplicates (CS-55), query (CS-62), explanation (CS-64). */
export const AI_STEPS = ['extraction', 'duplicates', 'query', 'explanation'] as const;
export type AiStep = (typeof AI_STEPS)[number];

export type StepModels = {
  readonly model: ModelChoice;
  /** On another provider's route, so one upstream's outage leaves the step a model (ADR-0019 point 4, CS-82). */
  readonly fallback: ModelChoice;
  /** Why, in one line; the measurements are in docs/research/2026-09-30-model-per-ai-step.md. */
  readonly reason: string;
};

/**
 * Each step's model and fallback, chosen by CS-46 on 2026-09-30 from Artificial Analysis's shortlist, filtered to what
 * Metis serves, then a bake-off through this layer on real Divar listings and buyer searches.
 */
export const STEP_MODELS = {
  extraction: {
    model: google('gemini-3.7-flash', { thinkingConfig: { thinkingLevel: 'low' } }),
    fallback: openai('gpt-6-luna', { reasoningEffort: 'low' }),
    reason:
      'Most accurate on 39 listings over three runs (99.3% of fields, 94% of listings fully right, 0 of 21 injected values taken) at $1.64 per 1,000; its fallback scored 98.2% at $0.16.',
  },
  duplicates: {
    model: google('gemini-3.7-flash', { thinkingConfig: { thinkingLevel: 'low' } }),
    fallback: anthropic('claude-sonnet-5-5', { thinking: { type: 'adaptive' }, effort: 'low' }),
    reason:
      'Both decided all 20 questions right with no wrong merge; the default is the stronger of the affordable models by Artificial Analysis, and volume is only the uncertain band.',
  },
  query: {
    model: google('gemini-3.5-flash-lite', { thinkingConfig: { thinkingLevel: 'minimal' } }),
    fallback: openai('gpt-6-luna', { reasoningEffort: 'none' }),
    reason:
      'Every field of 24 searches right and the fastest (1.3 s median, 1.8 s at the 95th percentile) while a buyer waits; the fallback was as accurate, slower and cheaper.',
  },
  explanation: {
    model: openai('gpt-6-luna', { reasoningEffort: 'low' }),
    fallback: anthropic('claude-sonnet-5-5', { thinking: { type: 'disabled' } }),
    reason:
      'Valid on the first answer most often (15 of 20) and 17 of 20 faithful by hand at $0.13 per 1,000; the fallback wrote all 20 faithfully at 50 times the price.',
  },
} as const satisfies Record<AiStep, StepModels>;

export const REGISTRY = {} as const satisfies Registry;
export type ProductRegistry = typeof REGISTRY;
