import { sql, type Kysely } from 'kysely';
import type { DB, JsonObject } from '@carshenas/db/db-types';

// What a crawl writes about listings (docs/design/data-model.md, section 3, "How a crawl writes these rows"): a listing
// upserted on its natural key with a change guard, its snapshot stored once per content, and a price event only when
// the price changed. Never a read to check before a write: the unique constraints decide, and a job that runs twice
// writes nothing twice.

export type PriceType = 'asking' | 'negotiable' | 'installment' | 'placeholder';

export type KnownListing = {
  readonly listingId: number;
  readonly status: 'active' | 'sold' | 'expired' | 'gone' | 'removed';
  /** Whether a detail of it was ever stored: discovery fetches one for a listing that has none. */
  readonly hasSnapshot: boolean;
  /** Its latest price event, the price a list row is compared with. */
  readonly latestPrice: { readonly type: PriceType; readonly toman: number | null } | undefined;
};

/** The listings of `sourceId` among `keys`, by key; keys it has never stored are absent. */
export async function knownListings(
  db: Kysely<DB>,
  sourceId: string,
  keys: readonly string[],
): Promise<Map<string, KnownListing>> {
  if (keys.length === 0) return new Map();
  const rows = await db
    .selectFrom('listing as l')
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom('listing_price_event as e')
          .select(['e.price_type', 'e.asking_price_toman'])
          .whereRef('e.listing_id', '=', 'l.id')
          .orderBy('e.observed_at', 'desc')
          .limit(1)
          .as('latest'),
      (join) => join.onTrue(),
    )
    .select((eb) => [
      'l.id',
      'l.source_listing_key',
      'l.status',
      'latest.price_type',
      'latest.asking_price_toman',
      eb
        .exists(eb.selectFrom('snapshot as s').select('s.id').whereRef('s.listing_id', '=', 'l.id'))
        .as('has_snapshot'),
    ])
    .where('l.source_id', '=', sourceId)
    .where('l.source_listing_key', '=', anyOf(keys))
    .execute();
  const known = new Map<string, KnownListing>();
  for (const row of rows) {
    if (row.source_listing_key === null) continue;
    known.set(row.source_listing_key, {
      listingId: row.id,
      status: row.status,
      hasSnapshot: Boolean(row.has_snapshot),
      latestPrice:
        row.price_type === null ? undefined : { type: row.price_type, toman: row.asking_price_toman },
    });
  }
  return known;
}

const DAY = sql`interval '1 day'`;

/** `= any($1)` with one array parameter: the statement's text stays the same whatever the number of keys. */
function anyOf(keys: readonly string[]) {
  return sql<string>`any(${[...keys]}::text[])`;
}

/**
 * Records that list rows showed these listings at `seenAt`: last_seen_at is refreshed when it is more than a day old
 * (fetch_log keeps every visit, and a daily refresh keeps the updates HOT), and an expired or gone listing seen again
 * is back on the market. Returns how many listings changed.
 */
export async function recordSightings(
  db: Kysely<DB>,
  sourceId: string,
  keys: readonly string[],
  seenAt: Date,
): Promise<number> {
  if (keys.length === 0) return 0;
  const result = await db
    .updateTable('listing')
    .set((eb) => ({
      last_seen_at: sql<Date>`greatest(last_seen_at, ${seenAt})`,
      status: eb
        .case()
        .when('status', 'in', ['expired', 'gone'])
        .then('active' as const)
        .else(eb.ref('status'))
        .end(),
      delisted_at: eb
        .case()
        .when('status', 'in', ['expired', 'gone'])
        .then(sql<Date | null>`NULL`)
        .else(eb.ref('delisted_at'))
        .end(),
    }))
    .where('source_id', '=', sourceId)
    .where('source_listing_key', '=', anyOf(keys))
    .where((eb) =>
      eb.or([
        eb('last_seen_at', '<', sql<Date>`${seenAt}::timestamptz - ${DAY}`),
        eb('status', 'in', ['expired', 'gone']),
      ]),
    )
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}

export type ListingSighting = {
  readonly sourceId: string;
  readonly key: string;
  /** Where the listing lives on its source: the click-out target. */
  readonly url: string;
  /** When it went on the market: the source's posting time if the page said, else this sighting. */
  readonly listedAt: Date;
  readonly seenAt: Date;
  /** Set when this sighting is a read of the listing's own page (CS-35): its last_checked_at. */
  readonly checkedAt?: Date;
  /** The source's own end date for the listing, when its page gives one (Divar's unavailable_after). */
  readonly expiresAt?: Date;
  /** The source's own model filter value, when its page gives one (Divar's brand_model). */
  readonly sourceModelKey?: string;
};

/**
 * Upserts a listing on (source_id, source_listing_key) with a change guard: a known listing is rewritten only when its
 * address changed, it had expired or gone (it is back on the market), its last sighting is more than a day old, the
 * page shows it was posted earlier than we knew, or this is a read of its own page (a check), which moves
 * last_checked_at and brings its expiry and model key. Returns its id, inserted or not.
 */
export async function upsertListing(db: Kysely<DB>, seen: ListingSighting): Promise<number> {
  const written = await db
    .insertInto('listing')
    .values({
      source_id: seen.sourceId,
      source_listing_key: seen.key,
      url: seen.url,
      status: 'active',
      listed_at: seen.listedAt,
      last_seen_at: seen.seenAt,
      last_checked_at: seen.checkedAt ?? null,
      expires_at: seen.expiresAt ?? null,
      source_model_key: seen.sourceModelKey ?? null,
    })
    .onConflict((conflict) =>
      conflict
        .constraint('listing_source_key_unique')
        .doUpdateSet((eb) => ({
          url: eb.ref('excluded.url'),
          listed_at: sql<Date>`least(listing.listed_at, excluded.listed_at)`,
          last_seen_at: sql<Date>`greatest(listing.last_seen_at, excluded.last_seen_at)`,
          last_checked_at: sql<Date | null>`greatest(listing.last_checked_at, excluded.last_checked_at)`,
          expires_at: sql<Date | null>`coalesce(excluded.expires_at, listing.expires_at)`,
          source_model_key: sql<string | null>`coalesce(excluded.source_model_key, listing.source_model_key)`,
          status: eb
            .case()
            .when('listing.status', 'in', ['expired', 'gone'])
            .then('active' as const)
            .else(eb.ref('listing.status'))
            .end(),
          delisted_at: eb
            .case()
            .when('listing.status', 'in', ['expired', 'gone'])
            .then(sql<Date | null>`NULL`)
            .else(eb.ref('listing.delisted_at'))
            .end(),
        }))
        .where((eb) =>
          eb.or([
            eb('listing.url', 'is distinct from', eb.ref('excluded.url')),
            eb('listing.status', 'in', ['expired', 'gone']),
            eb('listing.last_seen_at', '<', sql<Date>`excluded.last_seen_at - ${DAY}`),
            eb('excluded.listed_at', '<', eb.ref('listing.listed_at')),
            eb('excluded.last_checked_at', 'is not', null),
          ]),
        ),
    )
    .returning('id')
    .executeTakeFirst();
  if (written) return written.id;
  // Unchanged: nothing was rewritten, so nothing came back; a new statement sees the row.
  const known = await db
    .selectFrom('listing')
    .select('id')
    .where('source_id', '=', seen.sourceId)
    .where('source_listing_key', '=', seen.key)
    .executeTakeFirstOrThrow();
  return known.id;
}

export type SnapshotToStore = {
  readonly listingId: number;
  readonly url: string;
  readonly fetchedAt: Date;
  readonly canonicalVersion: number;
  readonly payload: JsonObject;
};

/** Stores a snapshot unless the listing already has one with the same content; returns its id either way. */
export async function storeSnapshot(
  db: Kysely<DB>,
  snapshot: SnapshotToStore,
): Promise<{ readonly snapshotId: number; readonly stored: boolean }> {
  const inserted = await db
    .insertInto('snapshot')
    .values({
      listing_id: snapshot.listingId,
      first_fetched_at: snapshot.fetchedAt,
      url: snapshot.url,
      canonical_version: snapshot.canonicalVersion,
      payload: snapshot.payload,
    })
    .onConflict((conflict) => conflict.constraint('snapshot_content_unique').doNothing())
    .returning('id')
    .executeTakeFirst();
  if (inserted) return { snapshotId: inserted.id, stored: true };
  // The same content was stored before (or by a job that ran at the same time): a new statement sees its row.
  const existing = await db
    .selectFrom('snapshot')
    .select('id')
    .where('listing_id', '=', snapshot.listingId)
    .where('content_sha256', '=', sql<Buffer>`jsonb_sha256(${JSON.stringify(snapshot.payload)}::jsonb)`)
    .executeTakeFirstOrThrow();
  return { snapshotId: existing.id, stored: false };
}

/** What showed a price: a snapshot of the listing's page, or the list page's request that showed its row (CS-35). */
export type PriceEvidence = { readonly snapshotId: number } | { readonly fetchLogId: number };

export type ObservedPrice = {
  readonly listingId: number;
  /** When the source showed it: the start of the request that is the evidence. */
  readonly observedAt: Date;
  readonly type: PriceType;
  /** Exactly for an asking price. */
  readonly toman: number | null;
} & PriceEvidence;

/**
 * Records a price event unless the listing's latest already says the same: the event table holds changes only (its
 * CHECK would refuse a repeat, and ON CONFLICT does not skip a CHECK). Returns whether an event was recorded.
 */
export async function recordPriceChange(db: Kysely<DB>, price: ObservedPrice): Promise<boolean> {
  const snapshotId = 'snapshotId' in price ? price.snapshotId : null;
  const fetchLogId = 'fetchLogId' in price ? price.fetchLogId : null;
  const { rows } = await sql<{ id: number }>`
    INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, snapshot_id, fetch_log_id)
    SELECT ${price.listingId}, ${price.observedAt}, ${price.type}, ${price.toman}::bigint, ${snapshotId}::bigint,
           ${fetchLogId}::bigint
    WHERE NOT EXISTS (
      SELECT FROM (
        SELECT e.price_type, e.asking_price_toman
        FROM listing_price_event e
        WHERE e.listing_id = ${price.listingId}
        ORDER BY e.observed_at DESC
        LIMIT 1
      ) latest
      WHERE latest.price_type = ${price.type} AND latest.asking_price_toman IS NOT DISTINCT FROM ${price.toman}::bigint
    )
    ON CONFLICT ON CONSTRAINT listing_price_event_observed_unique DO NOTHING
    RETURNING id`.execute(db);
  return rows.length > 0;
}

/** The id of a listing of `sourceId`, if it was ever stored. */
export async function listingIdOf(
  db: Kysely<DB>,
  sourceId: string,
  key: string,
): Promise<number | undefined> {
  const row = await db
    .selectFrom('listing')
    .select('id')
    .where('source_id', '=', sourceId)
    .where('source_listing_key', '=', key)
    .executeTakeFirst();
  return row?.id;
}

/**
 * Marks an active listing gone: its source answered that the post no longer exists. Returns its id when it was active,
 * undefined when it was unknown or already off the market.
 */
export async function markListingGone(
  db: Kysely<DB>,
  sourceId: string,
  key: string,
  at: Date,
): Promise<number | undefined> {
  const row = await db
    .updateTable('listing')
    .set({ status: 'gone', delisted_at: sql<Date>`greatest(${at}::timestamptz, last_seen_at, listed_at)` })
    .where('source_id', '=', sourceId)
    .where('source_listing_key', '=', key)
    .where('status', '=', 'active')
    .returning('id')
    .executeTakeFirst();
  return row?.id;
}

/** A listing's row on a list page, as a sweep read it (CS-35). */
export type SweptRow = {
  readonly key: string;
  readonly url: string;
  /** When it went on the market, as far as the row tells: its sort time, else this sighting. */
  readonly listedAt: Date;
  /** The price the row shows, when it could be read. */
  readonly price: { readonly type: PriceType; readonly toman: number | null } | undefined;
};

export type SweptPage = {
  readonly sourceId: string;
  /** The source's model filter value of the slice: each row's source_model_key, unless it knew a finer one. */
  readonly sliceKey: string;
  /** When the sweep started: a listing seen since is not missing, and is not rewritten twice in one sweep. */
  readonly sweptAt: Date;
  /** The start of the page's request: the sighting and the observation time of any price it shows. */
  readonly seenAt: Date;
  /** The page's fetch_log row: the evidence of the prices read from its rows. */
  readonly fetchLogId: number;
  readonly rows: readonly SweptRow[];
};

/**
 * Writes what one sweep page showed (CS-35 criteria 1 and 3): every row's listing upserted in one statement, with its
 * last sighting moved to this page once a sweep, its model key set (a finer key it already had is kept), and an
 * expired or gone one back on the market; then a price event for every row whose price differs from the listing's
 * latest, citing this page's request. Returns the keys it stored for the first time and how many events it recorded.
 */
export async function recordSweptPage(
  db: Kysely<DB>,
  page: SweptPage,
): Promise<{ readonly newKeys: readonly string[]; readonly priceEvents: number }> {
  // A token shown twice on one page (a promoted row, say) is written once: an upsert may touch a row only once.
  const rows = [...new Map(page.rows.map((row) => [row.key, row])).values()];
  if (rows.length === 0) return { newKeys: [], priceEvents: 0 };
  const keys = rows.map((row) => row.key);
  const urls = rows.map((row) => row.url);
  const listedAts = rows.map((row) => row.listedAt.toISOString());
  const { rows: written } = await sql<{ source_listing_key: string; inserted: boolean }>`
    INSERT INTO listing AS l (source_id, source_listing_key, url, status, listed_at, last_seen_at, source_model_key)
    SELECT ${page.sourceId}, r.key, r.url, 'active', least(r.listed_at, ${page.seenAt}::timestamptz),
           ${page.seenAt}::timestamptz, ${page.sliceKey}
    FROM unnest(${keys}::text[], ${urls}::text[], ${listedAts}::timestamptz[]) AS r (key, url, listed_at)
    ON CONFLICT ON CONSTRAINT listing_source_key_unique DO UPDATE
    SET last_seen_at = greatest(l.last_seen_at, excluded.last_seen_at),
        source_model_key = CASE
          WHEN starts_with(l.source_model_key, excluded.source_model_key || ' ') THEN l.source_model_key
          ELSE excluded.source_model_key END,
        status = CASE WHEN l.status IN ('expired', 'gone') THEN 'active' ELSE l.status END,
        delisted_at = CASE WHEN l.status IN ('expired', 'gone') THEN NULL ELSE l.delisted_at END
    WHERE l.last_seen_at < ${page.sweptAt}::timestamptz
       OR l.status IN ('expired', 'gone')
       OR l.source_model_key IS NULL
       OR NOT (l.source_model_key = excluded.source_model_key
               OR starts_with(l.source_model_key, excluded.source_model_key || ' '))
    RETURNING l.source_listing_key, (l.xmax = 0) AS inserted`.execute(db);
  const priced = rows.filter((row) => row.price !== undefined);
  let priceEvents = 0;
  if (priced.length > 0) {
    const { rows: events } = await sql<{ id: number }>`
      INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, fetch_log_id)
      SELECT l.id, ${page.seenAt}::timestamptz, r.price_type, r.toman, ${page.fetchLogId}::bigint
      FROM unnest(${priced.map((row) => row.key)}::text[], ${priced.map((row) => row.price?.type)}::text[],
                  ${priced.map((row) => row.price?.toman ?? null)}::bigint[]) AS r (key, price_type, toman)
      JOIN listing l ON l.source_id = ${page.sourceId} AND l.source_listing_key = r.key
      WHERE NOT EXISTS (
        SELECT FROM (
          SELECT e.price_type, e.asking_price_toman
          FROM listing_price_event e
          WHERE e.listing_id = l.id
          ORDER BY e.observed_at DESC
          LIMIT 1
        ) latest
        WHERE latest.price_type = r.price_type AND latest.asking_price_toman IS NOT DISTINCT FROM r.toman
      )
      ON CONFLICT ON CONSTRAINT listing_price_event_observed_unique DO NOTHING
      RETURNING id`.execute(db);
    priceEvents = events.length;
  }
  return { newKeys: written.filter((row) => row.inserted).map((row) => row.source_listing_key), priceEvents };
}

/** A listing a complete sweep of its slice no longer showed, with the model key it was last seen under. */
export type MissingListing = {
  readonly listingId: number;
  readonly key: string;
  readonly sourceModelKey: string | null;
};

/**
 * The active listings of a slice that a complete sweep did not show: of its model key, or of a finer key under it,
 * and not seen since the sweep started (CS-35 criterion 2).
 */
export async function missingFromSlice(
  db: Kysely<DB>,
  sourceId: string,
  sliceKey: string,
  sweptAt: Date,
): Promise<MissingListing[]> {
  const rows = await db
    .selectFrom('listing')
    .select(['id', 'source_listing_key', 'source_model_key'])
    .where('source_id', '=', sourceId)
    // A literal: the predicate of listing_active_model_idx, which the planner matches only against one.
    .where('status', '=', sql.lit('active'))
    .where((eb) =>
      eb.or([
        eb('source_model_key', '=', sliceKey),
        eb(sql<boolean>`starts_with(source_model_key, ${sliceKey} || ' ')`, '=', true),
      ]),
    )
    .where('last_seen_at', '<', sweptAt)
    .execute();
  return rows.flatMap((row) =>
    row.source_listing_key === null
      ? []
      : [{ listingId: row.id, key: row.source_listing_key, sourceModelKey: row.source_model_key }],
  );
}

/**
 * Marks listings a complete sweep no longer showed as gone without a request (CS-35 criterion 2, untracked models; the
 * owner's decision of 2026-09-30), dated to the sweep. Only active listings not seen since change. Returns how many.
 */
export async function markMissingGone(
  db: Kysely<DB>,
  listingIds: readonly number[],
  sweptAt: Date,
): Promise<number> {
  if (listingIds.length === 0) return 0;
  const result = await db
    .updateTable('listing')
    .set({
      status: 'gone',
      delisted_at: sql<Date>`greatest(${sweptAt}::timestamptz, last_seen_at, listed_at)`,
    })
    .where('id', '=', sql<number>`any(${[...listingIds]}::bigint[])`)
    .where('status', '=', 'active')
    .where('last_seen_at', '<', sweptAt)
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}

/**
 * Marks the active listings of a source past their own end date as expired, without a request (ADR-0017 point 3; CS-35
 * criterion 2), dated to that end date, unless a list showed them after it. Returns how many.
 */
export async function expireListings(db: Kysely<DB>, sourceId: string): Promise<number> {
  const result = await db
    .updateTable('listing')
    .set({ status: 'expired', delisted_at: sql<Date>`greatest(expires_at, last_seen_at, listed_at)` })
    .where('source_id', '=', sourceId)
    .where('status', '=', 'active')
    .where('expires_at', '<=', sql<Date>`now()`)
    // A sighting after the end date disproves it: Divar renewed the listing, and its next page read will say so.
    .whereRef('last_seen_at', '<', 'expires_at')
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}

/**
 * Marks one listing whose own page says it has left the market (CS-35 criterion 2): sold, or expired past its end date.
 * Returns its id when it was active.
 */
export async function markListingOffMarket(
  db: Kysely<DB>,
  sourceId: string,
  key: string,
  status: 'sold' | 'expired',
  at: Date,
): Promise<number | undefined> {
  const row = await db
    .updateTable('listing')
    .set({ status, delisted_at: sql<Date>`greatest(${at}::timestamptz, last_seen_at, listed_at)` })
    .where('source_id', '=', sourceId)
    .where('source_listing_key', '=', key)
    .where('status', '=', 'active')
    .returning('id')
    .executeTakeFirst();
  return row?.id;
}
