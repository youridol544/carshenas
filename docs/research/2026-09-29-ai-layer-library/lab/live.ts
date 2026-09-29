// The AI SDK against Metis, live: each native route answers the three synthetic listings through the re-ask layer
// (one re-ask allowed), and one call checks whether Metis serves OpenAI's Responses API, the OpenAI provider's
// default. Records what went on the wire (no key, no listing text), the outcome, the answering model, tokens,
// latency and the cost at Metis's live prices. Run from an Iranian network with `npm run live`.
import { networkSeen } from './netwatch.ts';
import { APICallError } from 'ai';
import { generateChecked } from './reask.ts';
import { checkGrounding, EXPECTED, INSTRUCTIONS, ListingFacts, SAMPLES } from './listing.ts';
import type { ListingFacts as Facts } from './listing.ts';
import { costUsd, loadMetisPrices, PRICING_URL } from './pricing.ts';
import { metisRoutes, openaiResponsesModel, summariseRequest } from './providers.ts';
import { metisKey, writeResults } from './results.ts';

const KEPT_HEADER = /request-id|x-request|cf-ray|processing-ms|server-timing|ratelimit|retry-after/i;

interface Exchange {
  request: ReturnType<typeof summariseRequest>;
  status: number;
  headers: Record<string, string>;
  errorBody?: string;
}

let exchanges: Exchange[] = [];
const recordingFetch: typeof fetch = async (input, init) => {
  const request = summariseRequest(input as string | URL | Request, init);
  const response = await fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(120_000) });
  const headers: Record<string, string> = {};
  for (const [name, value] of response.headers) if (KEPT_HEADER.test(name)) headers[name] = value;
  const exchange: Exchange = { request, status: response.status, headers };
  if (!response.ok) exchange.errorBody = (await response.clone().text()).slice(0, 600);
  exchanges.push(exchange);
  return response;
};

const priceOf = await loadMetisPrices();

const key = metisKey();
const results = {
  ranAt: new Date().toISOString(),
  sdk: { ai: '7.0.122', '@ai-sdk/openai': '4.0.81', '@ai-sdk/anthropic': '4.0.68', '@ai-sdk/google': '4.0.85', '@ai-sdk/deepseek': '3.0.56' },
  pricing: { source: PRICING_URL, rows: {} as Record<string, unknown> },
  calls: [] as unknown[],
  responsesApi: undefined as unknown,
};

for (const route of metisRoutes(key, recordingFetch)) {
  results.pricing.rows[route.modelId] = priceOf(route.modelId) ?? null;
  for (const sample of SAMPLES) {
    exchanges = [];
    const started = performance.now();
    let entry: Record<string, unknown>;
    try {
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
      entry = {
        outcome: outcome.kind,
        value: outcome.kind === 'ok' ? outcome.value : undefined,
        agreesWithExpected:
          outcome.kind === 'ok'
            ? Object.fromEntries(Object.entries(expected).map(([field, want]) => [field, outcome.value[field as keyof Facts] === want]))
            : undefined,
        attempts: outcome.attempts,
        costUsd: costUsd(priceOf(route.modelId), outcome.attempts),
      };
    } catch (error) {
      entry = {
        outcome: 'provider-error',
        error: APICallError.isInstance(error)
          ? { status: error.statusCode, message: error.message.slice(0, 300), body: error.responseBody?.slice(0, 600) }
          : String(error).slice(0, 300),
      };
    }
    results.calls.push({
      route: route.id,
      requestedModel: route.modelId,
      sample: sample.id,
      totalMs: Math.round(performance.now() - started),
      ...entry,
      wire: exchanges,
    });
    const attempts = (entry.attempts as Array<{ outcome: string; latencyMs: number }> | undefined) ?? [];
    console.log(
      `${route.id.padEnd(12)} ${sample.id.padEnd(28)} ${String(entry.outcome).padEnd(15)} attempts ${attempts.map((attempt) => `${attempt.outcome}:${attempt.latencyMs}ms`).join(',')} status ${exchanges.map((exchange) => exchange.status).join(',')} $${entry.costUsd ?? '-'}`,
    );
  }
}

// Does Metis serve the Responses API, which `openai(id)` uses by default?
exchanges = [];
try {
  const outcome = await generateChecked({
    model: openaiResponsesModel(key, recordingFetch),
    instructions: INSTRUCTIONS,
    input: SAMPLES[0]!.text,
    schema: ListingFacts,
    maxReasks: 0,
    maxOutputTokens: 4096,
    providerOptions: { openai: { reasoningEffort: 'low' } },
  });
  results.responsesApi = { outcome: outcome.kind, attempts: outcome.attempts, wire: exchanges };
} catch (error) {
  results.responsesApi = {
    outcome: 'provider-error',
    error: APICallError.isInstance(error)
      ? { status: error.statusCode, message: error.message.slice(0, 300), body: error.responseBody?.slice(0, 600) }
      : String(error).slice(0, 300),
    wire: exchanges,
  };
}
console.log('responses API', JSON.stringify((results.responsesApi as { outcome: string }).outcome), exchanges.map((exchange) => exchange.status));

// The positive control for the wire check's network watch: here it must see every request, and nothing else.
const hosts = [...new Set(networkSeen.map((line) => new URL(line.split(' ')[1]!).host))];
Object.assign(results, { networkRequestsSeen: networkSeen.length, networkHostsSeen: hosts });
console.log(`network requests seen: ${networkSeen.length}, hosts ${hosts.join(', ')}`);

console.log(`\nwrote ${writeResults('live', results)}`);
