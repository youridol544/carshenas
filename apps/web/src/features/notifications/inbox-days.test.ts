// @vitest-environment node
import { formatWeekdayDate } from '@carshenas/locale/format-date';
import { expect, test } from 'vitest';
import { dayLabel } from '@/features/notifications/inbox-days';
import { NOTIFICATIONS_COPY } from '@/features/notifications/notifications-copy';

// Tehran days, not the server's: 00:30 on 9 Mehr in Tehran (Thursday 1 October 2026) is still 30 September in UTC.
const justAfterMidnightInTehran = new Date('2026-09-30T21:00:00Z');

test('today and yesterday are named, and an older day by its weekday and Jalali date', () => {
  expect(dayLabel('2026-10-01', justAfterMidnightInTehran)).toBe(NOTIFICATIONS_COPY.today);
  expect(dayLabel('2026-09-30', justAfterMidnightInTehran)).toBe(NOTIFICATIONS_COPY.yesterday);
  expect(dayLabel('2026-09-29', justAfterMidnightInTehran)).toBe(formatWeekdayDate('2026-09-29T12:00:00Z'));
  expect(dayLabel('2026-09-29', justAfterMidnightInTehran)).toBe('سه‌شنبه ۷ مهر ۱۴۰۵');
});
