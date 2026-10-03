'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { fromStoredSearch } from '@carshenas/search/search';
import { CRAWL_REQUESTS_COPY } from '@/lib/crawl-requests-copy';
import { isFewMatches } from '@/lib/crawl-requests-rules';
import { requestScopesOf } from '@/lib/crawl-requests-scope';
import type { AskResult } from '@/lib/crawl-requests-types';
import { isAskable } from '@/features/search-files/server/crawl-request-queries';
import { askForCrawl } from '@/server/db/crawl-request-mutations';
import { readScopeStates, resolveScopes } from '@/server/db/crawl-request-reads';
import { MATCH_COUNT_CAP } from '@/features/search-files/search-files-rules';
import { fileIdSchema } from '@/features/search-files/search-files-schemas';
import { currentAccount } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { readDatabase } from '@/server/db/database';
import { countFileMatches } from '@/server/db/search-file-matches';
import { captureError, logger } from '@/server/observability/logger';

// The buyer's ask for a deeper crawl (CS-71, ADR-0033). A public POST endpoint: it checks that the request came from a
// page of this site, parses its whole input (a file's id and nothing else: which models are asked is read from the
// file's own search, never from the client), takes the account from the session, recomputes whether the file may ask
// (the shared rule, crawl-requests-rules.ts) and asks in one transaction. The limits and a declined request come back
// as results the database decided, mapped from constraint names.

const log = logger.child({ component: 'crawl-requests' });
const ERRORS = CRAWL_REQUESTS_COPY.card.errors;

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that asks for a crawl came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

export async function askCrawlAction(input: unknown): Promise<AskResult> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  const account = await currentAccount();
  if (account === null) return { status: 'signed_out', message: ERRORS.signedOut };
  const parsed = fileIdSchema.safeParse(input);
  if (!parsed.success) return { status: 'failed', message: ERRORS.failed };
  const fileId = parsed.data.id;
  try {
    const db = readDatabase();
    const file = await db
      .selectFrom('search_file')
      .select('search')
      .where('id', '=', fileId)
      .where('account_id', '=', account.id)
      .executeTakeFirst();
    if (file === undefined) return { status: 'gone', message: ERRORS.gone };
    const search = fromStoredSearch(file.search);
    if (!search.success) return { status: 'nothing_to_ask' };
    const { scopes, tooMany } = requestScopesOf(search.data.filters);
    if (tooMany) return { status: 'too_many' };
    const counts = await countFileMatches(db, fileId, search.data, MATCH_COUNT_CAP);
    if (!isFewMatches(counts.matches.count)) return { status: 'not_needed' };
    const resolved = await resolveScopes(db, scopes);
    const states = await readScopeStates(db, resolved, fileId);
    const targets = resolved.filter((scope) => {
      const state = states.get(scope.key);
      return state !== undefined && isAskable(state);
    });
    if (targets.length === 0) return { status: 'nothing_to_ask' };
    const outcome = await askForCrawl(
      account.id,
      fileId,
      targets.map((scope) => ({ modelId: scope.modelId, trimId: scope.trimId })),
    );
    if (outcome.status === 'gone') return { status: 'gone', message: ERRORS.gone };
    if (outcome.status === 'asked') {
      log.info('crawl requested', { accountId: account.id, fileId, scopes: outcome.count });
      refresh();
      return outcome;
    }
    return outcome;
  } catch (error) {
    captureError(error, { message: 'asking for a crawl failed', fields: { accountId: account.id, fileId } });
    return { status: 'failed', message: ERRORS.failed };
  }
}
