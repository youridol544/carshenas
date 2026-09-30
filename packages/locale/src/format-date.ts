import { CALENDAR, LOCALE, NUMBERING_SYSTEM, TIME_ZONE } from './locale.ts';

// Instants are stored in UTC and shown as Jalali dates in Tehran (ADR-0014, point 5). The time zone is passed to
// every formatter: the server runs in UTC, and 02:00 in Tehran is still the previous day there.

/** An instant as it arrives: a `Date`, or the ISO-8601 string a DTO carries. */
export type Instant = Date | string;

// Calendar, digits and zone are explicit, so a change in the runtime's defaults for fa-IR cannot move a date.
const JALALI = { calendar: CALENDAR, numberingSystem: NUMBERING_SYSTEM, timeZone: TIME_ZONE } as const;
const longDate = new Intl.DateTimeFormat(LOCALE, { ...JALALI, dateStyle: 'long' });
const longDateTime = new Intl.DateTimeFormat(LOCALE, { ...JALALI, dateStyle: 'long', timeStyle: 'short' });
const numericDate = new Intl.DateTimeFormat(LOCALE, {
  ...JALALI,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const weekday = new Intl.DateTimeFormat(LOCALE, { ...JALALI, weekday: 'long' });
const clockTime = new Intl.DateTimeFormat(LOCALE, {
  ...JALALI,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const monthAndYear = new Intl.DateTimeFormat(LOCALE, { ...JALALI, month: 'long', year: 'numeric' });
// TypeScript's RelativeTimeFormat options omit numberingSystem, so it goes in the locale tag instead.
const relative = new Intl.RelativeTimeFormat(`${LOCALE}-u-nu-${NUMBERING_SYSTEM}`, { numeric: 'auto' });
// «۳ ساعت پیش» keeps the number with its unit on one line (ui-design craft.md, V-30); Intl writes an ordinary space.
const NO_BREAK_SPACE = '\u00A0';
// Only for arithmetic on Tehran days and for ISO dates: Gregorian parts with Latin digits.
const tehranDayParts = new Intl.DateTimeFormat('en-US', {
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: TIME_ZONE,
});

function toDate(instant: Instant): Date {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Not an instant: ${String(instant)}`);
  }
  return date;
}

/** «۵ مهر ۱۴۰۵» */
export function formatDate(instant: Instant): string {
  return longDate.format(toDate(instant));
}

/** «۵ مهر ۱۴۰۵ ساعت ۱۵:۳۰» */
export function formatDateTime(instant: Instant): string {
  return longDateTime.format(toDate(instant));
}

/** «۰۹:۰۵»: the time of day in Tehran, on the 24-hour clock, for a list already grouped by day. */
export function formatTime(instant: Instant): string {
  return clockTime.format(toDate(instant));
}

/** «۵ تا ۱۰ مهر ۱۴۰۵», «۵ مهر تا ۸ آبان ۱۴۰۵»: `Intl` writes Persian ranges with «تا» itself. */
export function formatDateRange(start: Instant, end: Instant): string {
  return longDate.formatRange(toDate(start), toDate(end));
}

/** «۱۴۰۵/۰۷/۰۵»: for dense tables, where every date has the same width. */
export function formatDateNumeric(instant: Instant): string {
  return numericDate.format(toDate(instant));
}

/** «یکشنبه ۵ مهر ۱۴۰۵»: built from parts, because `dateStyle: 'full'` prints «۱۴۰۵ مهر ۵, یکشنبه». */
export function formatWeekdayDate(instant: Instant): string {
  const date = toDate(instant);
  return `${weekday.format(date)} ${longDate.format(date)}`;
}

/** «مهر ۱۴۰۵»: built from parts, because `Intl` puts the year first («۱۴۰۵ مهر»). */
export function formatMonthYear(instant: Instant): string {
  const parts = monthAndYear.formatToParts(toDate(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('month')} ${part('year')}`;
}

/** '2026-09-27': the Tehran day of an instant, in ISO-8601 with Latin digits, for URLs, keys and APIs. */
export function tehranIsoDate(instant: Instant): string {
  const parts = tehranDayParts.formatToParts(toDate(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month').padStart(2, '0')}-${part('day').padStart(2, '0')}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * «۵ دقیقه پیش», «۳ ساعت پیش», «دیروز», «۳ روز پیش», «هفتهٔ گذشته»: how long ago, against a `now` the caller
 * reads (inside `<Suspense>` after `connection()`, so the prerendered shell never reads the clock). Days count
 * Tehran calendar days, so a listing from 23:00 yesterday is «دیروز» at 08:00. A time in the future reads as now.
 */
export function formatTimeAgo(instant: Instant, now: Instant): string {
  const then = toDate(instant);
  const current = toDate(now);
  const elapsed = Math.max(0, current.getTime() - then.getTime());
  if (elapsed < MINUTE) return ago(0, 'second');
  if (elapsed < HOUR) return ago(-Math.floor(elapsed / MINUTE), 'minute');
  const days = (Date.parse(tehranIsoDate(current)) - Date.parse(tehranIsoDate(then))) / DAY;
  if (days < 1) return ago(-Math.floor(elapsed / HOUR), 'hour');
  if (days < 7) return ago(-days, 'day');
  if (days < 30) return ago(-Math.floor(days / 7), 'week');
  if (days < 365) return ago(-Math.floor(days / 30), 'month');
  return ago(-Math.floor(days / 365), 'year');
}

/**
 * «۴۵ ثانیه پیش» under a minute, then as formatTimeAgo: for a clock that matters to the second, such as a heartbeat
 * judged against a 40-second silence, where «اکنون» for a whole minute would contradict it.
 */
export function formatSecondsAgo(instant: Instant, now: Instant): string {
  const elapsed = Math.max(0, toDate(now).getTime() - toDate(instant).getTime());
  if (elapsed < MINUTE) return ago(-Math.floor(elapsed / 1000), 'second');
  return formatTimeAgo(instant, now);
}

function ago(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return relative
    .formatToParts(value, unit)
    .map((part, index, parts) =>
      part.type === 'literal' && parts[index - 1]?.type === 'integer'
        ? part.value.replace(/^ /, NO_BREAK_SPACE)
        : part.value,
    )
    .join('');
}
