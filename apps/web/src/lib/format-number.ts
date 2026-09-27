import { LOCALE, NUMBERING_SYSTEM } from '@/lib/locale';

// Counts and shares on screen: Persian digits, «٬» between thousands and «٫» for decimals, as `Intl` prints them
// for fa-IR. Amounts of money go through toman.ts instead. Every percentage on screen comes from formatPercent:
// the lint rejects a percent sign written by hand.

const count = new Intl.NumberFormat(LOCALE, { numberingSystem: NUMBERING_SYSTEM, maximumFractionDigits: 0 });
const wholePercent = new Intl.NumberFormat(LOCALE, {
  numberingSystem: NUMBERING_SYSTEM,
  style: 'percent',
  maximumFractionDigits: 0,
});

// Persian digits are European numbers to the Unicode bidi algorithm, and a percent sign right after one joins the
// number's left-to-right run (UAX #9, rule W5), so «۱۲٪» as Intl writes it shows the sign on the right. Persian
// reads «درصد» after the number, which in a right-to-left line is its left. A right-to-left mark before the sign
// keeps it out of the number's run; it is invisible, and it works where markup cannot (titles, attributes, bot
// messages).
const RIGHT_TO_LEFT_MARK = '\u200F';

/** «۱۲۰٬۰۰۰»: a count such as mileage or a number of listings, rounded to a whole number. */
export function formatCount(value: number): string {
  return count.format(value);
}

/**
 * «۱۲٪» with the sign to the left of the number: a share given as a ratio (0.12), in whole percent, as a price gap
 * is shown. A negative ratio keeps the left-to-right mark `Intl` puts before the minus sign; a sentence usually
 * names the direction in words instead («۸٪ زیر ارزش بازار»).
 */
export function formatPercent(ratio: number): string {
  return wholePercent
    .formatToParts(ratio)
    .map((part) => (part.type === 'percentSign' ? RIGHT_TO_LEFT_MARK + part.value : part.value))
    .join('');
}
