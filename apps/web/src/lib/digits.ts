// What a person types may use Persian (۰–۹), Arabic-Indic (٠–٩) or Latin digits, and data keeps Latin digits
// (ADR-0014). `Number('۱۲۳')` is NaN, so every typed number goes through here before it is parsed.

const PERSIAN_ZERO = 0x06f0;
const ARABIC_INDIC_ZERO = 0x0660;
const NON_LATIN_DIGIT = /[۰-۹٠-٩]/g;

/** '۱۲۳' and '١٢٣' become '123'; every other character is left as it is. */
export function toLatinDigits(text: string): string {
  return text.replace(NON_LATIN_DIGIT, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_INDIC_ZERO));
  });
}
