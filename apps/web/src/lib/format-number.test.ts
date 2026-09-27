// @vitest-environment node
import { expect, test } from 'vitest';
import { formatCount, formatPercent } from '@/lib/format-number';

test('a count prints in Persian digits with the Persian thousands mark', () => {
  expect(formatCount(120_000)).toBe('۱۲۰٬۰۰۰');
  expect(formatCount(128)).toBe('۱۲۸');
  expect(formatCount(0)).toBe('۰');
});

test('a share prints as a whole Persian percentage', () => {
  expect(formatPercent(0.12)).toBe('۱۲٪');
  expect(formatPercent(0.124)).toBe('۱۲٪');
});

test('a negative share keeps the left-to-right mark Intl puts before the minus sign', () => {
  expect(formatPercent(-0.12)).toBe('‎−۱۲٪');
});
