import 'server-only';
import type { JsonObject } from '@carshenas/db/db-types';
import type { LabelOf } from '@carshenas/search/kinds';
import { describeSearch, fromStoredSearch, type Search } from '@carshenas/search/search';
import { nameOnScreen } from '@carshenas/locale/names';
import { makeLabelOf } from '@/features/search/search-labels';
import type { ListingCard, SearchFacets } from '@/features/search/search-types';
import { readBodyTypeLabels } from '@/features/search/server/search-labels';
import { readFilterOptionCounts, searchListings } from '@/features/search/server/search-queries';
import {
  MATCH_COUNT_CAP,
  FILE_PAGE_SIZE,
  type SearchFileState,
} from '@/features/search-files/search-files-rules';
import type { SearchFileSummary } from '@/features/search-files/search-files-types';
import { readDatabase } from '@/server/db/database';
import { countFileMatches } from '@/server/db/search-file-matches';
import { captureError, logger } from '@/server/observability/logger';

// Reads of a buyer's search files (CS-70, ADR-0030), always for the account the caller took from the session: every
// query filters on it, so no id from an address can reach another buyer's file. A file keeps only its search; its
// matches are read from search_document with searchableWhere(), the one function the search page, the API and the
// matching job (CS-72) share, so a file finds exactly what the search page shows. A listing is new to a buyer when
// Carshenas first saw it (listing.created_at) after the file's viewed_at. Plans are in the task's notes.

const log = logger.child({ component: 'search-files' });

type FileRow = {
  id: number;
  name: string;
  search: unknown;
  status: SearchFileState;
  created_at: Date;
  viewed_at: Date;
  status_changed_at: Date;
};

const FILE_COLUMNS = [
  'id',
  'name',
  'search',
  'status',
  'created_at',
  'viewed_at',
  'status_changed_at',
] as const;

/** The names of makes, models, body types and places as the search page's chips write them. */
export async function readLabelOf(): Promise<LabelOf> {
  const [options, bodyTypes] = await Promise.all([readFilterOptionCounts(), readBodyTypeLabels()]);
  const named: Record<string, SearchFacets[keyof SearchFacets]> = {};
  for (const [kind, list] of Object.entries(options)) {
    named[kind] = list.map((option) => ({ ...option, label: nameOnScreen(option.label) }));
  }
  return makeLabelOf(named as SearchFacets, bodyTypes);
}

async function summarise(row: FileRow, labelOf: LabelOf): Promise<SearchFileSummary> {
  const common = {
    id: row.id,
    name: row.name,
    state: row.status,
    createdAt: row.created_at.toISOString(),
    viewedAt: row.viewed_at.toISOString(),
  };
  const parsed = fromStoredSearch(row.search);
  if (!parsed.success) return { ...common, chips: [], readable: false, counts: null };
  const chips = describeSearch(parsed.data, labelOf);
  try {
    return {
      ...common,
      chips,
      readable: true,
      counts: await countFileMatches(readDatabase(), row.id, parsed.data, MATCH_COUNT_CAP),
    };
  } catch (error) {
    // One file that cannot be counted must not hide the others: its numbers are said to be missing, never zero.
    captureError(error, { message: 'counting a search file failed', fields: { fileId: row.id } });
    return { ...common, chips, readable: true, counts: null };
  }
}

/** The account's files, newest first, each with how many cars match it and how many are new. */
export async function listSearchFiles(accountId: number): Promise<SearchFileSummary[]> {
  const [rows, labelOf] = await Promise.all([
    readDatabase()
      .selectFrom('search_file')
      .select(FILE_COLUMNS)
      .where('account_id', '=', accountId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .execute(),
    readLabelOf(),
  ]);
  return Promise.all(rows.map((row) => summarise(row, labelOf)));
}

/** How many files the account keeps and how many of them have something new, for the account page's card. */
export async function readSearchFileOverview(accountId: number): Promise<{
  total: number;
  top: SearchFileSummary[];
  newTotal: number;
}> {
  const files = await listSearchFiles(accountId);
  const watched = files.filter((file) => file.state === 'watching');
  const top = (watched.length > 0 ? watched : files).slice(0, 3);
  return {
    total: files.length,
    top,
    newTotal: watched.reduce((sum, file) => sum + (file.counts?.newCount ?? 0), 0),
  };
}

export type SearchFilePage = {
  readonly file: SearchFileSummary;
  /** The stored search, for the link to the search page; null when it is unreadable. */
  readonly search: Search | null;
  readonly cards: readonly ListingCard[];
  /** The ids among the cards that are new since the buyer last looked. */
  readonly newIds: readonly number[];
  readonly resultsFailed: boolean;
};

/**
 * One of the account's files with its best matches, ranked by deal; null when the id is not one of the account's. The
 * file's own search order is not used: a file is about the best deals, and the search page has every order.
 */
export async function readSearchFilePage(accountId: number, id: number): Promise<SearchFilePage | null> {
  const [row, labelOf] = await Promise.all([
    readDatabase()
      .selectFrom('search_file')
      .select(FILE_COLUMNS)
      .where('account_id', '=', accountId)
      .where('id', '=', id)
      .executeTakeFirst(),
    readLabelOf(),
  ]);
  if (row === undefined) return null;
  const file = await summarise(row, labelOf);
  const parsed = fromStoredSearch(row.search);
  if (!parsed.success) return { file, search: null, cards: [], newIds: [], resultsFailed: false };
  const search = parsed.data;
  try {
    const result = await searchListings({
      search: { ...search, sort: undefined },
      limit: FILE_PAGE_SIZE,
      quiet: true,
    });
    if (result.status !== 'ok') throw new Error('the first page of a search file was refused');
    const cards = result.page.results;
    const fresh =
      cards.length === 0
        ? []
        : await readDatabase()
            .selectFrom('listing as l')
            .select('l.id')
            .where(
              'l.id',
              'in',
              cards.map((card) => card.id),
            )
            .where((eb) =>
              eb(
                'l.created_at',
                '>',
                eb
                  .selectFrom('search_file as f')
                  .select('f.viewed_at')
                  .where('f.id', '=', id)
                  .where('f.account_id', '=', accountId),
              ),
            )
            .execute();
    return { file, search, cards, newIds: fresh.map((listing) => listing.id), resultsFailed: false };
  } catch (error) {
    captureError(error, { message: 'reading a search file page failed', fields: { fileId: id } });
    log.warn('search file results unavailable', { fileId: id });
    return { file, search, cards: [], newIds: [], resultsFailed: true };
  }
}

/** The account's file that already holds this exact search, or undefined. */
export async function findFileBySearch(
  accountId: number,
  stored: JsonObject,
): Promise<{ id: number; name: string; state: SearchFileState } | undefined> {
  const row = await readDatabase()
    .selectFrom('search_file')
    .select(['id', 'name', 'status'])
    .where('account_id', '=', accountId)
    .where('search', '=', stored)
    .executeTakeFirst();
  return row === undefined ? undefined : { id: row.id, name: row.name, state: row.status };
}

/** How many files the account has (against the limit), for the save dialog. */
export async function countSearchFiles(accountId: number): Promise<number> {
  const row = await readDatabase()
    .selectFrom('search_file')
    .select((eb) => eb.fn.countAll<number>().as('files'))
    .where('account_id', '=', accountId)
    .executeTakeFirstOrThrow();
  return row.files;
}
