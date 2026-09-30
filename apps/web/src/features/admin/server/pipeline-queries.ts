import 'server-only';
import type { StopReason } from '@/features/admin/admin-types';
import { requireSuperadmin } from '@/server/auth/current-account';
import { readAdminDatabase } from '@/server/db/admin-database';
import type { JobState } from '@/server/db/pgboss-types';
import { averageSecondsBetween, secondsAgo, tehranToday } from '@/server/db/sql-helpers';

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
  /** The job's kind from its envelope (crawl.divar-listing …), when it has one. */
  kind: string | null;
  /** Attempts made, of those allowed. */
  attempts: number;
  attemptsAllowed: number;
  /** Null only if pg-boss left the time out. */
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

export type JobsData = { queues: QueueStates[]; failures: FailedJob[]; deadLetters: DeadLetter[] };

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
  const [counts, failures, deadLetters] = await Promise.all([
    // Every job pg-boss still keeps, by queue and state: one pass over the job table (CS-41's notes).
    database
      .selectFrom('pgboss.job')
      .select((eb) => ['name', 'state', eb.fn.countAll<number>().as('jobs')])
      .groupBy(['name', 'state'])
      .orderBy('name')
      .execute(),
    database
      .selectFrom('pgboss.job')
      .select(['id', 'name', 'data', 'retry_count', 'retry_limit', 'completed_on', 'output'])
      .where('state', '=', 'failed')
      .where('name', '<>', 'dead-letter')
      .orderBy('completed_on', 'desc')
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
      kind: stringField(job.data, 'kind'),
      attempts: job.retry_count + 1,
      attemptsAllowed: job.retry_limit + 1,
      failedAt: job.completed_on?.toISOString() ?? null,
      error: jobError(job.output),
    })),
    deadLetters: deadLetters.map((job) => ({
      id: job.id,
      fromQueue: job.source_name,
      kind: stringField(job.data, 'kind'),
      deadLetteredAt: job.created_on.toISOString(),
      error: jobError(job.source_output),
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
    // Refused requests are rare: newest first over fetch_log_source_requested_idx until twenty are found per source.
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
            .where('fetch_log.outcome', 'in', PROBLEM_OUTCOMES)
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
    // The values the parser could not read, most common first (CS-34): teach the parser, then re-derive.
    database
      .selectFrom('listing_unparsed_value')
      .innerJoin('listing', 'listing.id', 'listing_unparsed_value.listing_id')
      .select((eb) => [
        'listing.source_id',
        'listing_unparsed_value.field',
        'listing_unparsed_value.raw_text',
        eb.fn.countAll<number>().as('listings'),
      ])
      .groupBy(['listing.source_id', 'listing_unparsed_value.field', 'listing_unparsed_value.raw_text'])
      .orderBy('listings', 'desc')
      .orderBy('listing_unparsed_value.field')
      .orderBy('listing_unparsed_value.raw_text')
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
        .slice(0, RECENT_ROWS)
        .map((row) => ({ field: row.field, rawText: row.raw_text, listings: row.listings })),
    })),
  };
}
