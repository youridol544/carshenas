import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatToman,
  formatTomanCompact,
  formatTomanCompactRange,
  formatTomanEstimate,
  formatTomanEstimateRange,
  formatTomanInWords,
  MAX_TOMAN,
  readWrittenToman,
  toToman,
} from './toman.ts';

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

// U+00A0: a number never wraps away from its unit or scale word.
const NBSP = '\u00A0';

test('a stated price prints in full Persian digits with the Persian thousands mark and the unit after it', () => {
  assert.equal(formatToman(toToman(1_250_000_000)), `۱٬۲۵۰٬۰۰۰٬۰۰۰${NBSP}تومان`);
});

test('a stated price is never rounded, because the buyer checks it against the source', () => {
  assert.equal(formatToman(toToman(1_263_456_789)), `۱٬۲۶۳٬۴۵۶٬۷۸۹${NBSP}تومان`);
});

test('an estimate and its range are rounded to three significant digits', () => {
  assert.equal(formatTomanEstimate(toToman(1_263_456_789)), `۱٬۲۶۰٬۰۰۰٬۰۰۰${NBSP}تومان`);
  assert.equal(
    formatTomanEstimateRange(toToman(1_196_000_000), toToman(1_352_000_000)),
    `۱٬۲۰۰٬۰۰۰٬۰۰۰ تا ۱٬۳۵۰٬۰۰۰٬۰۰۰${NBSP}تومان`,
  );
});

test('an amount inside a sentence is written with scale words, as Persian news and Divar write it', () => {
  assert.equal(formatTomanInWords(toToman(1_250_000_000)), `۱${NBSP}میلیارد و ۲۵۰${NBSP}میلیون${NBSP}تومان`);
  assert.equal(formatTomanInWords(toToman(7_050_000_000)), `۷${NBSP}میلیارد و ۵۰${NBSP}میلیون${NBSP}تومان`);
  assert.equal(formatTomanInWords(toToman(1_000_500)), `۱${NBSP}میلیون و ۵۰۰${NBSP}تومان`);
  assert.equal(formatTomanInWords(toToman(500)), `۵۰۰${NBSP}تومان`);
});

test('words stop at «میلیارد», which groups its own digits', () => {
  assert.equal(formatTomanInWords(toToman(1_200_000_000_000)), `۱٬۲۰۰${NBSP}میلیارد${NBSP}تومان`);
  assert.equal(
    formatTomanInWords(toToman(MAX_TOMAN)),
    `۹۹۹٬۹۹۹${NBSP}میلیارد و ۹۹۹${NBSP}میلیون و ۹۹۹${NBSP}هزار و ۹۹۹${NBSP}تومان`,
  );
});

test('a sentence names a difference in words, so the words form refuses a negative amount', () => {
  assert.throws(() => formatTomanInWords(toToman(-5_000_000)), RangeError);
});

test('scale labels keep three significant digits, where Intl alone would round to two', () => {
  assert.equal(formatTomanCompact(toToman(1_250_000_000)), `۱٫۲۵${NBSP}میلیارد`);
  assert.equal(formatTomanCompact(toToman(1_049_000_000)), `۱٫۰۵${NBSP}میلیارد`);
  assert.equal(formatTomanCompact(toToman(850_000_000)), `۸۵۰${NBSP}میلیون`);
  assert.equal(formatTomanCompact(toToman(12_500)), `۱۲٫۵${NBSP}هزار`);
});

test('scale labels stop at «میلیارد» instead of «هزارمیلیارد», also where an amount rounds up to it', () => {
  assert.equal(formatTomanCompact(toToman(1_234_000_000_000)), `۱٬۲۳۰${NBSP}میلیارد`);
  assert.equal(formatTomanCompact(toToman(999_500_000_000)), `۱٬۰۰۰${NBSP}میلیارد`);
  assert.equal(formatTomanCompact(toToman(999_400_000_000)), `۹۹۹${NBSP}میلیارد`);
  assert.equal(
    formatTomanCompactRange(toToman(900_000_000_000), toToman(999_600_000_000)),
    `۹۰۰${NBSP}میلیارد تا ۱٬۰۰۰${NBSP}میلیارد${NBSP}تومان`,
  );
});

test('a range on a chip is joined with «تا» and names a shared scale word once', () => {
  assert.equal(
    formatTomanCompactRange(toToman(1_200_000_000), toToman(1_350_000_000)),
    `۱٫۲ تا ۱٫۳۵${NBSP}میلیارد${NBSP}تومان`,
  );
  assert.equal(
    formatTomanCompactRange(toToman(850_000_000), toToman(1_200_000_000)),
    `۸۵۰${NBSP}میلیون تا ۱٫۲${NBSP}میلیارد${NBSP}تومان`,
  );
});

test('a range whose ends round to one value shows that value once, never with «~»', () => {
  assert.equal(
    formatTomanEstimateRange(toToman(1_196_000_000), toToman(1_204_000_000)),
    `۱٬۲۰۰٬۰۰۰٬۰۰۰${NBSP}تومان`,
  );
  assert.equal(
    formatTomanCompactRange(toToman(1_200_000_000), toToman(1_204_000_000)),
    `۱٫۲${NBSP}میلیارد${NBSP}تومان`,
  );
  assert.equal(
    formatTomanCompactRange(toToman(1_200_000_000_000), toToman(1_200_400_000_000)),
    `۱٬۲۰۰${NBSP}میلیارد${NBSP}تومان`,
  );
});

test('a range that runs from high to low is a bug, not a reversed label', () => {
  assert.throws(() => formatTomanEstimateRange(toToman(2_000_000_000), toToman(1_000_000_000)), RangeError);
  assert.throws(() => formatTomanCompactRange(toToman(2_000_000_000), toToman(1_000_000_000)), RangeError);
});
