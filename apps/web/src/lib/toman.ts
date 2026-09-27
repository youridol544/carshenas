import { LOCALE, NUMBERING_SYSTEM } from '@/lib/locale';

// Amounts are whole tomans (ADR-0014). This file is the only place that turns one into text, in the three forms
// the ADR allows: full digits for every price and value, words inside sentences, and compact numbers on scales.

/** A whole number of tomans. Brand a number where it is parsed (`toToman`), never with `as` elsewhere. */
export type Toman = number & { readonly __brand: 'Toman' };

/** The bound every amount column's CHECK states (ADR-0014, point 2). */
export const MAX_TOMAN = 999_999_999_999_999;

const UNIT = 'تومان';
// A number never wraps away from its unit or scale word.
const NO_BREAK_SPACE = ' ';
const RANGE_WORD = ' تا ';
const BILLION = 1_000_000_000;

const exact = new Intl.NumberFormat(LOCALE, { numberingSystem: NUMBERING_SYSTEM, maximumFractionDigits: 0 });
const threeSignificant = new Intl.NumberFormat(LOCALE, {
  numberingSystem: NUMBERING_SYSTEM,
  maximumSignificantDigits: 3,
});
// Intl's compact default keeps two significant digits, which turns 1,250,000,000 into «۱٫۳ میلیارد».
const compact = new Intl.NumberFormat(LOCALE, {
  numberingSystem: NUMBERING_SYSTEM,
  notation: 'compact',
  compactDisplay: 'long',
  maximumSignificantDigits: 3,
});

export function toToman(value: number): Toman {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_TOMAN) {
    throw new RangeError(`Not a whole number of tomans within the stored bound: ${String(value)}`);
  }
  return value as Toman;
}

/** «۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان»: a stated price, exactly as the source gave it. */
export function formatToman(amount: Toman): string {
  return exact.format(amount) + NO_BREAK_SPACE + UNIT;
}

/** «۱٬۲۶۰٬۰۰۰٬۰۰۰ تومان»: an estimate such as a market value, rounded to three significant digits. */
export function formatTomanEstimate(amount: Toman): string {
  return threeSignificant.format(amount) + NO_BREAK_SPACE + UNIT;
}

/** «۱٬۲۰۰٬۰۰۰٬۰۰۰ تا ۱٬۳۵۰٬۰۰۰٬۰۰۰ تومان»: an estimated range, both ends rounded like an estimate. */
export function formatTomanEstimateRange(low: Toman, high: Toman): string {
  return threeSignificant.format(low) + RANGE_WORD + formatTomanEstimate(high);
}

const SCALE_WORDS = [
  [BILLION, 'میلیارد'],
  [1_000_000, 'میلیون'],
  [1_000, 'هزار'],
] as const;

/**
 * «۱ میلیارد و ۲۵۰ میلیون تومان»: an amount inside a Farsi sentence (explanations, alerts, the echo under an
 * amount field). Exact; «میلیارد» is the largest word, so «۱٬۲۰۰ میلیارد تومان».
 */
export function formatTomanInWords(amount: Toman): string {
  if (amount < 0) {
    throw new RangeError('A sentence names the direction in words; pass the amount without its sign.');
  }
  const groups: string[] = [];
  let rest: number = amount;
  for (const [size, word] of SCALE_WORDS) {
    const remainder = rest % size;
    const count = (rest - remainder) / size;
    if (count > 0) {
      groups.push(exact.format(count) + NO_BREAK_SPACE + word);
    }
    rest = remainder;
  }
  if (rest > 0 || groups.length === 0) {
    groups.push(exact.format(rest));
  }
  return groups.join(' و ') + NO_BREAK_SPACE + UNIT;
}

/** «۱٫۲۵ میلیارد», «۸۵۰ میلیون»: a label on a scale (an axis, a gauge's band edge), whose title names the unit. */
export function formatTomanCompact(amount: Toman): string {
  if (Math.abs(amount) >= 1000 * BILLION) {
    // Intl would say «هزارمیلیارد»; Persian car prices stop at «میلیارد».
    return threeSignificant.format(amount / BILLION) + NO_BREAK_SPACE + 'میلیارد';
  }
  return joinParts(compact.formatToParts(amount));
}

/** «۱٫۲ تا ۱٫۳۵ میلیارد تومان»: a range on a filter chip; the scale word is written once when both ends share it. */
export function formatTomanCompactRange(low: Toman, high: Toman): string {
  if (Math.max(Math.abs(low), Math.abs(high)) >= 1000 * BILLION) {
    return formatTomanCompact(low) + RANGE_WORD + formatTomanCompact(high) + NO_BREAK_SPACE + UNIT;
  }
  return joinParts(compact.formatRangeToParts(low, high)) + NO_BREAK_SPACE + UNIT;
}

// Intl joins a range with a dash and puts an ordinary space before the scale word; Persian writes «تا» and keeps
// the number with its word.
function joinParts(parts: readonly (Intl.NumberFormatPart | Intl.NumberRangeFormatPart)[]): string {
  return parts
    .map((part) => {
      if (part.type !== 'literal') return part.value;
      if ('source' in part && part.source === 'shared' && part.value.trim() !== '') return RANGE_WORD;
      return part.value.replaceAll(' ', NO_BREAK_SPACE);
    })
    .join('');
}
