import { formatCountOf } from '@carshenas/locale/format-number';
import { WORKER_COPY } from '@/features/admin/admin-copy';

// Durations on the worker screen (CS-41), in the largest whole unit that keeps them readable: a run's seconds, how
// long ago a listing was last checked. Persian digits, each number joined to its unit by a no-break space.

/** «کمتر از یک ثانیه», «۴ ثانیه», «۲ دقیقه»: a run's duration, rounded to whole seconds, then minutes. */
export function formatRunSeconds(seconds: number): string {
  if (seconds < 1) return WORKER_COPY.underASecond;
  if (seconds < 120) return formatCountOf(Math.round(seconds), WORKER_COPY.seconds);
  return formatCountOf(Math.round(seconds / 60), WORKER_COPY.minutes);
}

/** «۲۲ دقیقه», «۳ ساعت», «۲ روز»: an age given in minutes. */
export function formatAgeMinutes(minutes: number): string {
  if (minutes < 90) return formatCountOf(Math.round(minutes), WORKER_COPY.minutes);
  if (minutes < 48 * 60) return formatCountOf(Math.round(minutes / 60), WORKER_COPY.hours);
  return formatCountOf(Math.round(minutes / (24 * 60)), WORKER_COPY.days);
}
