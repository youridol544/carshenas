import { sql, type Kysely, type Transaction } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { Search } from '@carshenas/search/search';
import { searchableWhere, searchQuerySql } from '@carshenas/search/sql';

// What the matching job reads and writes (CS-72, ADR-0035). A search file's matches are never stored: they are read from
// search_document with searchableWhere(), the function the search page and API use, restricted to the rows indexed after
// the file's watermark (search_file.matched_through) and to the price drops recorded after it. Instants travel as text,
// as PostgreSQL wrote them, so no microsecond is lost between a watermark and the comparison that uses it.

/** Tehran's midnight, which the daily cap counts from. */
const TEHRAN_DAY_START = sql`date_trunc('day', now() AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'Asia/Tehran'`;

/** The alias search_document is read under, which the package's SQL helpers are given. */
const ALIAS = 'r';

export type WatchedFile = {
  readonly id: number;
  readonly accountId: number;
  readonly name: string;
  /** The stored search as it was written; the job parses it with fromStoredSearch. */
  readonly search: unknown;
  /** matched_through, as text. */
  readonly watermark: string;
  /** matched_through in microseconds since the epoch (below 2^53 until the year 2255): for comparing with candidates. */
  readonly watermarkMicros: number;
};

/** The end of this run: now less a margin, as text. Rows indexed later wait for the next run, so a slow transaction cannot be missed. */
export async function readRunEnd(db: Kysely<DB>, marginSeconds: number, now?: Date): Promise<string> {
  const clock = now === undefined ? sql`clock_timestamp()` : sql`${now.toISOString()}::timestamptz`;
  const { rows } = await sql<{ end: string }>`
    SELECT (${clock} - make_interval(secs => ${marginSeconds}))::text AS end`.execute(db);
  const end = rows[0]?.end;
  if (end === undefined) throw new Error('the database gave no time');
  return end;
}

/**
 * The files to match: watching, not muted, with something unmatched before the run's end, and not told within the minimum
 * gap (their watermark stays, so the next alert tells everything since in one digest). The `limit` oldest watermarks, by
 * search_file_to_match_idx: a run does bounded work, and the files it does not reach come first in the next. Files that are
 * paused, closed or muted are never read, and their watermark restarts when they are watched again (a trigger).
 */
export async function readFilesToMatch(
  db: Kysely<DB>,
  runEnd: string,
  gapMinutes: number,
  dailyCap: number,
  limit: number,
): Promise<WatchedFile[]> {
  const { rows } = await sql<{
    id: number;
    account_id: number;
    name: string;
    search: unknown;
    watermark: string;
    watermark_us: number;
  }>`
    SELECT f.id, f.account_id, f.name, f.search, f.matched_through::text AS watermark,
           (extract(epoch FROM f.matched_through) * 1000000)::bigint AS watermark_us
    FROM search_file f
    WHERE f.status = 'watching' AND f.muted_at IS NULL AND f.matched_through < ${runEnd}::timestamptz
      AND (f.last_alert_at IS NULL OR f.last_alert_at <= ${runEnd}::timestamptz - make_interval(mins => ${gapMinutes}))
      -- An account at its daily cap is not read at all: its files wait, with their watermarks, for tomorrow.
      AND (SELECT count(*) FROM notification n
           WHERE n.account_id = f.account_id AND n.kind = 'search_file_matches' AND n.created_at >= ${TEHRAN_DAY_START}) < ${dailyCap}
    ORDER BY f.matched_through, f.id
    LIMIT ${limit}`.execute(db);
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    search: row.search,
    watermark: row.watermark,
    watermarkMicros: row.watermark_us,
  }));
}

export type Candidate = {
  readonly listingId: number;
  readonly makeKey: string | null;
  readonly modelKey: string | null;
  readonly trimKey: string | null;
  /** When it became searchable, in microseconds since the epoch; 0 when it did not in the window. */
  readonly indexedMicros: number;
  /** When its latest price drop in the window was recorded, in microseconds; 0 when there was none. */
  readonly droppedMicros: number;
};

/** A price drop: the price went from an asking price to a lower one (the same test the price events' own constraints allow). */
const DROP_EVENT = sql`e.price_type = 'asking' AND e.previous_price_type = 'asking' AND e.asking_price_toman < e.previous_price_toman`;

/**
 * The listings that became searchable, or dropped their price, between the oldest watermark and the run's end: a range
 * of search_document_indexed_at_idx and of listing_price_event_recorded_at_idx. Each file is then matched against only
 * these, after its make, model and trim keys have ruled most of them out in memory.
 */
export async function readCandidates(db: Kysely<DB>, since: string, runEnd: string): Promise<Candidate[]> {
  type Row = {
    listing_id: number;
    make_key: string | null;
    model_key: string | null;
    trim_key: string | null;
    at_us: number;
  };
  // Two statements, each a range of its own index, merged here: one statement with an OR would read the whole table.
  const [indexed, dropped] = await Promise.all([
    sql<Row>`
      SELECT r.listing_id, r.make_key, r.model_key, r.trim_key, (extract(epoch FROM r.indexed_at) * 1000000)::bigint AS at_us
      FROM search_document r
      WHERE r.indexed_at > ${since}::timestamptz AND r.indexed_at <= ${runEnd}::timestamptz`.execute(db),
    sql<Row>`
      SELECT r.listing_id, r.make_key, r.model_key, r.trim_key, d.at_us
      FROM (SELECT e.listing_id, max((extract(epoch FROM e.recorded_at) * 1000000)::bigint) AS at_us
            FROM listing_price_event e
            WHERE e.recorded_at > ${since}::timestamptz AND e.recorded_at <= ${runEnd}::timestamptz AND ${DROP_EVENT}
            GROUP BY e.listing_id) d
      JOIN search_document r ON r.listing_id = d.listing_id`.execute(db),
  ]);
  const byListing = new Map<number, Candidate>();
  for (const row of indexed.rows) {
    byListing.set(row.listing_id, {
      listingId: row.listing_id,
      makeKey: row.make_key,
      modelKey: row.model_key,
      trimKey: row.trim_key,
      indexedMicros: row.at_us,
      droppedMicros: 0,
    });
  }
  for (const row of dropped.rows) {
    const known = byListing.get(row.listing_id);
    byListing.set(row.listing_id, {
      listingId: row.listing_id,
      makeKey: row.make_key,
      modelKey: row.model_key,
      trimKey: row.trim_key,
      indexedMicros: known?.indexedMicros ?? 0,
      droppedMicros: row.at_us,
    });
  }
  return [...byListing.values()];
}

/**
 * Locks the file's row for this run, skipping one a buyer's write holds at the moment, and re-reads what the run needs
 * of it: undefined when it is no longer watched, was muted, or another run already matched it.
 */
export async function lockFileForMatching(
  trx: Transaction<DB>,
  fileId: number,
  runEnd: string,
): Promise<{ watermark: string; sinceKey: string } | undefined> {
  const { rows } = await sql<{ watermark: string; since_key: string }>`
    SELECT matched_through::text AS watermark,
           (extract(epoch FROM matched_through) * 1000000)::bigint::text AS since_key
    FROM search_file
    WHERE id = ${fileId} AND status = 'watching' AND muted_at IS NULL AND matched_through < ${runEnd}::timestamptz
    FOR UPDATE SKIP LOCKED`.execute(trx);
  const row = rows[0];
  return row === undefined ? undefined : { watermark: row.watermark, sinceKey: row.since_key };
}

export type FileMatch = {
  readonly listingId: number;
  readonly dealRating: 'great' | 'good' | 'fair' | 'high' | 'overpriced' | null;
  /** Indexed after the file's watermark: it became searchable since the last alert. */
  readonly isNew: boolean;
  /** A price drop was recorded after the watermark. */
  readonly isDrop: boolean;
};

/** Which of the candidate listings the file's search finds, and why each is news. Reads only search_document. */
export async function readFileMatches(
  db: Kysely<DB> | Transaction<DB>,
  search: Search,
  candidateIds: readonly number[],
  watermark: string,
  runEnd: string,
): Promise<FileMatch[]> {
  if (candidateIds.length === 0) return [];
  const plan =
    search.q === undefined
      ? undefined
      : await db.selectFrom(searchQuerySql(search.q).as('q')).selectAll().executeTakeFirst();
  const where = searchableWhere(
    { filters: search.filters, tsquery: plan?.tsquery_text ?? null },
    { alias: ALIAS },
  );
  const isNew = sql<boolean>`(r.indexed_at > ${watermark}::timestamptz AND r.indexed_at <= ${runEnd}::timestamptz)`;
  const isDrop = sql<boolean>`EXISTS (
    SELECT FROM listing_price_event e
    WHERE e.listing_id = r.listing_id AND e.recorded_at > ${watermark}::timestamptz
      AND e.recorded_at <= ${runEnd}::timestamptz AND ${DROP_EVENT})`;
  const rows = await db
    .selectFrom('search_document as r')
    .select(['r.listing_id', 'r.deal_rating'])
    .select(isNew.as('is_new'))
    .select(isDrop.as('is_drop'))
    .where(where)
    .where(sql<boolean>`r.listing_id = ANY(${candidateIds as number[]}::bigint[])`)
    .where(sql<boolean>`(${isNew} OR ${isDrop})`)
    .execute();
  return rows.map((row) => ({
    listingId: row.listing_id,
    dealRating: row.deal_rating,
    isNew: row.is_new,
    isDrop: row.is_drop,
  }));
}

/** How many search file digests the account was sent since Tehran's midnight. Served by notification_inbox_idx. */
export async function countDigestsToday(trx: Transaction<DB>, accountId: number): Promise<number> {
  const { rows } = await sql<{ sent: number }>`
    SELECT count(*)::integer AS sent FROM notification
    WHERE account_id = ${accountId} AND kind = 'search_file_matches'
      AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'Asia/Tehran'`.execute(
    trx,
  );
  return rows[0]?.sent ?? 0;
}

/** The file is matched through the run's end; alerted also records when the buyer was told. */
export async function finishFile(
  trx: Transaction<DB>,
  fileId: number,
  runEnd: string,
  alerted: boolean,
): Promise<void> {
  await sql`
    UPDATE search_file
    SET matched_through = ${runEnd}::timestamptz${alerted ? sql`, last_alert_at = now()` : sql``}
    WHERE id = ${fileId}`.execute(trx);
}

/**
 * Moves watching files on to the run's end without a word, in one statement: those nothing in the run can match (the news
 * has other makes, models or trims, or there is none). A file that was paused, muted or already moved is left as it is.
 */
export async function advanceFiles(
  db: Kysely<DB>,
  fileIds: readonly number[],
  runEnd: string,
): Promise<number> {
  if (fileIds.length === 0) return 0;
  const result = await sql`
    UPDATE search_file SET matched_through = ${runEnd}::timestamptz
    WHERE id = ANY(${fileIds}::bigint[]) AND status = 'watching' AND muted_at IS NULL
      AND matched_through < ${runEnd}::timestamptz`.execute(db);
  return Number(result.numAffectedRows ?? 0);
}
