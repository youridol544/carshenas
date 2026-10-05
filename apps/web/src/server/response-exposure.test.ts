// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { HSTS_VALUE, ROBOTS_TAG_UNLISTED } from '@/lib/exposure';
import { withExposureHeaders } from '@/server/response-exposure';

afterEach(() => {
  vi.unstubAllEnvs();
});

/** What the function reads of a request: its headers, as the reverse proxy passes them. */
function visit(headers: Record<string, string> = {}) {
  return { headers: new Headers(headers) };
}

test('a production response says noindex, carries the security headers and, over https, HSTS', () => {
  vi.stubEnv('NODE_ENV', 'production');
  const response = withExposureHeaders(
    new Response('page'),
    visit({ host: 'demo.example.ir', 'x-forwarded-proto': 'https' }),
  );
  expect(response.headers.get('x-robots-tag')).toBe(ROBOTS_TAG_UNLISTED);
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('x-frame-options')).toBe('DENY');
  expect(response.headers.get('strict-transport-security')).toBe(HSTS_VALUE);
});

test('over plain http there is no HSTS, and the other headers stay', () => {
  vi.stubEnv('NODE_ENV', 'production');
  const response = withExposureHeaders(new Response('page'), visit({ host: 'demo.example.ir' }));
  expect(response.headers.get('strict-transport-security')).toBeNull();
  expect(response.headers.get('x-robots-tag')).toBe(ROBOTS_TAG_UNLISTED);
});

test('listing the site takes noindex away and keeps the security headers', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('CARSHENAS_UNLISTED', '0');
  const response = withExposureHeaders(new Response('page'), visit());
  expect(response.headers.get('x-robots-tag')).toBeNull();
  expect(response.headers.get('x-frame-options')).toBe('DENY');
});

test('development adds nothing to a response', () => {
  vi.stubEnv('NODE_ENV', 'development');
  const response = withExposureHeaders(new Response('page'), visit({ host: '127.0.0.1:3000' }));
  expect([...response.headers.keys()]).toEqual(['content-type']);
});

test('a header the page already set is replaced by the deployment value, and others are left alone', () => {
  vi.stubEnv('NODE_ENV', 'production');
  const page = new Response('page', { headers: { 'X-Robots-Tag': 'all', 'Cache-Control': 'no-store' } });
  const response = withExposureHeaders(page, visit());
  expect(response.headers.get('x-robots-tag')).toBe(ROBOTS_TAG_UNLISTED);
  expect(response.headers.get('cache-control')).toBe('no-store');
});

test('a switch value the deployment does not know stops the response with a message that names it', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('CARSHENAS_UNLISTED', 'sometimes');
  expect(() => withExposureHeaders(new Response('page'), visit())).toThrow(
    'CARSHENAS_UNLISTED must be 1, true, 0 or false',
  );
});
