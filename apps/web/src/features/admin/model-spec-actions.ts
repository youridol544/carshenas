'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { readModelSpecForm } from '@/features/admin/model-spec-schemas';
import type { ModelSpecState } from '@/features/admin/model-spec-types';
import { setModelSpec } from '@/features/admin/server/model-spec-mutations';
import { requireSuperadmin } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError, logger } from '@/server/observability/logger';

// A model's or trim's engine volume and origin (CS-99, ADR-0023). A public POST endpoint: it checks that the request
// came from a page of this site and that a superadmin sent it (anyone else gets the not-found page), parses the whole
// form, checks the values by the table's own rules, lets the database decide and writes one log line with the outcome.
// Search and the pages read the change within a minute (the search table's refresh), so no cache is dropped here.

const log = logger.child({ component: 'admin' });

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that changes a model spec came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

export async function setModelSpecAction(
  _previous: ModelSpecState,
  formData: FormData,
): Promise<ModelSpecState> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  const superadmin = await requireSuperadmin();
  const submission = Date.now();
  const read = readModelSpecForm(formData);
  if (!read.ok) {
    return read.problem === null
      ? { status: 'invalid', submission }
      : { status: 'problem', submission, problem: read.problem };
  }
  const { form } = read;
  let outcome;
  try {
    outcome = await setModelSpec(form, superadmin.id);
  } catch (error) {
    captureError(error, {
      message: 'model spec change failed',
      fields: { modelId: form.modelId, trimId: form.trimId, intent: form.intent, accountId: superadmin.id },
    });
    refresh();
    return { status: 'failed', submission, intent: form.intent };
  }
  log.info('model spec change', {
    modelId: form.modelId,
    trimId: form.trimId,
    intent: form.intent,
    outcome,
    accountId: superadmin.id,
  });
  refresh();
  return { status: outcome, submission, intent: form.intent };
}
