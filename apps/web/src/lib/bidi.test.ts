// @vitest-environment node
import { expect, test } from 'vitest';
import { isolate, isolateLtr } from '@/lib/bidi';

test('isolate wraps text in a first-strong isolate so its direction comes from its own letters', () => {
  expect(isolate('BMW X3')).toBe('\u2068BMW X3\u2069');
});

test('isolateLtr forces left to right, for text that starts with digits or symbols', () => {
  expect(isolateLtr('+98 912 345 6789')).toBe('\u2066+98 912 345 6789\u2069');
});
