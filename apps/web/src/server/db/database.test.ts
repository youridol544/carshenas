// @vitest-environment node
import { expect, test } from 'vitest';
import { parseInt8 } from '@/server/db/database';

test('bigint values become numbers, and a value beyond the safe integer range throws instead of rounding', () => {
  expect(parseInt8('0')).toBe(0);
  expect(parseInt8('-42')).toBe(-42);
  expect(parseInt8('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
  expect(() => parseInt8('9007199254740993')).toThrow(RangeError);
});
