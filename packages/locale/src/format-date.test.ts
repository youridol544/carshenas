import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatDate,
  formatDateNumeric,
  formatDateRange,
  formatDateTime,
  formatDayMonth,
  formatMonthYear,
  formatSecondsAgo,
  formatTime,
  formatTimeAgo,
  formatWeekdayDate,
  tehranIsoDate,
} from './format-date.ts';
import { CALENDAR, LOCALE, TIME_ZONE } from './locale.ts';

// The package's test script runs these tests in UTC (TZ=UTC), as the production server runs, so a formatter that forgot the Tehran
// time zone fails here instead of passing on a machine set to Tehran.

test('a day and month print without the year, in Persian digits', () => {
  assert.equal(formatDayMonth('2026-09-27T12:00:00Z'), '۵ مهر');
  assert.equal(formatDayMonth('2026-10-03'), '۱۱ مهر');
});

test('a date prints as a Jalali date in Persian digits', () => {
  assert.equal(formatDate('2026-09-27T12:00:00Z'), '۵ مهر ۱۴۰۵');
  assert.equal(formatDate(new Date('2026-09-27T12:00:00Z')), '۵ مهر ۱۴۰۵');
});

test('the day is the Tehran day, not the server day', () => {
  // 00:30 on 5 Mehr in Tehran is still 26 September in UTC.
  assert.equal(formatDate('2026-09-26T21:00:00Z'), '۵ مهر ۱۴۰۵');
  assert.equal(formatDate('2026-09-26T20:00:00Z'), '۴ مهر ۱۴۰۵');
});

test('the other forms read as Persian writes them', () => {
  assert.equal(formatDateTime('2026-09-27T12:00:00Z'), '۵ مهر ۱۴۰۵ ساعت ۱۵:۳۰');
  assert.equal(formatDateRange('2026-09-27T08:00:00Z', '2026-10-02T08:00:00Z'), '۵ تا ۱۰ مهر ۱۴۰۵');
  assert.equal(formatDateRange('2026-09-27T08:00:00Z', '2026-10-30T08:00:00Z'), '۵ مهر تا ۸ آبان ۱۴۰۵');
  assert.equal(formatDateNumeric('2026-09-27T12:00:00Z'), '۱۴۰۵/۰۷/۰۵');
  assert.equal(formatWeekdayDate('2026-09-27T12:00:00Z'), 'یکشنبه ۵ مهر ۱۴۰۵');
  assert.equal(formatMonthYear('2026-09-27T12:00:00Z'), 'مهر ۱۴۰۵');
  assert.equal(formatTime('2026-09-27T12:00:00Z'), '۱۵:۳۰');
  // Just after midnight in Tehran, on the 24-hour clock.
  assert.equal(formatTime('2026-09-26T20:35:00Z'), '۰۰:۰۵');
});

test('data gets the Tehran day in ISO-8601 with Latin digits', () => {
  assert.equal(tehranIsoDate('2026-09-26T21:00:00Z'), '2026-09-27');
  assert.equal(tehranIsoDate('2026-09-26T20:00:00Z'), '2026-09-26');
});

test('an instant that is not a date is a bug, not «ناعدد» on screen', () => {
  assert.throws(() => formatDate('not a date'), RangeError);
});

test('time ago counts minutes and hours, then Tehran calendar days, against the now it is given', () => {
  // A no-break space holds the number to its unit, so «۳» never ends a line on its own.
  const NBSP = '\u00A0';
  const now = '2026-09-27T12:00:00Z'; // 15:30 in Tehran
  assert.equal(formatTimeAgo('2026-09-27T11:59:30Z', now), 'اکنون');
  assert.equal(formatTimeAgo('2026-09-27T11:55:00Z', now), `۵${NBSP}دقیقه پیش`);
  assert.equal(formatTimeAgo('2026-09-27T09:00:00Z', now), `۳${NBSP}ساعت پیش`);
  assert.equal(formatTimeAgo('2026-09-24T12:00:00Z', now), `۳${NBSP}روز پیش`);
  assert.equal(formatTimeAgo('2026-09-19T12:00:00Z', now), 'هفتهٔ گذشته');
  assert.equal(formatTimeAgo('2026-08-13T12:00:00Z', now), 'ماه گذشته');
  assert.equal(formatTimeAgo('2025-08-23T12:00:00Z', now), 'سال گذشته');
});

test('a listing from late yesterday evening in Tehran reads «دیروز» the next morning', () => {
  // 23:00 on 4 Mehr and 08:00 on 5 Mehr, Tehran time.
  assert.equal(formatTimeAgo('2026-09-26T19:30:00Z', '2026-09-27T04:30:00Z'), 'دیروز');
});

test('a time slightly in the future, from clock skew, reads as now', () => {
  assert.equal(formatTimeAgo('2026-09-27T12:00:05Z', '2026-09-27T12:00:00Z'), 'اکنون');
});

// ADR-0014, point 6: the Calendar Center's leap list for 1206 to 1498 (CC0 copy in the CS-2 lab) pins the
// runtime's Persian calendar, so an ICU upgrade that moves a date fails here.
const LEAP_LIST = new URL(
  '../../../docs/research/2026-09-27-money-and-jalali-calendar/lab/kabise-1206-1498.txt',
  import.meta.url,
);

test("the runtime's Persian calendar matches the official leap list from 1206 to 1498", () => {
  const years = readFileSync(LEAP_LIST, 'utf8')
    .split('\n')
    .map((line) => /^(\d{4})(\*{0,2}) (\d{4}-\d{2}-\d{2})$/.exec(line.trim()))
    .filter((match) => match !== null)
    .map(([, year, stars, nowruz]) => ({ year: Number(year), leap: stars !== '', nowruz: String(nowruz) }));
  assert.equal(years.length, 293);

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
  assert.deepEqual(mismatches, []);
});

test('seconds ago counts seconds under a minute, then reads as time ago', () => {
  const NBSP = String.fromCodePoint(0xa0);
  const now = '2026-09-27T12:00:00Z';
  assert.equal(formatSecondsAgo('2026-09-27T12:00:00Z', now), 'اکنون');
  assert.equal(formatSecondsAgo('2026-09-27T11:59:15Z', now), `۴۵${NBSP}ثانیه پیش`);
  assert.equal(formatSecondsAgo('2026-09-27T11:59:00.500Z', now), `۵۹${NBSP}ثانیه پیش`);
  assert.equal(formatSecondsAgo('2026-09-27T11:59:00Z', now), `۱${NBSP}دقیقه پیش`);
  assert.equal(formatSecondsAgo('2026-09-27T09:00:00Z', now), `۳${NBSP}ساعت پیش`);
});
