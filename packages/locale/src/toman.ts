import { toLatinDigits } from './digits.ts';
import { LOCALE, NUMBERING_SYSTEM } from './locale.ts';
import { withoutBidiControls } from './text.ts';

// Amounts are whole tomans (ADR-0014): the brand, the bound every amount column states, reading an amount the way a
// Farsi page writes it, and the only place that turns one into text, in the three forms the ADR allows: full digits
// for every price and value, words inside sentences, and compact numbers on scales.

/** A whole number of tomans. Brand a number where it is parsed (`toToman`, `readWrittenToman`), never with `as` elsewhere. */
export type Toman = number & { readonly __brand: 'Toman' };

/** The bound every amount column's CHECK states (ADR-0014, point 2): each amount, and the sum of any nine, stay exact. */
export const MAX_TOMAN = 999_999_999_999_999;

export function toToman(value: number): Toman {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_TOMAN) {
    throw new RangeError(`Not a whole number of tomans within the stored bound: ${String(value)}`);
  }
  return value as Toman;
}

// Digits grouped by threes with an ASCII comma, an Arabic comma (U+060C), or the Arabic decimal (U+066B) or thousands
// (U+066C) separator, or not grouped at all, then «تومان» (CS-2, finding 3.5: Divar used U+060C in 2025 and the ASCII
// comma in 2026, and Torob groups with U+066B).
const SEPARATOR = /[,،٫٬]/g;
const WRITTEN = /^(\d{1,3}(?:[,،٫٬]\d{3})+|\d+) ?تومان$/;

/**
 * «۱,۲۵۰,۰۰۰,۰۰۰ تومان» as a number of tomans: digits in any script, a leading direction mark allowed. Undefined for
 * anything else, a decimal («۱٫۵ میلیارد») and a missing unit included: an amount is read, never guessed.
 */
export function readWrittenToman(text: string): Toman | undefined {
  const plain = toLatinDigits(withoutBidiControls(text)).replace(/\s+/g, ' ').trim();
  const digits = WRITTEN.exec(plain)?.[1];
  if (digits === undefined) return undefined;
  const value = Number(digits.replace(SEPARATOR, ''));
  return Number.isSafeInteger(value) && value <= MAX_TOMAN ? toToman(value) : undefined;
}

// Writing an amount.

const UNIT = 'تومان';
// A number never wraps away from its unit or scale word.
const NO_BREAK_SPACE = '\u00A0';
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

/** «۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان»: a stated price, exactly as the source gave it. */
export function formatToman(amount: Toman): string {
  return exact.format(amount) + NO_BREAK_SPACE + UNIT;
}

/** «۱٬۲۶۰٬۰۰۰٬۰۰۰ تومان»: an estimate such as a market value, rounded to three significant digits. */
export function formatTomanEstimate(amount: Toman): string {
  return threeSignificant.format(amount) + NO_BREAK_SPACE + UNIT;
}

/**
 * «۱٬۲۰۰٬۰۰۰٬۰۰۰ تا ۱٬۳۵۰٬۰۰۰٬۰۰۰ تومان»: an estimated range, both ends rounded like an estimate. Ends that round
 * to the same value are one estimate.
 */
export function formatTomanEstimateRange(low: Toman, high: Toman): string {
  assertOrdered(low, high);
  const from = threeSignificant.format(low);
  const to = threeSignificant.format(high);
  return (from === to ? to : from + RANGE_WORD + to) + NO_BREAK_SPACE + UNIT;
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
  if (roundsToThousandBillions(amount)) {
    return threeSignificant.format(amount / BILLION) + NO_BREAK_SPACE + 'میلیارد';
  }
  return joinParts(compact.formatToParts(amount));
}

// Intl says «هزارمیلیارد» for anything that rounds to a thousand billion, 999.5 billion included; Persian car prices
// stop at «میلیارد». toPrecision rounds half away from zero, as Intl does.
function roundsToThousandBillions(amount: number) {
  return Math.abs(Number(amount.toPrecision(3))) >= 1000 * BILLION;
}

/**
 * «۱٫۲ تا ۱٫۳۵ میلیارد تومان»: a range on a filter chip; the scale word is written once when both ends share it.
 * Ends that round to the same label are that label, where Intl would print «~۱٫۲ میلیارد» with a Latin tilde.
 */
export function formatTomanCompactRange(low: Toman, high: Toman): string {
  assertOrdered(low, high);
  const from = formatTomanCompact(low);
  const to = formatTomanCompact(high);
  if (from === to) return to + NO_BREAK_SPACE + UNIT;
  if (roundsToThousandBillions(low) || roundsToThousandBillions(high)) {
    return from + RANGE_WORD + to + NO_BREAK_SPACE + UNIT;
  }
  return joinParts(compact.formatRangeToParts(low, high)) + NO_BREAK_SPACE + UNIT;
}

// Intl prints a range that runs backwards («۲–۱ میلیارد») without complaint.
function assertOrdered(low: Toman, high: Toman) {
  if (low > high) {
    throw new RangeError(`A range runs from low to high: ${String(low)} is above ${String(high)}`);
  }
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
