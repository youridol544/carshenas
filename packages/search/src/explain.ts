// What a filter or a catalogue measures, in Farsi, for the info control beside it (owner, 2026-10-01; CS-61, CS-63,
// CS-70 render it). Nothing here is written by hand twice: a rule filter states its own rule (filters.ts, built from
// the constants its predicate uses), a ranked option its own rule, and a catalogue is explained by the rules of the
// filters it applies, one line each.
import { CATALOGUES, type CatalogueId } from './catalogues.ts';
import { FILTERS, type AnyFilter } from './filters.ts';
import { optionLabel, rangeText, type LabelOf, type Range } from './kinds.ts';
import type { SearchFilters } from './search.ts';
import { sortById } from './sorts.ts';

/** One applied filter explained: its label, and exactly what its value keeps. */
export type Explanation = { readonly filterId: string; readonly label: string; readonly text: string };

/** What one filter's value keeps, in a Farsi sentence with its numbers. */
export function explainFilter(filter: AnyFilter, value: unknown, labelOf?: LabelOf): Explanation {
  const text = ((): string => {
    switch (filter.kind) {
      case 'flag':
        return filter.rule;
      case 'limit':
        return filter.rule(value as number);
      case 'ranked': {
        const values = filter.options.map((option) => option.value as string);
        const chosen = filter.options[values.indexOf(value as string)];
        const accepted = filter.options
          .slice(0, values.indexOf(value as string) + 1)
          .map((option) => option.label);
        return chosen?.rule ?? `فروشنده یکی از این‌ها را اعلام کرده باشد: ${accepted.join('، ')}.`;
      }
      case 'choice':
        return `${(value as string[]).map((chosen) => optionLabel(filter, chosen, labelOf)).join('، ')}.`;
      case 'range':
        return `${rangeText(filter.unit, value as Range)}.`;
    }
  })();
  return { filterId: filter.id, label: filter.label, text };
}

/** Every applied filter explained, in the filters' order. */
export function explainFilters(filters: SearchFilters, labelOf?: LabelOf): Explanation[] {
  return FILTERS.flatMap((filter) => {
    const value: unknown = filters[filter.id];
    return value === undefined ? [] : [explainFilter(filter, value, labelOf)];
  });
}

/** A catalogue's info control: its title and description, each condition it requires, and its order. */
export function explainCatalogue(id: CatalogueId, labelOf?: LabelOf) {
  const catalogue = CATALOGUES.find((candidate) => candidate.id === id);
  if (catalogue === undefined) throw new RangeError(`no catalogue ${id}`);
  const sort = sortById(catalogue.sort);
  return {
    title: catalogue.title,
    description: catalogue.description,
    conditions: explainFilters(catalogue.filters, labelOf),
    order: `${sort.label}: ${sort.description}`,
  };
}
