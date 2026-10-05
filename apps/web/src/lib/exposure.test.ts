// @vitest-environment node
import { expect, test } from 'vitest';
import {
  exposureHeaders,
  HSTS_VALUE,
  readExposure,
  robotsRules,
  ROBOTS_TAG_UNLISTED,
  type Exposure,
} from '@/lib/exposure';

const UNLISTED_PRODUCTION: Exposure = { unlisted: true, securityHeaders: true };
const LISTED_PRODUCTION: Exposure = { unlisted: false, securityHeaders: true };
const DEVELOPMENT: Exposure = { unlisted: false, securityHeaders: false };

function headerMap(exposure: Exposure, protocol: string, host: string): Map<string, string> {
  return new Map(exposureHeaders(exposure, { protocol, host }));
}

test('a production build is unlisted unless the switch says otherwise', () => {
  expect(readExposure({ NODE_ENV: 'production' })).toEqual(UNLISTED_PRODUCTION);
  expect(readExposure({ NODE_ENV: 'production', CARSHENAS_UNLISTED: '' })).toEqual(UNLISTED_PRODUCTION);
  expect(readExposure({ NODE_ENV: 'production', CARSHENAS_UNLISTED: '1' })).toEqual(UNLISTED_PRODUCTION);
  expect(readExposure({ NODE_ENV: 'production', CARSHENAS_UNLISTED: ' TRUE ' })).toEqual(UNLISTED_PRODUCTION);
});

test('the switch lists a production site, which keeps its security headers', () => {
  expect(readExposure({ NODE_ENV: 'production', CARSHENAS_UNLISTED: '0' })).toEqual(LISTED_PRODUCTION);
  expect(readExposure({ NODE_ENV: 'production', CARSHENAS_UNLISTED: 'false' })).toEqual(LISTED_PRODUCTION);
});

test('development and tests are listed and send no security headers, unless the switch unlists them', () => {
  expect(readExposure({ NODE_ENV: 'development' })).toEqual(DEVELOPMENT);
  expect(readExposure({ NODE_ENV: 'test' })).toEqual(DEVELOPMENT);
  expect(readExposure({})).toEqual(DEVELOPMENT);
  expect(readExposure({ NODE_ENV: 'development', CARSHENAS_UNLISTED: '1' })).toEqual({
    unlisted: true,
    securityHeaders: false,
  });
});

test('a value the switch does not know stops the server with a message that names it', () => {
  expect(() => readExposure({ NODE_ENV: 'production', CARSHENAS_UNLISTED: 'yes' })).toThrow(
    'CARSHENAS_UNLISTED must be 1, true, 0 or false; it is "yes".',
  );
});

test('every response of an unlisted site says noindex, nofollow and no archive', () => {
  const headers = headerMap(UNLISTED_PRODUCTION, 'https', 'demo.example.ir');
  expect(headers.get('X-Robots-Tag')).toBe(ROBOTS_TAG_UNLISTED);
  expect(ROBOTS_TAG_UNLISTED.split(', ')).toEqual(
    expect.arrayContaining(['noindex', 'nofollow', 'noarchive']),
  );
});

test('a listed site never says noindex', () => {
  expect(headerMap(LISTED_PRODUCTION, 'https', 'demo.example.ir').has('X-Robots-Tag')).toBe(false);
});

test('a production build sends the security headers whatever the scheme', () => {
  const headers = headerMap(UNLISTED_PRODUCTION, 'http', 'demo.example.ir');
  expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(headers.get('X-Frame-Options')).toBe('DENY');
  expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
  expect(headers.get('Permissions-Policy')).toContain('camera=()');
  expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
});

test('the browser is told to stay on https only for a visit over https to a named host', () => {
  expect(headerMap(UNLISTED_PRODUCTION, 'https', 'demo.example.ir').get('Strict-Transport-Security')).toBe(
    HSTS_VALUE,
  );
  expect(headerMap(UNLISTED_PRODUCTION, 'http', 'demo.example.ir').has('Strict-Transport-Security')).toBe(
    false,
  );
});

test('no host that is an address or a loopback name is pinned to https', () => {
  const hosts = ['203.0.113.7', '[2001:db8::1]', 'localhost', 'app.localhost'];
  expect(
    hosts.filter((host) => headerMap(UNLISTED_PRODUCTION, 'https', host).has('Strict-Transport-Security')),
  ).toEqual([]);
});

test('the HSTS value is a year with no subdomains and no preload, which cannot be taken back', () => {
  expect(HSTS_VALUE).toBe('max-age=31536000');
});

test('development sends no extra header at all', () => {
  expect(exposureHeaders(DEVELOPMENT, { protocol: 'http', host: '127.0.0.1' })).toEqual([]);
});

test('robots.txt of an unlisted site disallows everything for every crawler', () => {
  expect(robotsRules(UNLISTED_PRODUCTION)).toEqual({ rules: { userAgent: '*', disallow: '/' } });
});

test('robots.txt of a listed site opens the pages and keeps the admin section, the account and the API closed', () => {
  expect(robotsRules(LISTED_PRODUCTION)).toEqual({
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/api/'] },
  });
});
