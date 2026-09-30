// @vitest-environment node
import { expect, test } from 'vitest';
import { formatAgeMinutes, formatRunSeconds } from '@/features/admin/worker-format';

const NBSP = String.fromCodePoint(0xa0);

test('a run lasts under a second, whole seconds, or whole minutes past two', () => {
  expect(formatRunSeconds(0.4)).toBe('کمتر از ۱ ثانیه');
  expect(formatRunSeconds(4.4)).toBe(`۴${NBSP}ثانیه`);
  expect(formatRunSeconds(119)).toBe(`۱۱۹${NBSP}ثانیه`);
  expect(formatRunSeconds(600)).toBe(`۱۰${NBSP}دقیقه`);
});

test('an age reads in minutes, then hours, then days', () => {
  expect(formatAgeMinutes(22)).toBe(`۲۲${NBSP}دقیقه`);
  expect(formatAgeMinutes(89)).toBe(`۸۹${NBSP}دقیقه`);
  expect(formatAgeMinutes(180)).toBe(`۳${NBSP}ساعت`);
  expect(formatAgeMinutes(3 * 24 * 60)).toBe(`۳${NBSP}روز`);
});
