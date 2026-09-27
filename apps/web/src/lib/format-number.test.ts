// @vitest-environment node
import { expect, test } from 'vitest';
import { formatCount, formatPercent } from '@/lib/format-number';

const RLM = '‏';

test('a count prints in Persian digits with the Persian thousands mark', () => {
  expect(formatCount(120_000)).toBe('۱۲۰٬۰۰۰');
  expect(formatCount(128)).toBe('۱۲۸');
  expect(formatCount(0)).toBe('۰');
});

test('a share prints as a whole Persian percentage', () => {
  expect(formatPercent(0.12)).toBe(`۱۲${RLM}٪`);
  expect(formatPercent(0.124)).toBe(`۱۲${RLM}٪`);
});

test('a right-to-left mark before every percent sign keeps it to the left of the number on screen', () => {
  // Without the mark the bidi algorithm pulls the sign into the digits' left-to-right run and shows it on the
  // right; e2e/tests/app/layout-stress.spec.ts measures the rendered order on every page.
  for (let whole = 0; whole <= 100; whole++) {
    expect(formatPercent(whole / 100)).toMatch(/^[۰-۹]+‏٪$/);
  }
});

test('a negative share keeps the left-to-right mark Intl puts before the minus sign', () => {
  expect(formatPercent(-0.12)).toBe(`‎−۱۲${RLM}٪`);
});
