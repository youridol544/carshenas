import type { Kysely } from 'kysely';
import * as z from 'zod';
import { createNotification } from '@carshenas/notifications/create-notification';
import { SEARCH_FILE_ALERT_RULES } from '@carshenas/notifications/search-file-alerts';
import type { DB } from '@carshenas/db/db-types';
import { fromStoredSearch, type Search } from '@carshenas/search/search';
import {
  advanceFiles,
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

// Proactive matching (CS-72, ADR-0035): every five minutes, after the search table's refresh has indexed what the
// pipeline found, each watching search file is matched against the listings that became searchable, or dropped their
// price, since its watermark, and its buyer gets one notification for the run. Nothing about the matches is stored: the
// watermark (search_file.matched_through) says how far a file has been matched, and the notification's event key (the
// file and the watermark the run started from) makes a second run of the same work notify nobody twice. A file's row is locked and its
// watermark moved in the transaction that creates the notification, so both commit or neither does.
//
// It is cheap with many files because it asks the database once for the few listings that are news (a range of an
// index), rules out files by their make, model and trim keys in memory, and matches the rest with the search page's own
// searchableWhere() against only those listings' primary keys. A paused, closed or muted file is never read; its watermark restarts when it is watched again,
// without a backlog. A file told within the last two hours, or whose buyer already got eight digests today (Tehran), is
// left alone: its watermark stays and the next alert tells everything since, in one digest.

/** The most files one run reads: a run does bounded work, and the files it does not reach come first next time. */
export const MAX_FILES_PER_RUN = 2_000;

export type MatchOptions = {
  /** The clock the run's end is taken from; the database's own unless a test fixes it. */
  readonly now?: Date;
  readonly marginSeconds?: number;
  readonly gapMinutes?: number;
  readonly dailyCap?: number;
  readonly signal?: AbortSignal;
  /** The most files one run reads; the others wait for the next. */
  readonly maxFiles?: number;
  /** Called for a file whose matching failed; the run goes on with the others. */
  readonly onFileError?: (fileId: number, error: unknown) => void;
};

export type MatchRun = {
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
  /** Files whose stored search this build cannot read, or whose matching failed. */
  readonly unreadable: number;
  readonly failed: number;
  readonly newListings: number;
  readonly drops: number;
  readonly milliseconds: number;
};

const NOTHING: MatchRun = {
  files: 0,
  candidates: 0,
  skippedByKeys: 0,
  notified: 0,
  quiet: 0,
  deferred: 0,
  unreadable: 0,
  failed: 0,
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
    const good = fresh.filter((match) => match.dealRating === 'great' || match.dealRating === 'good').length;
    // A digest is worth an inbox line only when something in the batch is a good deal or got cheaper; the other new
    // listings still show as «تازه» on the file's page, but do not interrupt the buyer (ADR-0035).
    if (good + drops.length === 0) {
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
        goodCount: good,
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
  const files = await readFilesToMatch(
    db,
    runEnd,
    options.gapMinutes ?? SEARCH_FILE_ALERT_RULES.minGapMinutes,
    options.dailyCap ?? SEARCH_FILE_ALERT_RULES.dailyCap,
    options.maxFiles ?? MAX_FILES_PER_RUN,
  );
  if (files.length === 0) return { ...NOTHING, milliseconds: Math.round(performance.now() - started) };

  // Files nothing in this run can match, and files whose search this build cannot read, move on together in one
  // statement; an unreadable one never pins the window the candidates are read from.
  const idle: number[] = [];
  const readable: { file: WatchedFile; search: Search }[] = [];
  const counts = { notified: 0, quiet: 0, deferred: 0, skippedByKeys: 0, unreadable: 0, failed: 0 };
  for (const file of files) {
    const parsed = fromStoredSearch(file.search);
    if (parsed.success) readable.push({ file, search: parsed.data });
    else {
      idle.push(file.id);
      counts.unreadable += 1;
    }
  }
  const oldest = readable.reduce(
    (least, { file }) => (file.watermark < least ? file.watermark : least),
    readable[0]?.file.watermark ?? runEnd,
  );
  const candidates = readable.length === 0 ? [] : await readCandidates(db, oldest, runEnd);
  const tally = { newListings: 0, drops: 0 };
  for (const { file, search } of readable) {
    if (options.signal?.aborted === true) break;
    const relevant = narrow(search, file, candidates);
    if (relevant.length === 0) {
      idle.push(file.id);
      counts.skippedByKeys += 1;
      continue;
    }
    try {
      const outcome = await matchFile(
        db,
        file,
        search,
        relevant,
        runEnd,
        { dailyCap: options.dailyCap ?? SEARCH_FILE_ALERT_RULES.dailyCap },
        tally,
      );
      if (outcome === 'notified') counts.notified += 1;
      else if (outcome === 'quiet') counts.quiet += 1;
      else if (outcome === 'deferred') counts.deferred += 1;
    } catch (error) {
      // One file's failure (its transaction rolled back, its watermark unmoved) must not stop the others.
      counts.failed += 1;
      options.onFileError?.(file.id, error);
    }
  }
  await advanceFiles(db, idle, runEnd);
  return {
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
      const run = await matchSearchFiles(context.db, {
        signal: context.signal,
        onFileError: (fileId, error) => {
          context.log.error('a search file could not be matched', { fileId, err: error });
        },
      });
      for (const [name, value] of Object.entries(run)) context.count(name, value);
    },
  });
}
