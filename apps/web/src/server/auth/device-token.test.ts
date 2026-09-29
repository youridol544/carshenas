// @vitest-environment node
import { expect, test, vi } from 'vitest';
import { deviceKeyFor, newDeviceToken } from '@/server/auth/device-token';

vi.mock('@/server/env', () => ({ env: { authKey: Buffer.alloc(32, 7) } }));

test('a device token names its account, and is accepted only for that account', () => {
  const token = newDeviceToken(42);
  expect(token).toMatch(/^42\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
  const key = deviceKeyFor(token, 42);
  expect(key).toBe(token.split('.').slice(0, 2).join('.'));
  expect(deviceKeyFor(token, 43)).toBeUndefined();
});

test('a device token that was changed, cut or made up is refused', () => {
  const token = newDeviceToken(42);
  const [id, nonce, mac] = token.split('.');
  expect(deviceKeyFor(`${id}.${nonce}x.${mac}`, 42)).toBeUndefined();
  expect(deviceKeyFor(`${id}.${nonce}`, 42)).toBeUndefined();
  expect(deviceKeyFor(`${token}.extra`, 42)).toBeUndefined();
  expect(deviceKeyFor(`${id}.${nonce}.${'A'.repeat(43)}`, 42)).toBeUndefined();
  expect(deviceKeyFor(undefined, 42)).toBeUndefined();
});
