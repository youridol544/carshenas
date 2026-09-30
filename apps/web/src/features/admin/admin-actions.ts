'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { readChangeJobStateForm, readChangeSourceStateForm } from '@/features/admin/admin-schemas';
import type {
  ChangeJobStateState,
  ChangeSourceStateState,
  JobStateOutcome,
  SourceStateOutcome,
} from '@/features/admin/admin-types';
import { changeJobState } from '@/features/admin/server/job-mutations';
import { changeSourceState } from '@/features/admin/server/source-mutations';
import { requireSuperadmin } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError, logger } from '@/server/observability/logger';

// The superadmin section's actions (CS-40, ADR-0023). Each is a public POST endpoint: it checks that the request came
// from a page of this site and that a superadmin sent it (anyone else gets the not-found page, as the section's pages
// answer), parses the whole form, lets the database decide, and writes one log line with the outcome. A database that
// does not answer is reported and answered in the form's own line, so the rest of the screen keeps working.

const log = logger.child({ component: 'admin' });

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that changes a source or a job came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

/** Sets a source to the state the person chose: the target, never a toggle, so a second press changes nothing. */
export async function changeSourceStateAction(
  _previous: ChangeSourceStateState,
  formData: FormData,
): Promise<ChangeSourceStateState> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  const superadmin = await requireSuperadmin();
  const submission = Date.now();
  const form = readChangeSourceStateForm(formData);
  if (form === undefined) return { status: 'invalid', submission };

  let outcome: SourceStateOutcome;
  try {
    outcome = await changeSourceState(form, superadmin.id);
  } catch (error) {
    captureError(error, {
      message: 'source state change failed',
      fields: { sourceId: form.sourceId, chosen: form.chosen, accountId: superadmin.id },
    });
    refresh();
    return { status: 'failed', submission, chosen: form.chosen };
  }
  log.info('source state change', {
    sourceId: form.sourceId,
    seenState: form.seenState,
    chosen: form.chosen,
    outcome,
    accountId: superadmin.id,
  });
  // The page shows the source as it is now: the new state, or the one that made the page stale.
  refresh();
  return { status: outcome, submission, chosen: form.chosen };
}

/** Retries a failed job or cancels one waiting to run again (CS-41): the target, so a second press changes nothing. */
export async function changeJobStateAction(
  _previous: ChangeJobStateState,
  formData: FormData,
): Promise<ChangeJobStateState> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  const superadmin = await requireSuperadmin();
  const submission = Date.now();
  const form = readChangeJobStateForm(formData);
  if (form === undefined) return { status: 'invalid', submission };

  let outcome: JobStateOutcome;
  try {
    outcome = await changeJobState(form, superadmin.id);
  } catch (error) {
    captureError(error, {
      message: 'job state change failed',
      fields: { queue: form.queue, jobId: form.jobId, action: form.action, accountId: superadmin.id },
    });
    refresh();
    return { status: 'failed', submission, action: form.action };
  }
  log.info('job state change', {
    queue: form.queue,
    jobId: form.jobId,
    seenState: form.seenState,
    action: form.action,
    outcome,
    accountId: superadmin.id,
  });
  refresh();
  return { status: outcome, submission, action: form.action };
}
