import 'server-only';
import type { ReadonlyKysely } from 'kysely/readonly';
import type { DB } from '@carshenas/db/db-types';
import { describeSearch, fromStoredSearch } from '@carshenas/search/search';
import { readLabelOf } from '@/features/admin/server/search-file-queries';
import { requireSuperadmin } from '@/server/auth/current-account';
import { readAdminDatabase } from '@/server/db/admin-database';
import { readCrawlPaused } from '@/server/db/crawl-request-reads';
import { carNameOf } from '@/lib/crawl-requests-names';
import { CRAWL_REQUEST_STATES, type CrawlRequestState } from '@/lib/crawl-requests-rules';

// The superadmin's crawl-request screen (CS-71, ADR-0032), through the section's own role (ADR-0023): every request
// with the files that depend on it and their buyers (by username), how many buyers want each model, who approved what
// and when, and the models read in depth with how each came to be. It asks for the superadmin itself: a page is never
// the guard (ADR-0020 point 10). Plans are in the task's notes.

/** How many requests the screen lists, and how many dependent files each shows before «+N». */
export const REQUESTS_LIMIT = 100;
export const FILES_PER_REQUEST = 6;
const DEMAND_LIMIT = 8;

export type RequestFilter = CrawlRequestState | 'all';

export function readRequestFilter(value: unknown): RequestFilter {
  return typeof value === 'string' && ([...CRAWL_REQUEST_STATES, 'all'] as string[]).includes(value)
    ? (value as RequestFilter)
    : 'all';
}

export type DependentFile = {
  id: number;
  name: string;
  buyer: string;
  state: 'watching' | 'paused' | 'closed';
  /** The search as chips; empty when the stored search no longer fits this build. */
  chips: string[];
};

export type AdminCrawlRequest = {
  id: number;
  state: CrawlRequestState;
  carName: string;
  buyers: number;
  fileCount: number;
  files: DependentFile[];
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  reason: string | null;
};

export type TrackedRow = {
  key: string;
  carName: string;
  /** Null: chosen by the owner; otherwise the approved request it came from. */
  fromRequest: { decidedBy: string | null; decidedAt: string | null } | null;
};

export type AdminCrawlRequests = {
  filter: RequestFilter;
  counts: Record<RequestFilter, number>;
  requests: AdminCrawlRequest[];
  demand: { modelId: number; carName: string; buyers: number; requests: number }[];
  tracked: TrackedRow[];
  crawlPaused: boolean;
};

type Reader = ReadonlyKysely<DB>;

export async function loadCrawlRequests(filter: RequestFilter): Promise<AdminCrawlRequests> {
  await requireSuperadmin();
  const database = readAdminDatabase();
  // The section's read-only view of the public schema, as the shared reads type it.
  const publicSchema = database as unknown as Reader;
  const [rows, countRows, demandRows, trackedRows, labelOf, paused] = await Promise.all([
    database
      .selectFrom('crawl_request as r')
      .innerJoin('model as m', 'm.id', 'r.model_id')
      .innerJoin('make as k', 'k.id', 'm.make_id')
      .leftJoin('trim as t', 't.id', 'r.trim_id')
      .leftJoin('account as who', 'who.id', 'r.decided_by_account_id')
      .select((eb) => [
        'r.id',
        'r.state',
        'r.created_at',
        'r.decided_at',
        'r.decline_reason',
        'who.username as decided_by',
        'm.name_fa as model_fa',
        'm.name_en as model_en',
        'k.name_fa as make_fa',
        'k.name_en as make_en',
        't.name_fa as trim_fa',
        't.name_en as trim_en',
        eb
          .selectFrom('crawl_request_file as l')
          .innerJoin('search_file as f', 'f.id', 'l.search_file_id')
          .select((inner) => inner.fn.count<number>('f.account_id').distinct().as('buyers'))
          .whereRef('l.crawl_request_id', '=', 'r.id')
          .as('buyers'),
        eb
          .selectFrom('crawl_request_file as l')
          .select((inner) => inner.fn.countAll<number>().as('files'))
          .whereRef('l.crawl_request_id', '=', 'r.id')
          .as('files'),
      ])
      // A pending request nobody waits for any more (its files were deleted) is not a request to decide.
      .where((eb) =>
        eb.or([
          eb('r.state', '<>', 'pending'),
          eb.exists(
            eb
              .selectFrom('crawl_request_file as l')
              .select('l.search_file_id')
              .whereRef('l.crawl_request_id', '=', 'r.id'),
          ),
        ]),
      )
      .$if(filter !== 'all', (query) => query.where('r.state', '=', filter as CrawlRequestState))
      // The queue first: what waits for an answer, then the answered, each the most wanted first.
      .orderBy((eb) => eb.case().when('r.state', '=', 'pending').then(0).else(1).end())
      .orderBy('buyers', 'desc')
      .orderBy('r.created_at', 'asc')
      .orderBy('r.id', 'asc')
      .limit(REQUESTS_LIMIT)
      .execute(),
    database
      .selectFrom('crawl_request as r')
      .select((eb) => ['r.state', eb.fn.countAll<number>().as('requests')])
      .where((eb) =>
        eb.or([
          eb('r.state', '<>', 'pending'),
          eb.exists(
            eb
              .selectFrom('crawl_request_file as l')
              .select('l.search_file_id')
              .whereRef('l.crawl_request_id', '=', 'r.id'),
          ),
        ]),
      )
      .groupBy('r.state')
      .execute(),
    database
      .selectFrom('crawl_request as r')
      .innerJoin('crawl_request_file as l', 'l.crawl_request_id', 'r.id')
      .innerJoin('search_file as f', 'f.id', 'l.search_file_id')
      .innerJoin('model as m', 'm.id', 'r.model_id')
      .innerJoin('make as k', 'k.id', 'm.make_id')
      .select((eb) => [
        'm.id as model_id',
        'm.name_fa as model_fa',
        'm.name_en as model_en',
        'k.name_fa as make_fa',
        'k.name_en as make_en',
        eb.fn.count<number>('f.account_id').distinct().as('buyers'),
        eb.fn.count<number>('r.id').distinct().as('requests'),
      ])
      .groupBy(['m.id', 'm.name_fa', 'm.name_en', 'k.name_fa', 'k.name_en'])
      .orderBy('buyers', 'desc')
      .orderBy('m.id')
      .limit(DEMAND_LIMIT)
      .execute(),
    database
      .selectFrom('tracked_model_scope as s')
      .innerJoin('model as m', 'm.id', 's.model_id')
      .innerJoin('make as k', 'k.id', 'm.make_id')
      .leftJoin('trim as t', 't.id', 's.trim_id')
      .leftJoin('crawl_request as r', (join) =>
        join
          .onRef('r.model_id', '=', 's.model_id')
          .on((eb) => eb('r.trim_id', 'is not distinct from', eb.ref('s.trim_id')))
          .on('r.state', '=', 'fulfilled'),
      )
      .leftJoin('account as who', 'who.id', 'r.decided_by_account_id')
      .select([
        's.model_id',
        's.trim_id',
        'm.name_fa as model_fa',
        'm.name_en as model_en',
        'k.name_fa as make_fa',
        'k.name_en as make_en',
        't.name_fa as trim_fa',
        't.name_en as trim_en',
        'r.id as request_id',
        'r.decided_at',
        'who.username as decided_by',
      ])
      .orderBy('m.name_en')
      .execute(),
    readLabelOf(),
    readCrawlPaused(publicSchema),
  ]);

  // The dependent files of the listed requests, one read.
  const ids = rows.map((row) => row.id);
  const fileRows =
    ids.length === 0
      ? []
      : await database
          .selectFrom('crawl_request_file as l')
          .innerJoin('search_file as f', 'f.id', 'l.search_file_id')
          .innerJoin('account as a', 'a.id', 'f.account_id')
          .select(['l.crawl_request_id', 'f.id', 'f.name', 'f.status', 'f.search', 'a.username'])
          .where('l.crawl_request_id', 'in', ids)
          .orderBy('l.created_at')
          .orderBy('f.id')
          .execute();

  const counts: Record<RequestFilter, number> = {
    pending: 0,
    approved: 0,
    declined: 0,
    fulfilled: 0,
    all: 0,
  };
  for (const row of countRows) {
    counts[row.state as CrawlRequestState] = row.requests;
    counts.all += row.requests;
  }

  const requests = rows.map((row): AdminCrawlRequest => {
    const files = fileRows
      .filter((file) => file.crawl_request_id === row.id)
      .slice(0, FILES_PER_REQUEST)
      .map((file): DependentFile => {
        const parsed = fromStoredSearch(file.search);
        return {
          id: file.id,
          name: file.name,
          buyer: file.username,
          state: file.status,
          chips: parsed.success ? describeSearch(parsed.data, labelOf) : [],
        };
      });
    return {
      id: row.id,
      state: row.state as CrawlRequestState,
      carName: carNameOf({
        makeFa: row.make_fa,
        makeEn: row.make_en,
        modelFa: row.model_fa,
        modelEn: row.model_en,
        trimFa: row.trim_fa,
        trimEn: row.trim_en,
      }),
      buyers: row.buyers ?? 0,
      fileCount: row.files ?? 0,
      files,
      createdAt: row.created_at.toISOString(),
      decidedAt: row.decided_at?.toISOString() ?? null,
      decidedBy: row.decided_by,
      reason: row.decline_reason,
    };
  });

  return {
    filter,
    counts,
    requests,
    demand: demandRows.map((row) => ({
      modelId: row.model_id,
      carName: carNameOf({
        makeFa: row.make_fa,
        makeEn: row.make_en,
        modelFa: row.model_fa,
        modelEn: row.model_en,
      }),
      buyers: row.buyers,
      requests: row.requests,
    })),
    tracked: trackedRows.map((row) => ({
      key: `${String(row.model_id)}:${String(row.trim_id ?? 0)}`,
      carName: carNameOf({
        makeFa: row.make_fa,
        makeEn: row.make_en,
        modelFa: row.model_fa,
        modelEn: row.model_en,
        trimFa: row.trim_fa,
        trimEn: row.trim_en,
      }),
      fromRequest:
        row.request_id === null
          ? null
          : { decidedBy: row.decided_by, decidedAt: row.decided_at?.toISOString() ?? null },
    })),
    crawlPaused: paused,
  };
}
