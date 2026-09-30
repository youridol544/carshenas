import type { Kysely } from 'kysely';
import * as z from 'zod';
import type { DB } from '@carshenas/db/db-types';
import {
  buildSearchDocuments,
  countFacets,
  lockSearchBuild,
  refreshSearchWords,
  takeStaleListings,
  trackedModelIds,
  writeFacetCounts,
} from '@carshenas/search/document';
import { defineJob, type QueueJobDefinition } from '../runtime/job.ts';
import type { TrackedModel } from '../sources/divar/tracked-models.ts';

// Keeping the search table fresh (CS-59): search.refresh every minute rebuilds the rows of the listings the triggers
// marked (a crawl, a derivation, the catalogue's matching, an extraction, a valuation run that succeeded) and drops
// the rows not seen for 48 hours; search.rebuild every night, and `pnpm search:rebuild`, rebuilds every row, which
// also brings the models' popularity ranks and catalogue names up to date. After either changes a row, the counts
// pages read (search_facet_count) and the typo vocabulary (search_word) are refreshed in the same transaction. No
// request to any source: it reads only what is stored.

/** Listings built per transaction: the view's fixed cost is paid once per batch. */
const BATCH = 10_000;

export type SearchRefresh = {
  readonly listings: number;
  readonly written: number;
  readonly removed: number;
  readonly words: number;
  readonly trackedModels: number;
};

type Options = {
  readonly sourceId: string;
  readonly trackedModels: readonly TrackedModel[];
  readonly now?: Date;
};

async function trackedIds(db: Kysely<DB>, options: Options): Promise<number[]> {
  return trackedModelIds(
    db,
    options.sourceId,
    options.trackedModels.map((model) => model.brandModel),
  );
}

async function afterChange(db: Kysely<DB>, changed: boolean, now: Date | undefined): Promise<number> {
  if (!changed) return 0;
  await writeFacetCounts(db, await countFacets(db, now));
  return (await refreshSearchWords(db)).words;
}

/** Rebuilds every searchable listing's row, the counts and the vocabulary, in one transaction. */
export async function rebuildSearch(db: Kysely<DB>, options: Options): Promise<SearchRefresh> {
  return db.transaction().execute(async (trx) => {
    await lockSearchBuild(trx);
    const tracked = await trackedIds(trx, options);
    const result = await buildSearchDocuments(trx, {
      scope: 'all',
      trackedModelIds: tracked,
      ...(options.now === undefined ? {} : { now: options.now }),
    });
    const words = await afterChange(trx, true, options.now);
    const listings = await trx
      .selectFrom('search_document')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();
    return { listings: listings.count, ...result, words, trackedModels: tracked.length };
  });
}

/** Rebuilds the rows of the marked listings, batch by batch, and drops rows past the freshness window. */
export async function refreshSearch(db: Kysely<DB>, options: Options): Promise<SearchRefresh> {
  let listings = 0;
  let written = 0;
  let removed = 0;
  let words = 0;
  let tracked: number[] = [];
  for (let first = true; ; first = false) {
    const batch = await db.transaction().execute(async (trx) => {
      await lockSearchBuild(trx);
      tracked = await trackedIds(trx, options);
      const ids = await takeStaleListings(trx, BATCH);
      // The first batch runs even with nothing marked: a row can age out of the freshness window without any write.
      if (ids.length === 0 && !first) return undefined;
      const result = await buildSearchDocuments(trx, {
        scope: { listingIds: ids },
        trackedModelIds: tracked,
        ...(options.now === undefined ? {} : { now: options.now }),
      });
      const vocabulary = await afterChange(trx, result.written + result.removed > 0, options.now);
      if (vocabulary > 0) words = vocabulary;
      return { ids: ids.length, ...result };
    });
    if (batch === undefined) break;
    listings += batch.ids;
    written += batch.written;
    removed += batch.removed;
    if (batch.ids < BATCH) break;
  }
  return { listings, written, removed, words, trackedModels: tracked.length };
}

export type SearchJobs = {
  readonly refresh: QueueJobDefinition<Record<string, never>>;
  readonly rebuild: QueueJobDefinition<Record<string, never>>;
  readonly all: readonly QueueJobDefinition<Record<string, never>>[];
};

export function searchJobs(options: Options & { readonly scheduled: boolean }): SearchJobs {
  const report = (refreshed: SearchRefresh, count: (name: string, by?: number) => void) => {
    for (const [name, value] of Object.entries(refreshed)) count(name, value);
  };
  const refresh = defineJob({
    name: 'search.refresh',
    payload: z.strictObject({}),
    // A minute's marks are stale a minute later: never keep a backlog of refreshes.
    retentionDays: 1,
    schedules: options.scheduled ? [{ key: 'every-minute', cron: '* * * * *', payload: {} }] : [],
    async run(_payload, context) {
      report(await refreshSearch(context.db, options), (name, by) => {
        context.count(name, by);
      });
    },
  });
  const rebuild = defineJob({
    name: 'search.rebuild',
    payload: z.strictObject({}),
    // After the 04:00 valuation run, whose marks search.refresh has usually drained by then.
    schedules: options.scheduled ? [{ key: 'nightly', cron: '30 4 * * *', payload: {} }] : [],
    async run(_payload, context) {
      report(await rebuildSearch(context.db, options), (name, by) => {
        context.count(name, by);
      });
    },
  });
  return { refresh, rebuild, all: [refresh, rebuild] };
}
