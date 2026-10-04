// @vitest-environment node
import { expect, test } from 'vitest';
import {
  isPlainHttpLoopback,
  isSameOriginRequest,
  requestHost,
  requestScheme,
} from '@/server/auth/request-origin';

test('the scheme is what the reverse proxy passed, the first of several, and http without one', () => {
  expect(requestScheme(new Headers({ 'x-forwarded-proto': 'https' }))).toBe('https');
  expect(requestScheme(new Headers({ 'x-forwarded-proto': 'HTTPS, http' }))).toBe('https');
  expect(requestScheme(new Headers())).toBe('http');
});

test('the host is read from X-Forwarded-Host, then Host, without its port', () => {
  expect(requestHost(new Headers({ host: '127.0.0.1:3200' }))).toBe('127.0.0.1');
  expect(requestHost(new Headers({ host: '[::1]:3000' }))).toBe('[::1]');
  expect(requestHost(new Headers({ 'x-forwarded-host': 'Carshenas.ir', host: '127.0.0.1:3000' }))).toBe(
    'carshenas.ir',
  );
});

test('cookies drop Secure only for plain http to a loopback host', () => {
  const loopback = (host: string, proto = 'http') => new Headers({ host, 'x-forwarded-proto': proto });
  expect(isPlainHttpLoopback(loopback('127.0.0.1:3200'))).toBe(true);
  expect(isPlainHttpLoopback(loopback('localhost:3000'))).toBe(true);
  expect(isPlainHttpLoopback(loopback('[::1]:3000'))).toBe(true);
  expect(isPlainHttpLoopback(loopback('127.0.0.1:3200', 'https'))).toBe(false);
  // A deployment answers on its public host, whatever the scheme header says.
  expect(isPlainHttpLoopback(loopback('carshenas.ir', 'http'))).toBe(false);
  expect(isPlainHttpLoopback(loopback('127.0.0.1.evil.example'))).toBe(false);
});

test('a state change is accepted only from a page of this site', () => {
  expect(isSameOriginRequest(new Headers({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
  expect(isSameOriginRequest(new Headers({ 'sec-fetch-site': 'same-site' }))).toBe(false);
  expect(
    isSameOriginRequest(new Headers({ 'sec-fetch-site': 'cross-site', origin: 'https://carshenas.ir' })),
  ).toBe(false);
  // Browsers without Sec-Fetch-Site: the Origin must name this host and port.
  expect(isSameOriginRequest(new Headers({ origin: 'http://127.0.0.1:3200', host: '127.0.0.1:3200' }))).toBe(
    true,
  );
  expect(isSameOriginRequest(new Headers({ origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3200' }))).toBe(
    false,
  );
  expect(
    isSameOriginRequest(new Headers({ origin: 'https://carshenas.ir', 'x-forwarded-host': 'carshenas.ir' })),
  ).toBe(true);
  expect(isSameOriginRequest(new Headers({ origin: 'null', host: '127.0.0.1:3200' }))).toBe(false);
  expect(isSameOriginRequest(new Headers({ host: '127.0.0.1:3200' }))).toBe(false);
});
