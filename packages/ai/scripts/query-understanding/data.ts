// CS-62's labelled set for plain-Farsi search (data/queries.ts, labelled from labelling-guide.md): checked against the
// product's own schemas before anything runs, so a label that no search could carry fails here, not in a report.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { SearchFiltersSchema } from '@carshenas/search/search';
import { SORT_IDS } from '@carshenas/search/sorts';
import { INTENT_IDS } from '@carshenas/search/understand/intents';
import { NOTE_KINDS } from '@carshenas/search/understand/types';
import { CATEGORIES, QUERIES, type QueryItem } from './data/queries.ts';

const Expected = z.strictObject({
  filters: SearchFiltersSchema.optional(),
  intents: z.array(z.enum(INTENT_IDS)).optional(),
  sort: z.enum(SORT_IDS).optional(),
  unused: z.array(z.string().min(1)).optional(),
  textSearch: z.boolean().optional(),
  notes: z.array(z.enum(NOTE_KINDS)).optional(),
});

const Witness = z.union([
  z.strictObject({ kind: z.literal('present'), filter: z.string(), value: z.unknown().optional() }),
  z.strictObject({ kind: z.literal('absent'), filter: z.string() }),
]);

const Item = z.strictObject({
  id: z.string().regex(/^Q\d{3}$/),
  split: z.enum(['development', 'test']),
  category: z.enum(CATEGORIES),
  source: z.literal('written'),
  text: z.string().min(1),
  expected: Expected,
  settledByCode: z.boolean(),
  accept: z.array(Expected),
  attacks: z.array(Witness),
  comment: z.string().nullable(),
});

/** The SHA-256 of the labelled set's file: a run records it, and a report refuses runs made on other labels. */
export function labelsHash(): string {
  return createHash('sha256')
    .update(readFileSync(new URL('./data/queries.ts', import.meta.url)))
    .digest('hex')
    .slice(0, 16);
}

export function loadSet(): readonly QueryItem[] {
  const items = QUERIES.map((query) => Item.parse(query) as unknown as QueryItem);
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error('two queries share an id');
  for (const category of CATEGORIES) {
    for (const split of ['development', 'test'] as const) {
      if (!items.some((item) => item.category === category && item.split === split)) {
        throw new Error(`category ${category} has no query in the ${split} split`);
      }
    }
  }
  return items;
}
