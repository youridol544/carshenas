// CS-52's labelled set for listing.facts (data/listings.json, labelled from labelling-guide.md): read and checked
// against the task's own values, so a label outside the schema fails before any model is asked.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  ACCIDENT,
  CHASSIS,
  PAINT,
  PANELS,
  PLATE,
  PRICE_MEANING,
  REPLACED,
  RIDE_HAILING,
  YES_NO,
} from '../../src/tasks/listing-facts.ts';

/** A label, or the values either of which is right where the text reads two ways (the guide's rule 3). */
const label = <const Values extends readonly [string, ...string[]]>(values: Values) =>
  z.union([z.enum(values), z.array(z.enum(values)).min(2)]);

export const Labels = z.strictObject({
  paint: label(PAINT),
  replaced: label(REPLACED),
  chassis: label(CHASSIS),
  accident: label(ACCIDENT),
  negotiable: label(YES_NO),
  installment: label(YES_NO),
  swap: label(YES_NO),
  ride_hailing: label(RIDE_HAILING),
  price_meaning: label(PRICE_MEANING),
  plate: label(PLATE),
  panels: label(PANELS),
  instructions_to_ai: z.boolean(),
});
export type Labels = z.infer<typeof Labels>;
export type LabelledField = keyof Labels;

const Parsed = z.strictObject({
  priceType: z.enum(['asking', 'negotiable', 'installment', 'placeholder']).nullable(),
  acceptsInstallments: z.boolean().nullable(),
  acceptsSwap: z.boolean().nullable(),
  bodyCondition: z.string().nullable(),
  frontChassisCondition: z.string().nullable(),
  rearChassisCondition: z.string().nullable(),
});

export const Item = z.strictObject({
  id: z.string().regex(/^[LNXS]\d{2}$/),
  source: z.enum(['bakeoff', 'bakeoff-injection', 'new', 'injection', 'hand-made']),
  split: z.enum(['development', 'test']),
  /** The snapshot's row in the lane database (the same ids as main's); null for an item made by hand. */
  snapshotId: z.number().int().positive().nullable(),
  /** The real listing a hand-made item changes. */
  basedOn: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  /** The price the site shows beside the text (CS-34's reading), which the model reads as <site_price>. */
  shownPrice: z.union([
    z.strictObject({ type: z.literal('asking'), toman: z.number().int().positive() }),
    z.strictObject({ type: z.enum(['negotiable', 'placeholder', 'not_shown']) }),
  ]),
  parsed: Parsed.nullable(),
  labels: Labels,
  note: z.string().nullable(),
});
export type Item = z.infer<typeof Item>;

/** The SHA-256 of the labelled set's file: a run records it, and a report refuses runs made on other labels. */
export function labelsHash(): string {
  return createHash('sha256')
    .update(readFileSync(new URL('./data/listings.json', import.meta.url)))
    .digest('hex')
    .slice(0, 16);
}

export function loadSet(): Item[] {
  const file = new URL('./data/listings.json', import.meta.url);
  const data = z
    .strictObject({ note: z.string(), listings: z.array(Item) })
    .parse(JSON.parse(readFileSync(file, 'utf8')));
  const ids = new Set(data.listings.map((item) => item.id));
  if (ids.size !== data.listings.length) throw new Error('two items share an id');
  for (const item of data.listings) {
    if (item.basedOn !== null && !ids.has(item.basedOn))
      throw new Error(`${item.id} is based on a missing item`);
  }
  return data.listings;
}

/** Whether a value is right for a label: equal, or one of the values a two-way label accepts. */
export function matches(labelled: string | boolean | readonly string[], value: string | boolean): boolean {
  return typeof labelled === 'object' ? labelled.some((one) => one === value) : labelled === value;
}
