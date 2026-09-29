// @vitest-environment node
import { expect, test } from 'vitest';
import { formatCount, formatCountOf, formatMileage, formatPercent } from '@/lib/format-number';

const RLM = '\u200F';
const NBSP = '\u00A0';

test('a count prints in Persian digits with the Persian thousands mark', () => {
  expect(formatCount(120_000)).toBe('۱۲۰٬۰۰۰');
  expect(formatCount(128)).toBe('۱۲۸');
  expect(formatCount(0)).toBe('۰');
});

test('mileage keeps its unit on the same line as the number', () => {
  expect(formatMileage(120_000)).toBe(`۱۲۰٬۰۰۰${NBSP}کیلومتر`);
  expect(formatMileage(0)).toBe(`۰${NBSP}کیلومتر`);
});

test('a count stays on the line of its noun', () => {
  expect(formatCountOf(8, 'کاراکتر')).toBe(`۸${NBSP}کاراکتر`);
  expect(formatCountOf(1_250, 'آگهی')).toBe(`۱٬۲۵۰${NBSP}آگهی`);
});

test('a share prints as a whole Persian percentage', () => {
  expect(formatPercent(0.12)).toBe(`۱۲${RLM}٪`);
  expect(formatPercent(0.124)).toBe(`۱۲${RLM}٪`);
});

test('a right-to-left mark before every percent sign keeps it to the left of the number on screen', () => {
  // Without the mark the bidi algorithm pulls the sign into the digits' left-to-right run and shows it on the
  // right; e2e/tests/app/layout-stress.spec.ts measures the rendered order on every page.
  for (let whole = 0; whole <= 100; whole++) {
    expect(formatPercent(whole / 100)).toMatch(/^[۰-۹]+\u200F٪$/);
  }
});

test('a negative share keeps the left-to-right mark Intl puts before the minus sign', () => {
  expect(formatPercent(-0.12)).toBe(`\u200E−۱۲${RLM}٪`);
});
