import 'server-only';
import type { StopReason } from '@/features/admin/admin-types';
import { requireSuperadmin } from '@/server/auth/current-account';
import { readAdminDatabase } from '@/server/db/admin-database';
import type { JobState } from '@/server/db/pgboss-types';
import {
  averageSecondsBetween,
  databaseNow,
  equalsLiteral,
  inLiterals,
  laterOf,
  medianMinutesSince,
  modelKeyOrTrim,
  secondsAgo,
  tehranToday,
} from '@/server/db/sql-helpers';

// The worker and the pipeline, as the superadmin section shows them (CS-41): the job queue, each crawled source's runs,
// requests and budget, and what went wrong at a source. Every number comes from the database, through the section's
// own role (ADR-0023); each loader asks for the superadmin itself (ADR-0020 point 10). The plans, measured with
// EXPLAIN (ANALYZE, BUFFERS) on a copy of the crawler's data, are in CS-41's notes.

/** The windows the screens offer, in seconds. */
export const WINDOW_SECONDS = { '1h': 3_600, '24h': 86_400, '7d': 604_800 } as const;
export type PipelineWindow = keyof typeof WINDOW_SECONDS;

/** How many recent failures, runs and problems a screen lists. */
export const RECENT_ROWS = 20;

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonObject) : null;
}

function stringField(value: unknown, key: string): string | null {
  const field = asObject(value)?.[key];
  return typeof field === 'string' ? field : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Jobs

export type QueueStates = { queue: string; counts: Partial<Record<JobState, number>> };

export type JobError = {
  /** The error's class (TypeError, SourceUnavailableError …) and message, as the worker stored them. */
  type: string | null;
  message: string | null;
  /** The trace of the attempt that failed, which finds its log lines; stored since CS-41. */
  traceId: string | null;
};

export type FailedJob = {
  id: string;
  queue: string;
  /** failed: out of attempts, a person may retry it; retry: waiting to run again, a person may cancel it. */
  state: 'failed' | 'retry';
  /** The job's kind from its envelope (crawl.divar-listing …), when it has one. */
  kind: string | null;
  /** Attempts made, of those allowed. */
  attempts: number;
  attemptsAllowed: number;
  /** When the last attempt ended, or started when pg-boss kept no end; null only if it kept neither. */
  failedAt: string | null;
  error: JobError;
};

export type DeadLetter = {
  id: string;
  /** The queue the job failed in. */
  fromQueue: string | null;
  kind: string | null;
  deadLetteredAt: string;
  error: JobError;
};

export type JobChange = {
  id: number;
  queue: string;
  jobId: string;
  action: 'retry' | 'cancel';
  /** The superadmin's username. */
  changedBy: string;
  changedAt: string;
};

export type JobsData = {
  queues: QueueStates[];
  failures: FailedJob[];
  deadLetters: DeadLetter[];
  changes: JobChange[];
};

/** How many of the latest retries and cancels the screen lists. */
export const RECENT_JOB_CHANGES = 5;

function jobError(output: unknown): JobError {
  return {
    type: stringField(output, 'type'),
    message: stringField(output, 'message'),
    traceId: stringField(output, 'traceId'),
  };
}

export async function loadJobs(): Promise<JobsData> {
  await requireSuperadmin();
  const database = readAdminDatabase();
  const [counts, failures, deadLetters, changes] = await Promise.all([
    // Every job pg-boss still keeps, by queue and state: one pass over the job table (CS-41's notes).
    database
      .selectFrom('pgboss.job')
      .select((eb) => ['name', 'state', eb.fn.countAll<number>().as('jobs')])
      .groupBy(['name', 'state'])
      .orderBy('name')
      .execute(),
    // Jobs whose last attempt failed: out of attempts, or waiting to run again. pg-boss clears a retrying job's end.
    database
      .selectFrom('pgboss.job')
      .select((eb) => [
        'id',
        'name',
        'state',
        'data',
        'retry_count',
        'retry_limit',
        'output',
        eb.fn.coalesce('completed_on', 'started_on').as('failed_at'),
      ])
      .where('state', 'in', ['failed', 'retry'])
      .where('name', '<>', 'dead-letter')
      .orderBy((eb) => eb.fn.coalesce('completed_on', 'started_on', 'created_on'), 'desc')
      .limit(RECENT_ROWS)
      .execute(),
    database
      .selectFrom('pgboss.job')
      .select(['id', 'source_name', 'data', 'created_on', 'source_output'])
      .where('name', '=', 'dead-letter')
      .where('state', 'in', ['created', 'retry'])
      .orderBy('created_on', 'desc')
      .limit(RECENT_ROWS)
      .execute(),
    database
      .selectFrom('job_state_change')
      .innerJoin('account', 'account.id', 'job_state_change.changed_by_account_id')
      .select([
        'job_state_change.id',
        'job_state_change.queue',
        'job_state_change.job_id',
        'job_state_change.action',
        'job_state_change.changed_at',
        'account.username',
      ])
      .orderBy('job_state_change.changed_at', 'desc')
      .orderBy('job_state_change.id', 'desc')
      .limit(RECENT_JOB_CHANGES)
      .execute(),
  ]);

  const queues = new Map<string, QueueStates>();
  for (const row of counts) {
    const queue = queues.get(row.name) ?? { queue: row.name, counts: {} };
    queue.counts[row.state] = row.jobs;
    queues.set(row.name, queue);
  }
  return {
    queues: [...queues.values()],
    failures: failures.map((job) => ({
      id: job.id,
      queue: job.name,
      state: job.state === 'retry' ? 'retry' : 'failed',
      kind: stringField(job.data, 'kind'),
      attempts: job.retry_count + 1,
      attemptsAllowed: job.retry_limit + 1,
      failedAt: job.failed_at?.toISOString() ?? null,
      error: jobError(job.output),
    })),
    deadLetters: deadLetters.map((job) => ({
      id: job.id,
      fromQueue: job.source_name,
      kind: stringField(job.data, 'kind'),
      deadLetteredAt: job.created_on.toISOString(),
      error: jobError(job.source_output),
    })),
    changes: changes.map((change) => ({
      id: change.id,
      queue: change.queue,
      jobId: change.job_id,
      action: change.action,
      changedBy: change.username,
      changedAt: change.changed_at.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Crawl runs, requests and the daily budget

export type FetchOutcome =
  'ok' | 'not_modified' | 'not_found' | 'gone' | 'blocked' | 'rate_limited' | 'challenge' | 'error';

export type CrawlKind = 'discovery' | 'detail' | 'measure' | 'sweep' | 'check' | 'recheck';
export type CrawlRunStatus = 'running' | 'succeeded' | 'failed' | 'stopped_on_block';

export type RunGroup = {
  kind: CrawlKind;
  status: CrawlRunStatus;
  runs: number;
  /** Over the group's finished runs; null when none has finished. */
  averageSeconds: number | null;
};

export type CrawlRunRow = {
  id: number;
  kind: CrawlKind;
  status: CrawlRunStatus;
  startedAt: string;
  /** Null while it runs. */
  seconds: number | null;
  counts: Record<string, number>;
};

export type SourceCrawl = {
  id: string;
  nameFa: string;
  /** Requests leased today in Tehran, and the day's budget (ADR-0017 point 5); null budget: none set. */
  spentToday: number;
  dailyBudget: number | null;
  runGroups: RunGroup[];
  outcomes: Partial<Record<FetchOutcome, number>>;
  recentRuns: CrawlRunRow[];
};

export type CrawlData = { window: PipelineWindow; sources: SourceCrawl[] };

function numericCounts(value: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [key, count] of Object.entries(asObject(value) ?? {})) {
    if (typeof count === 'number') counts[key] = count;
  }
  return counts;
}

export async function loadCrawl(window: PipelineWindow): Promise<CrawlData> {
  await requireSuperadmin();
  const database = readAdminDatabase();
  const since = secondsAgo(WINDOW_SECONDS[window]);
  const [sources, groups, outcomes, runs] = await Promise.all([
    database
      .selectFrom('source')
      .leftJoin('crawl_lane', 'crawl_lane.source_id', 'source.id')
      .select((eb) => [
        'source.id',
        'source.name_fa',
        'source.daily_request_budget',
        eb
          .case()
          .when('crawl_lane.budget_day', '=', tehranToday())
          .then(eb.ref('crawl_lane.budget_spent'))
          .else(0)
          .end()
          .as('spent_today'),
      ])
      .where('source.access_method', '=', 'crawl')
      .orderBy('source.id')
      .execute(),
    // Each source's runs in the window, one range of crawl_run_source_started_idx per source.
    database
      .selectFrom('crawl_run')
      .select((eb) => [
        'source_id',
        'kind',
        'status',
        eb.fn.countAll<number>().as('runs'),
        averageSecondsBetween('started_at', 'finished_at').as('average_seconds'),
      ])
      .where('started_at', '>', since)
      .groupBy(['source_id', 'kind', 'status'])
      .orderBy('source_id')
      .orderBy('kind')
      .orderBy('status')
      .execute(),
    // What each request in the window came back with, on fetch_log_source_requested_idx.
    database
      .selectFrom('fetch_log')
      .select((eb) => ['source_id', 'outcome', eb.fn.countAll<number>().as('requests')])
      .where('requested_at', '>', since)
      .groupBy(['source_id', 'outcome'])
      .execute(),
    database
      .selectFrom('source')
      .innerJoinLateral(
        (eb) =>
          eb
            .selectFrom('crawl_run')
            .select([
              'crawl_run.id',
              'crawl_run.source_id',
              'crawl_run.kind',
              'crawl_run.status',
              'crawl_run.started_at',
              'crawl_run.finished_at',
              'crawl_run.counts',
            ])
            .whereRef('crawl_run.source_id', '=', 'source.id')
            .orderBy('crawl_run.started_at', 'desc')
            .limit(RECENT_ROWS)
            .as('run'),
        (join) => join.onTrue(),
      )
      .select([
        'run.id',
        'run.source_id',
        'run.kind',
        'run.status',
        'run.started_at',
        'run.finished_at',
        'run.counts',
      ])
      .where('source.access_method', '=', 'crawl')
      .orderBy('run.source_id')
      .orderBy('run.started_at', 'desc')
      .execute(),
  ]);

  return {
    window,
    sources: sources.map((source) => ({
      id: source.id,
      nameFa: source.name_fa,
      // No lane yet: nothing spent.
      spentToday: source.spent_today ?? 0,
      dailyBudget: source.daily_request_budget,
      runGroups: groups
        .filter((group) => group.source_id === source.id)
        .map((group) => ({
          kind: group.kind,
          status: group.status,
          runs: group.runs,
          averageSeconds: group.average_seconds,
        })),
      outcomes: Object.fromEntries(
        outcomes.filter((row) => row.source_id === source.id).map((row) => [row.outcome, row.requests]),
      ),
      recentRuns: runs
        .filter((run) => run.source_id === source.id)
        .map((run) => ({
          id: run.id,
          kind: run.kind,
          status: run.status,
          startedAt: run.started_at.toISOString(),
          seconds:
            run.finished_at === null ? null : (run.finished_at.getTime() - run.started_at.getTime()) / 1000,
          counts: numericCounts(run.counts),
        })),
    })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Source problems

export type ProblemFetch = {
  id: number;
  requestedAt: string;
  outcome: 'blocked' | 'rate_limited' | 'challenge';
  httpStatus: number | null;
  /** The address the refused request asked for: the evidence, with the run that sent it. */
  url: string;
  runKind: CrawlKind;
};

export type UnparsedValue = { field: string; rawText: string; listings: number };

export type SourceProblems = {
  id: string;
  nameFa: string;
  /** Set while the crawler holds the source stopped; resuming it is on the sources screen (CS-40). */
  stop: { stoppedAt: string; reason: StopReason } | null;
  cooldown: { until: string; reason: 'unavailable' | 'rate_limited' } | null;
  /** The lane's last 429: for 24 hours after it the gap stays doubled and another 429 stops the source. */
  rateLimitedAt: string | null;
  fetches: ProblemFetch[];
  unparsed: UnparsedValue[];
};

export type ProblemsData = { sources: SourceProblems[] };

const PROBLEM_OUTCOMES = ['blocked', 'rate_limited', 'challenge'] as const;

function isProblemOutcome(outcome: FetchOutcome): outcome is ProblemFetch['outcome'] {
  return (PROBLEM_OUTCOMES as readonly string[]).includes(outcome);
}

export async function loadProblems(): Promise<ProblemsData> {
  await requireSuperadmin();
  const database = readAdminDatabase();
  const [sources, fetches, unparsed] = await Promise.all([
    database
      .selectFrom('source')
      .leftJoin('crawl_lane', 'crawl_lane.source_id', 'source.id')
      .select([
        'source.id',
        'source.name_fa',
        'source.stopped_at',
        'source.stop_reason',
        'crawl_lane.cooldown_until',
        'crawl_lane.cooldown_reason',
        'crawl_lane.rate_limited_at',
      ])
      .where('source.access_method', '=', 'crawl')
      .orderBy('source.id')
      .execute(),
    // Refused requests are rare among the log's rows: fetch_log_refused_idx holds only them, newest first per source.
    // The outcomes are literals in the SQL text, so the planner matches the index's predicate.
    database
      .selectFrom('source')
      .innerJoinLateral(
        (eb) =>
          eb
            .selectFrom('fetch_log')
            .innerJoin('crawl_run', (join) =>
              join
                .onRef('crawl_run.id', '=', 'fetch_log.crawl_run_id')
                .onRef('crawl_run.source_id', '=', 'fetch_log.source_id'),
            )
            .select([
              'fetch_log.id',
              'fetch_log.source_id',
              'fetch_log.requested_at',
              'fetch_log.outcome',
              'fetch_log.http_status',
              'fetch_log.url',
              'crawl_run.kind',
            ])
            .whereRef('fetch_log.source_id', '=', 'source.id')
            .where(inLiterals('fetch_log.outcome', PROBLEM_OUTCOMES))
            .orderBy('fetch_log.requested_at', 'desc')
            .limit(RECENT_ROWS)
            .as('fetch'),
        (join) => join.onTrue(),
      )
      .select([
        'fetch.id',
        'fetch.source_id',
        'fetch.requested_at',
        'fetch.outcome',
        'fetch.http_status',
        'fetch.url',
        'fetch.kind',
      ])
      .where('source.access_method', '=', 'crawl')
      .orderBy('fetch.source_id')
      .orderBy('fetch.requested_at', 'desc')
      .execute(),
    // The values the parser could not read, most common first per source (CS-34): teach the parser, then re-derive.
    database
      .selectFrom('source')
      .innerJoinLateral(
        (eb) =>
          eb
            .selectFrom('listing_unparsed_value')
            .innerJoin('listing', 'listing.id', 'listing_unparsed_value.listing_id')
            .select((inner) => [
              'listing.source_id',
              'listing_unparsed_value.field',
              'listing_unparsed_value.raw_text',
              inner.fn.countAll<number>().as('listings'),
            ])
            .whereRef('listing.source_id', '=', 'source.id')
            .groupBy(['listing.source_id', 'listing_unparsed_value.field', 'listing_unparsed_value.raw_text'])
            .orderBy('listings', 'desc')
            .orderBy('listing_unparsed_value.field')
            .orderBy('listing_unparsed_value.raw_text')
            .limit(RECENT_ROWS)
            .as('unparsed'),
        (join) => join.onTrue(),
      )
      .select(['unparsed.source_id', 'unparsed.field', 'unparsed.raw_text', 'unparsed.listings'])
      .where('source.access_method', '=', 'crawl')
      .orderBy('unparsed.source_id')
      .orderBy('unparsed.listings', 'desc')
      .orderBy('unparsed.field')
      .orderBy('unparsed.raw_text')
      .execute(),
  ]);

  return {
    sources: sources.map((source) => ({
      id: source.id,
      nameFa: source.name_fa,
      stop:
        source.stopped_at !== null && source.stop_reason !== null
          ? { stoppedAt: source.stopped_at.toISOString(), reason: source.stop_reason }
          : null,
      cooldown:
        source.cooldown_until !== null && source.cooldown_reason !== null
          ? { until: source.cooldown_until.toISOString(), reason: source.cooldown_reason }
          : null,
      rateLimitedAt: source.rate_limited_at?.toISOString() ?? null,
      fetches: fetches
        .filter((row) => row.source_id === source.id)
        .flatMap((row) => (isProblemOutcome(row.outcome) ? [{ ...row, outcome: row.outcome }] : []))
        .map((row) => ({
          id: row.id,
          requestedAt: row.requested_at.toISOString(),
          outcome: row.outcome,
          httpStatus: row.http_status,
          url: row.url,
          runKind: row.kind,
        })),
      unparsed: unparsed
        .filter((row) => row.source_id === source.id)
        .map((row) => ({ field: row.field, rawText: row.raw_text, listings: row.listings })),
    })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The worker's heartbeat

/** A worker that has not beaten for this long is down (three missed beats of 15 s; the owner's decision). */
export const HEARTBEAT_SILENCE_SECONDS = 45;
/** How many of the latest worker processes the screen lists. */
export const RECENT_WORKERS = 5;

export type WorkerProcess = {
  instanceId: string;
  hostname: string;
  pid: number;
  version: string;
  startedAt: string;
  beatAt: string;
  stoppedAt: string | null;
  /** Running and beating within the silence: the database's clock decides. */
  alive: boolean;
};

export type WorkerData = {
  /** alive: a process beats; stopped: the latest one shut down cleanly; silent: it stopped beating; never: no row. */
  status: 'alive' | 'stopped' | 'silent' | 'never';
  /** The database's now(), which the times on the screen are measured against. */
  now: string;
  processes: WorkerProcess[];
};

export async function loadWorker(): Promise<WorkerData> {
  await requireSuperadmin();
  const database = readAdminDatabase();
  const rows = await database
    .selectFrom('worker_heartbeat')
    .select((eb) => [
      'instance_id',
      'hostname',
      'pid',
      'version',
      'started_at',
      'beat_at',
      'stopped_at',
      databaseNow().as('now'),
      eb
        .and([eb('stopped_at', 'is', null), eb('beat_at', '>', secondsAgo(HEARTBEAT_SILENCE_SECONDS))])
        .as('alive'),
    ])
    .orderBy('beat_at', 'desc')
    .limit(RECENT_WORKERS)
    .execute();
  const processes = rows.map((row) => ({
    instanceId: row.instance_id,
    hostname: row.hostname,
    pid: row.pid,
    version: row.version,
    startedAt: row.started_at.toISOString(),
    beatAt: row.beat_at.toISOString(),
    stoppedAt: row.stopped_at?.toISOString() ?? null,
    alive: row.alive === true,
  }));
  const [latest] = processes;
  const now = rows[0]?.now ?? new Date();
  return {
    status:
      latest === undefined
        ? 'never'
        : processes.some((process) => process.alive)
          ? 'alive'
          : latest.stoppedAt !== null
            ? 'stopped'
            : 'silent',
    now: now.toISOString(),
    processes,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Listings in and out, and freshness

export type ListingFlow = {
  /** Null for the whole source; otherwise a tracked model's key (with its trims). */
  modelKey: string | null;
  total: number;
  active: number;
  /** First stored in the window. */
  added: number;
  /** Given a price event in the window (the owner's decision: a changed listing is a re-priced one). */
  changed: number;
  /** Left the market (sold, expired, gone) in the window. */
  gone: number;
  /** The median time since an active listing was last seen or checked, in minutes; null without active listings. */
  lastCheckMedianMinutes: number | null;
};

export type FreshnessPoint = {
  measuredAt: string;
  /** Over the 24 hours before measuredAt (CS-35's hourly measurement). */
  added: number;
  gone: number;
  lastCheckMedianMinutes: number | null;
};

export type SourceListings = {
  id: string;
  nameFa: string;
  flows: ListingFlow[];
  chart: FreshnessPoint[];
};

export type ListingsData = { window: PipelineWindow; chartHours: number; sources: SourceListings[] };

/** The chart spans the window, but never less than a day: one hourly point is not a line. */
export function chartHoursOf(window: PipelineWindow): number {
  return Math.max(24, WINDOW_SECONDS[window] / 3_600);
}

export async function loadListings(window: PipelineWindow): Promise<ListingsData> {
  await requireSuperadmin();
  const database = readAdminDatabase();
  const since = secondsAgo(WINDOW_SECONDS[window]);
  const chartHours = chartHoursOf(window);
  const lastCheck = laterOf('listing.last_seen_at', 'listing.last_checked_at');
  const active = equalsLiteral('listing.status', 'active');

  const [sources, wholeSource, tracked, changedWhole, changedTracked, chart] = await Promise.all([
    database
      .selectFrom('source')
      .select(['id', 'name_fa'])
      .where('access_method', '=', 'crawl')
      .orderBy('id')
      .execute(),
    database
      .selectFrom('listing')
      .select((eb) => [
        'listing.source_id',
        eb.fn.countAll<number>().as('total'),
        eb.fn.countAll<number>().filterWhere(active).as('active'),
        eb.fn.countAll<number>().filterWhere('listing.created_at', '>', since).as('added'),
        eb.fn.countAll<number>().filterWhere('listing.delisted_at', '>', since).as('gone'),
        medianMinutesSince(lastCheck, active).as('last_check_median_minutes'),
      ])
      .groupBy('listing.source_id')
      .execute(),
    // Each tracked model with its trims: the keys of the source's latest freshness measurement (until CS-53).
    database
      .selectFrom('freshness_measurement as tracked')
      .innerJoin('listing', (join) =>
        join
          .onRef('listing.source_id', '=', 'tracked.source_id')
          .on(modelKeyOrTrim('listing.source_model_key', 'tracked.source_model_key')),
      )
      .select((eb) => [
        'tracked.source_id',
        'tracked.source_model_key',
        eb.fn.countAll<number>().as('total'),
        eb.fn.countAll<number>().filterWhere(active).as('active'),
        eb.fn.countAll<number>().filterWhere('listing.created_at', '>', since).as('added'),
        eb.fn.countAll<number>().filterWhere('listing.delisted_at', '>', since).as('gone'),
        medianMinutesSince(lastCheck, active).as('last_check_median_minutes'),
      ])
      .where('tracked.source_model_key', 'is not', null)
      .where('tracked.measured_at', '=', (eb) =>
        eb
          .selectFrom('freshness_measurement as latest')
          .select((inner) => inner.fn.max('latest.measured_at').as('measured_at'))
          .whereRef('latest.source_id', '=', 'tracked.source_id')
          .where('latest.source_model_key', 'is', null),
      )
      .groupBy(['tracked.source_id', 'tracked.source_model_key'])
      .execute(),
    database
      .selectFrom('listing_price_event')
      .innerJoin('listing', 'listing.id', 'listing_price_event.listing_id')
      .select((eb) => ['listing.source_id', eb.fn.count<number>('listing.id').distinct().as('changed')])
      .where('listing_price_event.recorded_at', '>', since)
      .groupBy('listing.source_id')
      .execute(),
    database
      .selectFrom('listing_price_event')
      .innerJoin('listing', 'listing.id', 'listing_price_event.listing_id')
      .innerJoin('freshness_measurement as tracked', (join) =>
        join
          .onRef('tracked.source_id', '=', 'listing.source_id')
          .on(modelKeyOrTrim('listing.source_model_key', 'tracked.source_model_key')),
      )
      .select((eb) => [
        'tracked.source_id',
        'tracked.source_model_key',
        eb.fn.count<number>('listing.id').distinct().as('changed'),
      ])
      .where('listing_price_event.recorded_at', '>', since)
      .where('tracked.source_model_key', 'is not', null)
      .where('tracked.measured_at', '=', (eb) =>
        eb
          .selectFrom('freshness_measurement as latest')
          .select((inner) => inner.fn.max('latest.measured_at').as('measured_at'))
          .whereRef('latest.source_id', '=', 'tracked.source_id')
          .where('latest.source_model_key', 'is', null),
      )
      .groupBy(['tracked.source_id', 'tracked.source_model_key'])
      .execute(),
    // The whole source's hourly measurements over the chart's span, on freshness_measurement_once_unique.
    database
      .selectFrom('freshness_measurement')
      .select(['source_id', 'measured_at', 'new_listings', 'left_market', 'last_seen_age_p50_minutes'])
      .where('source_model_key', 'is', null)
      .where('measured_at', '>', secondsAgo(chartHours * 3_600))
      .orderBy('source_id')
      .orderBy('measured_at')
      .execute(),
  ]);

  const flowOf = (
    row: {
      total: number;
      active: number;
      added: number;
      gone: number;
      last_check_median_minutes: number | null;
    },
    modelKey: string | null,
    changed: number,
  ): ListingFlow => ({
    modelKey,
    total: row.total,
    active: row.active,
    added: row.added,
    changed,
    gone: row.gone,
    lastCheckMedianMinutes: row.last_check_median_minutes,
  });

  return {
    window,
    chartHours,
    sources: sources.map((source) => {
      const whole = wholeSource.find((row) => row.source_id === source.id);
      const models = tracked
        .filter((row) => row.source_id === source.id)
        .sort(
          (a, b) =>
            b.active - a.active || String(a.source_model_key).localeCompare(String(b.source_model_key)),
        );
      return {
        id: source.id,
        nameFa: source.name_fa,
        flows: [
          flowOf(
            whole ?? { total: 0, active: 0, added: 0, gone: 0, last_check_median_minutes: null },
            null,
            changedWhole.find((row) => row.source_id === source.id)?.changed ?? 0,
          ),
          ...models.map((row) =>
            flowOf(
              row,
              row.source_model_key,
              changedTracked.find(
                (changed) =>
                  changed.source_id === source.id && changed.source_model_key === row.source_model_key,
              )?.changed ?? 0,
            ),
          ),
        ],
        chart: chart
          .filter((row) => row.source_id === source.id)
          .map((row) => ({
            measuredAt: row.measured_at.toISOString(),
            added: row.new_listings,
            gone: row.left_market,
            lastCheckMedianMinutes: row.last_seen_age_p50_minutes,
          })),
      };
    }),
  };
}
