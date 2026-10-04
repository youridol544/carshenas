import type { InfoContent } from '@/components/ui/info-popover';
import { explainCatalogue } from '@carshenas/search/explain';
import type { CatalogueId } from '@carshenas/search/catalogues';
import type { AnyFilter } from '@carshenas/search/filters';
import type { LabelOf } from '@carshenas/search/kinds';

// What an info control says, assembled from the shared definitions (CS-58) and nothing else: a filter's own description
// and rule, a deal option's own boundary against market value, a catalogue's description with one line per condition it
// applies and its order (explain.ts). The numbers in those sentences were printed from the constants the SQL uses, so
// the words and the query cannot disagree (the owner's request of 2026-10-01); this file only sets them out. A popover
// has no headings (the voice guide, section 5): its title is the control's own name and every section is a sentence or
// a row that explains itself.

/** A catalogue explained: what it offers, each condition it applies, and the order it shows them in. */
export function catalogueInfo(id: CatalogueId, labelOf?: LabelOf): InfoContent {
  const explained = explainCatalogue(id, labelOf);
  return {
    title: explained.title,
    sections: [
      { id: 'what', paragraphs: [explained.description] },
      {
        id: 'conditions',
        rows: explained.conditions.map((condition) => ({ label: condition.label, text: condition.text })),
      },
      { id: 'order', paragraphs: [explained.order] },
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
        sections: [what, { id: 'rule', paragraphs: [filter.rule] }],
      };
    case 'limit':
      return {
        title: filter.label,
        sections: [
          what,
          {
            id: 'options',
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
        // A ladder with no measured rule (the body's condition) needs no list of its own: the select shows the
        // options best first, and each chip says «or better».
        sections: rules.length > 0 ? [what, { id: 'options', rows: rules }] : [what],
      };
    }
    case 'choice':
    case 'range':
      return { title: filter.label, sections: [what] };
  }
}
