// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';

// The proxy's existence probe (CS-64): a failing database is `unknown`, reported once, and never a 404.

const execute = vi.fn();
const captureError = vi.fn();
vi.mock('@/server/db/database', () => ({
  readDatabase: () => ({
    selectFrom: () => ({
      select: () => ({ where: () => ({ where: () => ({ executeTakeFirst: execute }) }) }),
    }),
  }),
}));
vi.mock('@/server/observability/logger', () => ({ captureError }));

beforeEach(() => {
  execute.mockReset();
  captureError.mockReset();
});

test('a listing that is there exists, and one that is not is missing', async () => {
  const { probeListingPage } = await import('@/server/db/listing-existence');
  execute.mockResolvedValueOnce({ id: 5 });
  expect(await probeListingPage(5)).toBe('exists');
  execute.mockResolvedValueOnce(undefined);
  expect(await probeListingPage(6)).toBe('missing');
  expect(captureError).not.toHaveBeenCalled();
});

test('a database that fails is unknown, reported, and lets the page answer', async () => {
  const { probeListingPage } = await import('@/server/db/listing-existence');
  execute.mockRejectedValueOnce(new Error('connection refused'));
  expect(await probeListingPage(5)).toBe('unknown');
  expect(captureError).toHaveBeenCalledTimes(1);
});
