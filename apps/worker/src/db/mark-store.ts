import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { createNotification } from '@carshenas/notifications/create-notification';

// What happens to the listings buyers marked (CS-69; tables listing_mark and notification): a price drop, a listing that
// leaves the market and one that comes back each notify the buyers who follow it, once. Every notification goes through
// createNotification() inside the transaction that moves the mark's bookkeeping forward, so a run that dies half way
// rolls back whole, and a run that repeats finds the event already told (notification_once_per_event_unique).

const CAR_NAME_FALLBACK = 'خودرو';
const OFF_MARKET: readonly string[] = ['sold', 'expired', 'gone'];

export type MarkRun = {
  readonly priceDrops: number;
  readonly offMarket: number;
  readonly relisted: number;
  /** Events the buyer was not told because they muted the kind or were already told. */
  readonly skipped: number;
};

type CarFacts = { car_name: string | null; model_year_sh: number | null };

const carNameOf = (row: CarFacts): string =>
  (row.car_name ?? CAR_NAME_FALLBACK).trim().slice(0, 120) || CAR_NAME_FALLBACK;
const yearOf = (row: CarFacts) => (row.model_year_sh === null ? {} : { modelYearSh: row.model_year_sh });

/**
 * Tells every buyer who marked a listing of the asking-price drops recorded since their mark's watermark, then moves
 * the watermark to the newest event handled. The car is named as the catalogue names it, its trim first, then its
 * model, then the listing's own title.
 */
async function notifyPriceDrops(
  db: Kysely<DB>,
  limit: number,
): Promise<{ told: number; skipped: number; read: number }> {
  const { rows } = await sql<
    CarFacts & {
      account_id: number;
      listing_id: number;
      event_id: number;
      newest_seen_id: number;
      previous_price_toman: number | null;
      price_toman: number | null;
      price_type: string;
    }
  >`
    SELECT k.account_id, k.listing_id, e.id AS event_id,
           max(e.id) OVER (PARTITION BY k.account_id, k.listing_id) AS newest_seen_id,
           coalesce(t.name_fa, m.name_fa, l.title, l.source_model_key) AS car_name, l.model_year_sh,
           e.last_asking_price_toman AS previous_price_toman, e.asking_price_toman AS price_toman, e.price_type
    FROM listing_mark k
    JOIN listing_price_event e ON e.listing_id = k.listing_id AND e.id > k.price_event_seen_id
    JOIN listing l ON l.id = k.listing_id
    LEFT JOIN model m ON m.id = l.model_id
    LEFT JOIN trim t ON t.id = l.trim_id
    ORDER BY k.account_id, k.listing_id, e.id
    LIMIT ${limit}`.execute(db);
  let told = 0;
  let skipped = 0;
  const handled = new Map<string, { accountId: number; listingId: number; throughId: number }>();
  for (const row of rows) {
    const key = `${String(row.account_id)}:${String(row.listing_id)}`;
    handled.set(key, {
      accountId: row.account_id,
      listingId: row.listing_id,
      throughId: Math.max(row.event_id, handled.get(key)?.throughId ?? 0),
    });
    // A drop is an asking price below the listing's latest earlier asking price (data-model.md, listing_price_event).
    if (
      row.price_type !== 'asking' ||
      row.price_toman === null ||
      row.previous_price_toman === null ||
      row.price_toman >= row.previous_price_toman
    ) {
      continue;
    }
    const outcome = await createNotification(db, {
      accountId: row.account_id,
      kind: 'listing_price_drop',
      listingId: row.listing_id,
      payload: {
        priceEventId: row.event_id,
        carName: carNameOf(row),
        ...yearOf(row),
        previousPriceToman: row.previous_price_toman,
        priceToman: row.price_toman,
      },
    });
    if (outcome.status === 'created') told += 1;
    else skipped += 1;
  }
  for (const { accountId, listingId, throughId } of handled.values()) {
    await sql`
      UPDATE listing_mark SET price_event_seen_id = ${throughId}
      WHERE account_id = ${accountId} AND listing_id = ${listingId} AND price_event_seen_id < ${throughId}`.execute(
      db,
    );
  }
  return { told, skipped, read: rows.length };
}

/**
 * Tells every buyer whose marked listing left the market (sold, expired, gone) or came back of it, and moves the mark's
 * seen status to the listing's. A change between two off-market statuses, or to and from `removed` (taken down by us),
 * moves the status and tells nobody. The notification's version is the mark's count of announced changes, so a listing
 * that leaves twice is announced twice.
 */
async function notifyStatusChanges(
  db: Kysely<DB>,
  limit: number,
): Promise<{ off: number; back: number; skipped: number; read: number }> {
  const { rows } = await sql<
    CarFacts & {
      account_id: number;
      listing_id: number;
      seen_status: string;
      status_version: number;
      status: string;
      price_toman: number | null;
    }
  >`
    SELECT k.account_id, k.listing_id, k.seen_status, k.status_version, l.status,
           coalesce(t.name_fa, m.name_fa, l.title, l.source_model_key) AS car_name, l.model_year_sh,
           l.asking_price_toman AS price_toman
    FROM listing_mark k
    JOIN listing l ON l.id = k.listing_id
    LEFT JOIN model m ON m.id = l.model_id
    LEFT JOIN trim t ON t.id = l.trim_id
    WHERE k.seen_status <> l.status
    ORDER BY k.account_id, k.listing_id
    LIMIT ${limit}
    FOR UPDATE OF k SKIP LOCKED`.execute(db);
  let off = 0;
  let back = 0;
  let skipped = 0;
  for (const row of rows) {
    const leaves = row.seen_status === 'active' && OFF_MARKET.includes(row.status);
    const returns = OFF_MARKET.includes(row.seen_status) && row.status === 'active';
    let version = row.status_version;
    if (leaves || returns) {
      version += 1;
      const common = {
        accountId: row.account_id,
        listingId: row.listing_id,
      } as const;
      const outcome = leaves
        ? await createNotification(db, {
            ...common,
            kind: 'listing_off_market',
            payload: {
              listingId: row.listing_id,
              version,
              status: row.status as 'sold' | 'expired' | 'gone',
              carName: carNameOf(row),
              ...yearOf(row),
            },
          })
        : await createNotification(db, {
            ...common,
            kind: 'listing_relisted',
            payload: {
              listingId: row.listing_id,
              version,
              carName: carNameOf(row),
              ...yearOf(row),
              ...(row.price_toman === null ? {} : { priceToman: row.price_toman }),
            },
          });
      if (outcome.status === 'created') {
        if (leaves) off += 1;
        else back += 1;
      } else skipped += 1;
    }
    await sql`
      UPDATE listing_mark SET seen_status = ${row.status}, status_version = ${version}
      WHERE account_id = ${row.account_id} AND listing_id = ${row.listing_id}`.execute(db);
  }
  return { off, back, skipped, read: rows.length };
}

/** One batch of both kinds of events, in one transaction; fewer rows than the limit in both means nothing is left. */
export async function notifyMarkEvents(db: Kysely<DB>, limit: number): Promise<MarkRun & { more: boolean }> {
  return db.transaction().execute(async (trx) => {
    const drops = await notifyPriceDrops(trx, limit);
    const status = await notifyStatusChanges(trx, limit);
    return {
      priceDrops: drops.told,
      offMarket: status.off,
      relisted: status.back,
      skipped: drops.skipped + status.skipped,
      more: drops.read >= limit || status.read >= limit,
    };
  });
}
