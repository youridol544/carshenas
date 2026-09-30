// CS-52's evaluation of listing.facts on its labelled set: every item through the AI layer exactly as the worker will
// call it (the task's registry entry, Metis's native route, the schema, the checks, one re-ask), then the call site's
// confidence signals against CS-34's parsed fields, scored against the labels.
//
//   pnpm --filter @carshenas/ai listing-facts:evaluate [--models gemini,luna] [--split all|development|test]
//                                                      [--limit n] [--budget 0.9]
//   pnpm --filter @carshenas/ai listing-facts:evaluate --score results/listing-facts-<stamp>.json[,<another>]
//
// Answers are cached by input hash in results/listing-facts-cache.json (git-ignored), so a second run of an
// unchanged prompt makes no model call. It stops before a call once the run's measured cost reaches --budget (US$).
// Run from an Iranian network, and only within a budget the owner agreed.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createAi } from '../../src/ai.ts';
import type { AnswerCache, StoredRow } from '../../src/answer-cache.ts';
import { ModelCallError } from '../../src/errors.ts';
import { modelName, type ModelChoice } from '../../src/metis.ts';
import { costUsd, createMetisPriceBook } from '../../src/pricing.ts';
import { STEP_MODELS } from '../../src/registry.ts';
import { promptVersion, type RegistryEntry } from '../../src/task.ts';
import { recordingLogger } from '../../src/test-support/recording-logger.ts';
import {
  listingFactsEntry,
  type ListingFacts,
  type ListingFactsInput,
} from '../../src/tasks/listing-facts.ts';
import { NOTHING_PARSED, nextStep, type FieldReading } from '../../src/tasks/listing-facts-review.ts';
import { metisKey, percentile, writeResults } from '../support.ts';
import { loadSet, type Item } from './data.ts';
import { report } from './score.ts';

const MODELS: Readonly<Record<string, ModelChoice>> = {
  gemini: STEP_MODELS.extraction.model,
  luna: STEP_MODELS.extraction.fallback,
};

/** One item's call, as the results file keeps it. */
export type CallRecord = {
  readonly model: string;
  readonly item: string;
  readonly outcome: string;
  readonly attempts: number;
  readonly cached: boolean;
  readonly latencyMs: number;
  readonly costUsd: number | null;
  /** The same tokens priced as if none had been read from the provider's cache (CS-47's note on Luna). */
  readonly uncachedCostUsd: number | null;
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  readonly problemPaths: readonly string[];
  readonly value?: ListingFacts;
  readonly fields?: readonly FieldReading[];
  readonly hold?: readonly string[];
  readonly error?: string;
};

export type Run = {
  readonly task: string;
  readonly promptVersion: string;
  readonly startedAt: string;
  readonly records: readonly CallRecord[];
};

/** The answer cache in a git-ignored file: validated answers only, as the layer stores them. */
function fileAnswerCache(file: string): AnswerCache {
  const rows = new Map<string, StoredRow>(
    existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as [string, StoredRow][]) : [],
  );
  return {
    get: (key) => Promise.resolve(rows.get(key.toString('hex'))),
    put(key, answer) {
      const hex = key.toString('hex');
      const stored = rows.get(hex) ?? { ...answer, id: rows.size + 1 };
      rows.set(hex, stored);
      writeFileSync(file, JSON.stringify([...rows]));
      return Promise.resolve(stored);
    },
  };
}

async function run(options: {
  models: readonly string[];
  items: readonly Item[];
  budget: number;
}): Promise<Run> {
  const apiKey = metisKey();
  const prices = createMetisPriceBook({ logger: recordingLogger() });
  await prices.refresh();
  const cache = fileAnswerCache(
    fileURLToPath(new URL('../../results/listing-facts-cache.json', import.meta.url)),
  );
  const records: CallRecord[] = [];
  const startedAt = new Date().toISOString();
  let spent = 0;
  for (const name of options.models) {
    const model = MODELS[name];
    if (!model) throw new Error(`unknown model ${name}: ${Object.keys(MODELS).join(', ')}`);
    const entry: RegistryEntry<ListingFactsInput, ListingFacts> = { ...listingFactsEntry, model };
    const ai = createAi({
      apiKey,
      registry: { 'listing.facts': entry },
      logger: recordingLogger(),
      cache,
      prices,
    });
    const priced = prices.pricesOf(model.id);
    for (const item of options.items) {
      if (spent >= options.budget) {
        console.log(`budget of US$${String(options.budget)} reached after US$${spent.toFixed(4)}: stopping`);
        return { task: 'listing.facts', promptVersion: promptVersion(entry), startedAt, records };
      }
      const input = { title: item.title, description: item.description };
      const started = performance.now();
      try {
        const result = await ai.call('listing.facts', input);
        const usage = result.attempts.map((attempt) => attempt.usage);
        const sum = (pick: (u: (typeof usage)[number]) => number) =>
          usage.reduce((total, u) => total + pick(u), 0);
        const cost = result.cached ? 0 : costUsd(priced, usage);
        const uncached = result.cached
          ? 0
          : costUsd(
              priced,
              usage.map((u) => ({
                ...u,
                inputTokens: u.inputTokens + u.cacheReadTokens,
                cacheReadTokens: 0,
              })),
            );
        spent += cost ?? 0;
        const step = nextStep(result, input, item.parsed ?? NOTHING_PARSED);
        records.push({
          model: modelName(model),
          item: item.id,
          outcome: result.outcome,
          attempts: result.attempts.length,
          cached: result.cached,
          latencyMs: Math.round(performance.now() - started),
          costUsd: cost,
          uncachedCostUsd: uncached,
          inputTokens: sum((u) => u.inputTokens),
          cacheReadTokens: sum((u) => u.cacheReadTokens),
          outputTokens: sum((u) => u.outputTokens),
          reasoningTokens: sum((u) => u.reasoningTokens),
          problemPaths: result.outcome === 'ok' ? [] : result.problems.map((problem) => problem.path),
          ...(result.outcome === 'ok' ? { value: result.value } : {}),
          ...(step.action === 'store' ? { fields: step.fields, hold: step.hold } : {}),
        });
      } catch (error) {
        records.push({
          model: modelName(model),
          item: item.id,
          outcome: 'error',
          attempts: 0,
          cached: false,
          latencyMs: Math.round(performance.now() - started),
          costUsd: 0,
          uncachedCostUsd: 0,
          inputTokens: 0,
          cacheReadTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          problemPaths: [],
          error:
            error instanceof ModelCallError ? `${error.reason} ${String(error.status ?? '')}` : String(error),
        });
      }
      const last = records.at(-1);
      process.stdout.write(
        `${name.padEnd(7)} ${item.id} ${last?.outcome ?? '?'}${last?.cached ? ' (cached)' : ''} ${String(last?.latencyMs)} ms\n`,
      );
    }
  }
  return {
    task: 'listing.facts',
    promptVersion: promptVersion(listingFactsEntry),
    startedAt,
    records,
  };
}

const { values } = parseArgs({
  options: {
    models: { type: 'string', default: 'gemini,luna' },
    split: { type: 'string', default: 'all' },
    limit: { type: 'string' },
    budget: { type: 'string', default: '0.9' },
    score: { type: 'string' },
  },
});

const set = loadSet();
if (values.score) {
  const runs = values.score.split(',').map((file) => JSON.parse(readFileSync(file, 'utf8')) as Run);
  console.log(report(runs, set).join('\n'));
} else {
  const chosen = set.filter((item) => values.split === 'all' || item.split === values.split);
  const items = values.limit ? chosen.slice(0, Number(values.limit)) : chosen;
  const result = await run({
    models: values.models.split(','),
    items,
    budget: Number(values.budget),
  });
  const file = writeResults('listing-facts', result);
  console.log(report([result], set).join('\n'));
  console.log(`\nresults: ${file}`);
  const fresh = result.records.filter((record) => !record.cached);
  console.log(
    `fresh calls ${String(fresh.length)}, measured US$${fresh.reduce((total, r) => total + (r.costUsd ?? 0), 0).toFixed(4)}, p95 ${String(
      percentile(
        fresh.map((r) => r.latencyMs),
        0.95,
      ),
    )} ms`,
  );
}
