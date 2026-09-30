// CS-46's step models (docs/research/2026-09-30-model-per-ai-step.md): every AI step names a model and a fallback on
// another provider's route, never Metis's national-internet model (ADR-0019), and both are priced by Metis, so a
// call's cost line is never null. The prices are Metis's list as read on 2026-09-30.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { modelName } from './metis.ts';
import { costUsd, priceBookOf, type ModelPrices } from './pricing.ts';
import { AI_STEPS, STEP_MODELS } from './registry.ts';

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
