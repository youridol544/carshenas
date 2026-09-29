import { CalendarDateTime, PersianCalendar } from '@internationalized/date';
import { latinDigits, persianLetters, withoutBidiControls } from './text.ts';

// A date and time a Farsi page writes on Tehran's wall clock in the Solar Hijri calendar («۲ مهر ۱۴۰۵، ۰۹:۴۷»), as the
// instant it names. Calendar arithmetic is @internationalized/date's, never ours (ADR-0014): it converts the calendar
// and applies Asia/Tehran's offset for that day, which has not been fixed since Iran stopped daylight saving in 2022.

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

/** The instant «day month year، hh:mm» names in Tehran, or undefined when it is not such a text or no such day exists. */
export function parseTehranDateTime(text: string): Date | undefined {
  const plain = persianLetters(latinDigits(withoutBidiControls(text)))
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
  return written.toDate('Asia/Tehran');
}
