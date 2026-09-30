import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeCursor, encodeCursor } from './cursor.ts';

// A results page's cursor (CS-59): it round-trips the last row's key for its own order only, and anything else is
// refused rather than guessed.

test('a cursor carries the last row’s key back, for the order it was made for', () => {
  const key = { values: ['-12.50', '2026-09-30 12:46:00+00'], listingId: 4958 };
  const word = encodeCursor('best_deal', key);
  assert.match(word, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeCursor(word, 'best_deal'), key);
  assert.deepEqual(decodeCursor(word, undefined), key, 'no order is best deal first');
  assert.deepEqual(decodeCursor(encodeCursor('price_asc', { values: [null], listingId: 7 }), 'price_asc'), {
    values: [null],
    listingId: 7,
  });
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
