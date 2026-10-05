// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import robots from '@/app/robots';

vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));

afterEach(() => {
  vi.unstubAllEnvs();
});

test('robots.txt of a production build disallows everything for every crawler', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  await expect(robots()).resolves.toEqual({ rules: { userAgent: '*', disallow: '/' } });
});

test('robots.txt follows the switch at request time: listed, it keeps only the private places closed', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('CARSHENAS_UNLISTED', '0');
  await expect(robots()).resolves.toEqual({
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/api/'] },
  });
});
