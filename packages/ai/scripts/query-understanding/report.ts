// The evaluation report for plain-Farsi search (CS-62; ai-features references/evaluation.md): what a run found, as
// tables a person reads and a task note quotes. Every rate carries its 95% Wilson interval; the unit of "right" is the
// query, because the fields of one query are not independent (CS-43). The report is a pure function of a run file and
// the labels, so it can be printed again without a model or a database.
import { mcnemarExact, wilson, type Rate } from '../../src/examples/evaluation.ts';
import type { QueryFiltersCall } from '../../src/tasks/query-filters-step.ts';
import { percentile } from '../support.ts';
import type { QueryItem } from './data/queries.ts';
import { attackSucceeded, bestAgainst, finalOf, producedOf, type FieldResult } from './score.ts';
import type { Understanding } from '@carshenas/search/understand/types';
import type { UnderstandTrace } from '@carshenas/search/understand/understand';

/** One query's record in a run file. */
export type QueryRecord = {
  readonly id: string;
  readonly understanding: Understanding;
  readonly trace: UnderstandTrace;
  /** Every model call this query made (none when code settled it), as the step recorded them. */
  readonly calls: readonly QueryFiltersCall[];
  /** The whole pipeline, code and model, in milliseconds. */
  readonly totalMs: number;
};

export type Run = {
  readonly task: string;
  readonly promptVersion: string;
  /** The labelled set's hash when the run was made: a report refuses runs made on other labels. */
  readonly labelsHash: string;
  readonly model: string;
  /**
   * `full` (code first, then the model: the master switch on), `code-only` (no model: the switch off, its default) or
   * `model-only` (code only cleans: the model reads every word; the evaluation's comparison, never the product).
   */
  readonly mode: 'full' | 'code-only' | 'model-only';
  readonly startedAt: string;
  readonly records: readonly QueryRecord[];
};

const pct = (rate: Rate): string =>
  `${(rate.total === 0 ? 0 : (100 * rate.right) / rate.total).toFixed(1)}% (${String(rate.right)}/${String(rate.total)}, ${(100 * rate.low).toFixed(1)}–${(100 * rate.high).toFixed(1)})`;

const usd = (value: number, digits = 4) => `US$${value.toFixed(digits)}`;

/** What a run is called in a heading and a comparison. */
const runLabel = (run: Run): string =>
  run.mode === 'code-only' ? 'code only (switch off)' : `${run.mode} (${run.model})`;

type Scored = {
  readonly item: QueryItem;
  readonly record: QueryRecord;
  readonly results: FieldResult[];
  readonly allRight: boolean;
  readonly produced: ReturnType<typeof producedOf>;
};

function scoreRun(run: Run, set: readonly QueryItem[]): Scored[] {
  const byId = new Map(run.records.map((record) => [record.id, record]));
  return set.flatMap((item) => {
    const record = byId.get(item.id);
    if (record === undefined) return [];
    const produced = producedOf(record.understanding);
    return [{ item, record, produced, ...bestAgainst(item, produced) }];
  });
}

/** The tier an applied filter belongs to: who read it and how sure the reading was. */
function tierOf(by: 'code' | 'model', basis: 'stated' | 'inferred'): string {
  return `${by === 'code' ? 'code' : 'model'} ${basis === 'stated' ? 'stated' : 'inferred'}`;
}

export function report(
  runs: readonly Run[],
  set: readonly QueryItem[],
  current: { promptVersion: string; labelsHash: string },
): string[] {
  for (const run of runs) {
    if (run.labelsHash !== current.labelsHash) {
      throw new Error(`a run on labels ${run.labelsHash} cannot be scored on ${current.labelsHash}`);
    }
  }
  const lines: string[] = [];
  for (const run of runs) {
    const scored = scoreRun(run, set);
    const rows = scored.length;
    lines.push(
      `## ${run.task} on ${String(rows)} labelled queries: ${runLabel(run)}, prompt version ${run.promptVersion}`,
      '',
      'Accuracy with 95% Wilson intervals. A query is right when every field of what the buyer gets is right: each filter, the order, the unused words, the text-search fallback and the notices. The bundle a wish named is reported beside, not part of it.',
      '',
    );

    // Queries fully right.
    const split = (name: 'development' | 'test') => scored.filter((one) => one.item.split === name);
    const right = (items: readonly Scored[]) =>
      wilson(items.filter((one) => one.allRight).length, items.length);
    const asked = scored.filter((one) => one.record.trace.asked !== null);
    const settled = scored.filter((one) => one.record.trace.asked === null);
    lines.push(
      '| Queries | All | Development | Test | Settled by code | Asked the model |',
      '|---|---|---|---|---|---|',
      `| fully right | ${pct(right(scored))} | ${pct(right(split('development')))} | ${pct(right(split('test')))} | ${pct(right(settled))} | ${pct(right(asked))} |`,
      '',
      `Code settled ${String(settled.length)} of ${String(rows)} queries without a model (${((100 * settled.length) / rows).toFixed(1)}%); the model was asked about ${String(asked.length)}.`,
      '',
    );
    const labelledCode = scored.filter((one) => one.item.settledByCode);
    lines.push(
      `Labelled as needing no model: ${String(labelledCode.length)}; of them ${String(labelledCode.filter((one) => one.record.trace.asked === null).length)} cost no model call.`,
      '',
    );

    // By category.
    lines.push('| Category | Queries | Fully right | Asked the model |', '|---|---|---|---|');
    for (const category of [...new Set(set.map((item) => item.category))]) {
      const own = scored.filter((one) => one.item.category === category);
      lines.push(
        `| ${category} | ${String(own.length)} | ${pct(right(own))} | ${String(own.filter((one) => one.record.trace.asked !== null).length)} |`,
      );
    }
    lines.push('');

    // Per field.
    const fields = new Map<
      string,
      { right: number; total: number; truePositive: number; labelled: number; produced: number }
    >();
    for (const one of scored) {
      for (const result of one.results) {
        const own = fields.get(result.field) ?? {
          right: 0,
          total: 0,
          truePositive: 0,
          labelled: 0,
          produced: 0,
        };
        own.total += 1;
        if (result.right) own.right += 1;
        if (result.expected !== '') own.labelled += 1;
        if (result.got !== '') own.produced += 1;
        if (result.right && result.expected !== '') own.truePositive += 1;
        fields.set(result.field, own);
      }
    }
    lines.push('| Field | Queries it appears in | Right | Precision | Recall |', '|---|---|---|---|---|');
    for (const [field, own] of [...fields].sort(([a], [b]) => a.localeCompare(b))) {
      const precision = own.produced === 0 ? '—' : pct(wilson(own.truePositive, own.produced));
      const recall = own.labelled === 0 ? '—' : pct(wilson(own.truePositive, own.labelled));
      lines.push(
        `| ${field} | ${String(own.total)} | ${pct(wilson(own.right, own.total))} | ${precision} | ${recall} |`,
      );
    }
    lines.push('');

    // Applied filters by who read them and how sure.
    const tiers = new Map<string, { right: number; total: number }>();
    const bump = (tier: string, ok: boolean) => {
      const own = tiers.get(tier) ?? { right: 0, total: 0 };
      own.total += 1;
      if (ok) own.right += 1;
      tiers.set(tier, own);
    };
    for (const one of scored) {
      const final = finalOf(one.item.expected).filters;
      const alternatives = [final, ...one.item.accept.map((expected) => finalOf(expected).filters)];
      const u = one.record.understanding;
      for (const chip of u.chips) {
        const value = (u.search.filters as Record<string, unknown>)[chip.filterId];
        const ok = alternatives.some(
          (filters) => JSON.stringify(sorted(filters[chip.filterId])) === JSON.stringify(sorted(value)),
        );
        bump(tierOf(chip.by, chip.basis), ok);
      }
      for (const suggestion of u.suggestions) {
        const value =
          suggestion.filterId === null
            ? undefined
            : (suggestion.add.filters as Record<string, unknown>)[suggestion.filterId];
        const ok =
          suggestion.filterId !== null &&
          alternatives.some(
            (filters) =>
              JSON.stringify(sorted(filters[suggestion.filterId as string])) ===
              JSON.stringify(sorted(value)),
          );
        bump('model weak (a suggestion, not applied)', ok);
      }
    }
    lines.push(
      'Where each applied filter came from, and how often it was right (S04 "Confidence": a weak reading is only a suggestion):',
      '',
      '| Who read it | Filters shown | Right |',
      '|---|---|---|',
    );
    for (const [tier, own] of [...tiers].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`| ${tier} | ${String(own.total)} | ${pct(wilson(own.right, own.total))} |`);
    }
    lines.push('');

    // Attacks.
    const attacked = scored.filter((one) => one.item.attacks.length > 0);
    const tried = attacked.reduce((total, one) => total + one.item.attacks.length, 0);
    const succeeded = attacked.reduce(
      (total, one) =>
        total + one.item.attacks.filter((witness) => attackSucceeded(witness, one.produced)).length,
      0,
    );
    const flagged = attacked.filter((one) =>
      one.record.understanding.notes.some(
        (note) => note.kind === 'addressed' || note.kind === 'hidden_characters',
      ),
    );
    const benign = scored.filter((one) => one.item.id === 'Q161');
    lines.push(
      `Injected instructions: ${String(succeeded)} of ${String(tried)} witness values appeared in the answer, over ${String(attacked.length)} queries; ${String(flagged.length)} of those queries were told to the buyer as addressed or hidden. A polite request that is an ordinary wish (Q161) was ${benign.every((one) => one.allRight) ? 'understood, not flagged' : 'NOT understood as an ordinary wish'}.`,
      '',
    );

    // Cost and latency.
    const calls = scored.flatMap((one) => one.record.calls.map((call) => ({ call, id: one.item.id })));
    const fresh = calls.filter(({ call }) => !call.cached && call.outcome !== 'error');
    const cost = fresh.reduce((total, { call }) => total + (call.costUsd ?? 0), 0);
    const modelMs = fresh.map(({ call }) => call.latencyMs);
    const askedTotals = asked.map((one) => one.record.totalMs);
    const settledTotals = settled.map((one) => one.record.totalMs);
    const outcomes = new Map<string, number>();
    for (const { call } of calls) outcomes.set(call.outcome, (outcomes.get(call.outcome) ?? 0) + 1);
    const mean = (pick: (call: QueryFiltersCall) => number) =>
      fresh.length === 0 ? 0 : fresh.reduce((total, { call }) => total + pick(call), 0) / fresh.length;
    lines.push(
      `Model calls: ${String(calls.length)} (${String(fresh.length)} fresh, ${String(calls.filter(({ call }) => call.cached).length)} from the answer cache); outcomes: ${[...outcomes].map(([name, count]) => `${name} ${String(count)}`).join(', ') || 'none'}; re-asked ${String(fresh.filter(({ call }) => call.attempts > 1).length)}.`,
      `Cost: ${usd(cost)} measured for ${String(fresh.length)} fresh calls = ${usd(fresh.length === 0 ? 0 : (1000 * cost) / fresh.length, 2)} per 1,000 model calls and ${usd(rows === 0 ? 0 : (1000 * cost) / rows, 2)} per 1,000 queries (code settles the rest at no cost); mean tokens in ${mean((call) => call.tokens.input + call.tokens.cacheRead).toFixed(0)}, cache read ${mean((call) => call.tokens.cacheRead).toFixed(0)}, out ${mean((call) => call.tokens.output).toFixed(0)}, reasoning ${mean((call) => call.tokens.reasoning).toFixed(0)}.`,
      `Latency: model call p50 ${String(percentile(modelMs, 0.5))} ms, p95 ${String(percentile(modelMs, 0.95))} ms; a query that asked the model, whole pipeline, p50 ${String(percentile(askedTotals, 0.5))} ms, p95 ${String(percentile(askedTotals, 0.95))} ms; a query code settled, p50 ${String(percentile(settledTotals, 0.5))} ms, p95 ${String(percentile(settledTotals, 0.95))} ms (cached answers are not in the first).`,
      '',
    );

    // The misses.
    const misses = scored.filter((one) => !one.allRight);
    lines.push(
      `### Every query that was not fully right (${String(misses.length)})`,
      '',
      '| Query | Split | Category | Asked | Field | Expected | Got |',
      '|---|---|---|---|---|---|---|',
    );
    for (const one of misses) {
      for (const result of one.results.filter((field) => !field.right && field.core)) {
        lines.push(
          `| ${one.item.id} ${one.item.text.slice(0, 60).replaceAll('|', '/')} | ${one.item.split} | ${one.item.category} | ${String(one.record.trace.asked)} | ${result.field} | ${result.expected || '(none)'} | ${result.got || '(none)'} |`,
        );
      }
    }
    lines.push('');
  }
  if (runs.length === 2) {
    const [a, b] = runs.map((run) => new Map(scoreRun(run, set).map((one) => [one.item.id, one.allRight])));
    let onlyA = 0;
    let onlyB = 0;
    for (const item of set) {
      const x = a?.get(item.id);
      const y = b?.get(item.id);
      if (x === true && y === false) onlyA += 1;
      if (y === true && x === false) onlyB += 1;
    }
    const [first, second] = runs;
    if (first !== undefined && second !== undefined) {
      lines.push(
        `## What the two runs differ in`,
        '',
        '| Run | Fully right | Development | Test | Queries the model read | Cost per 1,000 queries |',
        '|---|---|---|---|---|---|',
      );
      for (const run of runs) {
        const scored = scoreRun(run, set);
        const right = (items: readonly Scored[]) =>
          pct(wilson(items.filter((one) => one.allRight).length, items.length));
        const cost = scored
          .flatMap((one) => one.record.calls)
          .filter((call) => !call.cached && call.outcome !== 'error')
          .reduce((total, call) => total + (call.costUsd ?? 0), 0);
        lines.push(
          `| ${runLabel(run)} | ${right(scored)} | ${right(scored.filter((one) => one.item.split === 'development'))} | ${right(scored.filter((one) => one.item.split === 'test'))} | ${String(scored.filter((one) => one.record.trace.answered === 'ok').length)} | ${usd(scored.length === 0 ? 0 : (1000 * cost) / scored.length, 2)} |`,
        );
      }
      lines.push(
        '',
        `Paired by query (fully right): only ${runLabel(first)} ${String(onlyA)}, only ${runLabel(second)} ${String(onlyB)}, exact McNemar p = ${mcnemarExact(onlyA, onlyB).toFixed(3)}.`,
      );
    }
  }
  return lines;
}

function sorted(value: unknown): unknown {
  return Array.isArray(value) ? [...(value as unknown[])].map(String).sort() : value;
}
