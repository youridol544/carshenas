// The live run of ADR-0021's upgrade gate, beside the wire check and the re-ask tests in src/: each of Metis's four
// native routes answers CS-42's three synthetic listings through the layer, with no cache. It prints and records the
// outcome, the answering model, tokens, latency and cost at Metis's live prices, and the layer's own line for each
// call. With --record it also saves one raw answer per route into src/test-support/recorded/, which the wire check
// replays. Run from an Iranian network: pnpm --filter @carshenas/ai live [--record]. About US$0.01 (2026-09-29).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createAi } from '../src/ai.ts';
import { anthropic, deepseek, google, modelName, openai, type ModelChoice } from '../src/metis.ts';
import { createMetisPriceBook } from '../src/pricing.ts';
import type { RegistryEntry } from '../src/task.ts';
import {
  listingCondition,
  SAMPLES,
  type ListingCondition,
  type Sample,
} from '../src/test-support/listing-condition.ts';
import { recordingLogger } from '../src/test-support/recording-logger.ts';
import { metisKey, recordingFetch, writeResults } from './support.ts';

const record = process.argv.includes('--record');

const ROUTES: readonly { name: string; model: ModelChoice; maxOutputTokens: number }[] = [
  { name: 'openai', model: openai('gpt-5.6-luna', { reasoningEffort: 'low' }), maxOutputTokens: 4096 },
  { name: 'anthropic', model: anthropic('claude-haiku-4-5'), maxOutputTokens: 1024 },
  { name: 'google', model: google('gemini-3.1-flash-lite'), maxOutputTokens: 2048 },
  { name: 'deepseek', model: deepseek('deepseek-v4-flash'), maxOutputTokens: 4096 },
];

const pinned = z
  .object({ dependencies: z.record(z.string(), z.string()) })
  .parse(
    JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as unknown,
  ).dependencies;

const logger = recordingLogger();
const prices = createMetisPriceBook({ logger });
if (!(await prices.refresh())) console.log('Metis prices could not be loaded: costs will be null');

const routes: unknown[] = [];
for (const route of ROUTES) {
  const network = recordingFetch({ keepBodies: record });
  const entry: RegistryEntry<Sample, ListingCondition> = {
    task: listingCondition,
    model: route.model,
    settings: { maxOutputTokens: route.maxOutputTokens, timeoutMs: 60_000, maxReasks: 1 },
  };
  const ai = createAi({
    apiKey: metisKey(),
    registry: { 'listing.condition': entry },
    logger,
    prices,
    fetch: network.fetch,
  });
  const calls: unknown[] = [];
  for (const listing of SAMPLES) {
    const started = performance.now();
    try {
      const result = await ai.call('listing.condition', listing);
      calls.push({
        sample: listing.id,
        outcome: result.outcome,
        attempts: result.attempts.length,
        answeringModel: result.attempts.at(-1)?.answeringModel,
        latencyMs: Math.round(performance.now() - started),
        ...(result.outcome === 'ok'
          ? { value: result.value }
          : { problemPaths: result.problems.map((problem) => problem.path) }),
      });
      console.log(
        `${route.name.padEnd(10)} ${listing.id.padEnd(28)} ${result.outcome} (${result.attempts.length})`,
      );
    } catch (error) {
      calls.push({
        sample: listing.id,
        outcome: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`${route.name.padEnd(10)} ${listing.id.padEnd(28)} error`);
    }
  }
  const answered = network.exchanges.find(
    (exchange) => exchange.status === 200 && exchange.body !== undefined,
  );
  if (record && answered?.body !== undefined) {
    const file = fileURLToPath(new URL(`../src/test-support/recorded/${route.name}.json`, import.meta.url));
    const recorded = {
      route: route.name,
      model: modelName(route.model),
      recordedAt: new Date().toISOString(),
      note: "A real answer from Metis to one of CS-42's synthetic listings, replayed by wire.test.ts.",
      status: answered.status,
      headers: answered.headers,
      body: JSON.parse(answered.body) as unknown,
    };
    writeFileSync(file, `${JSON.stringify(recorded, null, 2)}\n`);
  }
  routes.push({
    route: route.name,
    model: modelName(route.model),
    calls,
    exchanges: network.exchanges.map(({ body: _body, ...exchange }) => exchange),
  });
}

const lines = logger.lines
  .filter((line) => line.message === 'model call completed')
  .map((line) => line.fields);
const file = writeResults('live', { ranAt: new Date().toISOString(), pinned, routes, lines });
console.log(`wrote ${file}`);
