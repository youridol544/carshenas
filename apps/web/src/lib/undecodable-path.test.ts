// @vitest-environment node
import { expect, test } from 'vitest';
import { isUndecodablePath } from '@/lib/undecodable-path';

test('a well-formed path, with or without escapes, can be decoded', () => {
  expect(isUndecodablePath('/listings/123')).toBe(false);
  expect(isUndecodablePath('/listings/%DB%B1%DB%B2')).toBe(false);
  expect(isUndecodablePath('/listings/a%20b')).toBe(false);
});

test('a truncated or invalid escape cannot', () => {
  expect(isUndecodablePath('/listings/%E0%A4%A')).toBe(true);
  expect(isUndecodablePath('/listings/%')).toBe(true);
  expect(isUndecodablePath('/listings/%C0%AF')).toBe(true);
  expect(isUndecodablePath('/listings/%FF')).toBe(true);
});
