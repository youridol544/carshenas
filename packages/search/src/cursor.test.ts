import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeCursor, decodeCursorPage, encodeCursor, isSortValue } from './cursor.ts';

// A results page's cursor (CS-59): it round-trips the last row's key for its own order only, carries the first page's
// total, and refuses anything else rather than guessing. Its key's texts are checked against their column's type
// before they reach SQL: text that is no number would be 22P02, a date that is none 22007 or 22008, a number out of
// range 22003, and each would be a server error for a URL someone edited.

const KEY = { values: ['-12.50', '2026-09-30 12:46:00+00'], listingId: 4958 };

/** A cursor the way a client could write it by hand: base64url of any JSON. */
function handmade(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

test('a cursor carries the last row’s key back, for the order it was made for', () => {
  const word = encodeCursor('best_deal', KEY);
  assert.match(word, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeCursor(word, 'best_deal'), KEY);
  assert.deepEqual(decodeCursor(word, undefined), KEY, 'no order is best deal first');
  assert.deepEqual(decodeCursor(encodeCursor('price_asc', { values: [null], listingId: 7 }), 'price_asc'), {
    values: [null],
    listingId: 7,
  });
});

test('a cursor carries the first page’s total, so a later page counts nothing', () => {
  const word = encodeCursor('best_deal', KEY, { count: 1000, exact: false });
  assert.deepEqual(decodeCursorPage(word, 'best_deal'), { key: KEY, total: { count: 1000, exact: false } });
  assert.deepEqual(decodeCursorPage(encodeCursor('best_deal', KEY), 'best_deal'), { key: KEY });
  assert.equal(
    decodeCursorPage(handmade({ v: 1, s: 'best_deal', k: KEY.values, i: 1, n: -1 }), 'best_deal'),
    undefined,
  );
  assert.equal(
    decodeCursorPage(handmade({ v: 1, s: 'best_deal', k: KEY.values, i: 1, n: 1_000_000_001 }), 'best_deal'),
    undefined,
  );
});

test('a cursor from another order, of the wrong length or altered is refused', () => {
  const word = encodeCursor('newest', { values: ['2026-09-30 12:46:00+00'], listingId: 1 });
  assert.equal(decodeCursor(word, 'best_deal'), undefined);
  assert.equal(
    decodeCursor(encodeCursor('best_deal', { values: ['1'], listingId: 1 }), 'best_deal'),
    undefined,
  );
  assert.equal(decodeCursor(`${word}x`, 'newest'), undefined);
  assert.equal(decodeCursor('abc', 'newest'), undefined);
  assert.equal(decodeCursor('', 'newest'), undefined);
  assert.equal(decodeCursor('not a cursor!', 'newest'), undefined);
});

test('a key that is no value of its column is refused: text for a number, an impossible date, a number out of range', () => {
  const best = (values: (string | null)[]) =>
    decodeCursor(handmade({ v: 1, s: 'best_deal', k: values, i: 5 }), 'best_deal');
  assert.deepEqual(best(['-3.50', '2026-09-30 12:46:00+00']), {
    values: ['-3.50', '2026-09-30 12:46:00+00'],
    listingId: 5,
  });
  // 22P02: «abc» is no numeric.
  assert.equal(best(['abc', null]), undefined);
  assert.equal(best(['abc', '2026-09-30 12:46:00+00']), undefined);
  assert.equal(best(['1e5', '2026-09-30 12:46:00+00']), undefined);
  assert.equal(best(['', '2026-09-30 12:46:00+00']), undefined);
  // 22007 and 22008: dates that are none.
  assert.equal(best(['1', '2026-13-45 99:99:99+00']), undefined);
  assert.equal(best(['1', '2026-02-30 10:00:00+00']), undefined);
  assert.equal(best(['1', '2026-02-29 10:00:00+00']), undefined, '2026 is no leap year');
  assert.equal(best(['1', '2028-02-29 10:00:00+00']) === undefined, false, '2028 is');
  assert.equal(best(['1', '0000-01-01 00:00:00+00']), undefined, 'there is no year 0');
  assert.equal(best(['1', 'yesterday']), undefined);
  assert.equal(best(['1', '2026-09-30']), undefined);
  // 22003: more than numeric(7, 2) holds, and more than the integer types hold.
  assert.equal(best(['123456.78', '2026-09-30 12:46:00+00']), undefined);
  const mileage = (value: string | null) =>
    decodeCursor(handmade({ v: 1, s: 'mileage_asc', k: [value], i: 5 }), 'mileage_asc');
  assert.deepEqual(mileage('2147483647'), { values: ['2147483647'], listingId: 5 });
  assert.equal(mileage('2147483648'), undefined);
  assert.equal(mileage('99999999999'), undefined);
  assert.deepEqual(mileage(null), { values: [null], listingId: 5 }, 'a row without mileage is last');
  const year = (value: string | null) =>
    decodeCursor(handmade({ v: 1, s: 'year_desc', k: [value], i: 5 }), 'year_desc');
  assert.deepEqual(year('1403'), { values: ['1403'], listingId: 5 });
  assert.equal(year('32768'), undefined);
  const price = (value: string | null) =>
    decodeCursor(handmade({ v: 1, s: 'price_asc', k: [value], i: 5 }), 'price_asc');
  assert.deepEqual(price('999999999999999'), { values: ['999999999999999'], listingId: 5 });
  assert.equal(price('9999999999999999'), undefined);
  // A column that is never null has no null tail: a key cannot be without it.
  assert.equal(best(['1', null]), undefined);
  assert.equal(decodeCursor(handmade({ v: 1, s: 'newest', k: [null], i: 5 }), 'newest'), undefined);
  // The listing id is a positive whole number.
  assert.equal(
    decodeCursor(handmade({ v: 1, s: 'newest', k: ['2026-09-30 12:46:00+00'], i: 0 }), 'newest'),
    undefined,
  );
  assert.equal(
    decodeCursor(handmade({ v: 1, s: 'newest', k: ['2026-09-30 12:46:00+00'], i: 1.5 }), 'newest'),
    undefined,
  );
  assert.equal(
    decodeCursor(handmade({ v: 1, s: 'newest', k: ['2026-09-30 12:46:00+00'], i: '5' }), 'newest'),
    undefined,
  );
});

test('the texts PostgreSQL prints for each type are values of it', () => {
  for (const text of ['0', '-0.5', '12.5', '99999.99', '-99999.99', '3', '-3.0'])
    assert.ok(isSortValue('numeric', text), text);
  for (const text of [
    '2026-09-30 12:46:00+00',
    '2026-09-30 12:46:00.5+00',
    '2026-09-30 12:46:00.123456+03:30',
    '2026-12-31 23:59:59-05',
    '2028-02-29 00:00:00+00',
  ])
    assert.ok(isSortValue('timestamptz', text), text);
  for (const text of [
    '2026-09-30T12:46:00Z',
    '2026-09-30 12:46:00',
    '2026-09-30 24:00:00+00',
    '2026-09-31 12:00:00+00',
  ])
    assert.ok(!isSortValue('timestamptz', text), text);
});
