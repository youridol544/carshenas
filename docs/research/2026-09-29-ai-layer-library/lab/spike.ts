// The CS-44 spike (acceptance criterion 3), live against Metis through the AI SDK:
// 1. A Metis model answers the three synthetic listings through the re-ask layer, and every answer passes the schema
//    and the grounding checks.
// 2. A validation failure is fed back to a real Metis model and corrected. Models on strict structured output rarely
//    fail, so the failure is seeded: an AI SDK middleware answers the first call itself with a typical mistake, and
//    the re-ask, carrying the validation error, goes to Metis. Two mistakes are seeded, one the schema catches and
//    one only the grounding check in code catches.
// Run from an Iranian network with `npm run spike`.
import type { LanguageModelV4, LanguageModelV4GenerateResult } from '@ai-sdk/provider';
import { wrapLanguageModel } from 'ai';
import { generateChecked } from './reask.ts';
import { checkGrounding, EXPECTED, INSTRUCTIONS, ListingFacts, SAMPLES } from './listing.ts';
import { costUsd, loadMetisPrices } from './pricing.ts';
import { metisRoutes } from './providers.ts';
import { metisKey, writeResults } from './results.ts';

const key = metisKey();
const priceOf = await loadMetisPrices();
const routes = metisRoutes(key, fetch).filter((route) => route.id === 'openai-chat' || route.id === 'anthropic');
const results = { ranAt: new Date().toISOString(), ai: '7.0.122', plain: [] as unknown[], reask: [] as unknown[] };

// Part 1: output that passes the schema, straight from Metis.
for (const route of routes) {
  for (const sample of SAMPLES) {
    const outcome = await generateChecked({
      model: route.model,
      instructions: INSTRUCTIONS,
      input: sample.text,
      schema: ListingFacts,
      check: (facts) => checkGrounding(facts, sample.text),
      maxReasks: 1,
      maxOutputTokens: route.maxOutputTokens,
      ...(route.providerOptions ? { providerOptions: route.providerOptions } : {}),
    });
    const expected = EXPECTED[sample.id]!;
    results.plain.push({
      route: route.id,
      requestedModel: route.modelId,
      sample: sample.id,
      outcome: outcome.kind,
      passesSchema: outcome.kind === 'ok' ? ListingFacts.safeParse(outcome.value).success : false,
      value: outcome.kind === 'ok' ? outcome.value : undefined,
      agreesWithExpected:
        outcome.kind === 'ok' ? (Object.keys(expected) as Array<keyof typeof expected>).every((field) => outcome.value[field] === expected[field]) : false,
      attempts: outcome.attempts,
      costUsd: costUsd(priceOf(route.modelId), outcome.attempts),
    });
    console.log(`plain  ${route.id.padEnd(12)} ${sample.id.padEnd(28)} ${outcome.kind}  ${outcome.attempts.map((attempt) => `${attempt.outcome}:${attempt.latencyMs}ms`).join(',')}`);
  }
}

// Part 2: a seeded mistake, then the real model's correction.
const peugeot = SAMPLES.find((sample) => sample.id === 'peugeot-206-jalali')!;
const zwnj = String.fromCodePoint(0x200c);
const correct = {
  paint_evidence: ['بی', 'رنگ'].join(zwnj),
  paint: 'none',
  price_evidence: 'کمی قابل مذاکره',
  price_type: 'negotiable',
  instructions_to_ai: false,
};
const SEEDS = {
  // Outside the enum: the schema rejects it.
  'schema: paint outside the enum': { ...correct, paint: 'unpainted' },
  // Retyped with a space for the zero-width non-joiner: valid for the schema, caught by the grounding check.
  'grounding: evidence retyped': { ...correct, paint_evidence: ['بی', 'رنگ'].join(' ') },
};

type Sent = Array<{ role: string; text: string }>;

/** The model, except that its first call is answered with `seededAnswer`; records what each real call was sent. */
function failingOnce(model: LanguageModelV4, seededAnswer: string, sentToModel: Sent[]) {
  let calls = 0;
  return wrapLanguageModel({
    model,
    middleware: {
      wrapGenerate: async ({ doGenerate, params }) => {
        calls += 1;
        if (calls === 1) {
          const seeded: LanguageModelV4GenerateResult = {
            content: [{ type: 'text', text: seededAnswer }],
            finishReason: { unified: 'stop', raw: 'seeded' },
            usage: {
              inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 0, text: 0, reasoning: 0 },
            },
            warnings: [],
            response: { modelId: 'seeded-first-answer' },
          };
          return seeded;
        }
        sentToModel.push(
          params.prompt.map((message) => ({
            role: message.role,
            text:
              typeof message.content === 'string'
                ? message.content
                : message.content.map((part) => ('text' in part ? part.text : `[${part.type}]`)).join(''),
          })),
        );
        return doGenerate();
      },
    },
  });
}

for (const route of routes) {
  for (const [seedName, seededFacts] of Object.entries(SEEDS)) {
    const sentToModel: Sent[] = [];
    const outcome = await generateChecked({
      model: failingOnce(route.model, JSON.stringify(seededFacts), sentToModel),
      instructions: INSTRUCTIONS,
      input: peugeot.text,
      schema: ListingFacts,
      check: (facts) => checkGrounding(facts, peugeot.text),
      maxReasks: 1,
      maxOutputTokens: route.maxOutputTokens,
      ...(route.providerOptions ? { providerOptions: route.providerOptions } : {}),
    });
    const realAttempts = outcome.attempts.slice(1);
    results.reask.push({
      route: route.id,
      requestedModel: route.modelId,
      seed: seedName,
      seededAnswer: seededFacts,
      outcome: outcome.kind,
      passesSchema: outcome.kind === 'ok' ? ListingFacts.safeParse(outcome.value).success : false,
      passesGrounding: outcome.kind === 'ok' ? checkGrounding(outcome.value, peugeot.text).length === 0 : false,
      value: outcome.kind === 'ok' ? outcome.value : undefined,
      attempts: outcome.attempts,
      feedbackSentToModel: sentToModel[0]?.at(-1)?.text,
      rolesSentToModel: sentToModel[0]?.map((message) => message.role),
      costUsd: costUsd(priceOf(route.modelId), realAttempts),
    });
    console.log(
      `reask  ${route.id.padEnd(12)} ${seedName.padEnd(32)} ${outcome.kind}  ${outcome.attempts.map((attempt) => `${attempt.outcome}:${attempt.answeringModel}`).join(' -> ')}`,
    );
  }
}

console.log(`\nwrote ${writeResults('spike', results)}`);
