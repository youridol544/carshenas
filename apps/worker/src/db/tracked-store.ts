import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { laneQueue } from '../runtime/queues.ts';
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

export type BackfillCandidate = { readonly key: string };

/**
 * The active listings of a tracked model whose own page was never read, newest first (by the source's posting time),
 * leaving out the tokens already queued. Reads the catalogue's own link (model_id, trim_id), so a listing the catalogue
 * has not matched yet waits for its match.
 */
export async function backfillCandidates(
  db: Kysely<DB>,
  sourceId: string,
  scope: { readonly modelId: number; readonly trimId: number | null },
  queued: readonly string[],
  limit: number,
): Promise<BackfillCandidate[]> {
  if (limit <= 0) return [];
  const { rows } = await sql<{ source_listing_key: string }>`
    SELECT l.source_listing_key
    FROM listing l
    WHERE l.source_id = ${sourceId} AND l.model_id = ${scope.modelId}
      AND (${scope.trimId}::bigint IS NULL OR l.trim_id = ${scope.trimId}::bigint)
      AND l.status = 'active' AND l.last_checked_at IS NULL AND l.source_listing_key IS NOT NULL
      AND l.source_listing_key <> ALL(${[...queued]}::text[])
    ORDER BY l.listed_at DESC, l.id DESC
    LIMIT ${limit}`.execute(db);
  return rows.map((row) => ({ key: row.source_listing_key }));
}

/** The tokens of a lane's backfill jobs that wait in the queue (or wait to be retried): what the planner must not send twice. */
export async function queuedBackfillTokens(
  db: Kysely<DB>,
  sourceId: string,
  kind: string,
): Promise<string[]> {
  const queue = laneQueue(sourceId);
  const { rows } = await sql<{ token: string | null }>`
    SELECT j.data -> 'payload' ->> 'token' AS token
    FROM pgboss.job j
    WHERE j.name = ${queue} AND j.state IN ('created', 'retry') AND j.data ->> 'kind' = ${kind}`.execute(db);
  return rows.flatMap((row) => (row.token === null ? [] : [row.token]));
}

/** Marks approved crawl requests fulfilled when their model is tracked and has been read (fulfil_crawl_requests()). */
export async function fulfilCrawlRequests(db: Kysely<DB>): Promise<number> {
  const { rows } = await sql<{ fulfilled: number }>`SELECT fulfil_crawl_requests() AS fulfilled`.execute(db);
  return rows[0]?.fulfilled ?? 0;
}
