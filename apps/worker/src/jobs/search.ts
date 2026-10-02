import type { Kysely } from 'kysely';
import * as z from 'zod';
import type { DB } from '@carshenas/db/db-types';
import {
  ANALYZE_AFTER_ROWS,
  analyzeSearchTables,
  buildSearchDocuments,
  fullRebuildDue,
  isVocabularyStale,
  limitBuildTransaction,
  readBuildState,
  recordBuildEvent,
  refreshFacetCounts,
  refreshSearchWords,
  removeAgedDocuments,
  takeStaleListings,
  tryLockSearchBuild,
  waitForSearchBuild,
  type BuildChunk,
} from '@carshenas/search/document';
import { hasOpenJob } from '../db/search-store.ts';
import { defineJob, type Enqueue, type QueueJobDefinition } from '../runtime/job.ts';

// Keeping the search table fresh (CS-59, ADR-0028). search.refresh, every minute: the listings the triggers marked (a
// crawl, a derivation, the catalogue's matching, an extraction, a valuation run that succeeded) have their rows
// rebuilt, rows no crawl has seen for 48 hours are expired, and the counts pages read are recounted. search.rebuild,
// every night and by `pnpm search:rebuild`: every row rebuilt in id ranges of about 2,000 listings a statement, which
// also brings the models' popularity ranks and the catalogue's names up to date, then the counts and the typo
// vocabulary. No request to any source: it reads only what is stored.
//
// A build never holds up a writer. The marks are appended by triggers and never conflict, a build takes no lock on a
// listing, and the marks it takes are committed together with the rows they produced, before the counts, the
// vocabulary and the statistics, which are transactions of their own: a crawl or a derivation that marks a listing
// while the build runs inserts a new mark and goes on. Two builds never interleave: the refresh tries the build lock
// and leaves its marks for the next tick when it is held; the rebuild waits for it, but never more than 30 seconds.

/** Marks taken per transaction: its rows commit, with their marks, before the next batch starts. */
const MARKS_PER_BATCH = 2_000;
/** Batches one refresh runs; the marks it leaves wait a minute (a valuation run marks every searchable listing). */
const MAX_BATCHES = 25;
/** How long a rebuild waits for a refresh that holds the build lock. */
const LOCK_WAIT_MS = 30_000;
/**
 * The rebuild's own limits for its transaction (the worker's defaults are 30 s a statement, 5 s for a lock and two
 * minutes a transaction): a chunk of 2,000 listings takes one to three seconds, a fill from empty of 25,000 rows 40 s.
 */
const REBUILD_LIMITS = { statementSeconds: 90, lockSeconds: 10, transactionSeconds: 600 } as const;

export type SearchRun = {
  /** 1 when a build held the lock and this run did nothing: its marks stay for the next tick. */
  readonly skipped: number;
  readonly marks: number;
  /** Listings whose rows were rebuilt. */
  readonly listings: number;
  readonly written: number;
  readonly removed: number;
  /** Rows expired because no crawl had seen the listing for 48 hours. */
  readonly expired: number;
  /** Counts written or removed in search_facet_count. */
  readonly countsChanged: number;
  /** The vocabulary's size when it was rebuilt, else 0. */
  readonly words: number;
};

type Options = { readonly now?: Date };

const NOTHING: SearchRun = {
  skipped: 0,
  marks: 0,
  listings: 0,
  written: 0,
  removed: 0,
  expired: 0,
  countsChanged: 0,
  words: 0,
};

/**
 * Counts, in a transaction of its own: skipped when a build holds the lock (the rebuild recounts, and so does the next
 * tick), so a refresh never waits.
 */
async function recount(db: Kysely<DB>, options: Options): Promise<number> {
  return db.transaction().execute(async (trx) => {
    if (!(await tryLockSearchBuild(trx))) return 0;
    const changed = await refreshFacetCounts(trx, options.now);
    return changed.written + changed.removed;
  });
}

/**
 * The vocabulary, in a transaction of its own, when it was not built since the rows last changed: whatever this run
 * changed, so a run that failed after committing its rows is repaired by the next. The statistics follow a large
 * change. Returns the vocabulary's size, 0 when it was not rebuilt.
 */
async function rebuildVocabularyIfStale(db: Kysely<DB>, changedRows: number): Promise<number> {
  if (!isVocabularyStale(await readBuildState(db))) return 0;
  return db.transaction().execute(async (trx) => {
    if (!(await tryLockSearchBuild(trx))) return 0;
    const { words } = await refreshSearchWords(trx);
    if (changedRows > ANALYZE_AFTER_ROWS) await analyzeSearchTables(trx);
    return words;
  });
}

/**
 * Rebuilds the rows of the marked listings, batch by batch (each batch's rows commit with its marks), expires rows past
 * the freshness window, then recounts and rebuilds the vocabulary if it is stale, each in a transaction of its own.
 * A build in progress makes it skip, leaving the marks.
 */
export async function refreshSearch(db: Kysely<DB>, options: Options = {}): Promise<SearchRun> {
  let run = NOTHING;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const step = await db.transaction().execute(async (trx) => {
      if (!(await tryLockSearchBuild(trx))) return undefined;
      const taken = await takeStaleListings(trx, MARKS_PER_BATCH);
      const built =
        taken.listingIds.length === 0
          ? { written: 0, removed: 0 }
          : await buildSearchDocuments(trx, {
              scope: { listingIds: taken.listingIds },
              ...(options.now === undefined ? {} : { now: options.now }),
            });
      return { taken, built, expired: await removeAgedDocuments(trx) };
    });
    if (step === undefined) {
      if (batch === 0) return { ...NOTHING, skipped: 1 };
      break;
    }
    run = {
      ...run,
      marks: run.marks + step.taken.marks,
      listings: run.listings + step.taken.listingIds.length,
      written: run.written + step.built.written,
      removed: run.removed + step.built.removed,
      expired: run.expired + step.expired,
    };
    if (step.taken.marks < MARKS_PER_BATCH) break;
  }
  const countsChanged = await recount(db, options);
  const words = await rebuildVocabularyIfStale(db, run.written + run.removed + run.expired);
  return { ...run, countsChanged, words };
}

/**
 * Rebuilds every searchable listing's row in id ranges of about 2,000 listings a statement, all in one transaction (it
 * commits whole or not at all), with limits of its own; then, in transactions of their own, the counts, the vocabulary
 * and the statistics, and last the time of this full rebuild. It waits up to 30 seconds for a refresh to finish and
 * skips when it cannot get the build lock. A part that fails after the rows committed is stale, and the next refresh
 * rebuilds it; the rebuild's time is only recorded when every part is done, so a failed one is due again.
 */
export async function rebuildSearch(
  db: Kysely<DB>,
  options: Options & {
    readonly onChunk?: (chunk: BuildChunk) => void;
    /** How long to wait for a refresh that holds the build lock: 30 seconds unless a test shortens it. */
    readonly lockWaitMs?: number;
  } = {},
): Promise<SearchRun> {
  const lockWaitMs = options.lockWaitMs ?? LOCK_WAIT_MS;
  const rows = await db.transaction().execute(async (trx) => {
    await limitBuildTransaction(trx, REBUILD_LIMITS);
    if (!(await waitForSearchBuild(trx, { timeoutMs: lockWaitMs }))) return undefined;
    const built = await buildSearchDocuments(trx, {
      scope: 'all',
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.onChunk === undefined ? {} : { onChunk: options.onChunk }),
    });
    return { built, expired: await removeAgedDocuments(trx) };
  });
  if (rows === undefined) return { ...NOTHING, skipped: 1 };

  const countsChanged = await db.transaction().execute(async (trx) => {
    await limitBuildTransaction(trx, REBUILD_LIMITS);
    if (!(await waitForSearchBuild(trx, { timeoutMs: lockWaitMs }))) return 0;
    const changed = await refreshFacetCounts(trx, options.now);
    return changed.written + changed.removed;
  });
  const words = await db.transaction().execute(async (trx) => {
    await limitBuildTransaction(trx, REBUILD_LIMITS);
    if (!(await waitForSearchBuild(trx, { timeoutMs: lockWaitMs }))) return 0;
    const { words: size } = await refreshSearchWords(trx);
    await analyzeSearchTables(trx);
    // Last: a rebuild that threw before here is not recorded, so it is due again.
    await recordBuildEvent(trx, 'full_rebuild');
    return size;
  });
  return {
    ...NOTHING,
    listings: rows.built.written,
    written: rows.built.written,
    removed: rows.built.removed,
    expired: rows.expired,
    countsChanged,
    words,
  };
}

/**
 * At the worker's start: queues one full rebuild when the table is empty, none was ever completed or the last is more
 * than 26 hours old, unless one is already queued or running. So a table that was never filled (a database just
 * migrated, a worker down through the night) fills by itself. Returns why it queued one, if it did.
 */
export async function queueSearchRebuildIfDue(
  db: Kysely<DB>,
  enqueue: Enqueue,
  rebuild: QueueJobDefinition<Record<string, never>>,
): Promise<'empty' | 'never' | 'old' | undefined> {
  const reason = fullRebuildDue(await readBuildState(db));
  if (reason === undefined || (await hasOpenJob(db, rebuild.name))) return undefined;
  await enqueue(rebuild, {});
  return reason;
}

export type SearchJobs = {
  readonly refresh: QueueJobDefinition<Record<string, never>>;
  readonly rebuild: QueueJobDefinition<Record<string, never>>;
  readonly all: readonly QueueJobDefinition<Record<string, never>>[];
};

export function searchJobs(options: { readonly scheduled: boolean }): SearchJobs {
  const report = (run: SearchRun, count: (name: string, by?: number) => void) => {
    for (const [name, value] of Object.entries(run)) count(name, value);
  };
  const refresh = defineJob({
    name: 'search.refresh',
    payload: z.strictObject({}),
    // A minute's marks are stale a minute later: never keep a backlog of refreshes.
    retentionDays: 1,
    schedules: options.scheduled ? [{ key: 'every-minute', cron: '* * * * *', payload: {} }] : [],
    async run(_payload, context) {
      const run = await refreshSearch(context.db);
      if (run.skipped > 0) context.log.debug('a search build holds the lock: refresh skipped, marks kept');
      report(run, (name, by) => {
        context.count(name, by);
      });
    },
  });
  const rebuild = defineJob({
    name: 'search.rebuild',
    payload: z.strictObject({}),
    // At 04:37, after the 04:00 valuation run, and not on the refresh's minute 04:30 a rebuild from empty would
    // collide with; a refresh that finds it running skips its tick.
    schedules: options.scheduled ? [{ key: 'nightly', cron: '37 4 * * *', payload: {} }] : [],
    async run(_payload, context) {
      const run = await rebuildSearch(context.db);
      if (run.skipped > 0) context.log.warn('the search build lock stayed held: rebuild skipped');
      report(run, (name, by) => {
        context.count(name, by);
      });
    },
  });
  return { refresh, rebuild, all: [refresh, rebuild] };
}
