// Persian (۰–۹) and Arabic-Indic (٠–٩) digits become Latin: a phone's Persian keyboard types the first, some Windows
// layouts the second, and one account must accept both (ADR-0014, ADR-0020). The web app keeps its own copy for
// everything else people type (apps/web/src/lib/digits.ts): a package never imports the app.

const PERSIAN_ZERO = 0x06f0;
const ARABIC_INDIC_ZERO = 0x0660;
const NON_LATIN_DIGIT = /[۰-۹٠-٩]/g;

export function foldDigits(text: string): string {
  return text.replace(NON_LATIN_DIGIT, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_INDIC_ZERO));
  });
}
