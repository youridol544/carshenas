// The registry (ADR-0021 point 2.1): every AI task the product runs, with the model it runs on, its fallback and its
// settings. Switching a task's model is changing its `model` line here. CS-52 adds the first task (listing facts),
// CS-46 names each task's model and fallback from its bake-off, and CS-82 switches to the fallback in an outage.
//
//   'listing.facts': {
//     task: listingFacts,
//     model: openai('gpt-5.6-luna', { reasoningEffort: 'low' }),
//     fallback: anthropic('claude-haiku-4-5'),
//     settings: { maxOutputTokens: 4096, timeoutMs: 30_000, maxReasks: 1 },
//   },
import type { Registry } from './task.ts';

export const REGISTRY = {} as const satisfies Registry;
export type ProductRegistry = typeof REGISTRY;
