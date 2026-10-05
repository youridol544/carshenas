// @vitest-environment node
import { expect, test } from 'vitest';
import { judgeProbe, WORKER_MAX_SILENCE_MINUTES } from '@/features/data-status/data-status-probe';
import type {
  DataStatus,
  ListingFigures,
  SourceStatus,
  UpdateState,
} from '@/features/data-status/data-status-types';

// What GET /api/probe says about the site, the worker and the data (CS-119), judged from the data-status figures.

const NOW = new Date('2026-10-04T10:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const SITE = { reachable: true, migration: '20261004000030' } as const;
const RELEASE = '20261004-1030-421d298';

function figures(lastReadMinutesAgo: number | null): ListingFigures {
  return {
    active: 4210,
    postedLast24h: 120,
    goneLast24h: 90,
    lastReadAt: lastReadMinutesAgo === null ? null : minutesAgo(lastReadMinutesAgo),
    firstStoredAt: minutesAgo(60 * 24 * 5),
    trackedActive: 3600,
    shown: 3500,
    shownCheckMedianMinutes: 300,
  };
}

type Scenario = {
  state?: UpdateState;
  lastReadMinutesAgo?: number | null;
  measuredMinutesAgo?: number | null;
  valuationAsOf?: string | null;
};

/** A status in which everything is healthy, changed by the scenario. */
function status(scenario: Scenario = {}): DataStatus {
  const state = scenario.state ?? 'live';
  const lastRead = scenario.lastReadMinutesAgo === undefined ? 5 : scenario.lastReadMinutesAgo;
  const measured = scenario.measuredMinutesAgo === undefined ? 20 : scenario.measuredMinutesAgo;
  const source: SourceStatus = {
    id: 'divar',
    nameFa: 'دیوار',
    state,
    dailyRequestBudget: 12_000,
    figures: figures(lastRead),
    postingToStoredMedianMinutes: 25,
    series:
      measured === null
        ? []
        : [{ measuredAt: minutesAgo(measured), activeListings: 4210, lastCheckMedianMinutes: 300 }],
  };
  const valuationAsOf = scenario.valuationAsOf === undefined ? '2026-10-04' : scenario.valuationAsOf;
  return {
    measuredAt: minutesAgo(1),
    tehranToday: '2026-10-04',
    index: { state, figures: figures(lastRead) },
    sources: [source],
    valuation:
      valuationAsOf === null
        ? null
        : {
            asOfDate: valuationAsOf,
            finishedAt: minutesAgo(400),
            comparables: 3000,
            valued: 3400,
            rated: 3300,
            models: [],
          },
    extraction: null,
  };
}

function probe(scenario: Scenario) {
  return judgeProbe({ site: SITE, status: status(scenario), release: RELEASE, now: NOW });
}

test('a healthy site, worker and data answer ok with 200 and name the release and the newest migration', () => {
  const { report, httpStatus } = probe({});
  expect(httpStatus).toBe(200);
  expect(report).toMatchObject({
    status: 'ok',
    problems: [],
    site: { status: 'ok', release: RELEASE, migration: '20261004000030' },
    worker: { status: 'ok', ageMinutes: 5 },
    data: {
      status: 'live',
      ageMinutes: 5,
      activeListings: 4210,
      shownListings: 3500,
      sources: [{ id: 'divar', state: 'live' }],
    },
    valuation: { status: 'ok', asOfDate: '2026-10-04', ageDays: 0 },
  });
});

test('the worker is alive while its last sign, a measurement or a crawl read, is within an hour and a half', () => {
  const edge = probe({ lastReadMinutesAgo: null, measuredMinutesAgo: WORKER_MAX_SILENCE_MINUTES });
  expect(edge.report.worker.status).toBe('ok');
  const late = probe({ lastReadMinutesAgo: null, measuredMinutesAgo: WORKER_MAX_SILENCE_MINUTES + 1 });
  expect(late.report.worker.status).toBe('late');
  expect(late.report.problems).toContain('worker_late');
  expect(late.httpStatus).toBe(503);
});

test('the newer of the measurement and the crawl read counts as the last sign of the worker', () => {
  expect(probe({ lastReadMinutesAgo: 3, measuredMinutesAgo: 300 }).report.worker).toMatchObject({
    status: 'ok',
    ageMinutes: 3,
  });
  expect(probe({ lastReadMinutesAgo: 600, measuredMinutesAgo: 40 }).report.worker).toMatchObject({
    status: 'ok',
    ageMinutes: 40,
  });
});

test('a worker with no sign yet is unknown, which is not healthy', () => {
  const { report, httpStatus } = probe({ lastReadMinutesAgo: null, measuredMinutesAgo: null });
  expect(report.worker).toEqual({ status: 'unknown', lastSignAt: null, ageMinutes: null });
  expect(report.problems).toContain('worker_unknown');
  expect(httpStatus).toBe(503);
});

test('a paused crawl is a data problem, not a worker one, while the hourly measurement still arrives', () => {
  const { report, httpStatus } = probe({
    state: 'not_updating',
    lastReadMinutesAgo: 3000,
    measuredMinutesAgo: 20,
  });
  expect(report.worker.status).toBe('ok');
  expect(report.data.status).toBe('not_updating');
  expect(report.problems).toEqual(['data_not_updating']);
  expect(report.status).toBe('degraded');
  expect(httpStatus).toBe(503);
});

test('data that is enabled but not read for an hour is delayed', () => {
  const { report } = probe({ state: 'delayed', lastReadMinutesAgo: 90 });
  expect(report.problems).toEqual(['data_delayed']);
  expect(report.data.sources).toEqual([{ id: 'divar', state: 'delayed' }]);
});

test('market values are healthy from today or yesterday in Tehran, old after, and none before the first run', () => {
  expect(probe({ valuationAsOf: '2026-10-03' }).report.valuation).toMatchObject({ status: 'ok', ageDays: 1 });
  const old = probe({ valuationAsOf: '2026-10-02' });
  expect(old.report.valuation).toMatchObject({ status: 'old', ageDays: 2 });
  expect(old.report.problems).toEqual(['valuation_old']);
  const none = probe({ valuationAsOf: null });
  expect(none.report.valuation).toEqual({ status: 'none', asOfDate: null, ageDays: null });
  expect(none.report.problems).toEqual(['valuation_none']);
});

test('the Tehran day, not the UTC day, dates the market values', () => {
  // 21:00 UTC on the 3rd is 00:30 on the 4th in Tehran, so a run for the 3rd is a day old, not today's.
  const lateEvening = new Date('2026-10-03T21:00:00.000Z');
  const { report } = judgeProbe({
    site: SITE,
    status: status({ valuationAsOf: '2026-10-03' }),
    release: RELEASE,
    now: lateEvening,
  });
  expect(report.valuation.ageDays).toBe(1);
});

test('a database that does not answer is down: 503, and nothing else is claimed', () => {
  const { report, httpStatus } = judgeProbe({
    site: { reachable: false },
    status: null,
    release: RELEASE,
    now: NOW,
  });
  expect(httpStatus).toBe(503);
  expect(report).toMatchObject({
    status: 'down',
    problems: ['database_unreachable'],
    site: { status: 'down', release: RELEASE, migration: null },
    worker: { status: 'unreadable' },
    data: { status: 'unreadable', sources: [] },
    valuation: { status: 'unreadable' },
  });
});

test('figures that cannot be read leave the site answering but degraded', () => {
  const { report, httpStatus } = judgeProbe({ site: SITE, status: null, release: RELEASE, now: NOW });
  expect(httpStatus).toBe(503);
  expect(report.status).toBe('degraded');
  expect(report.problems).toEqual(['status_unreadable']);
  expect(report.site.status).toBe('ok');
});

test('the public report holds no error, address, account, trace or stop reason', () => {
  const { report } = probe({ state: 'not_updating' });
  const names = JSON.stringify(report).match(/"[A-Za-z]+":/g) ?? [];
  const forbidden = /(error|stop|reason|address|account|user|trace|password|token|secret)/i;
  expect(names.filter((name) => forbidden.test(name))).toEqual([]);
});
