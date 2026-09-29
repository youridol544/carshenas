// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
  formatDate,
  formatDateNumeric,
  formatDateRange,
  formatDateTime,
  formatMonthYear,
  formatTimeAgo,
  formatWeekdayDate,
  tehranIsoDate,
} from '@/lib/format-date';
import { CALENDAR, LOCALE, TIME_ZONE } from '@/lib/locale';

// vitest.config.mts runs these tests in UTC, as the production server runs, so a formatter that forgot the Tehran
// time zone fails here instead of passing on a machine set to Tehran.

test('a date prints as a Jalali date in Persian digits', () => {
  expect(formatDate('2026-09-27T12:00:00Z')).toBe('۵ مهر ۱۴۰۵');
  expect(formatDate(new Date('2026-09-27T12:00:00Z'))).toBe('۵ مهر ۱۴۰۵');
});

test('the day is the Tehran day, not the server day', () => {
  // 00:30 on 5 Mehr in Tehran is still 26 September in UTC.
  expect(formatDate('2026-09-26T21:00:00Z')).toBe('۵ مهر ۱۴۰۵');
  expect(formatDate('2026-09-26T20:00:00Z')).toBe('۴ مهر ۱۴۰۵');
});

test('the other forms read as Persian writes them', () => {
  expect(formatDateTime('2026-09-27T12:00:00Z')).toBe('۵ مهر ۱۴۰۵ ساعت ۱۵:۳۰');
  expect(formatDateRange('2026-09-27T08:00:00Z', '2026-10-02T08:00:00Z')).toBe('۵ تا ۱۰ مهر ۱۴۰۵');
  expect(formatDateRange('2026-09-27T08:00:00Z', '2026-10-30T08:00:00Z')).toBe('۵ مهر تا ۸ آبان ۱۴۰۵');
  expect(formatDateNumeric('2026-09-27T12:00:00Z')).toBe('۱۴۰۵/۰۷/۰۵');
  expect(formatWeekdayDate('2026-09-27T12:00:00Z')).toBe('یکشنبه ۵ مهر ۱۴۰۵');
  expect(formatMonthYear('2026-09-27T12:00:00Z')).toBe('مهر ۱۴۰۵');
});

test('data gets the Tehran day in ISO-8601 with Latin digits', () => {
  expect(tehranIsoDate('2026-09-26T21:00:00Z')).toBe('2026-09-27');
  expect(tehranIsoDate('2026-09-26T20:00:00Z')).toBe('2026-09-26');
});

test('an instant that is not a date is a bug, not «ناعدد» on screen', () => {
  expect(() => formatDate('not a date')).toThrow(RangeError);
});

test('time ago counts minutes and hours, then Tehran calendar days, against the now it is given', () => {
  // A no-break space holds the number to its unit, so «۳» never ends a line on its own.
  const NBSP = '\u00A0';
  const now = '2026-09-27T12:00:00Z'; // 15:30 in Tehran
  expect(formatTimeAgo('2026-09-27T11:59:30Z', now)).toBe('اکنون');
  expect(formatTimeAgo('2026-09-27T11:55:00Z', now)).toBe(`۵${NBSP}دقیقه پیش`);
  expect(formatTimeAgo('2026-09-27T09:00:00Z', now)).toBe(`۳${NBSP}ساعت پیش`);
  expect(formatTimeAgo('2026-09-24T12:00:00Z', now)).toBe(`۳${NBSP}روز پیش`);
  expect(formatTimeAgo('2026-09-19T12:00:00Z', now)).toBe('هفتهٔ گذشته');
  expect(formatTimeAgo('2026-08-13T12:00:00Z', now)).toBe('ماه گذشته');
  expect(formatTimeAgo('2025-08-23T12:00:00Z', now)).toBe('سال گذشته');
});

test('a listing from late yesterday evening in Tehran reads «دیروز» the next morning', () => {
  // 23:00 on 4 Mehr and 08:00 on 5 Mehr, Tehran time.
  expect(formatTimeAgo('2026-09-26T19:30:00Z', '2026-09-27T04:30:00Z')).toBe('دیروز');
});

test('a time slightly in the future, from clock skew, reads as now', () => {
  expect(formatTimeAgo('2026-09-27T12:00:05Z', '2026-09-27T12:00:00Z')).toBe('اکنون');
});

// ADR-0014, point 6: the Calendar Center's leap list for 1206 to 1498 (CC0 copy in the CS-2 lab) pins the
// runtime's Persian calendar, so an ICU upgrade that moves a date fails here.
const LEAP_LIST = new URL(
  '../../../../docs/research/2026-09-27-money-and-jalali-calendar/lab/kabise-1206-1498.txt',
  import.meta.url,
);

test("the runtime's Persian calendar matches the official leap list from 1206 to 1498", () => {
  const years = readFileSync(LEAP_LIST, 'utf8')
    .split('\n')
    .map((line) => /^(\d{4})(\*{0,2}) (\d{4}-\d{2}-\d{2})$/.exec(line.trim()))
    .filter((match) => match !== null)
    .map(([, year, stars, nowruz]) => ({ year: Number(year), leap: stars !== '', nowruz: String(nowruz) }));
  expect(years).toHaveLength(293);

  const jalali = new Intl.DateTimeFormat(LOCALE, {
    calendar: CALENDAR,
    numberingSystem: 'latn',
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const partsOf = (date: Date) => {
    const parts = jalali.formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
    return [part('year'), part('month'), part('day')];
  };
  const DAY = 86_400_000;
  const mismatches: string[] = [];
  let previous: (typeof years)[number] | undefined;
  for (const entry of years) {
    // Noon in UTC is mid-afternoon in Tehran, well inside the day.
    const nowruz = new Date(`${entry.nowruz}T12:00:00Z`);
    const firstDay = partsOf(nowruz).join('/');
    if (firstDay !== `${String(entry.year)}/1/1`) mismatches.push(`${entry.nowruz} is ${firstDay}`);
    if (previous) {
      const lastDay = partsOf(new Date(nowruz.getTime() - DAY)).join('/');
      const expected = `${String(previous.year)}/12/${previous.leap ? '30' : '29'}`;
      if (lastDay !== expected)
        mismatches.push(`the day before ${entry.nowruz} is ${lastDay}, not ${expected}`);
    }
    previous = entry;
  }
  expect(mismatches).toEqual([]);
});
