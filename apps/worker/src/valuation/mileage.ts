import { isPlausibleAsThousands } from '../sources/attributes.ts';
import type { MileageCandidate, MileageDecision } from '../db/valuation-store.ts';
import { predictLn, type FittedModel } from './fit.ts';
import { THOUSANDS_PRICE_BAND } from '@carshenas/search/mileage-reading';
import { ageInYears } from './method.ts';

// Reading a mileage the listing's words did not settle (CS-101, ADR-0040). A seller who typed «۱۰۰» for a car of three or
// more model years may mean 100 km or 100,000 km. The valuation model knows what such a car is worth at 100,000 km, so
// the asking price tells which: a price at or below the car's market value at 1,000 times the figure is a used car's,
// while a price far above it is a near-new car's, which no seller of a 100,000 km car asks. The test is one-sided on
// purpose: only a price too high for the assumed mileage keeps the figure unread, so the reading never claims more
// than the price can show, and a cheap listing (damaged, a down payment) is still read as the used car it is.

export const PRICE_BAND = THOUSANDS_PRICE_BAND;

/**
 * The figure is read in thousands when both hold: the asking price is at most this multiple of the market value at
 * 1,000 times the figure (a used car's price, within the model's error), and the value at the figure as written is at
 * least this multiple of the value at 1,000 times it (the two readings are further apart than the model's error, so a
 * price can tell them apart). Measured on the listings of 2026-10-03 (docs/evidence/listing-facts/
 * 2026-10-03-mileage-in-thousands.md): 20 of the 48 untested figures pass, all on cars of nine or more model years
 * with a written figure of 120 to 540; on a car of three to five years the two readings differ by 5 to 14 %, so there
 * the price decides nothing and the figure stays unread.
 */
export const THOUSANDS_MAX_PRICE_RATIO = 1 + PRICE_BAND;
export const THOUSANDS_MIN_VALUE_GAP = 1 + PRICE_BAND;

/** The ratio is stored with this many decimals and never above this (listing_mileage_ask_ratio_tested). */
const RATIO_DECIMALS = 3;
const RATIO_CEILING = 9_999;

/** The asking price over the model's market value at `mileageKm`; undefined when the model has no value for the listing. */
export function priceRatioAt(
  model: FittedModel,
  candidate: MileageCandidate,
  referenceYearSh: number,
  mileageKm: number,
): number | undefined {
  const ln = predictLn(model, { ...candidate, attributes: { ...candidate.attributes, mileageKm } }, referenceYearSh);
  return ln === undefined ? undefined : candidate.askingPriceToman / Math.exp(ln);
}

/** The market value at the figure as written over the value at 1,000 times it: how far apart the two readings are. */
export function valueGap(
  model: FittedModel,
  candidate: MileageCandidate,
  referenceYearSh: number,
): number | undefined {
  const written = priceRatioAt(model, candidate, referenceYearSh, candidate.writtenKm);
  const thousands = priceRatioAt(model, candidate, referenceYearSh, candidate.writtenKm * 1000);
  // r(thousands) / r(written) = value(written) / value(thousands): above 1, the car is worth more at the figure as written.
  return written === undefined || thousands === undefined ? undefined : thousands / written;
}

/** Whether the figure is read in thousands, and the evidence: the ratio at 1,000 times the figure. */
export function decideMileage(
  model: FittedModel,
  candidate: MileageCandidate,
  referenceYearSh: number,
): MileageDecision {
  const age = ageInYears(candidate.attributes, referenceYearSh);
  const ratio = priceRatioAt(model, candidate, referenceYearSh, candidate.writtenKm * 1000);
  const gap = valueGap(model, candidate, referenceYearSh);
  const evidence =
    ratio === undefined
      ? null
      : Math.min(Math.round(ratio * 10 ** RATIO_DECIMALS) / 10 ** RATIO_DECIMALS, RATIO_CEILING);
  return {
    listingId: candidate.listingId,
    writtenKm: candidate.writtenKm,
    priceRatio: evidence,
    thousands:
      evidence !== null &&
      gap !== undefined &&
      evidence <= THOUSANDS_MAX_PRICE_RATIO &&
      gap >= THOUSANDS_MIN_VALUE_GAP &&
      isPlausibleAsThousands(candidate.writtenKm, age),
  };
}
