import { sql, type Kysely } from 'kysely';
import { constraintViolation } from '@carshenas/db/database-errors';
import type { DB } from '@carshenas/db/db-types';

// The crawl's own records (ADR-0008, ADR-0017, ADR-0018; docs/design/data-model.md, section 3): a crawl run for each
// lane job that sends a request, every request in fetch_log, how far discovery has read each feed, and the listing
// counts a sweep takes. The database decides which run may open and how a block ends one (crawl_run_policy_guard,
// crawl_run_history_fixed, fetch_log_stops_on_block); these functions only write, and turn its refusals into results.

export type CrawlKind = 'discovery' | 'detail' | 'measure';

/** What a run did, by name: rows read, new listings, snapshots stored, and so on. */
export type RunCounts = Readonly<Record<string, number>>;

export type OpenedRun =
  | { readonly status: 'opened'; readonly runId: number }
  | { readonly status: 'refused'; readonly reason: 'source_not_enabled' | 'policy_out_of_date' };

const POLICY_REFUSALS: ReadonlySet<string> = new Set([
  'crawl_run_policy_current',
  'crawl_run_policy_allows',
  'crawl_run_policy_fresh',
]);

/**
 * Opens the crawl run of a lane job about to send a request, citing its source's newest policy check. A lane runs one
 * job of its source at a time, so a run of the source still running here was left by a job that crashed: it is closed
 * as failed first. The database refuses a source that is not enabled, and a policy check that is not current, allowed
 * and fresh; both come back as a refusal.
 */
export async function openCrawlRun(db: Kysely<DB>, sourceId: string, kind: CrawlKind): Promise<OpenedRun> {
  try {
    const runId = await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('crawl_run')
        .set({
          status: 'failed',
          finished_at: sql<Date>`greatest(now(), started_at)`,
          counts: sql`counts || '{"abandoned": 1}'::jsonb`,
        })
        .where('source_id', '=', sourceId)
        // A literal, so the planner can use crawl_run_running_per_source_unique, whose predicate it is.
        .where('status', '=', sql.lit('running'))
        .execute();
      const policy = await trx
        .selectFrom('source_current_policy')
        .select('id')
        .where('source_id', '=', sourceId)
        .executeTakeFirst();
      if (policy?.id == null) return undefined;
      const run = await trx
        .insertInto('crawl_run')
        .values({ source_id: sourceId, policy_check_id: policy.id, kind })
        .returning('id')
        .executeTakeFirstOrThrow();
      return run.id;
    });
    return runId === undefined
      ? { status: 'refused', reason: 'policy_out_of_date' }
      : { status: 'opened', runId };
  } catch (error) {
    const violation = constraintViolation(error);
    if (violation && 'constraint' in violation) {
      if (violation.constraint === 'crawl_run_source_enabled') {
        return { status: 'refused', reason: 'source_not_enabled' };
      }
      if (POLICY_REFUSALS.has(violation.constraint))
        return { status: 'refused', reason: 'policy_out_of_date' };
    }
    throw error;
  }
}

/**
 * Closes a run with what it did. A run the database already ended (stopped_on_block, by the request that stopped its
 * source) keeps that status and time and only gains its counts.
 */
export async function closeCrawlRun(
  db: Kysely<DB>,
  runId: number,
  status: 'succeeded' | 'failed',
  counts: RunCounts,
): Promise<void> {
  await db
    .updateTable('crawl_run')
    .set((eb) => ({
      counts: { ...counts },
      status: eb.case().when('status', '=', 'running').then(status).else(eb.ref('status')).end(),
      finished_at: eb
        .case()
        .when('status', '=', 'running')
        .then(sql<Date>`greatest(now(), started_at)`)
        .else(eb.ref('finished_at'))
        .end(),
    }))
    .where('id', '=', runId)
    .execute();
}

export type FetchOutcome = 'ok' | 'not_found' | 'gone' | 'blocked' | 'rate_limited' | 'challenge' | 'error';

export type LoggedFetch = {
  readonly sourceId: string;
  readonly runId: number;
  readonly url: string;
  readonly method: 'http_get' | 'http_post';
  /** When the lane let the request start: for a refused one, the instant its source was stopped at. */
  readonly requestedAt: Date;
  readonly durationMs: number;
  readonly httpStatus: number | undefined;
  readonly outcome: FetchOutcome;
  readonly listingId?: number;
  readonly snapshotId?: number;
};

/**
 * Logs one request the crawler sent, whatever came back (append-only), once: a request logged already, by the
 * transaction a failed step committed after all, keeps its row (fetch_log_request_unique).
 */
export async function logFetch(db: Kysely<DB>, fetch: LoggedFetch): Promise<void> {
  await db
    .insertInto('fetch_log')
    .values({
      source_id: fetch.sourceId,
      crawl_run_id: fetch.runId,
      url: fetch.url,
      method: fetch.method,
      requested_at: fetch.requestedAt,
      duration_ms: fetch.durationMs,
      http_status: fetch.httpStatus ?? null,
      outcome: fetch.outcome,
      listing_id: fetch.listingId ?? null,
      snapshot_id: fetch.snapshotId ?? null,
    })
    .onConflict((conflict) => conflict.constraint('fetch_log_request_unique').doNothing())
    .execute();
}

export type FeedRound = {
  /** The newest sort time, by the source's clock, down from which the last finished round read the feed. */
  readonly readThroughAt: Date | null;
  /** When this round started, by the database's clock. */
  readonly startedAt: Date;
};

/**
 * Starts a round of a discovery feed, unless one started less than `minimumGapMinutes` ago (a schedule that queued up
 * while the lane was closed must not read the feed again and again); undefined then.
 */
export async function startFeedRound(
  db: Kysely<DB>,
  sourceId: string,
  feedKey: string,
  minimumGapMinutes: number,
): Promise<FeedRound | undefined> {
  await db
    .insertInto('crawl_feed')
    .values({ source_id: sourceId, feed_key: feedKey })
    .onConflict((conflict) => conflict.constraint('crawl_feed_pkey').doNothing())
    .execute();
  const row = await db
    .updateTable('crawl_feed')
    .set({ round_started_at: sql<Date>`clock_timestamp()` })
    .where('source_id', '=', sourceId)
    .where('feed_key', '=', feedKey)
    .where((eb) =>
      eb.or([
        eb('round_started_at', 'is', null),
        eb(
          'round_started_at',
          '<=',
          sql<Date>`clock_timestamp() - make_interval(mins => ${minimumGapMinutes})`,
        ),
      ]),
    )
    .returning(['read_through_at', 'round_started_at'])
    .executeTakeFirst();
  if (!row?.round_started_at) return undefined;
  return { readThroughAt: row.read_through_at, startedAt: row.round_started_at };
}

/** Records that a round read the feed down from `readThroughAt`; the mark never moves back. */
export async function finishFeedRound(
  db: Kysely<DB>,
  sourceId: string,
  feedKey: string,
  readThroughAt: Date,
): Promise<void> {
  await db
    .updateTable('crawl_feed')
    .set({
      read_through_at: sql<Date>`greatest(coalesce(read_through_at, ${readThroughAt}), ${readThroughAt})`,
    })
    .where('source_id', '=', sourceId)
    .where('feed_key', '=', feedKey)
    .execute();
}

export type ModelVolume = {
  readonly sourceId: string;
  /** The source's own filter value: Divar's brand_model, ROOT for every car. */
  readonly sourceModelKey: string;
  readonly level: 'all' | 'brand' | 'model' | 'trim';
  readonly sweptAt: Date;
  readonly activeCount: number;
  readonly pagesRead: number;
  readonly complete: boolean;
};

/** Records one slice's count in a sweep, once: a job that runs twice cannot count it twice. */
export async function recordModelVolume(db: Kysely<DB>, volume: ModelVolume): Promise<void> {
  await db
    .insertInto('model_volume')
    .values({
      source_id: volume.sourceId,
      source_model_key: volume.sourceModelKey,
      level: volume.level,
      swept_at: volume.sweptAt,
      active_count: volume.activeCount,
      pages_read: volume.pagesRead,
      complete: volume.complete,
    })
    .onConflict((conflict) => conflict.constraint('model_volume_sweep_unique').doNothing())
    .execute();
}
