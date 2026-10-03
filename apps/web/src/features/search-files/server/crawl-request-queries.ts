import 'server-only';
import { fromStoredSearch } from '@carshenas/search/search';
import { isFewMatches } from '@/lib/crawl-requests-rules';
import { requestScopesOf } from '@/lib/crawl-requests-scope';
import type { CrawlPanel, FileCrawlSummary, PanelScope } from '@/lib/crawl-requests-types';
import {
  readCrawlPaused,
  readScopeStates,
  resolveScopes,
  type ScopeState,
} from '@/server/db/crawl-request-reads';
import { readDatabase } from '@/server/db/database';

// The buyer's reads of crawl requests (CS-71, ADR-0036), always for the account the caller took from the session: the
// file is looked up by its owner first, so no id from an address reaches another buyer's file or its requests.

/** A scope the buyer's press would ask for: nothing asked yet, or asked by another buyer and still waiting. */
export function isAskable(state: ScopeState): boolean {
  return state.status === 'none' || (state.status === 'pending' && !state.linked);
}

/**
 * What a file's page shows of crawl requests: each model or trim the search names with where it stands, and whether
 * the press is offered. `matchCount` is the file's match count (counted to a cap), or null when it could not be counted:
 * then nothing is offered, never a guess.
 */
export async function readCrawlPanel(
  accountId: number,
  fileId: number,
  search: unknown,
  matchCount: number | null,
): Promise<CrawlPanel | null> {
  const db = readDatabase();
  const parsed = fromStoredSearch(search);
  if (!parsed.success) return null;
  const owned = await db
    .selectFrom('search_file')
    .select('id')
    .where('id', '=', fileId)
    .where('account_id', '=', accountId)
    .executeTakeFirst();
  if (owned === undefined) return null;
  const { scopes, tooMany } = requestScopesOf(parsed.data.filters);
  const [resolved, paused] = await Promise.all([resolveScopes(db, scopes), readCrawlPaused(db)]);
  const states = await readScopeStates(db, resolved, fileId);
  const panelScopes: PanelScope[] = [];
  const askable: string[] = [];
  for (const scope of resolved) {
    const state = states.get(scope.key);
    if (state === undefined) continue;
    panelScopes.push({
      key: scope.key,
      carName: scope.carName,
      status: state.status,
      linked: state.linked,
      reason: state.reason,
      decidedAt: state.decidedAt?.toISOString() ?? null,
    });
    if (isAskable(state)) askable.push(scope.key);
  }
  return {
    scopes: panelScopes,
    tooMany,
    needsModel: scopes.length === 0,
    fewMatches: matchCount !== null && isFewMatches(matchCount),
    crawlPaused: paused,
    askable,
  };
}

const URGENCY = ['pending', 'approved', 'declined', 'fulfilled'] as const;

/** For each of the account's files that raised requests, the one state worth a word on its card, and how many. */
export async function readFileCrawlSummaries(accountId: number): Promise<Map<number, FileCrawlSummary>> {
  const rows = await readDatabase()
    .selectFrom('crawl_request_file as l')
    .innerJoin('search_file as f', 'f.id', 'l.search_file_id')
    .innerJoin('crawl_request as r', 'r.id', 'l.crawl_request_id')
    .select(['l.search_file_id', 'r.state'])
    .where('f.account_id', '=', accountId)
    .execute();
  const byFile = new Map<number, string[]>();
  for (const row of rows)
    byFile.set(row.search_file_id, [...(byFile.get(row.search_file_id) ?? []), row.state]);
  const summaries = new Map<number, FileCrawlSummary>();
  for (const [fileId, states] of byFile) {
    const present = URGENCY.filter((candidate) => states.includes(candidate));
    if (present.length > 0) summaries.set(fileId, { states: present, count: states.length });
  }
  return summaries;
}
