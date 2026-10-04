'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { toStoredSearch } from '@carshenas/search/search';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import { askToAddModelSchema } from '@/features/check-link/check-link-schemas';
import type { AskModelResult } from '@/features/check-link/check-link-types';
import { findKnownListing, readLinkCar } from '@/features/check-link/server/check-link-queries';
import { readPastedLink } from '@/lib/pasted-link';
import { currentAccount } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { readCatalogueModel, readModelRequest, type CatalogueModel } from '@/server/db/coverage-reads';
import { askForModelFromLink } from '@/server/db/crawl-request-mutations';
import { readDatabase } from '@/server/db/database';
import { captureError, logger } from '@/server/observability/logger';
import { takeToken } from '@/server/token-bucket';

// The buyer's ask to add a model, from a pasted link (CS-115, ADR-0046, ADR-0036). A public POST endpoint: it checks that
// the request came from a page of this site, parses its whole input (a link, and the model's key only when the link names
// a make and the buyer chose among its models), takes the account from the session, reads the car from the link again
// (the model never comes from the client alone), checks that Carshenas does not read it already, and asks in one
// transaction: the buyer's file for the model is found or made and the model's crawl request is found or made and linked
// to it. The limits and a declined request come back as results the database decided, mapped from constraint names. A
// visitor gets `signed_out`, and the page asks them to sign in and brings them back to the same answer.

const log = logger.child({ component: 'check-link' });
const ERRORS = CHECK_COPY.outside.errors;

// An account may ask for a handful of models in a row and one more every half minute: the database's caps are the real limit.
const ASK_RULE = { capacity: 5, perSecond: 1 / 30 } as const;

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that asks for a model came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

const UNREADABLE: AskModelResult = { status: 'unreadable', message: ERRORS.unreadable };

/** The model the link names and Carshenas does not read, or the result that says why there is none. */
async function modelToAsk(
  link: string,
  chosenKey: string | undefined,
): Promise<{ readonly model: CatalogueModel } | { readonly result: AskModelResult }> {
  const reading = readPastedLink(link);
  if (reading.kind !== 'divar_listing') return { result: UNREADABLE };
  const known = await findKnownListing(reading.token);
  const { car } = await readLinkCar(reading, known);
  const db = readDatabase();
  if (car.kind === 'model') {
    if (car.covered) return { result: { status: 'covered' } };
    const model = await readCatalogueModel(db, car.modelKey);
    return model === undefined ? { result: UNREADABLE } : { model };
  }
  // Only a make was told, none of whose models is read: the buyer chose the model among its models, and it must be one.
  if (car.kind !== 'make_outside' || chosenKey === undefined) return { result: UNREADABLE };
  if (chosenKey.split('.')[0] !== car.makeKey) return { result: UNREADABLE };
  const model = await readCatalogueModel(db, chosenKey);
  return model === undefined ? { result: UNREADABLE } : { model };
}

export async function askToAddModelAction(input: unknown): Promise<AskModelResult> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  const parsed = askToAddModelSchema.safeParse(input);
  if (!parsed.success) return { status: 'refused', message: ERRORS.failed };
  const account = await currentAccount();
  if (account === null) return { status: 'signed_out' };
  if (!takeToken('ask-model', String(account.id), ASK_RULE))
    return { status: 'refused', message: ERRORS.slow };
  try {
    const target = await modelToAsk(parsed.data.link, parsed.data.modelKey);
    if ('result' in target) return target.result;
    const { model } = target;
    const request = await readModelRequest(readDatabase(), account.id, model.id);
    if (request.fileId !== null) return { status: 'already', fileId: request.fileId };
    if (request.status === 'declined') return { status: 'declined', reason: request.reason };
    const outcome = await askForModelFromLink(account.id, model.id, {
      name: model.name.slice(0, 80),
      search: toStoredSearch({ filters: { model: [model.key] } }),
    });
    switch (outcome.status) {
      case 'asked':
        log.info('crawl requested from a pasted link', {
          accountId: account.id,
          modelId: model.id,
          madeFile: outcome.madeFile,
        });
        refresh();
        return { status: 'asked', fileId: outcome.fileId, madeFile: outcome.madeFile };
      case 'declined':
        return { status: 'declined', reason: request.reason };
      case 'no_room_for_file':
      case 'file_limit':
        return { status: 'refused', message: ERRORS.noRoom };
      case 'account_limit':
        return { status: 'refused', message: ERRORS.accountLimit };
    }
  } catch (error) {
    captureError(error, { message: 'asking to add a model failed', fields: { accountId: account.id } });
    return { status: 'refused', message: ERRORS.failed };
  }
}
