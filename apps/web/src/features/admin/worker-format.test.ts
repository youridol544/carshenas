// @vitest-environment node
import { expect, test } from 'vitest';
import { WORKER_COPY } from '@/features/admin/admin-copy';
import { formatAgeMinutes, formatRunSeconds } from '@/features/admin/worker-format';

const NBSP = String.fromCodePoint(0xa0);

test('a run lasts under a second, whole seconds, or whole minutes past two', () => {
  expect(formatRunSeconds(0.4)).toBe(WORKER_COPY.underASecond);
  expect(formatRunSeconds(4.4)).toBe(`۴${NBSP}${WORKER_COPY.seconds}`);
  expect(formatRunSeconds(119)).toBe(`۱۱۹${NBSP}${WORKER_COPY.seconds}`);
  expect(formatRunSeconds(600)).toBe(`۱۰${NBSP}${WORKER_COPY.minutes}`);
});

test('an age reads in minutes, then hours, then days', () => {
  expect(formatAgeMinutes(22)).toBe(`۲۲${NBSP}${WORKER_COPY.minutes}`);
  expect(formatAgeMinutes(89)).toBe(`۸۹${NBSP}${WORKER_COPY.minutes}`);
  expect(formatAgeMinutes(180)).toBe(`۳${NBSP}${WORKER_COPY.hours}`);
  expect(formatAgeMinutes(3 * 24 * 60)).toBe(`۳${NBSP}${WORKER_COPY.days}`);
});
