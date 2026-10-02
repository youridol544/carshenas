import 'server-only';
import { database } from '@/server/db/database';
import { requestListingRecheck, type RecheckAnswer } from '@/server/db/sql-helpers';

// What opening a listing page changes (CS-64, CS-35): one re-check request, which the worker drains into a high-priority
// lane job (the web app never touches the queue, ADR-0018). The decision is the database's (the function
// request_listing_recheck, migration 20261002222059): the listing must be active and its own page last read longer ago than
// the freshness window; a second request for the same listing, pending, is a no-op; and, because the action is public, at
// most 200 requests wait and 120 are made in an hour, so no loop over ids can spend the source's daily request budget.

export type { RecheckAnswer };

/** Asks for a stale, active listing's page to be read again; says what became of the asking. */
export async function requestRecheck(listingId: number): Promise<RecheckAnswer> {
  const row = await database()
    .selectNoFrom(requestListingRecheck(listingId).as('answer'))
    .executeTakeFirstOrThrow();
  return row.answer;
}
