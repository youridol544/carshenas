// Digits that could be a phone number or an identity number, masked to «#» wherever a buyer's words leave the process
// (CS-62: no personal data in prompts or logs; the search log and the model's request share this one function). Seven or
// more digits in a row, or nine or more across single spaces, dots, dashes or half-spaces («0912 345 6789»,
// «۰۹۱۲-۳۴۵-۶۷۸۹», «٠٩١٢ ٣٤٥ ٦٧٨٩»), in any digit script. A model year, a price and a mileage in one query stay readable,
// since words sit between them («206 تیپ ۵ ۱۳۹۷»). A long price typed as bare digits is masked too: the code has read it
// already, and the model never needs its digits.
const DIGIT = '[0-9۰-۹٠-٩]';
const SEPARATED = new RegExp(`${DIGIT}(?:[ .\\-\\u200c]?${DIGIT}){8,}`, 'g');
const CONTIGUOUS = new RegExp(`${DIGIT}{7,}`, 'g');

export function maskPhoneLike(text: string): string;
export function maskPhoneLike(text: string | undefined): string | undefined;
export function maskPhoneLike(text: string | undefined): string | undefined {
  return text?.replace(SEPARATED, '#').replace(CONTIGUOUS, '#');
}

/** The character ranges of `text` that maskPhoneLike would replace, in order and not overlapping. */
export function phoneLikeRanges(text: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  for (const pattern of [SEPARATED, CONTIGUOUS]) {
    for (const match of text.matchAll(pattern)) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last !== undefined && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}
