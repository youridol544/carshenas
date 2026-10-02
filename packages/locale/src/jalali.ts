import { CalendarDateTime, PersianCalendar, fromDate, toCalendar } from '@internationalized/date';
import { toLatinDigits } from './digits.ts';
import { TIME_ZONE } from './locale.ts';
import { withPersianLetters, withoutBidiControls } from './text.ts';

// A date and time a Farsi page writes on Tehran's wall clock in the Solar Hijri calendar («۲ مهر ۱۴۰۵، ۰۹:۴۷»), read as
// the instant it names, and the Solar Hijri year an instant falls in. Calendar arithmetic is @internationalized/date's,
// never ours (ADR-0014): it converts the calendar and applies Tehran's offset for that day, which daylight saving
// changed until Iran stopped it in 2022. Showing a date is format-date.ts's, through Intl.

const MONTHS: Readonly<Record<string, number>> = {
  فروردین: 1,
  اردیبهشت: 2,
  خرداد: 3,
  تیر: 4,
  مرداد: 5,
  امرداد: 5,
  شهریور: 6,
  مهر: 7,
  آبان: 8,
  آذر: 9,
  دی: 10,
  بهمن: 11,
  اسفند: 12,
};

const WRITTEN = /^(\d{1,2}) (\S+) (\d{4}) ?[،,] ?(\d{1,2}):(\d{2})$/;

/**
 * The instant «day month year، hh:mm» names on Tehran's clock, or undefined when the text is not one or no such day
 * exists.
 */
export function readTehranDateTime(text: string): Date | undefined {
  const plain = withPersianLetters(toLatinDigits(withoutBidiControls(text)))
    .replace(/\s+/g, ' ')
    .trim();
  const match = WRITTEN.exec(plain);
  if (!match) return undefined;
  const [, day, monthName, year, hour, minute] = match;
  const month = monthName === undefined ? undefined : MONTHS[monthName];
  if (month === undefined) return undefined;
  const fields = [Number(year), month, Number(day), Number(hour), Number(minute)] as const;
  // The library would carry an hour of 25 into the next day, so the clock is checked here.
  if (fields[3] > 23 || fields[4] > 59) return undefined;
  const written = new CalendarDateTime(new PersianCalendar(), ...fields);
  // It moves an impossible day to the nearest possible one (a 31st of Mehr becomes the 30th); a day that does not
  // exist must not become another day.
  const read = [written.year, written.month, written.day, written.hour, written.minute];
  if (read.some((value, index) => value !== fields[index])) return undefined;
  return written.toDate(TIME_ZONE);
}

/**
 * The Solar Hijri year of the Tehran day an instant falls on: a year opens at midnight in Tehran on 1 Farvardin, which
 * is 20:30 UTC the evening before (2026-03-20T20:30:00Z opens 1405). Model years are stated in this calendar, so a
 * car's age at a moment is this year minus its model year.
 */
export function jalaliYearOf(instant: Date): number {
  if (Number.isNaN(instant.getTime())) throw new RangeError('Not an instant');
  return toCalendar(fromDate(instant, TIME_ZONE), new PersianCalendar()).year;
}
