import type { Kysely } from 'kysely';
import * as z from 'zod';
import { createNotification } from '@carshenas/notifications/create-notification';
import { SEARCH_FILE_ALERT_RULES } from '@carshenas/notifications/search-file-alerts';
import type { DB } from '@carshenas/db/db-types';
import { fromStoredSearch, type Search } from '@carshenas/search/search';
import {
  advanceFiles,
  advanceUnwatchedFiles,
  countDigestsToday,
  finishFile,
  lockFileForMatching,
  readCandidates,
  readFileMatches,
  readFilesToMatch,
  readRunEnd,
  type Candidate,
  type WatchedFile,
} from '../db/match-store.ts';
import { defineJob, type QueueJobDefinition } from '../runtime/job.ts';

// Proactive matching (CS-72, ADR-0033): every five minutes, after the search table's refresh has indexed what the
// pipeline found, each watching search file is matched against the listings that became searchable, or dropped their
// price, since its watermark, and its buyer gets one notification for the run. Nothing about the matches is stored: the
// watermark (search_file.matched_through) says how far a file has been matched, and the notification's event key (the
// file and the watermark the run started from) makes a second run of the same work notify nobody twice. A file's row is locked and its
// watermark moved in the transaction that creates the notification, so both commit or neither does.
//
// It is cheap with many files because it asks the database once for the few listings that are news (a range of an
// index), rules out files by their make, model and trim keys in memory, and matches the rest with the search page's own
// searchableWhere() against only those listings' primary keys. A paused, closed or muted file moves its watermark
// without alerting. A file told within the last two hours, or whose buyer already got eight digests today (Tehran), is
// left alone: its watermark stays and the next alert tells everything since, in one digest.

export type MatchOptions = {
  /** The clock the run's end is taken from; the database's own unless a test fixes it. */
  readonly now?: Date;
  readonly marginSeconds?: number;
  readonly gapMinutes?: number;
  readonly dailyCap?: number;
  readonly signal?: AbortSignal;
};

export type MatchRun = {
  /** Files moved on without alerting: paused, closed or muted. */
  readonly unwatched: number;
  /** Files matched against the run's news. */
  readonly files: number;
  /** Listings that became searchable or dropped their price in the window. */
  readonly candidates: number;
  /** Files ruled out by their make, model or trim before any query. */
  readonly skippedByKeys: number;
  /** Files whose buyer was notified. */
  readonly notified: number;
  /** Files with nothing new. */
  readonly quiet: number;
  /** Files left for a later run: told too recently or the account's daily cap. */
  readonly deferred: number;
  /** Files whose stored search this build cannot read. */
  readonly unreadable: number;
  readonly newListings: number;
  readonly drops: number;
  readonly milliseconds: number;
};

const NOTHING: MatchRun = {
  unwatched: 0,
  files: 0,
  candidates: 0,
  skippedByKeys: 0,
  notified: 0,
  quiet: 0,
  deferred: 0,
  unreadable: 0,
  newListings: 0,
  drops: 0,
  milliseconds: 0,
};

function chosen(search: Search, id: 'make' | 'model' | 'trim'): readonly string[] | undefined {
  return search.filters[id];
}

/** The candidates that are news to a file and that its make, model and trim choices leave: the others cannot match it. */
function narrow(search: Search, file: WatchedFile, candidates: readonly Candidate[]): Candidate[] {
  const makes = chosen(search, 'make');
  const models = chosen(search, 'model');
  const trims = chosen(search, 'trim');
  return candidates.filter(
    (candidate) =>
      // News to this file: indexed or dropped after its own watermark, not just after the oldest file's.
      (candidate.indexedMicros > file.watermarkMicros || candidate.droppedMicros > file.watermarkMicros) &&
      (makes === undefined || (candidate.makeKey !== null && makes.includes(candidate.makeKey))) &&
      (models === undefined || (candidate.modelKey !== null && models.includes(candidate.modelKey))) &&
      (trims === undefined || (candidate.trimKey !== null && trims.includes(candidate.trimKey))),
  );
}

type FileOutcome = 'notified' | 'quiet' | 'deferred' | 'skipped';

async function matchFile(
  db: Kysely<DB>,
  file: WatchedFile,
  search: Search,
  candidates: readonly Candidate[],
  runEnd: string,
  options: Required<Pick<MatchOptions, 'dailyCap'>>,
  tally: { newListings: number; drops: number },
): Promise<FileOutcome> {
  return db.transaction().execute(async (trx) => {
    const locked = await lockFileForMatching(trx, file.id, runEnd);
    if (locked === undefined) return 'skipped';
    const matches = await readFileMatches(
      trx,
      search,
      candidates.map((candidate) => candidate.listingId),
      locked.watermark,
      runEnd,
    );
    const fresh = matches.filter((match) => match.isNew);
    const drops = matches.filter((match) => !match.isNew && match.isDrop);
    if (fresh.length + drops.length === 0) {
      await finishFile(trx, file.id, runEnd, false);
      return 'quiet';
    }
    if ((await countDigestsToday(trx, file.accountId)) >= options.dailyCap) return 'deferred';
    const outcome = await createNotification(trx, {
      accountId: file.accountId,
      kind: 'search_file_matches',
      searchFileId: file.id,
      payload: {
        searchFileId: file.id,
        fileName: file.name,
        newCount: fresh.length,
        goodCount: fresh.filter((match) => match.dealRating === 'great' || match.dealRating === 'good')
          .length,
        dropCount: drops.length,
        sinceKey: locked.sinceKey,
      },
    });
    // 'skipped': the run was already told (a retry after a crash that lost nothing), or the file was muted a moment ago.
    await finishFile(trx, file.id, runEnd, outcome.status === 'created');
    if (outcome.status === 'created') {
      tally.newListings += fresh.length;
      tally.drops += drops.length;
      return 'notified';
    }
    return 'quiet';
  });
}

/**
 * One matching run: moves unwatched files on, finds what is news, and notifies each watching file's buyer once. Safe to run
 * twice, or while a buyer changes their files: a second run finds every watermark at the run's end or later.
 */
export async function matchSearchFiles(db: Kysely<DB>, options: MatchOptions = {}): Promise<MatchRun> {
  const started = performance.now();
  const runEnd = await readRunEnd(
    db,
    options.marginSeconds ?? SEARCH_FILE_ALERT_RULES.marginSeconds,
    options.now,
  );
  const unwatched = await advanceUnwatchedFiles(db, runEnd);
  const files = await readFilesToMatch(
    db,
    runEnd,
    options.gapMinutes ?? SEARCH_FILE_ALERT_RULES.minGapMinutes,
    options.dailyCap ?? SEARCH_FILE_ALERT_RULES.dailyCap,
  );
  if (files.length === 0)
    return { ...NOTHING, unwatched, milliseconds: Math.round(performance.now() - started) };

  const oldest = files.reduce(
    (least, file) => (file.watermark < least ? file.watermark : least),
    files[0]?.watermark ?? runEnd,
  );
  const candidates = await readCandidates(db, oldest, runEnd);
  const tally = { newListings: 0, drops: 0 };
  const counts = { notified: 0, quiet: 0, deferred: 0, skippedByKeys: 0, unreadable: 0 };
  // Files nothing in this run can match move on together, in one statement; the others are matched one transaction each.
  const idle: number[] = [];
  for (const file of files) {
    if (options.signal?.aborted === true) break;
    const parsed = fromStoredSearch(file.search);
    if (!parsed.success) {
      counts.unreadable += 1;
      continue;
    }
    const relevant = narrow(parsed.data, file, candidates);
    if (relevant.length === 0) {
      idle.push(file.id);
      counts.skippedByKeys += 1;
      continue;
    }
    const outcome = await matchFile(
      db,
      file,
      parsed.data,
      relevant,
      runEnd,
      { dailyCap: options.dailyCap ?? SEARCH_FILE_ALERT_RULES.dailyCap },
      tally,
    );
    if (outcome === 'notified') counts.notified += 1;
    else if (outcome === 'quiet') counts.quiet += 1;
    else if (outcome === 'deferred') counts.deferred += 1;
  }
  await advanceFiles(db, idle, runEnd);
  return {
    unwatched,
    files: files.length,
    candidates: candidates.length,
    ...counts,
    ...tally,
    milliseconds: Math.round(performance.now() - started),
  };
}

export type SearchMatchOptions = { readonly scheduled: boolean };

export function searchMatchJob(options: SearchMatchOptions): QueueJobDefinition<Record<string, never>> {
  return defineJob({
    name: 'search.match',
    payload: z.strictObject({}),
    // A run's news is matched by the next run if this one is missed: keep no backlog.
    retentionDays: 1,
    schedules: options.scheduled ? [{ key: 'every-five-minutes', cron: '*/5 * * * *', payload: {} }] : [],
    async run(_payload, context) {
      const run = await matchSearchFiles(context.db, { signal: context.signal });
      for (const [name, value] of Object.entries(run)) context.count(name, value);
    },
  });
}
