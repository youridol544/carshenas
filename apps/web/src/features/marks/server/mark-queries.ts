import 'server-only';
import type { MarkSnapshot } from '@/features/marks/marks-types';
import { MAX_MARKED_LISTINGS } from '@/features/marks/marks-rules';
import { currentAccount } from '@/server/auth/current-account';
import { readDatabase } from '@/server/db/database';
import { captureError } from '@/server/observability/logger';

// The listings the signed-in buyer has marked, as plain ids, for the control on every card and on the listing page. One
// indexed read of the primary key's leading column (listing_mark_pkey), at most MAX_MARKED_LISTINGS rows. The session
// decides whose they are. A visitor has none, and a database that does not answer leaves the control as it is for a
// visitor of no account, so the page around it never fails because of it (the failure is reported once).

/** The marks of whoever is asking, or the fact that nobody is signed in. Never rejects. */
export async function loadMarkSnapshot(): Promise<MarkSnapshot> {
  try {
    const account = await currentAccount();
    if (account === null) return { signedIn: false };
    const rows = await readDatabase()
      .selectFrom('listing_mark')
      .select('listing_id')
      .where('account_id', '=', account.id)
      .limit(MAX_MARKED_LISTINGS)
      .execute();
    return { signedIn: true, marked: rows.map((row) => row.listing_id) };
  } catch (error) {
    captureError(error, { message: 'reading the marked listings failed' });
    return { signedIn: false };
  }
}
