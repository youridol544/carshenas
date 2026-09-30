// The models the bake-off compares for each step (CS-46): Artificial Analysis's shortlist, filtered to what Metis
// serves on its four native routes (docs/research/2026-09-30-model-per-ai-step.md), each at the settings the step
// would run it with. A candidate's label names the model and the setting that matters: reasoning effort or thinking.
import { anthropic, deepseek, google, openai, type ModelChoice } from '../../src/metis.ts';
import type { TaskSettings } from '../../src/task.ts';

export const STEPS = ['extraction', 'query', 'duplicate', 'explanation'] as const;
export type Step = (typeof STEPS)[number];

export type Candidate = {
  readonly label: string;
  readonly model: ModelChoice;
  /** Metis lists no price for it on 2026-09-30: its cost is estimated at `priceAs`'s price, and says so. */
  readonly priceAs?: string;
};

const luna = (effort: 'none' | 'low' | 'medium') => openai('gpt-6-luna', { reasoningEffort: effort });
const flash = (id: string, level: 'minimal' | 'low' | 'medium') =>
  google(id, { thinkingConfig: { thinkingLevel: level } });
const deepseekFlash = (thinking: boolean) =>
  deepseek(
    'deepseek-v4.1-flash',
    thinking
      ? { thinking: { type: 'enabled' }, reasoningEffort: 'high' }
      : { thinking: { type: 'disabled' } },
  );

export const CANDIDATES: Readonly<Record<Step, readonly Candidate[]>> = {
  extraction: [
    { label: 'gpt-6-luna/none', model: luna('none') },
    { label: 'gpt-6-luna/low', model: luna('low') },
    { label: 'gpt-5.6-luna/low', model: openai('gpt-5.6-luna', { reasoningEffort: 'low' }) },
    { label: 'gemini-3.1-flash-lite', model: google('gemini-3.1-flash-lite') },
    { label: 'gemini-3.5-flash-lite/minimal', model: flash('gemini-3.5-flash-lite', 'minimal') },
    { label: 'gemini-3.7-flash/low', model: flash('gemini-3.7-flash', 'low') },
    { label: 'deepseek-v4.1-flash/off', model: deepseekFlash(false) },
    { label: 'claude-haiku-4-5', model: anthropic('claude-haiku-4-5') },
    {
      label: 'claude-sonnet-5-5/off',
      model: anthropic('claude-sonnet-5-5', { thinking: { type: 'disabled' } }),
    },
  ],
  query: [
    { label: 'gpt-6-luna/none', model: luna('none') },
    { label: 'gpt-6-luna/low', model: luna('low') },
    { label: 'gemini-3.1-flash-lite', model: google('gemini-3.1-flash-lite') },
    { label: 'gemini-3.5-flash-lite/minimal', model: flash('gemini-3.5-flash-lite', 'minimal') },
    { label: 'gemini-3.7-flash/low', model: flash('gemini-3.7-flash', 'low') },
    { label: 'deepseek-v4.1-flash/off', model: deepseekFlash(false) },
    { label: 'claude-haiku-4-5', model: anthropic('claude-haiku-4-5') },
    {
      label: 'claude-sonnet-5-5/off',
      model: anthropic('claude-sonnet-5-5', { thinking: { type: 'disabled' } }),
    },
  ],
  duplicate: [
    { label: 'gpt-6-luna/low', model: luna('low') },
    { label: 'gpt-6-luna/medium', model: luna('medium') },
    { label: 'gpt-6-sol/low', model: openai('gpt-6-sol', { reasoningEffort: 'low' }) },
    { label: 'gemini-3.7-flash/low', model: flash('gemini-3.7-flash', 'low') },
    { label: 'gemini-3.7-flash/medium', model: flash('gemini-3.7-flash', 'medium') },
    { label: 'deepseek-v4.1-flash/high', model: deepseekFlash(true) },
    { label: 'claude-haiku-4-5', model: anthropic('claude-haiku-4-5') },
    {
      label: 'claude-sonnet-5-5/low',
      model: anthropic('claude-sonnet-5-5', { thinking: { type: 'adaptive' }, effort: 'low' }),
    },
  ],
  explanation: [
    { label: 'gpt-6-luna/low', model: luna('low') },
    { label: 'gemini-3.1-flash-lite', model: google('gemini-3.1-flash-lite') },
    { label: 'gemini-3.7-flash/low', model: flash('gemini-3.7-flash', 'low') },
    { label: 'deepseek-v4.1-flash/off', model: deepseekFlash(false) },
    { label: 'claude-haiku-4-5', model: anthropic('claude-haiku-4-5') },
    {
      label: 'claude-sonnet-5-5/off',
      model: anthropic('claude-sonnet-5-5', { thinking: { type: 'disabled' } }),
    },
  ],
};

/** Room for reasoning in the output budget, a deadline per attempt, and the layer's one re-ask (ADR-0021 point 2.3). */
export const SETTINGS: Readonly<Record<Step, TaskSettings>> = {
  extraction: { maxOutputTokens: 4096, timeoutMs: 90_000, maxReasks: 1 },
  query: { maxOutputTokens: 2048, timeoutMs: 60_000, maxReasks: 1 },
  duplicate: { maxOutputTokens: 8192, timeoutMs: 120_000, maxReasks: 1 },
  explanation: { maxOutputTokens: 2048, timeoutMs: 60_000, maxReasks: 1 },
};
