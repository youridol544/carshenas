// @vitest-environment node
import { expect, test } from 'vitest';
import {
  formatToman,
  formatTomanCompact,
  formatTomanCompactRange,
  formatTomanEstimate,
  formatTomanEstimateRange,
  formatTomanInWords,
  MAX_TOMAN,
  toToman,
} from '@/lib/toman';

// U+00A0: a number never wraps away from its unit or scale word.
const NBSP = '\u00A0';

test('a stated price prints in full Persian digits with the Persian thousands mark and the unit after it', () => {
  expect(formatToman(toToman(1_250_000_000))).toBe(`۱٬۲۵۰٬۰۰۰٬۰۰۰${NBSP}تومان`);
});

test('a stated price is never rounded, because the buyer checks it against the source', () => {
  expect(formatToman(toToman(1_263_456_789))).toBe(`۱٬۲۶۳٬۴۵۶٬۷۸۹${NBSP}تومان`);
});

test('an estimate and its range are rounded to three significant digits', () => {
  expect(formatTomanEstimate(toToman(1_263_456_789))).toBe(`۱٬۲۶۰٬۰۰۰٬۰۰۰${NBSP}تومان`);
  expect(formatTomanEstimateRange(toToman(1_196_000_000), toToman(1_352_000_000))).toBe(
    `۱٬۲۰۰٬۰۰۰٬۰۰۰ تا ۱٬۳۵۰٬۰۰۰٬۰۰۰${NBSP}تومان`,
  );
});

test('an amount inside a sentence is written with scale words, as Persian news and Divar write it', () => {
  expect(formatTomanInWords(toToman(1_250_000_000))).toBe(`۱${NBSP}میلیارد و ۲۵۰${NBSP}میلیون${NBSP}تومان`);
  expect(formatTomanInWords(toToman(7_050_000_000))).toBe(`۷${NBSP}میلیارد و ۵۰${NBSP}میلیون${NBSP}تومان`);
  expect(formatTomanInWords(toToman(1_000_500))).toBe(`۱${NBSP}میلیون و ۵۰۰${NBSP}تومان`);
  expect(formatTomanInWords(toToman(500))).toBe(`۵۰۰${NBSP}تومان`);
});

test('words stop at «میلیارد», which groups its own digits', () => {
  expect(formatTomanInWords(toToman(1_200_000_000_000))).toBe(`۱٬۲۰۰${NBSP}میلیارد${NBSP}تومان`);
  expect(formatTomanInWords(toToman(MAX_TOMAN))).toBe(
    `۹۹۹٬۹۹۹${NBSP}میلیارد و ۹۹۹${NBSP}میلیون و ۹۹۹${NBSP}هزار و ۹۹۹${NBSP}تومان`,
  );
});

test('a sentence names a difference in words, so the words form refuses a negative amount', () => {
  expect(() => formatTomanInWords(toToman(-5_000_000))).toThrow(RangeError);
});

test('scale labels keep three significant digits, where Intl alone would round to two', () => {
  expect(formatTomanCompact(toToman(1_250_000_000))).toBe(`۱٫۲۵${NBSP}میلیارد`);
  expect(formatTomanCompact(toToman(1_049_000_000))).toBe(`۱٫۰۵${NBSP}میلیارد`);
  expect(formatTomanCompact(toToman(850_000_000))).toBe(`۸۵۰${NBSP}میلیون`);
  expect(formatTomanCompact(toToman(12_500))).toBe(`۱۲٫۵${NBSP}هزار`);
});

test('scale labels stop at «میلیارد» instead of «هزارمیلیارد», also where an amount rounds up to it', () => {
  expect(formatTomanCompact(toToman(1_234_000_000_000))).toBe(`۱٬۲۳۰${NBSP}میلیارد`);
  expect(formatTomanCompact(toToman(999_500_000_000))).toBe(`۱٬۰۰۰${NBSP}میلیارد`);
  expect(formatTomanCompact(toToman(999_400_000_000))).toBe(`۹۹۹${NBSP}میلیارد`);
  expect(formatTomanCompactRange(toToman(900_000_000_000), toToman(999_600_000_000))).toBe(
    `۹۰۰${NBSP}میلیارد تا ۱٬۰۰۰${NBSP}میلیارد${NBSP}تومان`,
  );
});

test('a range on a chip is joined with «تا» and names a shared scale word once', () => {
  expect(formatTomanCompactRange(toToman(1_200_000_000), toToman(1_350_000_000))).toBe(
    `۱٫۲ تا ۱٫۳۵${NBSP}میلیارد${NBSP}تومان`,
  );
  expect(formatTomanCompactRange(toToman(850_000_000), toToman(1_200_000_000))).toBe(
    `۸۵۰${NBSP}میلیون تا ۱٫۲${NBSP}میلیارد${NBSP}تومان`,
  );
});

test('a range whose ends round to one value shows that value once, never with «~»', () => {
  expect(formatTomanEstimateRange(toToman(1_196_000_000), toToman(1_204_000_000))).toBe(
    `۱٬۲۰۰٬۰۰۰٬۰۰۰${NBSP}تومان`,
  );
  expect(formatTomanCompactRange(toToman(1_200_000_000), toToman(1_204_000_000))).toBe(
    `۱٫۲${NBSP}میلیارد${NBSP}تومان`,
  );
  expect(formatTomanCompactRange(toToman(1_200_000_000_000), toToman(1_200_400_000_000))).toBe(
    `۱٬۲۰۰${NBSP}میلیارد${NBSP}تومان`,
  );
});

test('a range that runs from high to low is a bug, not a reversed label', () => {
  expect(() => formatTomanEstimateRange(toToman(2_000_000_000), toToman(1_000_000_000))).toThrow(RangeError);
  expect(() => formatTomanCompactRange(toToman(2_000_000_000), toToman(1_000_000_000))).toThrow(RangeError);
});

test('only whole numbers within the bound every amount column states are tomans', () => {
  expect(toToman(MAX_TOMAN)).toBe(MAX_TOMAN);
  expect(toToman(-MAX_TOMAN)).toBe(-MAX_TOMAN);
  expect(toToman(0)).toBe(0);
  for (const value of [MAX_TOMAN + 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => toToman(value)).toThrow(RangeError);
  }
});
