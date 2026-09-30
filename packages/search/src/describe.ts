// The search's vocabulary as plain data, for plain-Farsi search (CS-62) to put in its prompt and check its answer
// against: every filter with its kind, values, unit and bounds, the words buyers use for it, every catalogue a vague
// request can open («یک ماشین تمیز و بی‌دردسر» is clean-and-easy), and every order. The model answers in the Search
// schema itself (search.ts), so what it understood is validated like the filter sheet's input and shown as chips.
import { CATALOGUES } from './catalogues.ts';
import { FILTERS } from './filters.ts';
import { SORTS } from './sorts.ts';

export type FilterDescription = {
  readonly id: string;
  readonly kind: 'choice' | 'ranked' | 'range' | 'limit' | 'flag';
  readonly label: string;
  readonly description: string;
  readonly words: readonly string[];
  /** A choice's or a rank's values in code; a rank's are best first and a value keeps it and every better one. */
  readonly values?: readonly { readonly value: string; readonly label: string }[];
  /** A choice whose values are rows: the caller gives the model the ones that exist (readFilterOptions). */
  readonly valuesFrom?: string;
  readonly unit?: string;
  readonly bounds?: { readonly min: number; readonly max: number };
};

export type SearchVocabulary = {
  readonly filters: readonly FilterDescription[];
  readonly catalogues: readonly {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly words: readonly string[];
  }[];
  readonly sorts: readonly {
    readonly id: string;
    readonly label: string;
    readonly words: readonly string[];
  }[];
};

const UNITS = { toman: 'tomans', km: 'kilometres', year: 'Solar Hijri model year' } as const;

export function searchVocabulary(): SearchVocabulary {
  return {
    filters: FILTERS.map((filter): FilterDescription => {
      const common = {
        id: filter.id,
        kind: filter.kind,
        label: filter.label,
        description: filter.description,
        words: filter.words,
      };
      switch (filter.kind) {
        case 'choice':
          return filter.options === undefined
            ? { ...common, valuesFrom: filter.optionsFrom }
            : { ...common, values: filter.options.map(({ value, label }) => ({ value, label })) };
        case 'ranked':
          return { ...common, values: filter.options.map(({ value, label }) => ({ value, label })) };
        case 'range':
          return { ...common, unit: UNITS[filter.unit], bounds: filter.bounds };
        case 'limit':
          return { ...common, bounds: filter.bounds };
        case 'flag':
          return common;
      }
    }),
    catalogues: CATALOGUES.map(({ id, title, description, words }) => ({ id, title, description, words })),
    sorts: SORTS.map(({ id, label, words }) => ({ id, label, words })),
  };
}
