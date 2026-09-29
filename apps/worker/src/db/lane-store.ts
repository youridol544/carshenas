import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { StopReason } from '../runtime/errors.ts';
import type { LaneSnapshot, LaneUpdate } from '../runtime/pacing.ts';

// The SQL of the lanes (ADR-0018; table crawl_lane, docs/design/data-model.md). Every time comes from the database's
// clock_timestamp(), never from a worker's clock, so two processes on two machines agree on whose turn it is.

export type CrawlState = 'enabled' | 'paused' | 'stopped_on_block';

/** A lane as it was when a worker tried to take its lease. */
export type LaneState = LaneSnapshot & {
  readonly sourceId: string;
  readonly crawlState: CrawlState;
  readonly nextRequestAt: Date;
  readonly cooldownUntil: Date | null;
  readonly cooldownReason: 'unavailable' | 'rate_limited' | null;
  readonly leaseHolder: string | null;
  readonly leaseUntil: Date | null;
};

type LaneRow = {
  source_id: string;
  crawl_state: CrawlState;
  min_request_interval_ms: number | null;
  next_request_at: Date;
  cooldown_until: Date | null;
  cooldown_reason: 'unavailable' | 'rate_limited' | null;
  lease_holder: string | null;
  lease_until: Date | null;
  rate_limited_at: Date | null;
  failure_streak: number;
  cooldowns: number;
  now: Date;
};

// A crawled source always has an interval (source_crawl_interval_floor); another source never runs (it stays paused).
const NO_INTERVAL_MS = 3_000;

function stateOf(row: LaneRow): LaneState {
  return {
    sourceId: row.source_id,
    crawlState: row.crawl_state,
    minIntervalMs: row.min_request_interval_ms ?? NO_INTERVAL_MS,
    nextRequestAt: row.next_request_at,
    cooldownUntil: row.cooldown_until,
    cooldownReason: row.cooldown_reason,
    leaseHolder: row.lease_holder,
    leaseUntil: row.lease_until,
    rateLimitedAt: row.rate_limited_at,
    failureStreak: row.failure_streak,
    cooldowns: row.cooldowns,
    now: row.now,
  };
}

/** Gives a source its lane, if it has none yet. */
export async function ensureLane(db: Kysely<DB>, sourceId: string): Promise<void> {
  await db
    .insertInto('crawl_lane')
    .values({ source_id: sourceId })
    .onConflict((conflict) => conflict.constraint('crawl_lane_pkey').doNothing())
    .execute();
}

/**
 * Takes the lane's lease for one request, in one statement, only while the source is enabled, the lane is not
 * cooling down, its next request time has come and no unexpired lease is held; the lane's row is locked meanwhile,
 * so two workers can never both take it. Returns whether it was taken and the lane as it was, which says why not;
 * undefined when the source has no lane.
 */
export async function acquireLane(
  db: Kysely<DB>,
  sourceId: string,
  holder: string,
  leaseMs: number,
): Promise<{ acquired: boolean; state: LaneState } | undefined> {
  const { rows } = await sql<LaneRow & { acquired: boolean }>`
    WITH lane AS (
      SELECT l.source_id, s.crawl_state, s.min_request_interval_ms, l.next_request_at, l.cooldown_until,
             l.cooldown_reason, l.lease_holder, l.lease_until, l.rate_limited_at, l.failure_streak, l.cooldowns,
             clock_timestamp() AS now
      FROM crawl_lane l
      JOIN source s ON s.id = l.source_id
      WHERE l.source_id = ${sourceId}
      FOR NO KEY UPDATE OF l
    ),
    taken AS (
      UPDATE crawl_lane l
      SET lease_holder = ${holder},
          lease_until = lane.now + make_interval(secs => ${leaseMs}::double precision / 1000),
          last_request_at = lane.now
      FROM lane
      WHERE l.source_id = lane.source_id
        AND lane.crawl_state = 'enabled'
        AND (lane.cooldown_until IS NULL OR lane.cooldown_until <= lane.now)
        AND lane.next_request_at <= lane.now
        AND (lane.lease_until IS NULL OR lane.lease_until <= lane.now)
      RETURNING l.source_id
    )
    SELECT lane.*, EXISTS (SELECT FROM taken) AS acquired
    FROM lane`.execute(db);
  const [row] = rows;
  return row && { acquired: row.acquired, state: stateOf(row) };
}

/**
 * Gives the lease back with what the source answered: the next request time is the end of this request plus its
 * gap, and the breaker and the 429 record move as `update` says. Returns the lane's new times, or undefined when
 * the lease had lapsed and another worker holds the lane (nothing is changed then).
 */
export async function releaseLane(
  db: Kysely<DB>,
  sourceId: string,
  holder: string,
  update: LaneUpdate,
): Promise<{ nextRequestAt: Date; cooldownUntil: Date | null } | undefined> {
  const cooldownUntil = update.cooldown
    ? sql`t.now + make_interval(secs => ${update.cooldown.ms}::double precision / 1000)`
    : sql`NULL`;
  const { rows } = await sql<{ next_request_at: Date; cooldown_until: Date | null }>`
    UPDATE crawl_lane l
    SET lease_holder = NULL,
        lease_until = NULL,
        next_request_at = t.now + make_interval(secs => ${update.gapMs}::double precision / 1000),
        failure_streak = ${update.failureStreak},
        cooldowns = ${update.cooldowns},
        cooldown_until = ${cooldownUntil},
        cooldown_reason = ${update.cooldown?.reason ?? null},
        rate_limited_at = CASE WHEN ${update.throttled} THEN t.now ELSE l.rate_limited_at END
    FROM (SELECT clock_timestamp() AS now) t
    WHERE l.source_id = ${sourceId} AND l.lease_holder = ${holder}
    RETURNING l.next_request_at, l.cooldown_until`.execute(db);
  const [row] = rows;
  return row && { nextRequestAt: row.next_request_at, cooldownUntil: row.cooldown_until };
}

/** Stops an enabled source on a block (stop_source(), the only change to a source the worker's role may make). */
export async function stopSource(
  db: Kysely<DB>,
  sourceId: string,
  reason: StopReason,
  blockedRequestAt: Date,
): Promise<boolean> {
  const { rows } = await sql<{ stopped: boolean }>`
    SELECT stop_source(${sourceId}, ${reason}, ${blockedRequestAt}) AS stopped`.execute(db);
  return rows[0]?.stopped === true;
}

/** A crawled source and its lane, for the lane supervisor and the health check. */
export type SourceLane = {
  readonly sourceId: string;
  readonly crawlState: CrawlState;
  readonly nextRequestAt: Date | null;
  readonly cooldownUntil: Date | null;
  readonly cooldownReason: 'unavailable' | 'rate_limited' | null;
  readonly rateLimitedAt: Date | null;
  /**
   * Whether the source's newest policy check is missing, not_allowed, or older than its policy_max_age_days: a crawl
   * run would be refused (crawl_run_policy_guard), so the lane claims nothing until a person records a new reading.
   */
  readonly policyExpired: boolean;
  readonly now: Date;
};

export async function readSourceLanes(db: Kysely<DB>): Promise<SourceLane[]> {
  const rows = await db
    .selectFrom('source as s')
    .leftJoin('crawl_lane as l', 'l.source_id', 's.id')
    .select([
      's.id as sourceId',
      's.crawl_state as crawlState',
      'l.next_request_at as nextRequestAt',
      'l.cooldown_until as cooldownUntil',
      'l.cooldown_reason as cooldownReason',
      'l.rate_limited_at as rateLimitedAt',
    ])
    .select(sql<Date>`clock_timestamp()`.as('now'))
    .select(
      sql<boolean>`NOT EXISTS (
        SELECT FROM source_current_policy p
        WHERE p.source_id = s.id AND p.verdict <> 'not_allowed'
          AND p.checked_at >= clock_timestamp() - make_interval(days => s.policy_max_age_days))`.as(
        'policyExpired',
      ),
    )
    .where('s.access_method', '=', 'crawl')
    .orderBy('s.id')
    .execute();
  return rows;
}
