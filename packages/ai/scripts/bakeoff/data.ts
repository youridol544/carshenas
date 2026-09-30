// The bake-off's inputs and hand labels (CS-46), in data/: real Divar listings with personal data removed, searches
// written the way buyers type them, duplicate questions built from the listings, and deal facts. The labels were set
// by hand before any model saw the item; data/README.md says how, and records every label changed afterwards.
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  ACCIDENT,
  BANDS,
  BODY,
  CALENDAR,
  CANDIDATE_KEYS,
  CATALOGUE,
  CHASSIS,
  FUEL,
  GEARBOX,
  INTENTS,
  PAINT,
  PAINT_MAX,
  REPLACED,
  RIDE_HAILING,
  YES_NO,
} from './tasks.ts';

const read = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./data/${name}`, import.meta.url), 'utf8')) as unknown;

export const CarCardSchema = z.strictObject({
  title: z.string(),
  description: z.string(),
  site: z.string(),
  city: z.string(),
  year: z.string(),
  mileageKm: z.number().int().nonnegative(),
  colour: z.string(),
  priceToman: z.number().int().positive().nullable(),
});

/**
 * A fact's label: the value, or, where re-reading the text after the first run showed two readings a careful reader
 * could take, the values either of which is right (data/README.md lists each).
 */
const label = <const Values extends readonly [string, ...string[]]>(values: Values) =>
  z.union([z.enum(values), z.array(z.enum(values)).min(2)]);

const ListingLabels = z.strictObject({
  paint: label(PAINT),
  replaced: label(REPLACED),
  chassis: label(CHASSIS),
  accident: label(ACCIDENT),
  negotiable: label(YES_NO),
  installment: label(YES_NO),
  swap: label(YES_NO),
  ride_hailing: label(RIDE_HAILING),
  instructions_to_ai: z.boolean(),
});
export type ListingLabels = z.infer<typeof ListingLabels>;

const Listing = z.strictObject({
  id: z.string(),
  /** The snapshot's row in the main database, the same id as in lane F's; no Divar token is kept (ADR-0017 point 7). */
  snapshotId: z.number().int().positive(),
  brandModel: z.string(),
  card: CarCardSchema.omit({ title: true, description: true }),
  title: z.string(),
  description: z.string(),
  labels: ListingLabels,
  /** On an injection variant: the values the injected text asks for. A model that reports one was persuaded. */
  attack: z.record(z.string(), z.string()).optional(),
  note: z.string().optional(),
});
export type Listing = z.infer<typeof Listing>;

const QueryLabels = z.strictObject({
  brand_model: z.enum([...CATALOGUE, 'other', 'not_stated']),
  /** Whether a word of the search names a trim; both, where the word can be read either way. */
  has_trim: z.union([z.boolean(), z.tuple([z.boolean(), z.boolean()])]),
  year_calendar: z.enum(CALENDAR),
  year_min: z.number().int().nonnegative(),
  year_max: z.number().int().nonnegative(),
  price_min_toman: z.number().int().nonnegative(),
  price_max_toman: z.number().int().nonnegative(),
  mileage_max_km: z.number().int().nonnegative(),
  paint_max: z.enum(PAINT_MAX),
  gearbox: z.enum(GEARBOX),
  fuel: z.enum(FUEL),
  body: z.enum(BODY),
  intents: z.array(z.enum(INTENTS)),
  /** Words that must be reported as unrecognised; others may be too. */
  unrecognised: z.array(z.string()),
});
export type QueryLabels = z.infer<typeof QueryLabels>;

const QueryItem = z.strictObject({
  id: z.string(),
  text: z.string(),
  labels: QueryLabels,
  note: z.string().optional(),
});
export type QueryItem = z.infer<typeof QueryItem>;

const DuplicateItem = z.strictObject({
  id: z.string(),
  listing: CarCardSchema,
  candidates: z
    .array(CarCardSchema.extend({ key: z.enum(CANDIDATE_KEYS) }))
    .min(1)
    .max(4),
  label: z.enum([...CANDIDATE_KEYS, 'none']),
  note: z.string(),
});
export type DuplicateItem = z.infer<typeof DuplicateItem>;

const DealItem = z.strictObject({
  id: z.string(),
  car: z.string(),
  band: z.enum(BANDS),
  gapDirection: z.enum(['below', 'above', 'at']),
  condition: z.array(z.string()),
  listedDays: z.number().int().nonnegative(),
  priceDrops: z.number().int().nonnegative(),
});
export type DealItem = z.infer<typeof DealItem>;

export function loadListings(): Listing[] {
  return z.strictObject({ note: z.string(), listings: z.array(Listing) }).parse(read('listings.json'))
    .listings;
}

export function loadQueries(): QueryItem[] {
  return z.strictObject({ note: z.string(), queries: z.array(QueryItem) }).parse(read('queries.json'))
    .queries;
}

export function loadDuplicates(): DuplicateItem[] {
  return z
    .strictObject({ note: z.string(), questions: z.array(DuplicateItem) })
    .parse(read('duplicates.json')).questions;
}

export function loadDeals(): DealItem[] {
  return z.strictObject({ note: z.string(), deals: z.array(DealItem) }).parse(read('deals.json')).deals;
}
