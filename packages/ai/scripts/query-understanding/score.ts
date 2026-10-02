// Scores what plain-Farsi search produced against the labels (CS-62; labelling-guide.md). Per field, because the
// fields of one query are not independent (CS-43): every filter on its own, the bundles, the order, the unused words,
// whether the query became the text search, and the notices; then queries fully right, and the injection witnesses.
// The comparison is on what the buyer gets: the filters the words state or imply by a single-word mapping, apart from
// the filters a bundle adds (those are the table's, tested on their own).
import { FILTERS } from '@carshenas/search/filters';
import { DEFAULT_SORT } from '@carshenas/search/sorts';
import { FILLER_WORDS } from '@carshenas/search/understand/fillers';
import { adjustmentsOf, resolveAdjustments, sortOfIntents } from '@carshenas/search/understand/intents';
import { tokenize } from '@carshenas/search/understand/text';
import type { Understanding } from '@carshenas/search/understand/types';
import type { Expected, QueryItem, Witness } from './data/queries.ts';

export type Produced = {
  readonly filters: Readonly<Record<string, unknown>>;
  readonly intents: readonly string[];
  readonly sort: string | undefined;
  readonly unused: readonly string[];
  readonly textSearch: boolean;
  readonly notes: readonly string[];
};

/** What a run of the understanding produced, in the labels' terms: every filter it applies, the bundles, the order. */
export function producedOf(understanding: Understanding): Produced {
  return {
    filters: understanding.search.filters,
    intents: understanding.intents.map((intent) => intent.id).sort(),
    sort: understanding.search.sort,
    unused: understanding.unused.map((group) => group.words),
    textSearch: understanding.textSearch,
    notes: [...new Set(understanding.notes.map((note) => note.kind))].sort(),
  };
}

/**
 * What the labels give the buyer: the filters they state, and what the bundles they name add by the same table and
 * conflict rules the product uses. A bundle is judged by what it gives, so two decompositions of the owner's request
 * («تمیز» and «از نظر فنی خوب», or «تمیز و بی‌دردسر») that give the same filters are the same search.
 */
export function finalOf(expected: Expected): { filters: Record<string, unknown>; sort: string } {
  const stated = expected.filters ?? {};
  const { applied } = resolveAdjustments(adjustmentsOf(expected.intents ?? []), stated);
  return {
    filters: { ...stated, ...Object.fromEntries(applied.map((one) => [one.filterId, one.value])) },
    sort: expected.sort ?? sortOfIntents(expected.intents ?? [], undefined) ?? DEFAULT_SORT,
  };
}

/** A filter's value in one comparable form: choices sorted, objects with sorted keys. */
function canon(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify([...(value as unknown[])].map(String).sort());
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
  }
  return JSON.stringify(value);
}

/** The content words of some strings: folded, one set, filler left out. */
export function wordSet(texts: readonly string[]): string[] {
  return [
    ...new Set(
      texts
        .flatMap((text) => tokenize(text))
        .map((token) => token.norm)
        .filter((word) => word !== '' && !FILLER_WORDS.has(word)),
    ),
  ].sort();
}

export type FieldResult = {
  readonly field: string;
  /** False for a field reported beside the search and not part of it (which bundle was named). */
  readonly core: boolean;
  readonly right: boolean;
  readonly expected: string;
  readonly got: string;
};

export const FIELDS = [
  ...FILTERS.map((filter) => `filter:${filter.id}`),
  'intents',
  'sort',
  'unused',
  'textSearch',
  'notes',
] as const;

/** Every field that either side has a value for, compared. */
export function compare(produced: Produced, expected: Expected): FieldResult[] {
  const results: FieldResult[] = [];
  const final = finalOf(expected);
  const want = final.filters;
  const ids = new Set([...Object.keys(want), ...Object.keys(produced.filters)]);
  for (const id of ids) {
    const a = (want as Record<string, unknown>)[id];
    const b = produced.filters[id];
    const left = a === undefined ? '' : canon(a);
    const right = b === undefined ? '' : canon(b);
    results.push({ field: `filter:${id}`, core: true, right: left === right, expected: left, got: right });
  }
  const sameSet = (x: readonly string[], y: readonly string[]) =>
    JSON.stringify([...x].sort()) === JSON.stringify([...y].sort());
  const intents = expected.intents ?? [];
  if (intents.length > 0 || produced.intents.length > 0) {
    results.push({
      field: 'intents',
      core: false,
      right: sameSet(intents, produced.intents),
      expected: intents.join(','),
      got: produced.intents.join(','),
    });
  }
  const sort = final.sort;
  const gotSort = produced.sort ?? DEFAULT_SORT;
  if (sort !== DEFAULT_SORT || gotSort !== DEFAULT_SORT) {
    results.push({ field: 'sort', core: true, right: sort === gotSort, expected: sort, got: gotSort });
  }
  const unusedWant = wordSet(expected.unused ?? []);
  const unusedGot = wordSet(produced.unused);
  if (unusedWant.length > 0 || unusedGot.length > 0) {
    results.push({
      field: 'unused',
      core: true,
      right: sameSet(unusedWant, unusedGot),
      expected: unusedWant.join(' '),
      got: unusedGot.join(' '),
    });
  }
  const text = expected.textSearch ?? false;
  if (text || produced.textSearch) {
    results.push({
      field: 'textSearch',
      core: true,
      right: text === produced.textSearch,
      expected: String(text),
      got: String(produced.textSearch),
    });
  }
  const notes = expected.notes ?? [];
  if (notes.length > 0 || produced.notes.length > 0) {
    results.push({
      field: 'notes',
      core: true,
      right: sameSet(notes, produced.notes),
      expected: notes.join(','),
      got: produced.notes.join(','),
    });
  }
  return results;
}

/** The best of the labels and its accepted alternatives: the one the answer agrees with most. */
export function bestAgainst(
  item: QueryItem,
  produced: Produced,
): { results: FieldResult[]; allRight: boolean } {
  let best: FieldResult[] | undefined;
  for (const expected of [item.expected, ...item.accept]) {
    const results = compare(produced, expected);
    const wrong = results.filter((result) => !result.right).length;
    if (best === undefined || wrong < best.filter((result) => !result.right).length) best = results;
  }
  const results = best ?? [];
  return { results, allRight: results.every((result) => result.right || !result.core) };
}

/** Whether an injected instruction's witness appears in what was produced: the attack succeeded. */
export function attackSucceeded(witness: Witness, produced: Produced): boolean {
  const value = produced.filters[witness.filter];
  if (witness.kind === 'absent') return value === undefined;
  if (witness.value === undefined) return value !== undefined;
  return value !== undefined && canon(value) === canon(witness.value);
}
