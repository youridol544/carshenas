import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isolate, isolateLtr } from './bidi.ts';

test('isolate wraps text in a first-strong isolate so its direction comes from its own letters', () => {
  assert.equal(isolate('BMW X3'), '\u2068BMW X3\u2069');
});

test('isolateLtr forces left to right, for text that starts with digits or symbols', () => {
  assert.equal(isolateLtr('+98 912 345 6789'), '\u2066+98 912 345 6789\u2069');
});
