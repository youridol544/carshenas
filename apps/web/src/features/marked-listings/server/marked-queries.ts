import 'server-only';
import type { MarkedRow } from '@/features/marked-listings/marked-view';
import { MAX_MARKED_LISTINGS } from '@/features/marks/marks-rules';
import { readDatabase } from '@/server/db/database';
import { nameOf } from '@/server/db/sql-helpers';

// The signed-in buyer's marked listings, all of them (at most MAX_MARKED_LISTINGS, so the page filters and counts in memory),
// newest mark first: for each, what the listing says now, its rating from the latest succeeded valuation run (through
// listing_filter_row, which carries every status), and the first photo's address. Every query filters on the account the
// caller took from the session. listing_mark_account_recent_idx serves the order; the rest are primary-key and index reads
// of one listing each (the plan is in the task's notes).

/** How many marked listings the account has, for its page: an index-only count on the primary key. */
export async function countMarkedListings(accountId: number): Promise<number> {
  const { count } = await readDatabase()
    .selectFrom('listing_mark')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('account_id', '=', accountId)
    .executeTakeFirstOrThrow();
  return count;
}

export async function listMarkedListings(accountId: number): Promise<MarkedRow[]> {
  const rows = await readDatabase()
    .selectFrom('listing_mark as k')
    .innerJoin('listing as l', 'l.id', 'k.listing_id')
    .leftJoin('listing_filter_row as r', 'r.listing_id', 'k.listing_id')
    .leftJoin('make as mk', 'mk.id', 'l.make_id')
    .leftJoin('model as m', 'm.id', 'l.model_id')
    .leftJoin('trim as t', 't.id', 'l.trim_id')
    .leftJoin('city as c', 'c.id', 'l.city_id')
    .leftJoin('listing_photo as p', (join) =>
      join.onRef('p.listing_id', '=', 'k.listing_id').on('p.position', '=', 1),
    )
    .select([
      'k.listing_id',
      'k.created_at as marked_at',
      'k.marked_price_toman',
      'l.status',
      'l.delisted_at',
      'l.title',
      'l.model_year_sh',
      'l.mileage_km',
      'l.gearbox',
      'l.district_fa',
      'l.price_type',
      'l.asking_price_toman',
      'c.name_fa as city_name',
      'r.deal_rating',
      'r.price_gap_pct',
      'p.thumbnail_url',
      'p.url as photo_url',
      nameOf('t').as('trim_name'),
      nameOf('m').as('model_name'),
      nameOf('mk').as('make_name'),
    ])
    .where('k.account_id', '=', accountId)
    .orderBy('k.created_at', 'desc')
    .orderBy('k.listing_id', 'desc')
    .limit(MAX_MARKED_LISTINGS)
    .execute();
  return rows.map((row) => ({
    listingId: row.listing_id,
    markedAt: row.marked_at,
    markedPriceToman: row.marked_price_toman,
    status: row.status,
    delistedAt: row.delisted_at,
    name: row.trim_name ?? row.model_name ?? row.make_name,
    title: row.title,
    modelYearSh: row.model_year_sh,
    mileageKm: row.mileage_km,
    gearbox: row.gearbox,
    cityName: row.city_name,
    districtFa: row.district_fa,
    priceType: row.price_type,
    askingPriceToman: row.asking_price_toman,
    dealRating: row.deal_rating,
    priceGapPct: row.price_gap_pct === null ? null : Number(row.price_gap_pct),
    photoUrl: row.thumbnail_url ?? row.photo_url,
  }));
}
