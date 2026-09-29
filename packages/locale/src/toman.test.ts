import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_TOMAN, readWrittenToman, toToman } from './toman.ts';

// Amounts as Farsi pages write them (CS-2, finding 3.5). The right-to-left mark Divar puts before a detail price is
// built from its code point.
const RLM = String.fromCodePoint(0x200f);

test('only whole numbers within the bound every amount column states are tomans', () => {
  assert.equal(toToman(MAX_TOMAN), MAX_TOMAN);
  assert.equal(toToman(-MAX_TOMAN), -MAX_TOMAN);
  assert.equal(toToman(0), 0);
  for (const value of [MAX_TOMAN + 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => toToman(value), RangeError);
  }
});

test('a written amount is read in any digit script and grouping, with or without a leading direction mark', () => {
  for (const written of [
    '۱,۳۵۰,۰۰۰,۰۰۰ تومان',
    `${RLM}۱,۳۵۰,۰۰۰,۰۰۰ تومان`,
    '۱،۳۵۰،۰۰۰،۰۰۰ تومان',
    '۱٬۳۵۰٬۰۰۰٬۰۰۰ تومان',
    '١٬٣٥٠٬٠٠٠٬٠٠٠ تومان',
    '1,350,000,000 تومان',
    '1350000000 تومان',
    '۱٬۳۵۰٬۰۰۰٬۰۰۰تومان',
  ]) {
    assert.equal(readWrittenToman(written), 1_350_000_000, written);
  }
  assert.equal(readWrittenToman('۰ تومان'), 0);
  assert.equal(readWrittenToman(`${String(MAX_TOMAN)} تومان`), MAX_TOMAN);
});

test('anything else is not read as an amount: it is kept, never guessed', () => {
  for (const written of [
    '',
    'توافقی',
    '۱٫۵ میلیارد تومان',
    '۱,۳۵,۰۰۰ تومان',
    '1,350,000,000',
    '۱,۳۵۰,۰۰۰,۰۰۰ دلار',
    `${String(MAX_TOMAN + 1)} تومان`,
  ]) {
    assert.equal(readWrittenToman(written), undefined, written);
  }
});
