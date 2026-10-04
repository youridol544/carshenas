// CS-46's step models (docs/research/2026-09-30-model-per-ai-step.md): every AI step names a model and a fallback on
// another provider's route, never Metis's national-internet model (ADR-0019), and both are priced by Metis, so a
// call's cost line is never null. The prices are Metis's list as read on 2026-09-30.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { modelName } from './metis.ts';
import { costUsd, priceBookOf, type ModelPrices } from './pricing.ts';
import { AI_STEPS, REGISTRY, STEP_MODELS } from './registry.ts';
import { promptVersion } from './task.ts';

const recorded = JSON.parse(
  readFileSync(new URL('./test-support/step-model-prices.json', import.meta.url), 'utf8'),
) as { prices: Record<string, ModelPrices> };
const prices = priceBookOf(recorded.prices);

describe('the step models', () => {
  for (const step of AI_STEPS) {
    const { model, fallback, reason } = STEP_MODELS[step];

    test(`${step} falls back to another provider's route`, () => {
      assert.notEqual(fallback.provider, model.provider, `${modelName(model)} and ${modelName(fallback)}`);
    });

    test(`${step} never uses metis-gpt`, () => {
      for (const choice of [model, fallback]) assert.doesNotMatch(choice.id, /^metis-/);
    });

    test(`${step} is priced by Metis, fallback included`, () => {
      const usage = {
        inputTokens: 1000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 100,
        reasoningTokens: 0,
      };
      for (const choice of [model, fallback]) {
        const cost = costUsd(prices.pricesOf(choice.id), [usage]);
        assert.ok(cost !== null && cost > 0, `${modelName(choice)} has no price in the recorded list`);
      }
    });

    test(`${step} says why`, () => {
      assert.ok(reason.length > 40);
    });
  }
});

// Rule 4 (.claude/rules/ai.md): a task is in the registry only at a prompt version a labelled set measured. A change to
// its instructions, glossary, schema, checks, render or output budget changes the version and fails this test until
// the evaluation is run again and its evidence recorded here.
const EVALUATED: Readonly<Record<keyof typeof REGISTRY, { version: string; evidence: string }>> = {
  'listing.facts': {
    version: '571b413f827bf546',
    evidence: 'docs/evidence/listing-facts/2026-09-30/report.md',
  },
  'query.filters': {
    version: '38cba78f3e912da3',
    evidence: 'docs/evidence/query-understanding/2026-10-04-country/report.md',
  },
};

const STEP_OF: Readonly<Record<keyof typeof REGISTRY, (typeof AI_STEPS)[number]>> = {
  'listing.facts': 'extraction',
  'query.filters': 'query',
};

describe('the registry', () => {
  for (const [name, entry] of Object.entries(REGISTRY)) {
    test(`${name} is registered at the prompt version its evaluation measured`, () => {
      const evaluated = EVALUATED[name as keyof typeof REGISTRY];
      assert.equal(promptVersion(entry), evaluated.version, `re-evaluate, then record ${evaluated.evidence}`);
      assert.ok(existsSync(new URL(`../../../${evaluated.evidence}`, import.meta.url)), evaluated.evidence);
    });

    test(`${name} runs on its step's model with its fallback`, () => {
      const step = STEP_OF[name as keyof typeof REGISTRY];
      assert.deepEqual(entry.model, STEP_MODELS[step].model);
      assert.deepEqual(entry.fallback, STEP_MODELS[step].fallback);
    });
  }
});
