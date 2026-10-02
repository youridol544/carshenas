// The valuation method (CS-51, docs/specs/S01-deal-ratings.md): its constants, the shared coefficients with their
// priors and bounds, and a listing's features. valuation_rate_listing() in the database computes the same features
// from the same columns; valuation.db.test.ts proves the two agree to the toman.

export const METHOD_VERSION = 1;
export const WINDOW_DAYS = 30;
export const MILEAGE_NORM_KM_PER_YEAR = 20_000;
/** How many listings each prior weighs in the ridge fit (S01 "Priors and bounds"). */
export const PRIOR_STRENGTH = 20;
/** Below this many kilometres a car is zero-km («صفر», «کارکرده صفر»). */
export const ZERO_KM_BELOW_KM = 1_000;
/**
 * A listing that accepts instalments (Divar's «امکان خرید قسطی») and asks this many percent below its market value or
 * more is valued but not rated: its price is a down payment or a first instalment (S01, CS-87). valuation_rate_listing()
 * applies the same threshold in SQL; valuation.db.test.ts proves the two agree.
 */
export const INSTALLMENT_GUARD_GAP_PCT = -20;
/** A model rates listings with at least this many comparables and a leave-one-out error of at most this (S01). */
export const MIN_SEGMENT_COMPARABLES = 8;
export const MAX_SEGMENT_ERROR_PCT = 15;
/** A trim gets a level of its own from this many comparables. */
export const MIN_TRIM_COMPARABLES = 5;
/** A comparable's price must be within this factor of its model's median (S01 comparables rule 7). */
export const OUTLIER_PRICE_FACTOR = 3;
/** And its first-fit residual within this many scaled median absolute deviations. */
export const OUTLIER_RESIDUAL_MADS = 3;
export const RETENTION_DAYS = 90;

export type SharedTerm =
  | 'age_slope'
  | 'mileage_deviation'
  | 'zero_km'
  | 'body_minor'
  | 'body_painted'
  | 'body_painted_around'
  | 'chassis_repainted'
  | 'gearbox_automatic'
  | 'dual_fuel_aftermarket'
  | 'electrified'
  | 'off_colour'
  | 'day';

type Prior = {
  /** Effect on the price as a fraction (−0.08 is 8 % less), per unit of the feature. */
  readonly prior: number;
  readonly min: number;
  readonly max: number;
  /** A typical size of the feature, so a prior weighs PRIOR_STRENGTH listings whatever the feature's unit. */
  readonly scale: number;
};

/**
 * S01's table, from the appraisers' percentages in docs/research/2026-09-30-iranian-used-car-price-factors.md.
 * Stored and fitted on the log scale: ln(1 + fraction).
 */
export const SHARED_PRIORS: Readonly<Record<SharedTerm, Prior>> = {
  age_slope: { prior: -0.06, min: -0.2, max: 0.05, scale: 5 },
  mileage_deviation: { prior: -0.08, min: -0.2, max: 0, scale: 0.5 },
  zero_km: { prior: 0.06, min: 0, max: 0.2, scale: 1 },
  body_minor: { prior: -0.02, min: -0.06, max: 0, scale: 1 },
  body_painted: { prior: -0.06, min: -0.15, max: 0, scale: 1 },
  body_painted_around: { prior: -0.12, min: -0.25, max: 0, scale: 1 },
  chassis_repainted: { prior: -0.06, min: -0.12, max: 0, scale: 1 },
  gearbox_automatic: { prior: 0.1, min: 0, max: 0.3, scale: 1 },
  dual_fuel_aftermarket: { prior: -0.04, min: -0.1, max: 0, scale: 1 },
  electrified: { prior: 0.15, min: 0, max: 0.4, scale: 1 },
  off_colour: { prior: -0.05, min: -0.12, max: 0, scale: 1 },
  day: { prior: 0.003, min: -0.005, max: 0.01, scale: 10 },
};

export const SHARED_TERMS = Object.keys(SHARED_PRIORS) as readonly SharedTerm[];

/** A model's own age slope is pulled toward the pooled one with this typical age. */
export const MODEL_AGE_SLOPE_SCALE = 5;

export type ListingAttributes = {
  readonly modelYearSh: number;
  readonly mileageKm: number;
  readonly gearbox: 'manual' | 'automatic';
  readonly fuel: string | null;
  readonly bodyCondition: string | null;
  readonly frontChassisCondition: string | null;
  readonly rearChassisCondition: string | null;
  /** The colour's family (colour.family); null when unknown. */
  readonly colourFamily: string | null;
  /** Days between the day the listing was posted and the run's day, at most WINDOW_DAYS; negative for a later day. */
  readonly daysBeforeAsOf: number;
};

const COMMON_COLOUR_FAMILIES = new Set(['white', 'black', 'silver', 'grey']);

export function ageInYears(
  attributes: Pick<ListingAttributes, 'modelYearSh'>,
  referenceYearSh: number,
): number {
  return Math.max(referenceYearSh - attributes.modelYearSh, 0);
}

/** The shared features of a listing (S01 "The price model"); age is returned apart, as it also feeds the model's slope. */
export function sharedFeatures(
  attributes: ListingAttributes,
  referenceYearSh: number,
): Readonly<Record<SharedTerm, number>> {
  const age = ageInYears(attributes, referenceYearSh);
  const chassis = [attributes.frontChassisCondition, attributes.rearChassisCondition];
  return {
    age_slope: age,
    mileage_deviation: (attributes.mileageKm - MILEAGE_NORM_KM_PER_YEAR * Math.max(age, 0.5)) / 100_000,
    zero_km: attributes.mileageKm < ZERO_KM_BELOW_KM ? 1 : 0,
    body_minor: attributes.bodyCondition === 'minor_scratches' ? 1 : 0,
    body_painted: attributes.bodyCondition === 'partly_repainted' ? 1 : 0,
    body_painted_around: attributes.bodyCondition === 'repainted_around' ? 1 : 0,
    chassis_repainted: chassis.includes('repainted') ? 1 : 0,
    gearbox_automatic: attributes.gearbox === 'automatic' ? 1 : 0,
    dual_fuel_aftermarket: attributes.fuel === 'dual_fuel_aftermarket' ? 1 : 0,
    electrified: ['hybrid', 'plug_in_hybrid', 'electric'].includes(attributes.fuel ?? '') ? 1 : 0,
    off_colour:
      attributes.colourFamily === null || COMMON_COLOUR_FAMILIES.has(attributes.colourFamily) ? 0 : 1,
    // Positive when the market rises: an older listing is valued lower by b_day per day.
    day: -Math.min(attributes.daysBeforeAsOf, WINDOW_DAYS),
  };
}

export type DealRating = 'great' | 'good' | 'fair' | 'high' | 'overpriced';

/** S01 "Price gap and ratings"; valuation_rate_listing() applies the same thresholds. */
export function dealRatingForGap(gapPct: number): DealRating {
  if (gapPct <= -10) return 'great';
  if (gapPct <= -4) return 'good';
  if (gapPct < 4) return 'fair';
  if (gapPct < 10) return 'high';
  return 'overpriced';
}
