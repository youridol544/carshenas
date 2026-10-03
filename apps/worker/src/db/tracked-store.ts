import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { TrackedModel, TrackedModelsSource, TrackedPriority } from '../sources/divar/tracked-models.ts';

// The models the superadmin chose to read in depth (CS-53, ADR-0037; table tracked_model), as a source's jobs see them,
// and the backfill's reads: the listings of a tracked model that sweeps have seen and whose own page was never read.

const RANK: Record<TrackedPriority, number> = { high: 0, normal: 1, low: 2 };

/**
 * The tracked models in state tracking, as the source's own keys: a model through its model-level key, a trim through
 * its trim key (catalogue_source_key), the high priority first and then the oldest. A model the source has no key for
 * is left out: nothing can be asked of it. A paused model is not here, so it is neither swept nor backfilled.
 */
export async function loadTrackedModels(db: Kysely<DB>, sourceId: string): Promise<TrackedModel[]> {
  const { rows } = await sql<{
    id: number;
    model_id: number;
    trim_id: number | null;
    priority: TrackedPriority;
    source_model_key: string;
    name_fa: string | null;
    name_en: string;
  }>`
    SELECT t.id, t.model_id, t.trim_id, t.priority, k.source_model_key, m.name_fa, m.name_en
    FROM tracked_model t
    JOIN model m ON m.id = t.model_id
    JOIN catalogue_source_key k
      ON k.source_id = ${sourceId} AND k.model_id = t.model_id
         AND (CASE WHEN t.trim_id IS NULL THEN k.level = 'model' ELSE k.trim_id = t.trim_id END)
    WHERE t.state = 'tracking'`.execute(db);
  const ordered = [...rows].sort(
    (a, b) =>
      RANK[a.priority] - RANK[b.priority] ||
      a.id - b.id ||
      a.source_model_key.localeCompare(b.source_model_key),
  );
  const seen = new Set<string>();
  const tracked: TrackedModel[] = [];
  for (const row of ordered) {
    if (seen.has(row.source_model_key)) continue;
    seen.add(row.source_model_key);
    tracked.push({
      brandModel: row.source_model_key,
      nameFa: row.name_fa ?? row.name_en,
      modelId: row.model_id,
      trimId: row.trim_id,
      priority: row.priority,
    });
  }
  return tracked;
}

/** The models a job reads now: its fixed list, or the table. */
export async function resolveTracked(
  source: TrackedModelsSource,
  db: Kysely<DB>,
): Promise<readonly TrackedModel[]> {
  return typeof source === 'function' ? source(db) : source;
}

export type BackfillCandidate = { readonly key: string; readonly listingId: number };

/** A listing whose job started this many times and still failed is left alone (pg-boss retries a failed job three times). */
export const BACKFILL_ATTEMPT_CAP = 4;
/** A planned job older than this that never finished is taken as lost, and its listing may be planned again. */
const STALE_AFTER = sql`interval '2 days'`;

/** One planner at a time per source, even when two workers run the job: the lock is held until the transaction ends. */
export async function lockPlanner(db: Kysely<DB>, sourceId: string): Promise<void> {
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`tracked_backfill:${sourceId}`}, 0))`.execute(db);
}

/** How many planned jobs are in flight: waiting, running or being retried, not given up and not lost. */
export async function plannedInFlight(db: Kysely<DB>): Promise<number> {
  const { rows } = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM tracked_backfill b
    WHERE b.queued_at > now() - ${STALE_AFTER} AND b.attempts < ${BACKFILL_ATTEMPT_CAP}`.execute(db);
  return rows[0]?.n ?? 0;
}

/**
 * The active listings of a tracked model whose own page was never read, newest first (by the source's posting time),
 * leaving out those the planner has in flight or gave up on. Reads the catalogue's own link (model_id, trim_id), so a
 * listing the catalogue has not matched yet waits for its match.
 */
export async function backfillCandidates(
  db: Kysely<DB>,
  sourceId: string,
  scope: { readonly modelId: number; readonly trimId: number | null },
  limit: number,
): Promise<BackfillCandidate[]> {
  if (limit <= 0) return [];
  const { rows } = await sql<{ id: number; source_listing_key: string }>`
    SELECT l.id, l.source_listing_key
    FROM listing l
    LEFT JOIN tracked_backfill b ON b.listing_id = l.id
    WHERE l.source_id = ${sourceId} AND l.model_id = ${scope.modelId}
      AND (${scope.trimId}::bigint IS NULL OR l.trim_id = ${scope.trimId}::bigint)
      AND l.status = 'active' AND l.last_checked_at IS NULL AND l.source_listing_key IS NOT NULL
      AND (b.listing_id IS NULL OR (b.queued_at <= now() - ${STALE_AFTER} AND b.attempts < ${BACKFILL_ATTEMPT_CAP}))
    ORDER BY l.listed_at DESC, l.id DESC
    LIMIT ${limit}`.execute(db);
  return rows.map((row) => ({ key: row.source_listing_key, listingId: row.id }));
}

/** Records the listings whose jobs the planner is sending (a stale row of a lost job is renewed, its attempts kept). */
export async function recordPlanned(db: Kysely<DB>, listingIds: readonly number[]): Promise<void> {
  if (listingIds.length === 0) return;
  await sql`
    INSERT INTO tracked_backfill (listing_id)
    SELECT unnest(${[...listingIds]}::bigint[])
    ON CONFLICT ON CONSTRAINT tracked_backfill_pkey DO UPDATE SET queued_at = now()`.execute(db);
}

export type ListingToBackfill = {
  readonly id: number;
  readonly status: string;
  readonly lastCheckedAt: Date | null;
  readonly modelKey: string | null;
};

/** What a backfill job needs to know before it sends a request: the listing as stored, or undefined when it is not. */
export async function listingToBackfill(
  db: Kysely<DB>,
  sourceId: string,
  token: string,
): Promise<ListingToBackfill | undefined> {
  const { rows } = await sql<{
    id: number;
    status: string;
    last_checked_at: Date | null;
    source_model_key: string | null;
  }>`
    SELECT l.id, l.status, l.last_checked_at, l.source_model_key
    FROM listing l WHERE l.source_id = ${sourceId} AND l.source_listing_key = ${token}`.execute(db);
  const row = rows[0];
  return row === undefined
    ? undefined
    : { id: row.id, status: row.status, lastCheckedAt: row.last_checked_at, modelKey: row.source_model_key };
}

/** A planned job starts: one more attempt (its row is left by a failure, which is how a poison listing is remembered). */
export async function startPlannedAttempt(db: Kysely<DB>, listingId: number): Promise<void> {
  await sql`UPDATE tracked_backfill SET attempts = attempts + 1, last_attempt_at = now() WHERE listing_id = ${listingId}`.execute(
    db,
  );
}

/** A planned job is done, whether it read the page or found there was nothing to read: its row goes. */
export async function finishPlanned(db: Kysely<DB>, listingId: number): Promise<void> {
  await sql`DELETE FROM tracked_backfill WHERE listing_id = ${listingId}`.execute(db);
}

/** Marks approved crawl requests fulfilled when their model is tracked and has been read (fulfil_crawl_requests()). */
export async function fulfilCrawlRequests(db: Kysely<DB>): Promise<number> {
  const { rows } = await sql<{ fulfilled: number }>`SELECT fulfil_crawl_requests() AS fulfilled`.execute(db);
  return rows[0]?.fulfilled ?? 0;
}
