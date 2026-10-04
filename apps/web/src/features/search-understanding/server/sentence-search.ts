import 'server-only';
import { MAX_QUERY_LENGTH, canonical, searchHref, type Search } from '@carshenas/search/search';
import { normalisePhrase } from '@carshenas/search/understand/text';
import type { Understanding, UnusedWords } from '@carshenas/search/understand/types';
import type { UnderstandTrace } from '@carshenas/search/understand/understand';
import { UNDERSTANDING_COPY } from '@/features/search-understanding/understanding-copy';
import { withSentence, type SentenceView } from '@/lib/search-sentence';

// A sentence as one search (CS-111, ADR-0043, docs/specs/S04-plain-farsi-search.md). The understanding says which
// filters the words meant and which words nobody could read; this file turns that into the one search the page shows,
// and says what it did with every word. The rule that keeps a sentence from ending in a dead end: the words no filter
// could name are looked for in the listings' text, and when that would leave nothing they are dropped, step by step,
// never the filters (those the buyer sees as chips and takes off). A count is a function the caller gives, so the rule
// is tested on its own and the page and the action bind the real one.

/** How many listings a search finds; only whether it is 0 matters here. */
export type Counter = (search: Search) => Promise<number>;

/** The reasons whose words are looked for in the listings' text; a city outside the market or a number no car has is only said. */
const TEXT_REASONS: readonly UnusedWords['reason'][] = ['unknown', 'unsupported'];

/** The most unread groups put to the count: a sentence with more is mostly noise, and every extra group costs a count. */
export const MAX_TEXT_GROUPS = 4;

function textGroupsOf(understanding: Understanding): UnusedWords[] {
  return understanding.unused.filter((group) => TEXT_REASONS.includes(group.reason));
}

/** The groups of words the listings' text is searched for. */
export function textGroups(understanding: Understanding): readonly UnusedWords[] {
  return textGroupsOf(understanding).slice(0, MAX_TEXT_GROUPS);
}

/** The search the filters make, without the words the understanding put in `q` when it read nothing else. */
function filtersOnly(understanding: Understanding): Search {
  const { q: _words, ...rest } = understanding.search;
  return canonical(rest);
}

function withWords(base: Search, words: readonly string[]): Search {
  if (words.length === 0) return base;
  return canonical({ ...base, q: words.join(' ').slice(0, MAX_QUERY_LENGTH) });
}

export type Settled = {
  /** What the page shows: the filters, and the words that still find listings as `q`. */
  readonly search: Search;
  readonly kept: readonly UnusedWords[];
  readonly dropped: readonly UnusedWords[];
};

/**
 * The search for a reading. Unread words go in as the text search unless they would empty the results: then they are
 * dropped one group at a time, the group whose going leaves the most listings first (the one written later on a tie),
 * until something is found. The filters are never dropped: when they alone find nothing, the words are kept as they
 * were written and the page shows its no-results panel, with the filters as chips to take off and what each would give.
 */
export async function settleReading(understanding: Understanding, count: Counter): Promise<Settled> {
  const base = filtersOnly(understanding);
  const groups = textGroups(understanding);
  if (groups.length === 0) return { search: base, kept: [], dropped: [] };
  const words = (kept: readonly UnusedWords[]) => kept.map((group) => group.words);

  // Nothing the words could change: the filters find nothing, so the sentence is shown as it was written.
  if ((await count(base)) === 0) return { search: withWords(base, words(groups)), kept: groups, dropped: [] };

  let kept = groups;
  while (kept.length > 0 && (await count(withWords(base, words(kept)))) === 0) {
    // With one group left, dropping it is the way out. With several, each way of dropping one is counted, and the
    // one that leaves the most goes; when every way still finds nothing, the group written last goes.
    let leave = kept.length - 1;
    if (kept.length > 1) {
      const totals = await Promise.all(
        kept.map((_group, index) =>
          count(withWords(base, words(kept.filter((_other, other) => other !== index)))),
        ),
      );
      let most = -1;
      totals.forEach((total, index) => {
        if (total >= most) {
          most = total;
          leave = index;
        }
      });
    }
    kept = kept.filter((_group, index) => index !== leave);
  }
  return {
    search: withWords(base, words(kept)),
    kept,
    dropped: groups.filter((group) => !kept.includes(group)),
  };
}

/** The address of the sentence: the settled search with the sentence kept beside it. */
export function sentenceAddress(settled: Settled, sentence: string): string {
  return withSentence(searchHref(settled.search), sentence);
}

/** Whether every word of a group is among the words the search already looks for. */
function isApplied(applied: string | undefined, words: string): boolean {
  const have = new Set(normalisePhrase(applied ?? '').split(' '));
  const need = normalisePhrase(words)
    .split(' ')
    .filter((word) => word !== '');
  return need.length > 0 && need.every((word) => have.has(word));
}

function putBack(search: Search, words: string): Search {
  const together = [search.q, words].filter((part) => part !== undefined).join(' ');
  return canonical({ ...search, q: together.slice(0, MAX_QUERY_LENGTH) });
}

/**
 * The groups of the sentence whose words the page does not look for and would leave it empty if it did: said to the
 * buyer, each with the search that puts it back. A group the buyer took off themselves, which would find listings, is
 * not said: it was their choice.
 */
export async function leftOut(
  search: Search,
  understanding: Understanding,
  count: Counter,
): Promise<SentenceView['dropped']> {
  const absent = textGroups(understanding).filter((group) => !isApplied(search.q, group.words));
  const found = await Promise.all(
    absent.map(async (group) => {
      const put = putBack(search, group.words);
      return (await count(put)) === 0 ? [{ words: group.words, put }] : [];
    }),
  );
  return found.flat();
}

/** A search as the page holds it, for comparing two: the catalogue mark only says where it started. */
function shape(search: Search): string {
  const { catalogue: _catalogue, ...rest } = canonical(search);
  return JSON.stringify(rest);
}

/** The words of the groups beyond the ones searched, said once. */
function unsearchedLine(understanding: Understanding): string[] {
  const extra = textGroupsOf(understanding).slice(MAX_TEXT_GROUPS);
  return extra.length === 0 ? [] : [UNDERSTANDING_COPY.unsearched(extra.map((group) => group.words))];
}

/** The numbers a buyer wrote that no car has, said once each. */
function implausibleLines(understanding: Understanding): string[] {
  return understanding.unused
    .filter((group) => group.reason === 'implausible')
    .map((group) => UNDERSTANDING_COPY.implausible(group.words));
}

export type ViewInput = {
  readonly search: Search;
  readonly understanding: Understanding;
  readonly trace: UnderstandTrace;
  /** The master switch is on: a model may be asked for what the code could not read. */
  readonly modelAvailable: boolean;
  readonly count: Counter;
};

/**
 * Everything the page says about the sentence beside the filters (see SentenceView). A model is asked in the
 * background only while the address is exactly what the code read and settled: once the buyer has changed anything,
 * their choices stand and nothing replaces them.
 */
export async function sentenceView(input: ViewInput): Promise<SentenceView> {
  const { search, understanding } = input;
  const mayAsk = input.modelAvailable && input.trace.asked !== null && !understanding.modelUsed;
  const [dropped, refine] = await Promise.all([
    leftOut(search, understanding, input.count),
    mayAsk
      ? settleReading(understanding, input.count).then((settled) => shape(settled.search) === shape(search))
      : Promise.resolve(false),
  ]);
  const suggestions = understanding.suggestions.flatMap((suggestion) => {
    if (suggestion.filterId === null) return [];
    const value = (suggestion.add.filters as Record<string, unknown>)[suggestion.filterId];
    if (
      value === undefined ||
      (search.filters as Record<string, unknown>)[suggestion.filterId] !== undefined
    ) {
      return [];
    }
    return [
      {
        key: suggestion.key,
        text: suggestion.text,
        add: canonical({ ...search, filters: { ...search.filters, [suggestion.filterId]: value } }),
      },
    ];
  });
  return {
    notes: [
      ...understanding.notes.map((note) => note.text),
      ...implausibleLines(understanding),
      ...unsearchedLine(understanding),
    ],
    dropped,
    suggestions,
    refine,
    labels: Object.fromEntries(
      understanding.chips
        .filter((chip) => chip.key.startsWith(`${chip.filterId}:`))
        .map((chip) => [chip.key, chip.text]),
    ),
  };
}
