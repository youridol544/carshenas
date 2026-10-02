// CS-62's evaluation of plain-Farsi search on its labelled set: every query through the product's own pipeline (the
// code pass, then the model step exactly as the web route binds it: the registry entry, Metis's native route, the
// schema, the checks, one re-ask inside a deadline, the answer cache), scored against the labels.
//
//   pnpm --filter @carshenas/ai query-understanding:evaluate [--model gemini|luna] [--split development|test|all]
//                                                            [--mode full|code-only|model-only] [--limit n] [--only Q001,Q002]
//                                                            [--budget 0.5]
//                                                            [--cache-only] [--fresh]
//   pnpm --filter @carshenas/ai query-understanding:evaluate --score results/query-understanding-<stamp>.json[,<another>]
//
// Answers are cached by input hash in the database's ai_answer (WORKER_DATABASE_URL, the worker's role), so a second run
// of an unchanged prompt makes no model call. It stops before a call once the run's measured cost reaches --budget (US$).
// --cache-only never reaches Metis: a request with no stored answer is answered without the model. Run from an Iranian
// network, and only within the budget the owner agreed (CS-62: US$3 in all). --mode code-only is the product with its
// master switch off (SEARCH_UNDERSTANDING_AI, off by default): no model, no database, no key, free.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createDatabase } from '@carshenas/db/database';
import { buildLexicon, type LexiconRows } from '@carshenas/search/understand/lexicon';
import { understandQuery, type ModelStep } from '@carshenas/search/understand/understand';
import { createAi } from '../../src/ai.ts';
import { memoryAnswerCache } from '../../src/answer-cache.ts';
import { postgresAnswerCache } from '../../src/answer-store.ts';
import { modelName, type ModelChoice } from '../../src/metis.ts';
import { createMetisPriceBook } from '../../src/pricing.ts';
import { STEP_MODELS } from '../../src/registry.ts';
import { promptVersion, type RegistryEntry } from '../../src/task.ts';
import {
  queryFiltersEntry,
  type QueryFiltersInput,
  type QueryReading,
} from '../../src/tasks/query-filters.ts';
import { queryFiltersStep, type QueryFiltersCall } from '../../src/tasks/query-filters-step.ts';
import { recordingLogger } from '../../src/test-support/recording-logger.ts';
import { metisKey, percentile, writeResults } from '../support.ts';
import { labelsHash, loadSet } from './data.ts';
import { report, type QueryRecord, type Run } from './report.ts';

const MODELS: Readonly<Record<string, ModelChoice>> = {
  gemini: STEP_MODELS.query.model,
  luna: STEP_MODELS.query.fallback,
};

/** The deadline the web route gives a model call and its one re-ask (docs/specs/S03). */
const DEADLINE_MS = 7_000;

const { values } = parseArgs({
  options: {
    model: { type: 'string', default: 'gemini' },
    split: { type: 'string', default: 'all' },
    mode: { type: 'string', default: 'full' },
    limit: { type: 'string' },
    only: { type: 'string' },
    budget: { type: 'string', default: '0.5' },
    score: { type: 'string' },
    'cache-only': { type: 'boolean', default: false },
    // A memory cache only: every request reaches the model, so a run measures latency and cost, and stores nothing.
    fresh: { type: 'boolean', default: false },
  },
});

const rows = JSON.parse(
  readFileSync(new URL('./data/lexicon-rows.json', import.meta.url), 'utf8'),
) as LexiconRows;
const lexicon = buildLexicon(rows);
const set = loadSet();

/** What a run with no model records as its model: a label in the report, never a model id. */
const NO_MODEL = 'none';

/** The items a run covers: the split asked for, narrowed by --only and --limit. */
function itemsOfRun() {
  const only = values.only?.split(',');
  const chosen = set.filter(
    (item) =>
      (values.split === 'all' || item.split === values.split) &&
      (only === undefined || only.includes(item.id)),
  );
  return values.limit ? chosen.slice(0, Number(values.limit)) : chosen;
}

/** The product with its master switch off: code alone, no model, no database, no key, free. */
async function runCodeOnly(): Promise<Run> {
  const startedAt = new Date().toISOString();
  const records: QueryRecord[] = [];
  for (const item of itemsOfRun()) {
    const started = performance.now();
    const { understanding, trace } = await understandQuery(item.text, {
      lexicon,
      solarYear: 1405,
      withoutModel: 'switched_off',
    });
    records.push({
      id: item.id,
      understanding,
      trace,
      calls: [],
      totalMs: Math.round(performance.now() - started),
    });
  }
  return {
    task: 'query.filters',
    promptVersion: promptVersion(queryFiltersEntry),
    labelsHash: labelsHash(),
    model: NO_MODEL,
    mode: 'code-only',
    startedAt,
    records,
  };
}

async function run(): Promise<Run> {
  if (!['full', 'code-only', 'model-only'].includes(values.mode))
    throw new Error(`unknown mode ${values.mode}: full, code-only or model-only`);
  if (values.mode === 'code-only') return runCodeOnly();
  const model = MODELS[values.model];
  if (!model) throw new Error(`unknown model ${values.model}: ${Object.keys(MODELS).join(', ')}`);
  const connectionString = process.env.WORKER_DATABASE_URL;
  if (!connectionString) throw new Error('WORKER_DATABASE_URL is not set: answers are cached in ai_answer');
  const db = createDatabase({
    connectionString,
    applicationName: 'carshenas-query-understanding-evaluation',
    max: 2,
    onIdleError: () => undefined,
  });
  try {
    const prices = createMetisPriceBook({ logger: recordingLogger() });
    await prices.refresh();
    const priced = prices.pricesOf(model.id);
    if (!priced) throw new Error(`Metis lists no price for ${model.id}: refusing to run without a cost`);
    const entry: RegistryEntry<QueryFiltersInput, QueryReading> = { ...queryFiltersEntry, model };
    const noNetwork: typeof globalThis.fetch = () =>
      Promise.reject(new Error('--cache-only: no request is made'));
    const ai = createAi({
      apiKey: metisKey() ?? 'cache-only',
      registry: { 'query.filters': entry },
      logger: recordingLogger(),
      cache: values.fresh ? memoryAnswerCache() : postgresAnswerCache(db),
      prices,
      ...(values['cache-only'] ? { fetch: noNetwork } : {}),
    });
    const items = itemsOfRun();
    const records: QueryRecord[] = [];
    const startedAt = new Date().toISOString();
    let spent = 0;
    let failedInARow = 0;
    for (const item of items) {
      if (spent >= Number(values.budget)) {
        console.log(`budget of US$${values.budget} reached after US$${spent.toFixed(4)}: stopping`);
        break;
      }
      const calls: QueryFiltersCall[] = [];
      const step: ModelStep = queryFiltersStep(ai, {
        deadlineMs: DEADLINE_MS,
        onCall: (call) => calls.push(call),
      });
      const started = performance.now();
      const { understanding, trace } = await understandQuery(item.text, {
        lexicon,
        solarYear: 1405,
        model: step,
        ...(values.mode === 'model-only' ? { codeFirst: false } : {}),
      });
      const totalMs = Math.round(performance.now() - started);
      for (const call of calls) spent += call.costUsd ?? 0;
      failedInARow = calls.some((call) => call.outcome === 'error' && call.errorReason !== 'timeout')
        ? failedInARow + 1
        : 0;
      if (failedInARow >= 3 && !values['cache-only'])
        throw new Error('three queries in a row got no answer from the model: stopping the run');
      records.push({ id: item.id, understanding, trace, calls, totalMs });
      const last = calls.at(-1);
      process.stdout.write(
        `${item.id} ${trace.asked ?? 'code'} ${last === undefined ? '' : `${last.outcome}${last.cached ? ' (cached)' : ''} ${String(last.latencyMs)} ms`} total ${String(totalMs)} ms\n`,
      );
    }
    return {
      task: 'query.filters',
      promptVersion: promptVersion(entry),
      labelsHash: labelsHash(),
      model: modelName(model),
      mode: values.mode === 'model-only' ? 'model-only' : 'full',
      startedAt,
      records,
    };
  } finally {
    await db.destroy();
  }
}

const CURRENT = { promptVersion: promptVersion(queryFiltersEntry), labelsHash: labelsHash() };
if (values.score) {
  const runs = values.score.split(',').map((file) => JSON.parse(readFileSync(file, 'utf8')) as Run);
  console.log(report(runs, set, CURRENT).join('\n'));
} else {
  const result = await run();
  const file = writeResults('query-understanding', result);
  console.log(report([result], set, CURRENT).join('\n'));
  console.log(`\nresults: ${file}`);
  const fresh = result.records
    .flatMap((record) => record.calls)
    .filter((call) => !call.cached && call.outcome !== 'error');
  if (result.mode !== 'code-only')
    console.log(
      `fresh calls ${String(fresh.length)}, measured US$${fresh.reduce((total, call) => total + (call.costUsd ?? 0), 0).toFixed(4)}, p95 ${String(
        percentile(
          fresh.map((call) => call.latencyMs),
          0.95,
        ),
      )} ms`,
    );
}
