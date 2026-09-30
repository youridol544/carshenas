import { withoutBidiControls } from './text.ts';

// What a person types, and what a source's page shows, may use Persian (۰–۹), Arabic-Indic (٠–٩) or Latin digits, and
// data keeps Latin digits (ADR-0014). `Number('۱۲۳')` is NaN, so every number read from text goes through here before it
// is parsed.

const PERSIAN_ZERO = 0x06f0;
const ARABIC_INDIC_ZERO = 0x0660;
const NON_LATIN_DIGIT = /[۰-۹٠-٩]/g;
const LATIN_DIGIT = /[0-9]/g;

/** '۱۲۳' and '١٢٣' become '123'; every other character is left as it is. */
export function toLatinDigits(text: string): string {
  return text.replace(NON_LATIN_DIGIT, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_INDIC_ZERO));
  });
}

/**
 * '2847193056' becomes '۲۸۴۷۱۹۳۰۵۶': the digits of a code shown as it is, such as an error's reference code. A
 * quantity goes through the formatters in format-number.ts instead, which add the thousands marks.
 */
export function toPersianDigits(text: string): string {
  return text.replace(LATIN_DIGIT, (digit) => String.fromCharCode(PERSIAN_ZERO + Number(digit)));
}

/**
 * Latin digits grouped by threes with an ASCII comma, an Arabic comma (U+060C), or the Arabic decimal (U+066B) or
 * thousands (U+066C) separator, or not grouped at all (CS-2, finding 3.5: Divar used U+060C in 2025 and the ASCII comma
 * in 2026, and Torob groups with U+066B). A group is exactly three digits, so «1٫5» is never read as 15.
 */
export const GROUPED_DIGITS = String.raw`\d{1,3}(?:[,،٫٬]\d{3})+|\d+`;
const GROUP_SEPARATOR = /[,،٫٬]/g;
const WHOLE_NUMBER = new RegExp(`^(?:${GROUPED_DIGITS})$`);

/**
 * «۱۲۰,۰۰۰» or «91000» as the whole number it writes: digits in any script, grouped by threes or not, with direction
 * marks and spaces around it ignored. Undefined for anything else, a sign, a decimal and a unit included: a number is
 * read, never guessed.
 */
export function readWholeNumber(text: string): number | undefined {
  const plain = toLatinDigits(withoutBidiControls(text)).trim();
  if (!WHOLE_NUMBER.test(plain)) return undefined;
  const value = Number(plain.replace(GROUP_SEPARATOR, ''));
  return Number.isSafeInteger(value) ? value : undefined;
}
