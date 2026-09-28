import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newReference } from './reference.ts';

test('a reference is ten Latin digits, and each one is new', () => {
  const references = Array.from({ length: 200 }, () => newReference());
  for (const reference of references) assert.match(reference, /^\d{10}$/);
  assert.equal(new Set(references).size, references.length);
});

test('a byte the digits cannot divide evenly is drawn again, not folded onto a digit', (context) => {
  // The first draw is all bytes from 250 up, which `byte % 10` would have turned into 0 to 5.
  const draws = [new Uint8Array(10).fill(255), Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])];
  context.mock.method(crypto, 'getRandomValues', (array: Uint8Array) => {
    array.set(draws.shift() ?? []);
    return array;
  });
  assert.equal(newReference(), '0123456789');
});
