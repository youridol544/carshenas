import { expect, test } from 'vitest';
import { ttlCache } from '@/server/ttl-cache';

test('a value lives for its time and no longer', () => {
  const cache = ttlCache<number, string>(1000, 10);
  cache.set(1, 'a', 0);
  expect(cache.get(1, 999)).toBe('a');
  expect(cache.get(1, 1000)).toBeUndefined();
});

test('null is a value; the oldest entries go first when it is full', () => {
  const cache = ttlCache<number, string | null>(1000, 10);
  cache.set(0, null, 0);
  expect(cache.get(0, 1)).toBeNull();
  for (let i = 1; i <= 10; i += 1) cache.set(i, 'x', i);
  expect(cache.get(0, 20)).toBeUndefined();
  expect(cache.get(10, 20)).toBe('x');
});
