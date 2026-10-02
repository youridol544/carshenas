import { FILTERS } from '@carshenas/search/filters';
import type { LabelOf } from '@carshenas/search/kinds';
import type { Search } from '@carshenas/search/search';
import type { SearchFacets } from '@/features/search/search-types';

// The Persian name of a value that comes from the database (a make, a model, a district, a body type), for the chips and
// the explanations: looked up in every option the index has, and in the body types' own table, so a value that has no
// listings right now still has its name. A value nobody knows is shown as it is, never as something invented.

type NamedCode = { readonly code: string; readonly label: string };

export function makeLabelOf(options: SearchFacets, bodyTypes: readonly NamedCode[]): LabelOf {
  const names = new Map<string, string>();
  for (const [kind, list] of Object.entries(options)) {
    for (const option of list) names.set(`${kind}:${option.value}`, option.label);
  }
  for (const bodyType of bodyTypes) names.set(`body_type:${bodyType.code}`, bodyType.label);
  return (filterId, value) => names.get(`${filterId}:${value}`);
}

/**
 * The names of the values a search has chosen for the filters whose options are rows, keyed «filter id:value», for the
 * filter panel: an option whose count fell to nothing under the other filters is not in its list any more, and a chosen
 * value must still show by its name, so it can be unchecked.
 */
export function chosenLabels(search: Search, labelOf: LabelOf): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const filter of FILTERS) {
    if (filter.kind !== 'choice' || filter.optionsFrom === undefined) continue;
    const values: unknown = search.filters[filter.id];
    if (!Array.isArray(values)) continue;
    for (const value of values as string[]) {
      const label = labelOf(filter.id, value);
      if (label !== undefined) labels[`${filter.id}:${value}`] = label;
    }
  }
  return labels;
}
