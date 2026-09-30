// The current Solar Hijri year, which a car's age is counted from (CS-58). Runs in the browser and in Node.

/** The Solar Hijri year of an instant in Tehran, from the ICU Persian calendar (as the valuation's run.ts reads it). */
export function solarHijriYear(instant: Date): number {
  const text = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    year: 'numeric',
    timeZone: 'Asia/Tehran',
  }).format(instant);
  const year = Number.parseInt(text, 10);
  if (!Number.isInteger(year)) throw new RangeError(`no Solar Hijri year for ${instant.toISOString()}`);
  return year;
}
