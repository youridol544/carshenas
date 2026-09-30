import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';

// How fresh the index is (CS-35 criterion 6; ADR-0017 point 6; table freshness_measurement): measured for a source, or
// for one of its tracked models with its trims, over the 24 hours before the start of the current hour, so a job run
// twice in one hour writes one row (freshness_measurement_once_unique).

export type FreshnessFigures = {
  readonly newListings: number;
  readonly leftMarket: number;
  readonly activeListings: number;
  readonly seenWithin48h: number;
  readonly postingToFirstSeenP50Minutes: number | null;
  readonly lastSeenAgeP50Minutes: number | null;
};

/**
 * Measures and stores one row; `sourceModelKey` null measures the whole source. Returns the figures, or undefined when
 * this hour was measured already.
 */
export async function measureFreshness(
  db: Kysely<DB>,
  sourceId: string,
  sourceModelKey: string | null,
): Promise<FreshnessFigures | undefined> {
  const { rows } = await sql<{
    new_listings: number;
    left_market: number;
    active_listings: number;
    seen_within_48h: number;
    posting_to_first_seen_p50_minutes: number | null;
    last_seen_age_p50_minutes: number | null;
  }>`
    WITH t AS (SELECT date_trunc('hour', clock_timestamp()) AS at),
    l AS (
      SELECT l.created_at, l.listed_at, l.delisted_at, l.status, l.last_checked_at,
             greatest(l.last_seen_at, l.last_checked_at) AS last_read_at
      FROM listing l
      WHERE l.source_id = ${sourceId}
        -- Only what the figures use: active listings, and those first stored or delisted in the last day. Long-gone
        -- history is never read, so the cost follows the market, not the archive.
        AND (l.status = 'active' OR l.created_at > clock_timestamp() - interval '25 hours'
             OR l.delisted_at > clock_timestamp() - interval '25 hours')
        AND (${sourceModelKey}::text IS NULL
             OR l.source_model_key = ${sourceModelKey}::text
             OR starts_with(l.source_model_key, ${sourceModelKey}::text || ' '))
    ),
    posted AS (
      SELECT greatest(0, extract(epoch FROM l.created_at - l.listed_at) / 60) AS minutes
      FROM l, t
      WHERE l.created_at > t.at - interval '24 hours' AND l.created_at <= t.at AND l.last_checked_at IS NOT NULL
    ),
    ages AS (
      SELECT greatest(0, extract(epoch FROM t.at - l.last_read_at) / 60) AS minutes
      FROM l, t
      WHERE l.status = 'active'
    )
    INSERT INTO freshness_measurement (
      source_id, source_model_key, measured_at, new_listings, left_market, active_listings, seen_within_48h,
      posting_to_first_seen_p50_minutes, posting_to_first_seen_p90_minutes, last_seen_age_p50_minutes,
      last_seen_age_p90_minutes)
    SELECT ${sourceId}, ${sourceModelKey}::text, t.at,
           (SELECT count(*) FROM l WHERE l.created_at > t.at - interval '24 hours' AND l.created_at <= t.at),
           (SELECT count(*) FROM l WHERE l.delisted_at > t.at - interval '24 hours' AND l.delisted_at <= t.at),
           (SELECT count(*) FROM l WHERE l.status = 'active'),
           (SELECT count(*) FROM l WHERE l.status = 'active' AND l.last_read_at > t.at - interval '48 hours'),
           (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes)) FROM posted),
           (SELECT round(percentile_cont(0.9) WITHIN GROUP (ORDER BY minutes)) FROM posted),
           (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes)) FROM ages),
           (SELECT round(percentile_cont(0.9) WITHIN GROUP (ORDER BY minutes)) FROM ages)
    FROM t
    ON CONFLICT ON CONSTRAINT freshness_measurement_once_unique DO NOTHING
    RETURNING new_listings, left_market, active_listings, seen_within_48h, posting_to_first_seen_p50_minutes,
              last_seen_age_p50_minutes`.execute(db);
  const [row] = rows;
  return (
    row && {
      newListings: row.new_listings,
      leftMarket: row.left_market,
      activeListings: row.active_listings,
      seenWithin48h: row.seen_within_48h,
      postingToFirstSeenP50Minutes: row.posting_to_first_seen_p50_minutes,
      lastSeenAgeP50Minutes: row.last_seen_age_p50_minutes,
    }
  );
}
