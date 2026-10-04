import { tehranIsoDate } from '@carshenas/locale/format-date';
import { daysBetween, FRESHNESS_TARGETS } from '@/features/data-status/data-status-rules';
import type { DataStatus, UpdateState } from '@/features/data-status/data-status-types';

// What GET /api/probe says (CS-119): one answer for an uptime monitor about the site, the worker and the data, judged from
// the figures the data-status page already reads (CS-66). Pure, so every rule is unit-tested. Plain words and numbers,
// never an address, an error, a stop reason or an account: the probe is public.

/**
 * The worker writes a freshness measurement every hour at :05 (`divar.measure-freshness`, whatever the crawl does), and
 * every crawl read stamps the listing it read. The newest of those is the worker's last sign of life; this long without
 * one, an hour plus half an hour of slack, and the worker is late. The exact heartbeat is `/admin/worker` and
 * `pnpm worker:health`.
 */
export const WORKER_MAX_SILENCE_MINUTES = 90;

export type ProbeProblem =
  | 'database_unreachable'
  | 'status_unreadable'
  | 'worker_late'
  | 'worker_unknown'
  | 'data_delayed'
  | 'data_not_updating'
  | 'valuation_old'
  | 'valuation_none';

export type ProbeReport = {
  /** `ok`: all three are healthy. `degraded`: the site answers but the worker or the data is not as it should be. */
  status: 'ok' | 'degraded' | 'down';
  checkedAt: string;
  problems: ProbeProblem[];
  site: { status: 'ok' | 'down'; release: string; migration: string | null };
  worker: {
    status: 'ok' | 'late' | 'unknown' | 'unreadable';
    lastSignAt: string | null;
    ageMinutes: number | null;
  };
  data: {
    status: UpdateState | 'unreadable';
    lastReadAt: string | null;
    ageMinutes: number | null;
    activeListings: number | null;
    shownListings: number | null;
    sources: { id: string; state: UpdateState }[];
  };
  valuation: {
    status: 'ok' | 'old' | 'none' | 'unreadable';
    asOfDate: string | null;
    ageDays: number | null;
  };
};

export type ProbeInput = {
  /** The database answered the health query, with its newest migration; or it did not. */
  site: { reachable: true; migration: string | null } | { reachable: false };
  /** The data-status figures, or null when they could not be read. */
  status: DataStatus | null;
  /** The deployed build (CARSHENAS_RELEASE). */
  release: string;
  now: Date;
};

const minutesSince = (from: string, now: Date) =>
  Math.max(0, Math.round((now.getTime() - Date.parse(from)) / 60_000));

/** The newest instant of those given, or null when none. */
function newest(instants: readonly (string | null)[]): string | null {
  const known = instants.filter((instant) => instant !== null);
  return known.length === 0 ? null : known.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
}

function judgeWorker(status: DataStatus, now: Date): ProbeReport['worker'] {
  const measurements = status.sources.map((source) => source.series.at(-1)?.measuredAt ?? null);
  const lastSignAt = newest([...measurements, status.index.figures.lastReadAt]);
  if (lastSignAt === null) return { status: 'unknown', lastSignAt: null, ageMinutes: null };
  const ageMinutes = minutesSince(lastSignAt, now);
  return { status: ageMinutes <= WORKER_MAX_SILENCE_MINUTES ? 'ok' : 'late', lastSignAt, ageMinutes };
}

function judgeValuation(status: DataStatus, now: Date): ProbeReport['valuation'] {
  if (status.valuation === null) return { status: 'none', asOfDate: null, ageDays: null };
  const ageDays = daysBetween(status.valuation.asOfDate, tehranIsoDate(now));
  return {
    status: ageDays <= FRESHNESS_TARGETS.valuationMaxAgeDays ? 'ok' : 'old',
    asOfDate: status.valuation.asOfDate,
    ageDays,
  };
}

/** What the report says about the parts it could not read. */
function unreadable(): Pick<ProbeReport, 'worker' | 'data' | 'valuation'> {
  return {
    worker: { status: 'unreadable', lastSignAt: null, ageMinutes: null },
    data: {
      status: 'unreadable',
      lastReadAt: null,
      ageMinutes: null,
      activeListings: null,
      shownListings: null,
      sources: [],
    },
    valuation: { status: 'unreadable', asOfDate: null, ageDays: null },
  };
}

/** The report, and with it the HTTP status: 200 only when everything is healthy, 503 otherwise. */
export function judgeProbe(input: ProbeInput): { report: ProbeReport; httpStatus: 200 | 503 } {
  const checkedAt = input.now.toISOString();
  if (!input.site.reachable) {
    const site = { status: 'down' as const, release: input.release, migration: null };
    const report: ProbeReport = {
      status: 'down',
      checkedAt,
      problems: ['database_unreachable'],
      site,
      ...unreadable(),
    };
    return { report, httpStatus: 503 };
  }
  const site = { status: 'ok' as const, release: input.release, migration: input.site.migration };
  const { status } = input;
  if (status === null) {
    const report: ProbeReport = {
      status: 'degraded',
      checkedAt,
      problems: ['status_unreadable'],
      site,
      ...unreadable(),
    };
    return { report, httpStatus: 503 };
  }

  const worker = judgeWorker(status, input.now);
  const valuation = judgeValuation(status, input.now);
  const lastReadAt = status.index.figures.lastReadAt;
  const data: ProbeReport['data'] = {
    status: status.index.state,
    lastReadAt,
    ageMinutes: lastReadAt === null ? null : minutesSince(lastReadAt, input.now),
    activeListings: status.index.figures.active,
    shownListings: status.index.figures.shown,
    sources: status.sources.map((source) => ({ id: source.id, state: source.state })),
  };

  const problems: ProbeProblem[] = [];
  if (worker.status === 'late') problems.push('worker_late');
  if (worker.status === 'unknown') problems.push('worker_unknown');
  if (data.status === 'delayed') problems.push('data_delayed');
  if (data.status === 'not_updating') problems.push('data_not_updating');
  if (valuation.status === 'old') problems.push('valuation_old');
  if (valuation.status === 'none') problems.push('valuation_none');

  const healthy = problems.length === 0;
  return {
    report: { status: healthy ? 'ok' : 'degraded', checkedAt, problems, site, worker, data, valuation },
    httpStatus: healthy ? 200 : 503,
  };
}
