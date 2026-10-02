import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jalaliYearOf } from './run.ts';

// The run's reference year is the Jalali year of its Tehran day, from the locale package's calendar (ADR-0014).

test('a Tehran day belongs to the Jalali year it falls in, and Nowruz starts the next one', () => {
  assert.equal(jalaliYearOf('2026-10-02'), 1405);
  // 1 Farvardin 1405 is 2026-03-21.
  assert.equal(jalaliYearOf('2026-03-20'), 1404);
  assert.equal(jalaliYearOf('2026-03-21'), 1405);
  assert.equal(jalaliYearOf('2027-03-20'), 1405);
  assert.equal(jalaliYearOf('2027-03-21'), 1406);
});

test('text that is not a day has no year', () => {
  assert.throws(() => jalaliYearOf('not a day'), RangeError);
});
