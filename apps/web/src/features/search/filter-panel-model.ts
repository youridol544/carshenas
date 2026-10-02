import { toLatinDigits } from '@carshenas/locale/digits';
import { FILTERS, type AnyFilter, type FilterId } from '@carshenas/search/filters';
import { FILTER_GROUPS, type FilterGroup } from '@carshenas/search/kinds';
import { SearchFiltersSchema, type SearchFilters } from '@carshenas/search/search';

// How the filter panel is laid out and changed, as plain functions a unit test can read (filter-panel-model.test.ts).
// The panel shows five filters at the top, always open (the car, the budget and the verdict: the first things a buyer
// narrows by), and every other filter in the groups of CS-58's definitions, each group a closed section that opens by
// itself when one of its filters is applied. A filter that has a place in the definitions has one here, except the source
// filter, which appears on its own once a second source has listings (CS-58 criterion 3).

export const FEATURED_FILTER_IDS = [
  'make',
  'model',
  'price',
  'year',
  'deal',
] as const satisfies readonly FilterId[];

export type PanelGroup = {
  readonly group: FilterGroup;
  readonly label: string;
  readonly filters: readonly AnyFilter[];
};

export type PanelLayout = {
  readonly featured: readonly AnyFilter[];
  readonly groups: readonly PanelGroup[];
};

function isFeatured(filter: AnyFilter): boolean {
  return (FEATURED_FILTER_IDS as readonly string[]).includes(filter.id);
}

/** The panel's filters: the featured ones, then the groups in the sheet's order, without the empty ones. */
export function panelLayout(sourceCount: number): PanelLayout {
  const offered = FILTERS.filter((filter) => filter.id !== 'source' || sourceCount > 1);
  const groups = (Object.keys(FILTER_GROUPS) as FilterGroup[]).flatMap((group) => {
    const filters = offered.filter((filter) => filter.group === group && !isFeatured(filter));
    return filters.length === 0 ? [] : [{ group, label: FILTER_GROUPS[group], filters }];
  });
  return { featured: offered.filter(isFeatured), groups };
}

/** How many of these filters have a value. */
export function appliedIn(filters: SearchFilters, among: readonly AnyFilter[]): number {
  return among.filter((filter) => filters[filter.id] !== undefined).length;
}

/**
 * The filters with one filter's value set, or removed when the value is undefined. A result the shared schema would
 * refuse is never returned: the filters stay as they were.
 */
export function withFilter(filters: SearchFilters, id: FilterId, value: unknown): SearchFilters {
  const others = Object.entries(filters).filter(([key]) => key !== id);
  const next: Record<string, unknown> = Object.fromEntries(
    value === undefined ? others : [...others, [id, value]],
  );
  const parsed = SearchFiltersSchema.safeParse(next);
  return parsed.success ? parsed.data : filters;
}

/** A choice with one value toggled: an empty choice is no filter. */
export function toggled(
  current: readonly string[] | undefined,
  value: string,
  on: boolean,
): string[] | undefined {
  const rest = (current ?? []).filter((candidate) => candidate !== value);
  const next = on ? [...rest, value] : rest;
  return next.length === 0 ? undefined : next;
}

// The zero-width non-joiner and the two direction marks: invisible in a name, and typed or not typed at will.
const INVISIBLE_MARKS = new RegExp(
  `[${String.fromCharCode(0x200c)}${String.fromCharCode(0x200e)}${String.fromCharCode(0x200f)}]`,
  'g',
);

/**
 * A name or a typed word as the filter lists compare them: digits in any script as Latin ones, Arabic yeh and kaf as
 * the Persian letters, no invisible marks, single spaces, no case. «پژو ۲۰۶» and «پژو 206» are the same word.
 */
export function normalizeForMatch(text: string): string {
  return toLatinDigits(text)
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(INVISIBLE_MARKS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
