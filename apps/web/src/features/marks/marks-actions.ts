'use server';

import { headers } from 'next/headers';
import { MARKS_COPY } from '@/features/marks/marks-copy';
import { setMarkSchema } from '@/features/marks/marks-schemas';
import type { MarkActionResult } from '@/features/marks/marks-types';
import { markListing, unmarkListing } from '@/features/marks/server/mark-mutations';
import { currentAccount } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError, logger } from '@/server/observability/logger';

// Marking a listing (CS-69), behind an optimistic control. A public POST endpoint: it checks that the request came from a
// page of this site, parses its whole input, takes the account from the session (never from the input) and sets the
// target state the buyer asked for; a database that does not answer comes back as a Farsi message beside the control,
// reported once. A visitor is told to sign in, never marked. It does not refresh the page: the control that asked keeps the
// answer (marks-provider.tsx), and refreshing would read a whole search again for one bookmark.

const log = logger.child({ component: 'marks' });

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that changes marked listings came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

function failed(
  reason: 'signed_out' | 'full' | 'missing' | 'unavailable',
  message: string,
): MarkActionResult {
  return { status: 'failed', reason, message };
}

/** Marks a listing or takes its mark off: the target state, never a toggle. */
export async function setListingMarkedAction(input: unknown): Promise<MarkActionResult> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  const account = await currentAccount();
  if (account === null) return failed('signed_out', MARKS_COPY.failures.signedOut);
  const parsed = setMarkSchema.safeParse(input);
  if (!parsed.success) return failed('unavailable', MARKS_COPY.failures.mark);
  const { listingId, marked } = parsed.data;
  try {
    if (marked) {
      const result = await markListing(account.id, listingId);
      if (result === 'full') return failed('full', MARKS_COPY.failures.full);
      if (result === 'missing') return failed('missing', MARKS_COPY.failures.missing);
    } else {
      await unmarkListing(account.id, listingId);
    }
  } catch (error) {
    captureError(error, {
      message: 'changing a marked listing failed',
      fields: { accountId: account.id, listingId },
    });
    return failed('unavailable', marked ? MARKS_COPY.failures.mark : MARKS_COPY.failures.unmark);
  }
  log.info('listing mark changed', { accountId: account.id, listingId, marked });
  return { status: 'done' };
}
