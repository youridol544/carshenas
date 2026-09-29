// @vitest-environment node
import { expect, test } from 'vitest';
import { addressKey, clientAddress } from '@/server/auth/client-address';

test('the address written last into X-Forwarded-For is the one counted', () => {
  expect(clientAddress(new Headers({ 'x-forwarded-for': '10.0.0.1, 5.160.1.2' }))).toBe('5.160.1.2');
  expect(clientAddress(new Headers({ 'x-forwarded-for': '127.0.0.1' }))).toBe('127.0.0.1');
  expect(clientAddress(new Headers())).toBe('unknown');
});

test('an IPv4 address counts as itself, also when written as IPv6', () => {
  expect(addressKey('5.160.1.2')).toBe('5.160.1.2');
  expect(addressKey('::ffff:5.160.1.2')).toBe('5.160.1.2');
  expect(addressKey('not an address')).toBe('unknown');
});

test('an IPv6 address counts by its /56, so one customer cannot step through their own range', () => {
  expect(addressKey('2a01:5ec0:1234:5678::1')).toBe('2a01:5ec0:1234:5600::/56');
  expect(addressKey('2a01:5ec0:1234:56ff:aaaa:bbbb:cccc:dddd')).toBe('2a01:5ec0:1234:5600::/56');
  expect(addressKey('::1')).toBe('0000:0000:0000:0000::/56');
  expect(addressKey('fe80::1%eth0')).toBe('fe80:0000:0000:0000::/56');
});
