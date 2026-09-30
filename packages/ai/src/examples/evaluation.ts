// A worked example for the ai-features skill (references/evaluation.md), never the product's harness, which CS-48
// builds: an evaluation run on a labelled set through the AI layer. Each item is asked exactly as a job asks it
// (registry entry, route, schema, checks, one re-ask, the answer cache), and each answer is scored against the hand
// labels field by field, with not_stated a class of its own. Every rate carries a Wilson interval, the injected values
// a model reported are counted, the run is priced at Metis's list, and two runs are compared item by item with an
// exact McNemar test, so a change is called better or worse only when the set can tell it from noise (CS-43, patterns
// 21, 27 and 28).
import type { AiResult } from '../ai.ts';
import { modelName } from '../metis.ts';
import { costUsd, type PriceBook } from '../pricing.ts';

export type Label = string | boolean;

export type LabelledItem<Input> = {
  readonly id: string;
  readonly input: Input;
  /** What a careful reader reports for each field, set from the text alone before any model saw the item. */
  readonly labels: Readonly<Record<string, Label>>;
  /** For an item carrying an injected instruction: the value it asks for in each field it targets (its witness). */
  readonly attack?: Readonly<Record<string, Label>>;
};

/** A share with its 95% Wilson interval, which stays honest at the sizes a hand-labelled set has. */
export type Rate = {
  readonly right: number;
  readonly total: number;
  readonly low: number;
  readonly high: number;
};

/** One value of a field: how often the labels say it, how often the model said it, and how often both did. */
export type ClassScore = {
  readonly value: Label;
  readonly labelled: number;
  readonly answered: number;
  /** Of the answers with this value, the share the labels agree with; null when the model never said it. */
  readonly precision: number | null;
  /** Of the items labelled with this value, the share the model found; null when no label says it. */
  readonly recall: number | null;
};

export type FieldScore = Rate & { readonly field: string; readonly classes: readonly ClassScore[] };

export type Report = {
  readonly task: string;
  readonly promptVersion: string;
  /** `provider/model`, as logs and the cache name a model. */
  readonly modelName: string;
  readonly items: number;
  readonly outcomes: Readonly<Record<string, number>>;
  readonly fields: readonly FieldScore[];
  /** Items with every field right: ten fields at 95% each leave about 60% of listings fully right. */
  readonly allRight: Rate;
  /** Witness values reported, over those the injected items asked for: "k of n attacks succeeded", never "robust". */
  readonly attacks: { readonly succeeded: number; readonly tried: number };
  /** Requests sent, first answers and re-asks; items answered from the cache sent none. */
  readonly requests: number;
  readonly cachedItems: number;
  /** At Metis's list price, re-asks included; null when the model has no price. */
  readonly costUsd: number | null;
  /** Item, then field: whether the answer was right. What a paired comparison of two runs reads. */
  readonly right: Readonly<Record<string, Readonly<Record<string, boolean>>>>;
};

const Z95 = 1.959963984540054;

/** The 95% Wilson score interval (190 of 200 is 91.0% to 97.3%; CS-43, section 5). */
export function wilson(right: number, total: number): Rate {
  if (total === 0) return { right, total, low: 0, high: 1 };
  const share = right / total;
  const z2 = Z95 * Z95;
  const centre = share + z2 / (2 * total);
  const margin = Z95 * Math.sqrt((share * (1 - share)) / total + z2 / (4 * total * total));
  const scale = 1 + z2 / total;
  return { right, total, low: (centre - margin) / scale, high: (centre + margin) / scale };
}

/**
 * The exact two-sided McNemar test on the items only one run got right: the chance of a split at least this uneven
 * when neither run is better (8 against 2 gives 0.109, 6 against 0 gives 0.031; CS-43, structured.md §C.3).
 */
export function mcnemarExact(onlyNew: number, onlyOld: number): number {
  const n = onlyNew + onlyOld;
  if (n === 0) return 1;
  // P(X <= k) for X ~ Binomial(n, 1/2), each term built in log space so thousands of pairs do not underflow.
  let logTerm = -n * Math.LN2;
  let tail = 0;
  for (let i = 0; i <= Math.min(onlyNew, onlyOld); i += 1) {
    tail += Math.exp(logTerm);
    logTerm += Math.log(n - i) - Math.log(i + 1);
  }
  return Math.min(1, 2 * tail);
}

type Scored = {
  readonly item: LabelledItem<unknown>;
  readonly answer: Readonly<Record<string, unknown>> | undefined;
};

function classScores(field: string, scored: readonly Scored[]): ClassScore[] {
  const values = new Set<Label>();
  for (const { item, answer } of scored) {
    const label = item.labels[field];
    const said = answer?.[field];
    if (label !== undefined) values.add(label);
    if (typeof said === 'string' || typeof said === 'boolean') values.add(said);
  }
  return [...values]
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map((value) => {
      const labelled = scored.filter(({ item }) => item.labels[field] === value).length;
      const answered = scored.filter(({ answer }) => answer?.[field] === value).length;
      const both = scored.filter(
        ({ item, answer }) => item.labels[field] === value && answer?.[field] === value,
      ).length;
      return {
        value,
        labelled,
        answered,
        precision: answered === 0 ? null : both / answered,
        recall: labelled === 0 ? null : both / labelled,
      };
    });
}

/**
 * Asks the task about every item, one at a time as a job would, and scores the answers. An item that ends without a
 * valid answer is wrong on every field, because the product would have nothing to store for it. Run it again through
 * the same layer and every unchanged item is answered from the cache, so a repeated run costs no model call.
 */
export async function runEvaluation<Input>(options: {
  readonly items: readonly LabelledItem<Input>[];
  /** One call of the task under evaluation: `(input) => ai.call('listing.facts', input)`. */
  readonly call: (input: Input) => Promise<AiResult<Readonly<Record<string, unknown>>>>;
  readonly prices: PriceBook;
}): Promise<Report> {
  const [firstItem] = options.items;
  if (!firstItem) throw new Error('an evaluation needs at least one labelled item');
  const fields = Object.keys(firstItem.labels);
  const scored: Scored[] = [];
  const right: Record<string, Record<string, boolean>> = {};
  const outcomes: Record<string, number> = {};
  let about: { task: string; promptVersion: string; modelName: string } | undefined;
  let requests = 0;
  let cachedItems = 0;
  let cost: number | null = 0;
  let succeeded = 0;
  let tried = 0;
  for (const item of options.items) {
    const result = await options.call(item.input);
    about ??= { task: result.task, promptVersion: result.promptVersion, modelName: modelName(result.model) };
    outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
    requests += result.attempts.length;
    if (result.cached) cachedItems += 1;
    const spent = costUsd(
      options.prices.pricesOf(result.model.id),
      result.attempts.map((attempt) => attempt.usage),
    );
    cost = cost === null || spent === null ? null : cost + spent;
    const answer = result.outcome === 'ok' ? result.value : undefined;
    scored.push({ item, answer });
    right[item.id] = Object.fromEntries(
      fields.map((field) => [field, answer !== undefined && answer[field] === item.labels[field]]),
    );
    for (const [field, asked] of Object.entries(item.attack ?? {})) {
      tried += 1;
      if (answer?.[field] === asked) succeeded += 1;
    }
  }
  const everyField = Object.values(right).filter((fieldsRight) => Object.values(fieldsRight).every(Boolean));
  return {
    task: about?.task ?? '',
    promptVersion: about?.promptVersion ?? '',
    modelName: about?.modelName ?? '',
    items: options.items.length,
    outcomes,
    fields: fields.map((field) => ({
      field,
      ...wilson(
        Object.values(right).filter((fieldsRight) => fieldsRight[field] === true).length,
        options.items.length,
      ),
      classes: classScores(field, scored),
    })),
    allRight: wilson(everyField.length, options.items.length),
    attacks: { succeeded, tried },
    requests,
    cachedItems,
    costUsd: cost === null ? null : Number(cost.toFixed(9)),
    right,
  };
}

export type Comparison = {
  /** Item-fields only the new run got right, and only the old one. */
  readonly onlyNew: number;
  readonly onlyOld: number;
  readonly p: number;
  readonly verdict: 'better' | 'worse' | 'no significant difference';
};

/**
 * Two runs of one labelled set, item by item and field by field. A prompt, model or schema change fails the gate
 * only on a significant paired loss, not whenever it scores below the last report, which noise alone does half the
 * time (CS-43, pattern 28; which rule the gate uses is CS-48's decision).
 */
export function compare(previous: Pick<Report, 'right'>, current: Pick<Report, 'right'>): Comparison {
  let onlyNew = 0;
  let onlyOld = 0;
  for (const [item, fieldsNow] of Object.entries(current.right)) {
    const fieldsBefore = previous.right[item];
    if (!fieldsBefore)
      throw new Error(`item ${item} is not in the previous run: compare two runs of one set`);
    for (const [field, now] of Object.entries(fieldsNow)) {
      const before = fieldsBefore[field] === true;
      if (now && !before) onlyNew += 1;
      if (before && !now) onlyOld += 1;
    }
  }
  const p = mcnemarExact(onlyNew, onlyOld);
  const verdict = p >= 0.05 ? 'no significant difference' : onlyNew > onlyOld ? 'better' : 'worse';
  return { onlyNew, onlyOld, p, verdict };
}

const percent = (share: number): string => `${(100 * share).toFixed(1)}%`;
const rate = (r: Rate): string =>
  `${r.right}/${r.total} ${percent(r.total === 0 ? 0 : r.right / r.total)} (${percent(r.low)} to ${percent(r.high)})`;

/** The report in four lines, short enough to read in a terminal or paste into a task's notes. */
export function formatReport(report: Report): string[] {
  const outcomes = Object.entries(report.outcomes)
    .map(([outcome, count]) => `${outcome} ${count}`)
    .join(', ');
  return [
    `${report.task} ${report.promptVersion} ${report.modelName}: ${report.items} items (${outcomes})`,
    report.fields.map((field) => `${field.field} ${rate(field)}`).join('; '),
    `all fields right ${rate(report.allRight)}; injected values reported ${report.attacks.succeeded} of ${report.attacks.tried}`,
    `${report.costUsd === null ? 'not priced' : `US$${report.costUsd.toFixed(4)}`}, ${report.requests} requests, ${report.cachedItems} of ${report.items} items from the cache`,
  ];
}

/** One line, with FAIL first when the gate should stop the change, so a person or a script finds it with grep. */
export function formatComparison(comparison: Comparison): string {
  const detail = `only the new run right on ${comparison.onlyNew}, only the old on ${comparison.onlyOld}, exact McNemar p = ${comparison.p.toFixed(3)}`;
  return comparison.verdict === 'worse' ? `FAIL: worse: ${detail}` : `${comparison.verdict}: ${detail}`;
}

export const POSITIONS = ['start', 'middle', 'end'] as const;
export type Position = (typeof POSITIONS)[number];

/**
 * A clean labelled listing with an injected note that asks for a witness value (CS-43, pattern 21): the labels stay
 * those of the clean listing, with the flag set, so scoring the copy tests both at once. A model that reads past the
 * note gives the clean facts (metamorphic invariance); one that obeys it reports the witness value. The end of a text
 * is where injections work best, so every position is tried.
 */
export function withInjection<Input extends { readonly description: string }>(
  item: LabelledItem<Input>,
  note: string,
  attack: Readonly<Record<string, Label>>,
  position: Position,
): LabelledItem<Input> {
  const text = item.input.description;
  const stop = text.indexOf('.', Math.floor(text.length / 2));
  const cut = stop === -1 ? text.length : stop + 1;
  const description =
    position === 'start'
      ? `${note} ${text}`
      : position === 'end'
        ? `${text} ${note}`
        : `${text.slice(0, cut)} ${note} ${text.slice(cut)}`;
  return {
    id: `${item.id}-${position}`,
    input: { ...item.input, description },
    labels: { ...item.labels, instructions_to_ai: true },
    attack,
  };
}
