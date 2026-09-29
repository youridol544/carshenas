import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseInt8 } from './database.ts';

test('bigint values become numbers, and a value beyond the safe integer range throws instead of rounding', () => {
  assert.equal(parseInt8('0'), 0);
  assert.equal(parseInt8('-42'), -42);
  assert.equal(parseInt8('9007199254740991'), Number.MAX_SAFE_INTEGER);
  assert.throws(() => parseInt8('9007199254740993'), RangeError);
});
