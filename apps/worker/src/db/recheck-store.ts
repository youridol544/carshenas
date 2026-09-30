import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';

// Buyers' requests to re-read one listing (CS-35 criterion 5, for CS-64; table listing_recheck_request): the web app
// inserts them, the worker drains them into lane jobs. A request is claimed with SKIP LOCKED, so two workers never
// handle the same one, and handled in the transaction that sends its job.

/** How long a read of a listing's own page stays fresh: a re-check within it sends nothing (ADR-0017 point 3). */
export const FRESHNESS_WINDOW_HOURS = 6;

export type PendingRecheck = {
  readonly requestId: number;
  readonly sourceId: string;
  readonly key: string;
  /** The listing has left the market: there is nothing to re-read. */
  readonly offMarket: boolean;
  /** Its page was read within the freshness window. */
  readonly fresh: boolean;
};

/** Claims up to `limit` pending requests, oldest first, locking them until the transaction ends. */
export async function claimPendingRechecks(db: Kysely<DB>, limit: number): Promise<PendingRecheck[]> {
  const { rows } = await sql<{
    id: number;
    source_id: string;
    source_listing_key: string;
    off_market: boolean;
    fresh: boolean;
  }>`
    SELECT r.id, l.source_id, l.source_listing_key, l.status <> 'active' AS off_market,
           coalesce(l.last_checked_at > clock_timestamp() - make_interval(hours => ${FRESHNESS_WINDOW_HOURS}), false)
             AS fresh
    FROM listing_recheck_request r
    JOIN listing l ON l.id = r.listing_id
    WHERE r.handled_at IS NULL AND l.source_listing_key IS NOT NULL
    ORDER BY r.requested_at
    LIMIT ${limit}
    FOR UPDATE OF r SKIP LOCKED`.execute(db);
  return rows.map((row) => ({
    requestId: row.id,
    sourceId: row.source_id,
    key: row.source_listing_key,
    offMarket: row.off_market,
    fresh: row.fresh,
  }));
}

/** Records what became of a request: queued (a re-check was sent), fresh or off_market (nothing was). */
export async function handleRecheck(
  db: Kysely<DB>,
  requestId: number,
  outcome: 'queued' | 'fresh' | 'off_market',
): Promise<void> {
  await db
    .updateTable('listing_recheck_request')
    .set({ handled_at: sql<Date>`greatest(clock_timestamp(), requested_at)`, outcome })
    .where('id', '=', requestId)
    .where('handled_at', 'is', null)
    .execute();
}
