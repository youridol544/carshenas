// The documented adjustments a wish stands for (CS-62 criterion 3, docs/specs/S04-plain-farsi-search.md): a buyer who
// writes «مناسب اسنپ» or «ماشین خانوادگی» names no filter, so the product adds the filters and the order that wish
// means, shows each one as an inferred chip with the words it came from, and lets the buyer change them. The bundles
// are the catalogues' own (CS-58: «خانوادگی», «مناسب کار در تاکسی اینترنتی», «تمیز و بی‌دردسر» …) and the two
// conditions they are built from («تمیز», «سالم از نظر فنی»), so no filter value is written twice. One table: the code
// pass reads it for phrases, the model step offers its ids, and the merge expands it with the conflict rules below.
import { CATALOGUES, CLEAN_BODY, TECHNICALLY_SOUND, type CatalogueId } from '../catalogues.ts';
import type { FilterId } from '../filters.ts';
import type { SearchFilters } from '../search.ts';
import type { SortId } from '../sorts.ts';

export const INTENT_IDS = [
  'clean-and-easy',
  'clean-body',
  'technically-sound',
  'karshenas-pick',
  'family',
  'ride-hailing',
  'newest',
] as const;
export type IntentId = (typeof INTENT_IDS)[number];

export type Intent = {
  readonly id: IntentId;
  /** The Farsi name of the bundle, shown beside the words that asked for it. */
  readonly title: string;
  /** One Farsi sentence: what the bundle keeps. */
  readonly meaning: string;
  /** What the bundle adds; relative values («حداکثر ۱۰ سال عمر») stay relative. */
  readonly filters: SearchFilters;
  /** The order the bundle asks for; best deal first is the default and is left out of a search. */
  readonly sort: SortId;
  /** The catalogue the bundle is, when it is one. */
  readonly catalogue?: CatalogueId;
  /** Why the bundle exists, for the people who maintain it. */
  readonly reason: string;
};

function ofCatalogue(id: CatalogueId, intent: IntentId, reason: string): Intent {
  const found = CATALOGUES.find((candidate) => candidate.id === id);
  if (found === undefined) throw new RangeError(`no catalogue ${id}`);
  return {
    id: intent,
    title: found.title,
    meaning: found.description,
    filters: found.filters,
    sort: found.sort,
    catalogue: id,
    reason,
  };
}

export const INTENTS: readonly Intent[] = [
  ofCatalogue(
    'clean-and-easy',
    'clean-and-easy',
    "The owner's request of 2026-09-30, made without naming a model: clean, little driven for its age, technically sound, easy to keep.",
  ),
  {
    id: 'clean-body',
    title: 'بدنه‌ی تمیز',
    meaning: 'بدون رنگ‌شدگی، بدون تصادف و بدون تعویض قطعه‌ی بدنه.',
    filters: CLEAN_BODY,
    sort: 'best_deal',
    reason:
      '«ماشین تمیز» alone: in a used-car ad, clean is the body (no paint, no accident, no replaced panel), the largest price factor in this market. Smaller than clean-and-easy so it does not over-constrain.',
  },
  {
    id: 'technically-sound',
    title: 'سالم از نظر فنی',
    meaning: 'موتور، گیربکس و شاسی‌ای که فروشنده سالم اعلام کرده است.',
    filters: TECHNICALLY_SOUND,
    sort: 'best_deal',
    reason: 'The sound-engine, sound-gearbox and intact-chassis conditions the catalogues share.',
  },
  ofCatalogue(
    'karshenas-pick',
    'karshenas-pick',
    'A buyer asking what to buy, or for the best: the product shortlist.',
  ),
  ofCatalogue('family', 'family', 'Family and trip wishes (CS-58: «خانوادگی», «جادار», «سفر»).'),
  ofCatalogue('ride-hailing', 'ride-hailing', 'Wishes to work for Snapp or Tapsi, or as a taxi.'),
  ofCatalogue('newest', 'newest', "Today's listings: posted in the last 24 hours, newest first."),
];

const BY_ID: ReadonlyMap<IntentId, Intent> = new Map(INTENTS.map((intent) => [intent.id, intent]));

export function intentById(id: IntentId): Intent {
  const found = BY_ID.get(id);
  if (found === undefined) throw new RangeError(`no intent ${id}`);
  return found;
}

/** A filter value that is not the buyer's own word: an intent's, or a documented mapping's («بی‌دردسر» is a popular model). */
export type Adjustment = {
  readonly filterId: FilterId;
  readonly value: unknown;
  /** The bundle it came from; undefined for a single-word mapping. */
  readonly intent: IntentId | undefined;
};

/** An adjustment that was dropped and the conflict rule that dropped it. */
export type SkippedAdjustment = Adjustment & {
  readonly reason: 'stated' | 'car_named' | 'year_stated' | 'taken';
};

const CAR_NAMED: readonly FilterId[] = ['make', 'model', 'trim'];

/** What each intent adds, in the intents' order. */
export function adjustmentsOf(intents: readonly IntentId[]): Adjustment[] {
  return intents.flatMap((id) =>
    (Object.entries(intentById(id).filters) as [FilterId, unknown][]).map(([filterId, value]) => ({
      filterId,
      value,
      intent: id,
    })),
  );
}

/**
 * The adjustments after the conflict rules (S04 "Conflicts"): a filter the buyer stated is never changed by an
 * adjustment (the same filter, stated, wins); a car already named makes «پرطرفدار» and a body type pointless; a stated
 * model year makes a maximum age pointless; and when two adjustments add the same filter the first keeps it.
 */
export function resolveAdjustments(
  adjustments: readonly Adjustment[],
  stated: SearchFilters,
): { applied: Adjustment[]; skipped: SkippedAdjustment[] } {
  const applied: Adjustment[] = [];
  const skipped: SkippedAdjustment[] = [];
  const present = (id: FilterId) => (stated as Record<string, unknown>)[id] !== undefined;
  const carNamed = CAR_NAMED.some(present);
  for (const adjustment of adjustments) {
    const { filterId } = adjustment;
    const reason = ((): SkippedAdjustment['reason'] | undefined => {
      if (present(filterId)) return 'stated';
      if (carNamed && (filterId === 'popular_model' || filterId === 'body_type')) return 'car_named';
      if (filterId === 'age' && present('year')) return 'year_stated';
      if (applied.some((one) => one.filterId === filterId)) return 'taken';
      return undefined;
    })();
    if (reason === undefined) applied.push(adjustment);
    else skipped.push({ ...adjustment, reason });
  }
  return { applied, skipped };
}

/** The order the first intent that asks for one gets, when the buyer asked for none. */
export function sortOfIntents(intents: readonly IntentId[], stated: SortId | undefined): SortId | undefined {
  if (stated !== undefined) return stated;
  for (const id of intents) {
    const { sort } = intentById(id);
    if (sort !== 'best_deal') return sort;
  }
  return undefined;
}
