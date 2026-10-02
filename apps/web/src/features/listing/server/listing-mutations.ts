import 'server-only';
import { FRESHNESS_WINDOW_HOURS } from '@/features/listing/listing-rules';
import { database } from '@/server/db/database';
import { secondsAgo } from '@/server/db/sql-helpers';

// What opening a listing page changes (CS-64, CS-35): one re-check request, which the worker drains into a high-priority
// lane job (the web app never touches the queue, ADR-0018). The write is guarded by the database, not by a read before
// it: the row is inserted from a select of the listing only while it is on the market and its own page was last read
// longer ago than the freshness window, and the partial unique index listing_recheck_request_pending_unique makes a
// second request for the same listing, pending, a no-op. So a repeat, a double press and a crawler hammering the page
// all record the one request; a fresh or gone listing records none.

/** Records a request to read a stale, active listing's page again; true when a new request was recorded. */
export async function requestRecheck(listingId: number): Promise<boolean> {
  const result = await database()
    .insertInto('listing_recheck_request')
    .columns(['listing_id'])
    .expression((eb) =>
      eb
        .selectFrom('listing')
        .select('id')
        .where('id', '=', listingId)
        .where('status', '=', 'active')
        .where((stale) =>
          stale.or([
            stale('last_checked_at', 'is', null),
            stale('last_checked_at', '<', secondsAgo(FRESHNESS_WINDOW_HOURS * 3600)),
          ]),
        ),
    )
    .onConflict((conflict) => conflict.doNothing())
    .executeTakeFirst();
  return (result.numInsertedOrUpdatedRows ?? 0n) > 0n;
}
