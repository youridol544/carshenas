import { jalaliYearOf } from '@carshenas/locale/jalali';

// The current Solar Hijri year, which a car's age is counted from (CS-58). Runs in the browser and in Node.

/**
 * The Solar Hijri year of an instant in Tehran: the locale package's `jalaliYearOf` (ADR-0014), the one reading of a
 * Jalali year that the valuation's run (run.ts) and the parsers use too, so a car is the same age in a search, in its
 * rating and in the mileage rule (CS-86).
 */
export function solarHijriYear(instant: Date): number {
  return jalaliYearOf(instant);
}
