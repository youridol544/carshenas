import * as z from 'zod';
import type { JsonObject } from '@carshenas/db/db-types';

// What a Divar listing says in its own words, read from its canonical snapshot (post.ts, version 1): the title and
// the seller's description, the only text CS-52's extraction gives a model (the ai-features skill, rule 5). The
// crawler had already replaced phone numbers in both (ADR-0008 point 7), and the structured rows stay CS-34's
// (attributes.ts). The text is returned raw: the AI layer's listing-text.ts cleans the copy the model reads, and the
// raw text is what the review queue shows a person.

const widget = z.looseObject({ widget_type: z.string(), data: z.unknown() });
const section = z.looseObject({ section_name: z.string(), widgets: z.array(widget) });
const post = z.looseObject({ sections: z.array(section) });
const legendTitle = z.looseObject({ title: z.string() });
const descriptionRow = z.looseObject({ text: z.string() });

export type ListingText = {
  /** The listing's heading, «LEGEND_TITLE_ROW» of the TITLE section. */
  readonly title: string;
  /** The seller's description: every «DESCRIPTION_ROW» of the DESCRIPTION section, one per line; "" when none. */
  readonly description: string;
};

/**
 * The title and description of a Divar snapshot, or null when it has no title, which no post readPost stores lacks:
 * a model is never asked about a listing it cannot name. The dates row inside the TITLE section is not the
 * description, so only the DESCRIPTION section is read for it.
 */
export function divarListingText(payload: JsonObject): ListingText | null {
  const read = post.safeParse(payload);
  if (!read.success) return null;
  let title = '';
  const lines: string[] = [];
  for (const { section_name: name, widgets } of read.data.sections) {
    for (const item of widgets) {
      if (name === 'TITLE' && title === '' && item.widget_type === 'LEGEND_TITLE_ROW') {
        title = legendTitle.safeParse(item.data).data?.title.trim() ?? '';
      } else if (name === 'DESCRIPTION' && item.widget_type === 'DESCRIPTION_ROW') {
        const text = descriptionRow.safeParse(item.data).data?.text.trim() ?? '';
        if (text !== '') lines.push(text);
      }
    }
  }
  return title === '' ? null : { title, description: lines.join('\n') };
}
