import 'server-only';
import type { MarkSnapshot } from '@/features/marks/marks-types';
import { MAX_MARKED_LISTINGS } from '@/features/marks/marks-rules';
import { currentAccount } from '@/server/auth/current-account';
import { readDatabase } from '@/server/db/database';
import { captureError } from '@/server/observability/logger';

// The listings the signed-in buyer has marked, as plain ids, for the control on every card and on the listing page. One
// indexed read of the primary key's leading column (listing_mark_pkey), at most MAX_MARKED_LISTINGS rows. The session
// decides whose they are. A visitor has none. A database that does not answer leaves a signed-in buyer's controls
// unmarked, never the page failed (the failure is reported once); a press then fails in its own Farsi message.
// The session is read outside the try: reading it at prerender time is how Next.js learns this is request-time work.

/** The marks of whoever is asking, or the fact that nobody is signed in. */
export async function loadMarkSnapshot(): Promise<MarkSnapshot> {
  const account = await currentAccount();
  if (account === null) return { signedIn: false };
  try {
    const rows = await readDatabase()
      .selectFrom('listing_mark')
      .select('listing_id')
      .where('account_id', '=', account.id)
      .limit(MAX_MARKED_LISTINGS)
      .execute();
    return { signedIn: true, marked: rows.map((row) => row.listing_id) };
  } catch (error) {
    captureError(error, { message: 'reading the marked listings failed', fields: { accountId: account.id } });
    return { signedIn: true, marked: [] };
  }
}
