import { beforeEach, expect, test } from 'vitest';
import { resetBuckets, takeToken } from '@/server/token-bucket';

const RULE = { capacity: 3, perSecond: 1 };

beforeEach(() => {
  resetBuckets();
});

test('a bucket lets its capacity through at once, then refuses until it refills', () => {
  expect([1, 2, 3, 4].map(() => takeToken('t', 'a', RULE, 0))).toEqual([true, true, true, false]);
  expect(takeToken('t', 'a', RULE, 500)).toBe(false);
  expect(takeToken('t', 'a', RULE, 1000)).toBe(true);
  expect(takeToken('t', 'a', RULE, 1000)).toBe(false);
});

test('it never holds more than its capacity, however long it rested', () => {
  takeToken('t', 'a', RULE, 0);
  expect([1, 2, 3, 4].map(() => takeToken('t', 'a', RULE, 3_600_000))).toEqual([true, true, true, false]);
});

test('addresses and names have buckets of their own', () => {
  for (let i = 0; i < 3; i += 1) takeToken('t', 'a', RULE, 0);
  expect(takeToken('t', 'a', RULE, 0)).toBe(false);
  expect(takeToken('t', 'b', RULE, 0)).toBe(true);
  expect(takeToken('other', 'a', RULE, 0)).toBe(true);
});
