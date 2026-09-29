import { toLatinDigits } from './digits.ts';
import { withoutBidiControls } from './text.ts';

// Amounts are whole tomans (ADR-0014): the brand, the bound every amount column states, and reading an amount the way
// a Farsi page writes it. Turning one into text is the web app's (apps/web/src/lib/toman.ts).

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
