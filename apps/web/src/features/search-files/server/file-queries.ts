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
import type { CrawlPanel, FileCrawlSummary } from '@/lib/crawl-requests-types';
import { readCrawlPanel, readFileCrawlSummaries } from '@/features/search-files/server/crawl-request-queries';
import { readCatalogueLabelOf } from '@/server/db/crawl-request-reads';
import { readDatabase } from '@/server/db/database';
import { searchFileSeenBaseline } from '@/server/db/sql-helpers';
import { countFileMatches, readFileHighlights } from '@/server/db/search-file-matches';
import { formatToman, toToman } from '@carshenas/locale/toman';
import { deal } from '@carshenas/search/filters';
import { captureError, logger } from '@/server/observability/logger';

// Reads of a buyer's search files (CS-70, ADR-0031), always for the account the caller took from the session: every
// query filters on it, so no id from an address can reach another buyer's file. A file keeps only its search; its
// matches are read from search_document with searchableWhere(), the one function the search page, the API and the
// matching job (CS-72) share, so a file finds exactly what the search page shows. A listing is new to a buyer when
// it first became searchable (search_document.indexed_at, CS-72) after the file's baseline. Plans are in the task's notes.

/** Files counted at once: the pool has five connections. */
const COUNT_CONCURRENCY = 2;

const log = logger.child({ component: 'search-files' });

type FileRow = {
  id: number;
  name: string;
  search: unknown;
  status: SearchFileState;
  created_at: Date;
  viewed_at: Date;
  status_changed_at: Date;
  muted_at: Date | null;
  last_alert_at: Date | null;
};

const FILE_COLUMNS = [
  'id',
  'name',
  'search',
  'status',
  'created_at',
  'viewed_at',
  'status_changed_at',
  'muted_at',
  'last_alert_at',
] as const;

/** The names of makes, models, body types and places as the search page's chips write them. */
export async function readLabelOf(): Promise<LabelOf> {
  const [options, bodyTypes, catalogue] = await Promise.all([
    readFilterOptionCounts(),
    readBodyTypeLabels(),
    readCatalogueLabelOf(readDatabase()),
  ]);
  const named: Record<string, SearchFacets[keyof SearchFacets]> = {};
  for (const [kind, list] of Object.entries(options)) {
    named[kind] = list.map((option) => ({ ...option, label: nameOnScreen(option.label) }));
  }
  const counted = makeLabelOf(named as SearchFacets, bodyTypes);
  // A value nobody lists lately keeps its catalogue name, never its raw key.
  return (filterId, value) => counted(filterId, value) ?? catalogue(filterId, value);
}

async function highlightOf(search: Search): Promise<SearchFileSummary['highlight']> {
  const found = await readFileHighlights(readDatabase(), search);
  const { best } = found;
  const label =
    best?.dealRating == null
      ? undefined
      : deal.options.find((option) => option.value === best.dealRating)?.label;
  return {
    photoUrl: found.newestPhotoUrl,
    best:
      best?.askingPriceToman == null
        ? null
        : {
            price: formatToman(toToman(best.askingPriceToman)),
            rating: best.dealRating,
            label: label ?? null,
          },
  };
}

async function summarise(row: FileRow, labelOf: LabelOf, withHighlight = false): Promise<SearchFileSummary> {
  const common = {
    id: row.id,
    name: row.name,
    state: row.status,
    createdAt: row.created_at.toISOString(),
    viewedAt: row.viewed_at.toISOString(),
    alertsMuted: row.muted_at !== null,
    lastAlertAt: row.last_alert_at?.toISOString() ?? null,
  };
  const parsed = fromStoredSearch(row.search);
  if (!parsed.success) return { ...common, chips: [], readable: false, counts: null, highlight: null };
  const chips = describeSearch(parsed.data, labelOf);
  try {
    const [counts, highlight] = await Promise.all([
      countFileMatches(readDatabase(), row.id, parsed.data, MATCH_COUNT_CAP),
      withHighlight ? highlightOf(parsed.data) : Promise.resolve(null),
    ]);
    return { ...common, chips, readable: true, counts, highlight };
  } catch (error) {
    // One file that cannot be counted must not hide the others: its numbers are said to be missing, never zero.
    captureError(error, { message: 'counting a search file failed', fields: { fileId: row.id } });
    return { ...common, chips, readable: true, counts: null, highlight: null };
  }
}

/** The account's files, newest first, each with how many cars match it and how many are new. */
export async function listSearchFiles(
  accountId: number,
  options: { highlights?: boolean } = {},
): Promise<SearchFileSummary[]> {
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
  // A few files at a time: each is two small reads of the search table, and 30 files must not take 60 connections.
  const summaries: SearchFileSummary[] = [];
  for (let start = 0; start < rows.length; start += COUNT_CONCURRENCY) {
    summaries.push(
      ...(await Promise.all(
        rows
          .slice(start, start + COUNT_CONCURRENCY)
          .map((row) => summarise(row, labelOf, options.highlights === true)),
      )),
    );
  }
  // The crawl requests the files raised (CS-71): one read for all of them; a failure leaves the cards without it.
  const crawl = await readFileCrawlSummaries(accountId).catch(
    (error: unknown): Map<number, FileCrawlSummary> => {
      captureError(error, {
        message: 'reading the crawl requests of the files failed',
        fields: { accountId },
      });
      return new Map();
    },
  );
  return summaries.map((summary) => ({ ...summary, crawl: crawl.get(summary.id) ?? null }));
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
  /** What the page shows of crawl requests (CS-71); null when unreadable or when it could not be read. */
  readonly crawl: CrawlPanel | null;
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
  if (!parsed.success)
    return { file, search: null, cards: [], newIds: [], resultsFailed: false, crawl: null };
  const crawl = await readCrawlPanel(accountId, id, row.search, file.counts?.matches.count ?? null).catch(
    (error: unknown) => {
      captureError(error, {
        message: 'reading the crawl panel of a search file failed',
        fields: { fileId: id },
      });
      return null;
    },
  );
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
            .selectFrom('search_document as r')
            .select('r.listing_id as id')
            .where(
              'r.listing_id',
              'in',
              cards.map((card) => card.id),
            )
            .where((eb) =>
              eb(
                'r.indexed_at',
                '>',
                eb
                  .selectFrom('search_file as f')
                  .select(searchFileSeenBaseline('f').as('baseline'))
                  .where('f.id', '=', id)
                  .where('f.account_id', '=', accountId),
              ),
            )
            .execute();
    return { file, search, cards, newIds: fresh.map((listing) => listing.id), resultsFailed: false, crawl };
  } catch (error) {
    captureError(error, { message: 'reading a search file page failed', fields: { fileId: id } });
    log.warn('search file results unavailable', { fileId: id });
    return { file, search, cards: [], newIds: [], resultsFailed: true, crawl };
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
