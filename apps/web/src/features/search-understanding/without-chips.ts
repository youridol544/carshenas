import { canonical, type Search } from '@carshenas/search/search';
import type {
  Suggestion,
  UnderstoodChip,
  Understanding,
  UnusedWords,
} from '@carshenas/search/understand/types';

// What the buyer's own removals leave of an understood search (CS-62): each chip's `without` is relative to the search
// as first understood, so removing several is done here, from the keys. A chip of a choice filter is `<filter>:<value>`
// and removes only that value; any other chip removes its filter. The catalogue mark goes with the first removal, as
// in @carshenas/search's chipsOf: a search with a filter taken off is no longer that catalogue.

export function withoutChips(
  search: Search,
  chips: readonly UnderstoodChip[],
  removed: ReadonlySet<string>,
): Search {
  if (removed.size === 0) return search;
  const filters = new Map<string, unknown>(Object.entries(search.filters));
  for (const chip of chips) {
    if (!removed.has(chip.key)) continue;
    const current = filters.get(chip.filterId);
    const value = chip.key.startsWith(`${chip.filterId}:`)
      ? chip.key.slice(chip.filterId.length + 1)
      : undefined;
    if (value !== undefined && Array.isArray(current)) {
      const left = (current as string[]).filter((one) => one !== value);
      if (left.length > 0) filters.set(chip.filterId, left);
      else filters.delete(chip.filterId);
    } else {
      filters.delete(chip.filterId);
    }
  }
  const { catalogue: _catalogue, q, ...rest } = search;
  const keepsWords = q !== undefined && !removed.has('q');
  return canonical({
    ...rest,
    ...(keepsWords ? { q } : {}),
    filters: Object.fromEntries(filters),
  });
}

/** The buyer took a suggestion: it is a chip now (inferred, with the words it came from), and no longer offered. */
export function withSuggestionTaken(understanding: Understanding, suggestion: Suggestion): Understanding {
  if (suggestion.filterId === null) return understanding;
  const chip: UnderstoodChip = {
    key: suggestion.key,
    filterId: suggestion.filterId,
    text: suggestion.text,
    basis: 'inferred',
    by: 'model',
    words: suggestion.words,
    why: suggestion.why,
    intent: null,
    without: suggestion.add,
  };
  return {
    ...understanding,
    chips: [...understanding.chips, chip],
    suggestions: understanding.suggestions.filter((one) => one.key !== suggestion.key),
  };
}

/** The buyer chose to look for some unread words in the listings' text: they are no longer unread. */
export function withWordsAsText(understanding: Understanding, group: UnusedWords): Understanding {
  return { ...understanding, unused: understanding.unused.filter((one) => one !== group) };
}
