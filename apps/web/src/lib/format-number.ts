import { LOCALE, NUMBERING_SYSTEM } from '@/lib/locale';

// Counts and shares on screen: Persian digits, «٬» between thousands and «٫» for decimals, as `Intl` prints them
// for fa-IR. Amounts of money go through toman.ts instead.

const count = new Intl.NumberFormat(LOCALE, { numberingSystem: NUMBERING_SYSTEM, maximumFractionDigits: 0 });
const wholePercent = new Intl.NumberFormat(LOCALE, {
  numberingSystem: NUMBERING_SYSTEM,
  style: 'percent',
  maximumFractionDigits: 0,
});

/** «۱۲۰٬۰۰۰»: a count such as mileage or a number of listings, rounded to a whole number. */
export function formatCount(value: number): string {
  return count.format(value);
}

/**
 * «۱۲٪»: a share given as a ratio (0.12), in whole percent, as a price gap is shown. A negative ratio keeps the
 * left-to-right mark `Intl` puts before the minus sign; a sentence usually names the direction in words instead.
 */
export function formatPercent(ratio: number): string {
  return wholePercent.format(ratio);
}
