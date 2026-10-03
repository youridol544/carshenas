'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { readChangeTrackedForm } from '@/features/admin/tracked-model-schemas';
import type { ChangeTrackedState } from '@/features/admin/tracked-model-types';
import { changeTrackedModel } from '@/features/admin/server/tracked-model-mutations';
import { requireSuperadmin } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError, logger } from '@/server/observability/logger';

// A change to the tracked models (CS-53, ADR-0023). A public POST endpoint: it checks that the request came from a page
// of this site and that a superadmin sent it (anyone else gets the not-found page), parses the whole form, lets the
// database decide and writes one log line with the outcome. A database that does not answer is reported and answered
// in the form's own line.

const log = logger.child({ component: 'admin' });

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that changes the tracked models came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

export async function changeTrackedModelAction(
  _previous: ChangeTrackedState,
  formData: FormData,
): Promise<ChangeTrackedState> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  const superadmin = await requireSuperadmin();
  const submission = Date.now();
  const form = readChangeTrackedForm(formData);
  if (form === undefined) return { status: 'invalid', submission };

  let outcome;
  try {
    outcome = await changeTrackedModel(form, superadmin.id);
  } catch (error) {
    captureError(error, {
      message: 'tracked model change failed',
      fields: { modelId: form.modelId, intent: form.intent, accountId: superadmin.id },
    });
    refresh();
    return { status: 'failed', submission, intent: form.intent };
  }
  log.info('tracked model change', {
    modelId: form.modelId,
    trimId: form.trimId,
    intent: form.intent,
    outcome,
    accountId: superadmin.id,
  });
  refresh();
  return { status: outcome, submission, intent: form.intent };
}
