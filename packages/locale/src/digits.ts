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
