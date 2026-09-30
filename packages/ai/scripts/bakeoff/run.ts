// The model bake-off (CS-46): runs each step's candidate models through the AI layer, exactly as a product task would
// call them (registry entry, native route, schema, checks, one re-ask), on the hand-labelled items in data/, and
// scores the answers. No answer cache: every call reaches the model, so latency and cost are real.
//
//   pnpm --filter @carshenas/ai bakeoff --step extraction [--only gpt-6-luna/none,claude-haiku-4-5] [--limit 5]
//                                           [--repeat 3]
//   pnpm --filter @carshenas/ai bakeoff --score results/bakeoff-extraction-<stamp>.json
//
// Run from an Iranian network. It prints the table for the research note and writes every call, with the answer, to
// packages/ai/results/ (git-ignored); the runs the note quotes are copied into its evidence folder.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createAi } from '../../src/ai.ts';
import { ModelCallError } from '../../src/errors.ts';
import { modelName } from '../../src/metis.ts';
import { costUsd, createMetisPriceBook, type PriceBook } from '../../src/pricing.ts';
import type { RegistryEntry, Task } from '../../src/task.ts';
import { recordingLogger } from '../../src/test-support/recording-logger.ts';
import { metisKey, writeResults } from '../support.ts';
import { CANDIDATES, SETTINGS, STEPS, type Candidate, type Step } from './candidates.ts';
import { loadDeals, loadDuplicates, loadListings, loadQueries } from './data.ts';
import {
  scoreDuplicates,
  scoreExplanations,
  scoreExtraction,
  scoreQueries,
  summarise,
  table,
  type CallRecord,
  type DuplicateScore,
  type ExtractionScore,
  type Scored,
} from './score.ts';
import { duplicateTask, explanationTask, extractionTask, queryTask } from './tasks.ts';

const { values } = parseArgs({
  options: {
    step: { type: 'string' },
    only: { type: 'string' },
    limit: { type: 'string' },
    repeat: { type: 'string', default: '1' },
    score: { type: 'string' },
  },
});

type Item<Input> = { readonly id: string; readonly input: Input };

/** The layer's reason and status, and the provider's own answer where the SDK kept it: why a route refused a call. */
function describe(error: ModelCallError): string {
  const cause: unknown = error.cause;
  const body =
    cause !== null &&
    typeof cause === 'object' &&
    'responseBody' in cause &&
    typeof cause.responseBody === 'string'
      ? ` ${cause.responseBody.slice(0, 400)}`
      : '';
  return `${error.reason}${error.status === undefined ? '' : ` ${error.status}`}${body}`;
}

function isStep(value: string | undefined): value is Step {
  return (STEPS as readonly (string | undefined)[]).includes(value);
}

async function runCandidate<Input, Output>(options: {
  task: Task<Input, Output>;
  candidate: Candidate;
  step: Step;
  items: readonly Item<Input>[];
  repeat: number;
  prices: PriceBook;
  apiKey: string;
}): Promise<CallRecord[]> {
  const { task, candidate } = options;
  const entry: RegistryEntry<Input, Output> = {
    task,
    model: candidate.model,
    settings: SETTINGS[options.step],
  };
  const ai = createAi({
    apiKey: options.apiKey,
    registry: { [task.name]: entry },
    logger: recordingLogger(),
    prices: options.prices,
  });
  const priced = options.prices.pricesOf(candidate.priceAs ?? candidate.model.id);
  const records: CallRecord[] = [];
  for (let repeat = 1; repeat <= options.repeat; repeat += 1) {
    for (const item of options.items) {
      const started = performance.now();
      try {
        const result = await ai.call(task.name, item.input);
        const usage = result.attempts.map((attempt) => attempt.usage);
        const sum = (pick: (u: (typeof usage)[number]) => number) =>
          usage.reduce((total, u) => total + pick(u), 0);
        records.push({
          candidate: candidate.label,
          item: item.id,
          repeat,
          outcome: result.outcome,
          firstOutcome: result.attempts[0]?.outcome,
          attempts: result.attempts.length,
          totalMs: Math.round(performance.now() - started),
          firstAttemptMs: result.attempts[0]?.latencyMs,
          inputTokens: sum((u) => u.inputTokens),
          cacheReadTokens: sum((u) => u.cacheReadTokens),
          outputTokens: sum((u) => u.outputTokens),
          reasoningTokens: sum((u) => u.reasoningTokens),
          costUsd: costUsd(priced, usage),
          costEstimated: candidate.priceAs !== undefined,
          answeringModel: result.attempts.at(-1)?.answeringModel,
          problemPaths: result.outcome === 'ok' ? [] : result.problems.map((problem) => problem.path),
          ...(result.attempts[0] && result.attempts[0].outcome !== 'ok'
            ? {
                firstProblems: result.attempts[0].problems.map(
                  (problem) => `${problem.path}: ${problem.message}`,
                ),
              }
            : {}),
          ...(result.outcome === 'ok' ? { value: result.value } : {}),
        });
      } catch (error) {
        records.push({
          candidate: candidate.label,
          item: item.id,
          repeat,
          outcome: 'error',
          firstOutcome: 'error',
          attempts: 0,
          totalMs: Math.round(performance.now() - started),
          firstAttemptMs: undefined,
          inputTokens: 0,
          cacheReadTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          costUsd: 0,
          costEstimated: false,
          answeringModel: undefined,
          problemPaths: [],
          error: error instanceof ModelCallError ? describe(error) : String(error),
        });
      }
      const last = records.at(-1);
      process.stdout.write(
        `${candidate.label.padEnd(32)} ${item.id.padEnd(5)} ${last?.outcome ?? '?'} ${last?.totalMs ?? ''} ms\n`,
      );
    }
  }
  return records;
}

function scoreStep(step: Step, records: readonly CallRecord[]): Scored | ExtractionScore | DuplicateScore {
  switch (step) {
    case 'extraction':
      return scoreExtraction(records, loadListings());
    case 'query':
      return scoreQueries(records, loadQueries());
    case 'duplicate':
      return scoreDuplicates(records, loadDuplicates());
    case 'explanation':
      return scoreExplanations(records, loadDeals());
  }
}

function report(step: Step, records: readonly CallRecord[]): { summaries: unknown[]; scores: unknown[] } {
  const labels = [...new Set(records.map((record) => record.candidate))];
  const summaries = [];
  const scores = [];
  for (const label of labels) {
    const own = records.filter((record) => record.candidate === label);
    const scored = scoreStep(step, own);
    summaries.push(summarise(label, own, scored));
    scores.push({ candidate: label, ...scored });
  }
  console.log(`\n${table(summaries)}\n`);
  for (const score of scores) {
    const fields = score.fields.map((field) => `${field.field} ${field.right}/${field.total}`).join(', ');
    const attacks =
      'attacksTried' in score && score.attacksTried > 0
        ? `; injections: ${score.attacksSucceeded} of ${score.attacksTried} asked-for values reported, ${score.injectionsFlagged} of ${score.injections} flagged`
        : '';
    const merges =
      'wrongMerges' in score ? `; wrong merges ${score.wrongMerges}, missed duplicates ${score.missed}` : '';
    console.log(`${score.candidate}: ${fields}${attacks}${merges}`);
  }
  return { summaries, scores };
}

if (values.score) {
  // One or more saved runs of the same step, comma-separated: scored together against today's labels, no model call.
  const files = values.score.split(',');
  const runs = files.map(
    (file) => JSON.parse(readFileSync(file, 'utf8')) as { step: Step; records: CallRecord[] },
  );
  const step = runs[0]?.step;
  if (!step || runs.some((run) => run.step !== step)) throw new Error('--score takes runs of one step');
  const { summaries, scores } = report(
    step,
    runs.flatMap((run) => run.records),
  );
  const file = writeResults(`bakeoff-${step}-rescored`, {
    rescoredAt: new Date().toISOString(),
    from: files,
    step,
    summaries,
    scores,
  });
  console.log(`wrote ${file}`);
} else {
  const step = values.step;
  if (!isStep(step)) throw new Error(`--step must be one of ${STEPS.join(', ')}`);
  const apiKey = metisKey();
  if (!apiKey)
    throw new Error('METIS_API_KEY is not set: the package script reads it from the repository .env');
  const only = values.only?.split(',');
  const candidates = CANDIDATES[step].filter((candidate) => !only || only.includes(candidate.label));
  const limit = values.limit === undefined ? Infinity : Number(values.limit);
  const repeat = Number(values.repeat);
  const prices = createMetisPriceBook({ logger: recordingLogger() });
  if (!(await prices.refresh())) throw new Error('Metis prices could not be loaded');

  const take = <T extends { id: string }>(list: readonly T[]) => list.slice(0, limit);
  const runs = candidates.map((candidate) => {
    const common = { candidate, step, repeat, prices, apiKey };
    switch (step) {
      case 'extraction':
        return runCandidate({
          ...common,
          task: extractionTask,
          items: take(loadListings()).map((listing) => ({
            id: listing.id,
            input: { id: listing.id, title: listing.title, description: listing.description },
          })),
        });
      case 'query':
        return runCandidate({
          ...common,
          task: queryTask,
          items: take(loadQueries()).map((query) => ({
            id: query.id,
            input: { id: query.id, text: query.text },
          })),
        });
      case 'duplicate':
        return runCandidate({
          ...common,
          task: duplicateTask,
          items: take(loadDuplicates()).map((question) => ({
            id: question.id,
            input: { id: question.id, listing: question.listing, candidates: question.candidates },
          })),
        });
      case 'explanation':
        return runCandidate({
          ...common,
          task: explanationTask,
          items: take(loadDeals()).map((deal) => ({ id: deal.id, input: deal })),
        });
    }
  });
  const records = (await Promise.all(runs)).flat();
  const { summaries, scores } = report(step, records);
  const file = writeResults(`bakeoff-${step}`, {
    ranAt: new Date().toISOString(),
    step,
    repeat,
    candidates: candidates.map((candidate) => ({
      label: candidate.label,
      model: modelName(candidate.model),
      options: candidate.model.options,
      ...(candidate.priceAs ? { priceAs: candidate.priceAs } : {}),
    })),
    settings: SETTINGS[step],
    summaries,
    scores,
    records,
  });
  console.log(`wrote ${file}`);
}
