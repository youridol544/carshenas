import { formatWeekdayDate, tehranIsoDate } from '@carshenas/locale/format-date';
import { NOTIFICATIONS_COPY } from '@/features/notifications/notifications-copy';

// The inbox's day headings (CS-68): notifications are grouped by the Tehran day they arrived on, named as a person
// would say it at `now`.

/** «امروز», «دیروز», or the weekday and date («سه‌شنبه ۷ مهر ۱۴۰۵»), for the Tehran day `isoDay` seen at `now`. */
export function dayLabel(isoDay: string, now: Date): string {
  if (isoDay === tehranIsoDate(now)) return NOTIFICATIONS_COPY.today;
  // Noon the day before, in UTC, is on the previous Tehran day whatever the time of day in Tehran.
  const yesterday = new Date(`${tehranIsoDate(now)}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (isoDay === tehranIsoDate(yesterday)) return NOTIFICATIONS_COPY.yesterday;
  return formatWeekdayDate(new Date(`${isoDay}T12:00:00Z`));
}
