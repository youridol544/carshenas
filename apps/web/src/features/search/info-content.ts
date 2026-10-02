import type { InfoContent } from '@/components/ui/info-popover';
import { explainCatalogue } from '@carshenas/search/explain';
import type { CatalogueId } from '@carshenas/search/catalogues';
import type { AnyFilter } from '@carshenas/search/filters';
import type { LabelOf } from '@carshenas/search/kinds';
import { SEARCH_COPY } from '@/features/search/search-copy';

// What an info control says, assembled from the shared definitions (CS-58) and nothing else: a filter's own description
// and rule, a deal option's own boundary against market value, a catalogue's description with one line per condition it
// applies and its order (explain.ts). The numbers in those sentences were printed from the constants the SQL uses, so
// the words and the query cannot disagree (the owner's request of 2026-10-01); this file only sets them out.

const INFO = SEARCH_COPY.info;

/** A catalogue explained: what it offers, each condition it applies, and the order it shows them in. */
export function catalogueInfo(id: CatalogueId, labelOf?: LabelOf): InfoContent {
  const explained = explainCatalogue(id, labelOf);
  return {
    title: explained.title,
    sections: [
      { id: 'what', paragraphs: [explained.description] },
      {
        id: 'conditions',
        heading: INFO.conditions,
        rows: explained.conditions.map((condition) => ({ label: condition.label, text: condition.text })),
      },
      { id: 'order', heading: INFO.order, paragraphs: [explained.order] },
    ],
  };
}

/** A filter explained: what it keeps and what the data behind it can and cannot say, and for a rule its exact measure. */
export function filterInfo(filter: AnyFilter): InfoContent {
  const what = { id: 'what', paragraphs: [filter.description] };
  switch (filter.kind) {
    case 'flag':
      return {
        title: filter.label,
        sections: [what, { id: 'rule', heading: INFO.rule, paragraphs: [filter.rule] }],
      };
    case 'limit':
      return {
        title: filter.label,
        sections: [
          what,
          {
            id: 'options',
            heading: INFO.options,
            rows: filter.choices.map((choice) => ({ label: filter.chip(choice), text: filter.rule(choice) })),
          },
        ],
      };
    case 'ranked': {
      const rules = filter.options.flatMap((option) =>
        option.rule === undefined ? [] : [{ label: option.label, text: option.rule }],
      );
      return {
        title: filter.label,
        sections: [
          what,
          rules.length > 0
            ? { id: 'options', heading: INFO.options, rows: rules }
            : {
                id: 'order',
                heading: INFO.bestToWorst,
                paragraphs: [filter.options.map((option) => option.label).join('، ')],
              },
        ],
      };
    }
    case 'choice':
    case 'range':
      return { title: filter.label, sections: [what] };
  }
}
