'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { readDecideCrawlRequestForm } from '@/features/admin/crawl-request-schemas';
import type { DecideCrawlRequestState, DecideOutcome } from '@/features/admin/crawl-request-types';
import { decideCrawlRequest } from '@/features/admin/server/crawl-request-mutations';
import { requireSuperadmin } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError, logger } from '@/server/observability/logger';

// The superadmin's decision on a crawl request (CS-71, ADR-0023). A public POST endpoint: it checks that the request
// came from a page of this site and that a superadmin sent it (anyone else gets the not-found page), parses the whole
// form, lets the database decide (the target state, never a toggle, so a second press changes nothing) and writes one
// log line with the outcome. A database that does not answer is reported and answered in the form's own line.

const log = logger.child({ component: 'admin' });

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that decides a crawl request came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

export async function decideCrawlRequestAction(
  _previous: DecideCrawlRequestState,
  formData: FormData,
): Promise<DecideCrawlRequestState> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  const superadmin = await requireSuperadmin();
  const submission = Date.now();
  const form = readDecideCrawlRequestForm(formData);
  if (form === undefined) return { status: 'invalid', submission };

  let outcome: DecideOutcome;
  try {
    outcome = await decideCrawlRequest(form, superadmin.id);
  } catch (error) {
    captureError(error, {
      message: 'crawl request decision failed',
      fields: { requestId: form.requestId, decision: form.decision, accountId: superadmin.id },
    });
    refresh();
    return { status: 'failed', submission, decision: form.decision };
  }
  log.info('crawl request decision', {
    requestId: form.requestId,
    seenState: form.seenState,
    decision: form.decision,
    outcome,
    accountId: superadmin.id,
  });
  refresh();
  return { status: outcome, submission, decision: form.decision };
}
