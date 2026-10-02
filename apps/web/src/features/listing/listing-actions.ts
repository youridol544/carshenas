'use server';

import { headers } from 'next/headers';
import { recheckSchema } from '@/features/listing/listing-schemas';
import type { RecheckResult } from '@/features/listing/listing-types';
import { requestRecheck } from '@/features/listing/server/listing-mutations';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError } from '@/server/observability/logger';

// The listing page's one action (CS-64): ask for a stale listing to be read again. A public POST endpoint, so it checks
// that the request came from a page of this site, parses its input, and lets the database decide whether the listing
// needs it (listing-mutations.ts). Setting "a re-check is wanted" is idempotent: asking twice asks once. Nobody needs
// to be signed in; the request carries no personal data.

export async function requestRecheckAction(input: unknown): Promise<RecheckResult> {
  if (!isSameOriginRequest(await headers()))
    return { status: 'failed', message: LISTING_COPY.freshness.failed };
  const parsed = recheckSchema.safeParse(input);
  if (!parsed.success) return { status: 'failed', message: LISTING_COPY.freshness.failed };
  try {
    const answer = await requestRecheck(parsed.data.id);
    if (answer === 'capped') return { status: 'busy', message: LISTING_COPY.freshness.busy };
  } catch (error) {
    captureError(error, {
      message: 'recording a re-check request failed',
      fields: { listingId: parsed.data.id },
    });
    return { status: 'failed', message: LISTING_COPY.freshness.failed };
  }
  return { status: 'queued' };
}
