import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jalaliYearOf } from '@carshenas/locale/jalali';
import { solarHijriYear } from './year.ts';

// The year a search counts a car's age from is the locale package's: one reading of a Jalali year (ADR-0014; CS-86).

test('the current Solar Hijri year changes at midnight in Tehran on Nowruz, as the locale package reads it', () => {
  // 1 Farvardin 1405 is 2026-03-21, which Tehran (UTC+03:30) reaches at 20:30 UTC the evening before.
  const lastOf1404 = new Date('2026-03-20T20:29:59.999Z');
  const firstOf1405 = new Date('2026-03-20T20:30:00Z');
  assert.equal(solarHijriYear(lastOf1404), 1404);
  assert.equal(solarHijriYear(firstOf1405), 1405);
  for (const instant of [
    lastOf1404,
    firstOf1405,
    new Date('2026-10-02T15:08:00Z'),
    new Date('2027-03-20T20:30:00Z'),
  ]) {
    assert.equal(solarHijriYear(instant), jalaliYearOf(instant), instant.toISOString());
  }
});

test('an instant that is not one has no year', () => {
  assert.throws(() => solarHijriYear(new Date(Number.NaN)), RangeError);
});
