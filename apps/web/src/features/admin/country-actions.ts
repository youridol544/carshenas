'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { readCountryForm } from '@/features/admin/country-schemas';
import type { CountryState } from '@/features/admin/country-types';
import { setCountry } from '@/features/admin/server/country-mutations';
import { requireSuperadmin } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError, logger } from '@/server/observability/logger';

// The country of a make or of one of its models (CS-103, ADR-0023). A public POST endpoint: it checks that the request
// came from a page of this site and that a superadmin sent it (anyone else gets the not-found page), parses the whole
// form, lets the database decide and writes one log line with the outcome. Search and the pages read the change within a
// minute (the search table's refresh), so no cache is dropped here.

const log = logger.child({ component: 'admin' });

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that changes a country came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

export async function setCountryAction(_previous: CountryState, formData: FormData): Promise<CountryState> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  const superadmin = await requireSuperadmin();
  const submission = Date.now();
  const read = readCountryForm(formData);
  if (!read.ok) {
    return read.problem ? { status: 'problem', submission } : { status: 'invalid', submission };
  }
  const { form } = read;
  let outcome;
  try {
    outcome = await setCountry(form, superadmin.id);
  } catch (error) {
    captureError(error, {
      message: 'country change failed',
      fields: { makeId: form.makeId, modelId: form.modelId, intent: form.intent, accountId: superadmin.id },
    });
    refresh();
    return { status: 'failed', submission, intent: form.intent };
  }
  log.info('country change', {
    makeId: form.makeId,
    modelId: form.modelId,
    intent: form.intent,
    outcome,
    accountId: superadmin.id,
  });
  refresh();
  return { status: outcome, submission, intent: form.intent };
}
