import { formatCountOf, formatPercent } from '@carshenas/locale/format-number';

// Durations and errors on the data-status page (CS-66), in Persian digits, each number joined to its unit by a
// no-break space (formatCountOf).

/** «۲۲ دقیقه», «۵ ساعت», «۲ روز»: an age or a delay given in minutes, in the largest whole unit that stays readable. */
export function formatMinutes(minutes: number): string {
  if (minutes < 90) return formatCountOf(Math.round(minutes), 'دقیقه');
  if (minutes < 48 * 60) return formatCountOf(Math.round(minutes / 60), 'ساعت');
  return formatCountOf(Math.round(minutes / (24 * 60)), 'روز');
}

/** «۲۴ ساعت»: a window given in hours. */
export function formatHours(hours: number): string {
  return formatCountOf(hours, 'ساعت');
}

/** «۷٪»: a median absolute percentage error stored in percent (6.87), in whole percent. */
export function formatErrorPct(errorPct: number): string {
  return formatPercent(errorPct / 100);
}
