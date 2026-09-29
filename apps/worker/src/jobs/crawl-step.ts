import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import {
  closeCrawlRun,
  logFetch,
  openCrawlRun,
  type CrawlKind,
  type FetchOutcome,
} from '../db/crawl-store.ts';
import {
  LaneClosedError,
  SourceBlockedError,
  SourceThrottledError,
  SourceUnavailableError,
  type SourceRequest,
} from '../runtime/errors.ts';
import { AnswerTooLargeError, type SourceFetchInit, type SourceResponse } from '../runtime/http.ts';
import type { LaneJobContext } from '../runtime/job.ts';

// One lane job's crawl run (ADR-0008 point 1, ADR-0018; docs/design/data-model.md, "crawl_run"). The run is opened
// before the request, citing the source's newest policy check, so a source that is not enabled or whose robots.txt and
// terms were not read recently enough sends nothing. Every request the job sends is logged in fetch_log, whatever came
// back: an answer with the rows it wrote, in their transaction; a refusal or a failure on its own, with the instant the
// lane let it start, which for a refused request is the instant its source was stopped at, its evidence. The run closes
// with what the job counted (CS-33 criterion 4).

export type CrawlRequest = {
  readonly method: 'GET' | 'POST';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly detectBlock?: SourceFetchInit['detectBlock'];
};

export type CrawlRun = {
  readonly runId: number;
  /** Adds to the run's counts and to the job's completion line. */
  count(name: string, by?: number): void;
  /**
   * Sends one request through the lane. A refusal or a failure is logged as this run's request before its error goes
   * on to the runtime; an answer comes back to be logged with what it led to (logAnswer).
   */
  fetch(url: string, request: CrawlRequest): Promise<SourceResponse>;
  /** Logs the answer fetch returned, in the transaction that writes what it said. */
  logAnswer(
    db: Kysely<DB>,
    answer: SourceResponse,
    outcome: FetchOutcome,
    links?: { readonly listingId?: number | undefined; readonly snapshotId?: number | undefined },
  ): Promise<void>;
  /** Closes the run as succeeded, in the transaction that writes its work. */
  succeed(db: Kysely<DB>): Promise<void>;
};

const METHOD = { GET: 'http_get', POST: 'http_post' } as const satisfies Record<
  CrawlRequest['method'],
  string
>;

type Refusal = { readonly request: SourceRequest; readonly outcome: FetchOutcome; readonly status?: number };

/** What a request that did not bring back a usable answer logs, when it was sent at all. */
function refusalOf(error: unknown): Refusal | undefined {
  if (error instanceof SourceBlockedError && error.request) {
    return { request: error.request, outcome: error.reason, status: error.status };
  }
  if (error instanceof SourceThrottledError && error.request) {
    return { request: error.request, outcome: 'rate_limited', status: 429 };
  }
  if (error instanceof SourceUnavailableError && error.request) {
    return { request: error.request, outcome: 'error', status: error.status };
  }
  if (error instanceof AnswerTooLargeError && error.request) {
    return { request: error.request, outcome: 'error' };
  }
  return undefined;
}

/**
 * Runs `step` as one crawl run of `kind` in the job's lane. A source that is not enabled, or whose policy check is out of
 * date, puts the job back without a request: its lane stops claiming until a person acts.
 */
export async function crawlStep(
  context: LaneJobContext,
  kind: CrawlKind,
  step: (run: CrawlRun) => Promise<void>,
): Promise<void> {
  const sourceId = context.lane.sourceId;
  const opened = await openCrawlRun(context.db, sourceId, kind);
  if (opened.status === 'refused') {
    throw new LaneClosedError(
      opened.reason === 'source_not_enabled'
        ? 'the source is not enabled'
        : "the source's robots.txt and terms must be read again before it is crawled",
      { closure: opened.reason === 'source_not_enabled' ? 'paused' : 'policy_expired' },
    );
  }
  const { runId } = opened;
  const counts: Record<string, number> = {};
  // What the step has done so far, which its closures change: the answer fetch returned that is not logged yet (and
  // how it was asked for), and whether the run was closed with the step's work.
  const progress: {
    unlogged: { answer: SourceResponse; method: CrawlRequest['method'] } | undefined;
    succeeded: boolean;
  } = { unlogged: undefined, succeeded: false };

  const log = (
    db: Kysely<DB>,
    answer: SourceRequest & { status?: number },
    method: CrawlRequest['method'],
    outcome: FetchOutcome,
    links: { listingId?: number | undefined; snapshotId?: number | undefined } = {},
  ) =>
    logFetch(db, {
      sourceId,
      runId,
      url: answer.url,
      method: METHOD[method],
      requestedAt: answer.startedAt,
      durationMs: answer.durationMs,
      httpStatus: answer.status,
      outcome,
      ...(links.listingId !== undefined && { listingId: links.listingId }),
      ...(links.snapshotId !== undefined && { snapshotId: links.snapshotId }),
    });

  const run: CrawlRun = {
    runId,
    count(name, by = 1) {
      counts[name] = (counts[name] ?? 0) + by;
      context.count(name, by);
    },
    async fetch(url, request) {
      try {
        const answer = await context.fetch(url, {
          method: request.method,
          ...(request.headers && { headers: request.headers }),
          ...(request.body !== undefined && { body: request.body }),
          ...(request.detectBlock && { detectBlock: request.detectBlock }),
        });
        progress.unlogged = { answer, method: request.method };
        return answer;
      } catch (error) {
        const refusal = refusalOf(error);
        if (refusal) {
          try {
            await log(
              context.db,
              { ...refusal.request, status: refusal.status },
              request.method,
              refusal.outcome,
            );
          } catch (logError) {
            // The refusal is what the job reports; a request that could not be logged is only noted beside it.
            context.log.warn('refused request could not be logged', {
              err: logError,
              outcome: refusal.outcome,
            });
          }
        }
        throw error;
      }
    },
    async logAnswer(db, answer, outcome, links = {}) {
      await log(db, { ...answer, status: answer.status }, progress.unlogged?.method ?? 'GET', outcome, links);
      progress.unlogged = undefined;
    },
    async succeed(db) {
      await closeCrawlRun(db, runId, 'succeeded', counts);
      progress.succeeded = true;
    },
  };

  try {
    await step(run);
    if (progress.unlogged) await run.logAnswer(context.db, progress.unlogged.answer, 'ok');
    if (!progress.succeeded) await closeCrawlRun(context.db, runId, 'succeeded', counts);
  } catch (error) {
    try {
      // An answer the job could not use is still a request it sent.
      const { unlogged } = progress;
      if (unlogged) {
        await log(
          context.db,
          { ...unlogged.answer, status: unlogged.answer.status },
          unlogged.method,
          'error',
        );
      }
      if (error instanceof LaneClosedError) run.count('notSent');
      await closeCrawlRun(context.db, runId, 'failed', counts);
    } catch (closeError) {
      context.log.warn('crawl run could not be closed', { err: closeError, runId });
    }
    throw error;
  }
}
