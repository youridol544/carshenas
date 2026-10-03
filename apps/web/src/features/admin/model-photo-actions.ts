'use server';

import { refresh, updateTag } from 'next/cache';
import { headers } from 'next/headers';
import { readModelPhotoForm } from '@/features/admin/model-photo-schemas';
import type { ModelPhotoState } from '@/features/admin/model-photo-types';
import { setModelPhotoLink } from '@/features/admin/server/model-photo-mutations';
import { requireSuperadmin } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError, logger } from '@/server/observability/logger';

// A model's photo link (CS-97, ADR-0023). A public POST endpoint: it checks that the request came from a page of this
// site and that a superadmin sent it (anyone else gets the not-found page), parses the whole form, checks the address by
// the table's own rules, lets the database decide and writes one log line with the outcome (never the address). A
// change drops the cache the tiles are read from, so the home page and the models index show it at once.

const log = logger.child({ component: 'admin' });

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that changes a model photo came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

export async function setModelPhotoAction(
  _previous: ModelPhotoState,
  formData: FormData,
): Promise<ModelPhotoState> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  const superadmin = await requireSuperadmin();
  const submission = Date.now();
  const read = readModelPhotoForm(formData);
  if (!read.ok) {
    return read.problem === null
      ? { status: 'invalid', submission }
      : { status: 'problem', submission, problem: read.problem };
  }
  const { form } = read;
  let outcome;
  try {
    outcome = await setModelPhotoLink(form, superadmin.id);
  } catch (error) {
    captureError(error, {
      message: 'model photo change failed',
      fields: { modelId: form.modelId, intent: form.intent, accountId: superadmin.id },
    });
    refresh();
    return { status: 'failed', submission, intent: form.intent };
  }
  log.info('model photo change', {
    modelId: form.modelId,
    intent: form.intent,
    outcome,
    accountId: superadmin.id,
  });
  if (outcome === 'changed') updateTag('model-photos');
  refresh();
  return { status: outcome, submission, intent: form.intent };
}
