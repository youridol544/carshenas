import { toPersianDigits } from './digits.ts';

// How a catalogue's name is shown (CS-61): names are data and keep the digits their source wrote.

// A letter of the Persian alphabet: the Arabic block's letters, and the five Persian ones outside that run.
const PERSIAN_LETTER = /[ء-يپچژکگی]/;
// A run of digits standing alone: not part of a Latin code such as «X5», «C200» or «206i».
const DIGITS_ALONE = /(?<![A-Za-z\d])\d+(?![A-Za-z\d])/g;

/**
 * A catalogue name as it is shown. Names are data and keep the digits their source wrote (the trim «پژو 206 تیپ ۱» has
 * Latin ones, its model «پژو ۲۰۶» Persian ones), and on screen every number is Persian (ADR-0014): a name in Persian
 * gets its numbers in Persian digits, one in Latin letters stays as it was written.
 */
export function nameOnScreen(name: string): string {
  return PERSIAN_LETTER.test(name) ? name.replace(DIGITS_ALONE, toPersianDigits) : name;
}
