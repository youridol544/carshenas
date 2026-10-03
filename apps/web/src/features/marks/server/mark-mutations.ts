import 'server-only';
import { constraintViolation } from '@carshenas/db/database-errors';
import { database } from '@/server/db/database';
import { askingPriceOf, newestPriceEventId } from '@/server/db/sql-helpers';

// What a buyer changes in their marks (CS-69), for the account the caller took from the session: the web role may insert
// and delete its own marks and nothing else. Each write sets a target state, so a second press, or a retry after a lost
// answer, changes nothing. The database decides everything it can: the primary key (account, listing) says a listing is
// marked once, the cap trigger says how many, the foreign key says the listing exists.

export type MarkResult = 'marked' | 'already' | 'missing' | 'full';

/**
 * Marks a listing for the account. The price and status the buyer is looking at, and the newest price event they have
 * seen, are read from the listing in the same statement as the insert, so a later change is what the buyer is told of.
 */
export async function markListing(accountId: number, listingId: number): Promise<MarkResult> {
  const db = database();
  try {
    const inserted = await db
      .insertInto('listing_mark')
      .columns(['account_id', 'listing_id', 'marked_price_toman', 'seen_status', 'price_event_seen_id'])
      .expression((eb) =>
        eb
          .selectFrom('listing as l')
          .select([
            eb.val(accountId).as('account_id'),
            'l.id as listing_id',
            askingPriceOf('l').as('marked_price_toman'),
            'l.status as seen_status',
            newestPriceEventId('l').as('price_event_seen_id'),
          ])
          .where('l.id', '=', listingId),
      )
      .onConflict((conflict) => conflict.constraint('listing_mark_pkey').doNothing())
      .returning('listing_id')
      .executeTakeFirst();
    if (inserted !== undefined) return 'marked';
    // Nothing was inserted: the listing was already marked (a double press), or there is no such listing.
    const existing = await db
      .selectFrom('listing_mark')
      .select('listing_id')
      .where('account_id', '=', accountId)
      .where('listing_id', '=', listingId)
      .executeTakeFirst();
    return existing === undefined ? 'missing' : 'already';
  } catch (error) {
    const violation = constraintViolation(error);
    if (
      violation !== undefined &&
      'constraint' in violation &&
      violation.constraint === 'listing_mark_account_cap'
    ) {
      return 'full';
    }
    throw error;
  }
}

/** Takes a mark off; unmarking a listing that is not marked changes nothing. */
export async function unmarkListing(accountId: number, listingId: number): Promise<void> {
  await database()
    .deleteFrom('listing_mark')
    .where('account_id', '=', accountId)
    .where('listing_id', '=', listingId)
    .execute();
}
