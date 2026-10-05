// @vitest-environment node
import { expect, test, vi } from 'vitest';
import type { DataStatus } from '@/features/data-status/data-status-types';
import { probeResponse, type ProbeSources } from '@/features/data-status/server/probe';
import { captureError } from '@/server/observability/logger';

vi.mock('@/server/observability/logger', async () => {
  const { recordingLogger } = await import('@/server/observability/recording-logger');
  return { logger: recordingLogger(), captureError: vi.fn() };
});

const NOW = new Date('2026-10-04T10:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const figures = {
  active: 100,
  postedLast24h: 10,
  goneLast24h: 5,
  lastReadAt: minutesAgo(4),
  firstStoredAt: minutesAgo(5000),
  trackedActive: 90,
  shown: 80,
  shownCheckMedianMinutes: 200,
};

const HEALTHY: DataStatus = {
  measuredAt: minutesAgo(1),
  tehranToday: '2026-10-04',
  index: { state: 'live', figures },
  sources: [
    {
      id: 'divar',
      nameFa: 'دیوار',
      state: 'live',
      dailyRequestBudget: 12_000,
      figures,
      postingToStoredMedianMinutes: 20,
      series: [{ measuredAt: minutesAgo(25), activeListings: 100, lastCheckMedianMinutes: 200 }],
    },
  ],
  valuation: {
    asOfDate: '2026-10-04',
    finishedAt: minutesAgo(300),
    comparables: 1,
    valued: 1,
    rated: 1,
    models: [],
  },
  extraction: null,
};

function sources(overrides: Partial<ProbeSources> = {}): ProbeSources {
  return {
    checkSite: () => Promise.resolve({ migration: '20261004000030' }),
    loadStatus: () => Promise.resolve(HEALTHY),
    now: () => NOW,
    release: 'r1',
    ...overrides,
  };
}

test('everything healthy answers 200, uncacheable, with the report as JSON', async () => {
  const response = await probeResponse(sources());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(await response.json()).toMatchObject({ status: 'ok', problems: [], site: { release: 'r1' } });
});

test('a worker or data problem answers 503 with the reasons', async () => {
  const stale = { ...HEALTHY, index: { ...HEALTHY.index, state: 'not_updating' as const } };
  const response = await probeResponse(sources({ loadStatus: () => Promise.resolve(stale) }));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ status: 'degraded', problems: ['data_not_updating'] });
});

test('a database that does not answer is 503 down, is reported for a person to look at, and reads no figures', async () => {
  const loadStatus = vi.fn(() => Promise.resolve(HEALTHY));
  const response = await probeResponse(
    sources({ checkSite: () => Promise.reject(new Error('connect ECONNREFUSED')), loadStatus }),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ status: 'down', problems: ['database_unreachable'] });
  expect(loadStatus).not.toHaveBeenCalled();
  expect(captureError).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({ fields: { component: 'probe' } }),
  );
});

test('figures that fail to load leave the site answering but degraded, without the error in the body', async () => {
  const response = await probeResponse(
    sources({ loadStatus: () => Promise.reject(new Error('relation does not exist')) }),
  );
  expect(response.status).toBe(503);
  const text = await response.text();
  expect(JSON.parse(text)).toMatchObject({ status: 'degraded', problems: ['status_unreadable'] });
  expect(text).not.toContain('relation does not exist');
});
