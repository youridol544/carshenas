import * as z from 'zod';
import { toToman } from '@carshenas/locale/toman';
import { finishFeedRound, recordModelVolume, startFeedRound } from '../db/crawl-store.ts';
import type { CrawlKind } from '../db/crawl-store.ts';
import {
  knownListings,
  listingIdOf,
  markListingGone,
  markListingOffMarket,
  recordPriceChange,
  recordSightings,
  storeSnapshot,
  upsertListing,
  type KnownListing,
} from '../db/listing-store.ts';
import {
  defineLaneJob,
  type JobDefinition,
  type LaneJobContext,
  type LaneJobDefinition,
} from '../runtime/job.ts';
import { DivarShapeError, postRefusal, searchRefusal } from '../sources/divar/answers.ts';
import { listingPageUrl, postUrl, searchBody, searchUrl, TOKEN } from '../sources/divar/api.ts';
import { CANONICAL_VERSION, readPost } from '../sources/divar/post.ts';
import { PAGE_ROWS, readSearchPage, type SearchRow } from '../sources/divar/search.ts';
import type { TrackedModel } from '../sources/divar/tracked-models.ts';
import { parseShownPrice, samePrice, type ShownPrice } from '../sources/price.ts';
import { crawlStep } from './crawl-step.ts';

// Divar's crawl jobs (CS-33; ADR-0008, ADR-0017, ADR-0018), all in Divar's lane, one request per job:
//   - discovery reads the tracked models' feed newest first, every 15 minutes, down to what the last round read, and
//     asks for the details of listings it has none of, or whose row shows another price;
//   - a listing's detail stores its snapshot, once per content, and a price event when the price changed;
//   - a measurement walks the whole market's list pages, slice by slice, to count Tehran's listings per make and model.
// Priorities follow ADR-0017's order: discovery first, details next, measurement last.

/** The feed discovery reads: every tracked model in one newest-first search. */
const TRACKED_FEED = 'tracked_models';

const JSON_BODY = { 'content-type': 'application/json' } as const;

export type DiscoveryLimits = {
  /** A new round starts only this long after the last one started, however many the schedule queued. */
  readonly minimumGapMinutes: number;
  /** How far back the very first round reads: the rest is a backfill's (CS-53). */
  readonly firstRoundHours: number;
  /** A round reads at most this many pages, then stops and leaves the rest to sweeps (CS-35). */
  readonly maxPages: number;
};

export type MeasureLimits = {
  /** The whole feed is read only this deep: enough to see how deep it goes and how many listings arrive an hour. */
  readonly allPages: number;
  /**
   * Any other slice is read at most this deep; one that has more is measured again one level down, as one the source
   * cut short.
   */
  readonly slicePages: number;
  /**
   * A slice whose pages end after at least this many rows while its oldest row is younger than `completeAfterDays` was
   * cut short by the source (other entrants reported a cap of about 1,200 results a search), so it is measured again
   * one level down.
   */
  readonly cutAfterRows: number;
  readonly completeAfterDays: number;
};

export type DivarJobsOptions = {
  /** `divar`; a test source in the integration tests. */
  readonly sourceId: string;
  /** Divar's API, or a local stub in the tests. */
  readonly apiUrl: string;
  readonly trackedModels: readonly TrackedModel[];
  /** Whether discovery runs every 15 minutes by itself; the tests send it. */
  readonly scheduled: boolean;
  readonly discovery?: Partial<DiscoveryLimits>;
  readonly measure?: Partial<MeasureLimits>;
};

const DISCOVERY: DiscoveryLimits = { minimumGapMinutes: 10, firstRoundHours: 1, maxPages: 20 };
// Other entrants saw one Divar search stop at about 1,200 results (50 pages): no slice asks for more, and the whole feed
// asks for one page more, to see whether the cap holds.
const MEASURE: MeasureLimits = { allPages: 51, slicePages: 50, cutAfterRows: 1_000, completeAfterDays: 25 };

const instant = z.iso.datetime();

const discoverPayload = z.strictObject({
  page: z.int().min(1),
  /** The previous page's pagination.data, sent back unchanged. */
  cursor: z.unknown().optional(),
  round: z
    .strictObject({
      startedAt: instant,
      /** Rows sorted at or before it were read by the last finished round. */
      readThroughAt: instant.nullable(),
      /** The newest row this round has read: what the next one reads down to. */
      newestSortedAt: instant.nullable(),
    })
    .optional(),
});
export type DiscoverPayload = z.infer<typeof discoverPayload>;

const listingPayload = z.strictObject({
  token: z.string().regex(TOKEN),
  /** First seen, or seen again at another price. */
  reason: z.enum(['new', 'changed']),
});
export type ListingPayload = z.infer<typeof listingPayload>;

const level = z.enum(['all', 'brand', 'model', 'trim']);
const measurePayload = z.strictObject({
  /** The measurement's start: it groups every slice's count in model_volume. */
  sweptAt: instant,
  /** Divar's brand_model value, or ROOT for every car. */
  slice: z.strictObject({ key: z.string().min(1), level }),
  page: z.int().min(1),
  cursor: z.unknown().optional(),
  /** Rows counted on the pages before this one, and how many of them were bumped rather than posted. */
  rows: z.int().min(0),
  bumped: z.int().min(0),
  newestSortedAt: instant.nullable(),
  oldestSortedAt: instant.nullable(),
  /** The values one level down, from the slice's first page, for measuring it again if the source cut it short. */
  children: z.array(z.string()),
});
export type MeasurePayload = z.infer<typeof measurePayload>;

export type DivarJobs = {
  readonly discover: LaneJobDefinition<DiscoverPayload>;
  readonly listing: LaneJobDefinition<ListingPayload>;
  readonly measure: LaneJobDefinition<MeasurePayload>;
  readonly all: readonly JobDefinition[];
};

const NEXT_LEVEL = { all: 'brand', brand: 'model', model: 'trim' } as const;

/** The listing's latest price event as a shown price; a placeholder keeps no figure, and none is compared. */
function latestShown(latest: NonNullable<KnownListing['latestPrice']>): ShownPrice | undefined {
  if (latest.type === 'asking' && latest.toman !== null)
    return { type: 'asking', toman: toToman(latest.toman) };
  if (latest.type === 'negotiable') return { type: 'negotiable' };
  if (latest.type === 'placeholder') return { type: 'placeholder', toman: toToman(0) };
  return undefined;
}

/** Whether a row shows another price than the listing's latest price event. */
function rowPriceChanged(row: SearchRow, known: KnownListing): boolean {
  const shown = row.priceText === undefined ? undefined : parseShownPrice(row.priceText);
  const latest = known.latestPrice === undefined ? undefined : latestShown(known.latestPrice);
  return shown !== undefined && latest !== undefined && !samePrice(shown, latest);
}

function newest(rows: readonly SearchRow[]): Date | undefined {
  return rows.reduce<Date | undefined>(
    (top, row) => (row.sortedAt && (!top || row.sortedAt > top) ? row.sortedAt : top),
    undefined,
  );
}

function oldest(rows: readonly SearchRow[]): Date | undefined {
  return rows.reduce<Date | undefined>(
    (low, row) => (row.sortedAt && (!low || row.sortedAt < low) ? row.sortedAt : low),
    undefined,
  );
}

function laterOf(a: string | null | undefined, b: Date | undefined): string | null {
  if (b === undefined) return a ?? null;
  return a === null || a === undefined || new Date(a) < b ? b.toISOString() : a;
}

function earlierOf(a: string | null, b: Date | undefined): string | null {
  if (b === undefined) return a;
  return a === null || new Date(a) > b ? b.toISOString() : a;
}

/** A value one level below `parent` in Divar's brand_model tree: under every car, any brand; else the parent's own. */
function isChildOf(parent: string, value: string): boolean {
  return parent === 'ROOT' ? value !== 'ROOT' : value.startsWith(`${parent} `);
}

/**
 * Reads one listing's own page (CS-33, CS-35): a detail of a new or changed listing, a check that a listing a sweep
 * missed has left the market, or a buyer's re-check. A post Divar no longer has is gone; a car's page stores its
 * snapshot once per content, a price event when the price changed, when it was last checked, its own end date and
 * model key, and marks it expired when that end date has passed.
 */
export async function readListingPage(
  context: LaneJobContext,
  source: { readonly sourceId: string; readonly apiUrl: string },
  token: string,
  kind: Extract<CrawlKind, 'detail' | 'check' | 'recheck'>,
): Promise<void> {
  const { sourceId, apiUrl } = source;
  await crawlStep(context, kind, async (run) => {
    const answer = await run.fetch(postUrl(apiUrl, token), { method: 'GET', detectBlock: postRefusal });
    if (answer.status === 404 || answer.status === 410) {
      // The post is gone from Divar: a known listing leaves the market; an unknown one was never stored.
      await context.db.transaction().execute(async (trx) => {
        const gone = await markListingGone(trx, sourceId, token, answer.startedAt);
        const listingId = gone ?? (await listingIdOf(trx, sourceId, token));
        await run.logAnswer(trx, answer, answer.status === 410 ? 'gone' : 'not_found', { listingId });
        run.count(gone === undefined ? 'notFound' : 'markedGone');
        await run.succeed(trx);
      });
      return;
    }
    if (answer.status !== 200) throw new DivarShapeError(`the post answered ${String(answer.status)}`);
    const { payload, facts } = readPost(answer.body);
    if (facts.unknownSections.length > 0) {
      run.count('unknownSections', facts.unknownSections.length);
      context.log.debug('post sections left out of the snapshot', { sections: facts.unknownSections });
    }
    await context.db.transaction().execute(async (trx) => {
      if (!facts.isCar) {
        // Not a car or pick-up (a motorcycle, say): never stored.
        await run.logAnswer(trx, answer, 'ok');
        run.count('notACar');
        await run.succeed(trx);
        return;
      }
      const listingId = await upsertListing(trx, {
        sourceId,
        key: token,
        url: listingPageUrl(token),
        listedAt: facts.publishedAt ?? answer.startedAt,
        seenAt: answer.startedAt,
        checkedAt: answer.startedAt,
        ...(facts.expiresAt && { expiresAt: facts.expiresAt }),
        ...(facts.brandModel !== undefined && { sourceModelKey: facts.brandModel }),
      });
      const snapshot = await storeSnapshot(trx, {
        listingId,
        url: answer.url,
        fetchedAt: answer.startedAt,
        canonicalVersion: CANONICAL_VERSION,
        payload,
      });
      await run.logAnswer(trx, answer, 'ok', { listingId, snapshotId: snapshot.snapshotId });
      run.count(snapshot.stored ? 'snapshotsStored' : 'snapshotsUnchanged');
      if (facts.price === undefined) {
        run.count('priceUnread');
      } else if (
        await recordPriceChange(trx, {
          listingId,
          observedAt: answer.startedAt,
          type: facts.price.type,
          toman: facts.price.type === 'asking' ? facts.price.toman : null,
          snapshotId: snapshot.snapshotId,
        })
      ) {
        run.count('priceEvents');
      }
      if (facts.expiresAt && facts.expiresAt <= answer.startedAt) {
        // Divar still answers for a post past its end date; it is off the market all the same (ADR-0017 point 3).
        if (await markListingOffMarket(trx, sourceId, token, 'expired', facts.expiresAt))
          run.count('markedExpired');
      }
      if (facts.publishedAt === undefined) run.count('postedAtUnread');
      await run.succeed(trx);
    });
  });
}

export function divarJobs(options: DivarJobsOptions): DivarJobs {
  const { sourceId, apiUrl } = options;
  const discovery = { ...DISCOVERY, ...options.discovery };
  const limits = { ...MEASURE, ...options.measure };
  const brandModels = options.trackedModels.map((model) => model.brandModel);

  const listing: LaneJobDefinition<ListingPayload> = defineLaneJob({
    name: 'crawl.divar-listing',
    priority: 40,
    payload: listingPayload,
    source: () => sourceId,
    run: ({ token }, context) => readListingPage(context, { sourceId, apiUrl }, token, 'detail'),
  });

  const discover: LaneJobDefinition<DiscoverPayload> = defineLaneJob({
    name: 'crawl.divar-discover',
    priority: 60,
    payload: discoverPayload,
    source: () => sourceId,
    schedules: options.scheduled
      ? [{ key: 'every-15-minutes', cron: '*/15 * * * *', payload: { page: 1 } }]
      : [],
    async run(payload, context) {
      if (brandModels.length === 0) {
        context.log.warn('discovery has no tracked models to read', { source: sourceId });
        return;
      }
      let round = payload.round;
      if (round === undefined) {
        const started = await startFeedRound(context.db, sourceId, TRACKED_FEED, discovery.minimumGapMinutes);
        if (!started) {
          // A round started a moment ago: the schedule queued this one while the lane waited.
          context.count('roundsSkipped');
          return;
        }
        round = {
          startedAt: started.startedAt.toISOString(),
          readThroughAt: started.readThroughAt?.toISOString() ?? null,
          newestSortedAt: null,
        };
      }
      const thisRound = round;
      const horizon = thisRound.readThroughAt
        ? new Date(thisRound.readThroughAt)
        : new Date(new Date(thisRound.startedAt).getTime() - discovery.firstRoundHours * 3_600_000);
      await crawlStep(context, 'discovery', async (run) => {
        const answer = await run.fetch(searchUrl(apiUrl), {
          method: 'POST',
          headers: JSON_BODY,
          body: searchBody({ brandModels, cursor: payload.cursor }),
          // The tracked models always have listings: an empty page, first or next, is a refusal.
          detectBlock: searchRefusal(true),
        });
        if (answer.status !== 200) throw new DivarShapeError(`the search answered ${String(answer.status)}`);
        const page = readSearchPage(answer.body);
        if (page.otherWidgets.length > 0) {
          // The tracked models' feed ran out of Tehran's listings: never seen, since it holds thousands.
          context.log.warn('discovery feed ended before its mark', {
            page: payload.page,
            rows: page.rows.length,
            suggested: page.suggestedRows,
            widgets: page.otherWidgets,
          });
        }
        // Promoted rows sit on top whatever their time; the rest are newest first.
        const ordinary = page.rows.filter((row) => !row.promoted);
        const isFresh = (row: SearchRow) =>
          row.promoted || row.sortedAt === undefined || row.sortedAt > horizon;
        const fresh = page.rows.filter(isFresh);
        // Every row on the page is looked up. One at or below the mark was read by the last round, unless Divar showed
        // it late (a post approved after its sort time, say): unknown, it is new all the same, at no extra request. In a
        // first round, the rows below its hour are fetched the same way.
        const known = await knownListings(
          context.db,
          sourceId,
          page.rows.map((row) => row.token),
        );
        const details: ListingPayload[] = [];
        const sightings: string[] = [];
        let late = 0;
        for (const row of page.rows) {
          const listing = known.get(row.token);
          if (!listing?.hasSnapshot) {
            details.push({ token: row.token, reason: 'new' });
            if (!isFresh(row)) late += 1;
            continue;
          }
          if (!isFresh(row)) continue;
          sightings.push(row.token);
          if (rowPriceChanged(row, listing)) details.push({ token: row.token, reason: 'changed' });
        }
        const newestSortedAt = laterOf(thisRound.newestSortedAt, newest(ordinary));
        const oldestOnPage = oldest(ordinary);
        // Rows at or below the mark were read by the last round; above it, everything is new or moved up since.
        const reachedMark = oldestOnPage === undefined || oldestOnPage <= horizon;
        // A page that is not full is the feed's last, whatever Divar says (the measurement found it on 2026-09-29).
        const more = page.hasNextPage && page.rows.length >= PAGE_ROWS;
        const pageLimit = !reachedMark && more && payload.page >= discovery.maxPages;
        const readsOn = !reachedMark && more && !pageLimit;
        run.count('rows', page.rows.length);
        run.count('fresh', fresh.length);
        run.count('newListings', details.filter((detail) => detail.reason === 'new').length);
        run.count('lateListings', late);
        run.count('changedListings', details.filter((detail) => detail.reason === 'changed').length);
        if (pageLimit) run.count('pageLimit');
        await context.db.transaction().execute(async (trx) => {
          await run.logAnswer(trx, answer, 'ok');
          run.count('sightings', await recordSightings(trx, sourceId, sightings, answer.startedAt));
          for (const detail of details) await context.enqueue(listing, detail, { transaction: trx });
          if (readsOn) {
            await context.enqueue(
              discover,
              { page: payload.page + 1, cursor: page.cursor, round: { ...thisRound, newestSortedAt } },
              { transaction: trx },
            );
          } else if (newestSortedAt !== null) {
            await finishFeedRound(trx, sourceId, TRACKED_FEED, new Date(newestSortedAt));
          }
          await run.succeed(trx);
        });
        if (pageLimit) {
          context.log.warn("discovery round stopped at its page limit before the last round's mark", {
            pages: payload.page,
            readThroughAt: thisRound.readThroughAt,
          });
        }
      });
    },
  });

  const measure: LaneJobDefinition<MeasurePayload> = defineLaneJob({
    name: 'crawl.divar-measure',
    priority: 5,
    payload: measurePayload,
    source: () => sourceId,
    // A measurement walks for hours behind everything else; a slice's page still waiting after a day is stale.
    retentionDays: 2,
    async run(payload, context) {
      const { slice } = payload;
      await crawlStep(context, 'measure', async (run) => {
        const answer = await run.fetch(searchUrl(apiUrl), {
          method: 'POST',
          headers: JSON_BODY,
          body: searchBody({ brandModels: slice.key === 'ROOT' ? [] : [slice.key], cursor: payload.cursor }),
          // Every car in Tehran is never an empty page. Any other slice may hold no listing, and Divar says a next page
          // follows even under a slice of one, so an empty page there is where the slice ends, not a refusal.
          detectBlock: searchRefusal(slice.level === 'all' && payload.page === 1),
        });
        if (answer.status !== 200) throw new DivarShapeError(`the search answered ${String(answer.status)}`);
        const page = readSearchPage(answer.body);
        const ordinary = page.rows.filter((row) => !row.promoted);
        // A page that is not full is a slice's last, whatever Divar says: past it comes an empty answer or other cities.
        const full = page.rows.length >= PAGE_ROWS;
        const hasMore = page.hasNextPage && full;
        if (page.otherWidgets.length > 0 || (page.hasNextPage && !full)) {
          // How a slice ends on Divar: a short page that says more follow, or a divider before other listings.
          context.log.info('search page shape', {
            slice: slice.key,
            page: payload.page,
            rows: page.rows.length,
            promoted: page.rows.length - ordinary.length,
            suggested: page.suggestedRows,
            hasNextPage: page.hasNextPage,
            widgets: page.otherWidgets,
          });
        }
        const rows = payload.rows + ordinary.length;
        const bumped = payload.bumped + ordinary.filter((row) => row.bumped).length;
        const newestSortedAt = laterOf(payload.newestSortedAt, newest(ordinary));
        const oldestSortedAt = earlierOf(payload.oldestSortedAt, oldest(ordinary));
        const children =
          payload.page === 1
            ? page.childValues.filter((value) => isChildOf(slice.key, value))
            : payload.children;
        const sweptAt = new Date(payload.sweptAt);
        const maxPages = slice.level === 'all' ? limits.allPages : limits.slicePages;
        const first = (key: string, childLevel: MeasurePayload['slice']['level']): MeasurePayload => ({
          sweptAt: payload.sweptAt,
          slice: { key, level: childLevel },
          page: 1,
          rows: 0,
          bumped: 0,
          newestSortedAt: null,
          oldestSortedAt: null,
          children: [],
        });
        // A brand with more than one page is counted through its models, which also gives each model's count.
        const splitBrand = slice.level === 'brand' && payload.page === 1 && hasMore && children.length > 0;
        const readsOn = !splitBrand && hasMore && payload.page < maxPages;
        const ended = !hasMore;
        // Read to the page limit with more to come: counted one level down, like a slice the source cut short.
        const limited = hasMore && payload.page >= maxPages;
        const cutShort =
          ended &&
          rows >= limits.cutAfterRows &&
          oldestSortedAt !== null &&
          new Date(oldestSortedAt).getTime() > Date.now() - limits.completeAfterDays * 86_400_000;
        // A brand or model the source cut short is measured again one level down; every car's brands are already sent.
        const below =
          slice.level === 'brand' || slice.level === 'model' ? NEXT_LEVEL[slice.level] : undefined;
        const splitCut = (cutShort || limited) && below !== undefined && children.length > 0;
        run.count('rows', ordinary.length);
        const measured = !splitBrand && !readsOn;
        await context.db.transaction().execute(async (trx) => {
          await run.logAnswer(trx, answer, 'ok');
          if (slice.level === 'all' && payload.page === 1) {
            for (const brand of children)
              await context.enqueue(measure, first(brand, 'brand'), { transaction: trx });
          }
          if (splitBrand) {
            for (const model of children)
              await context.enqueue(measure, first(model, 'model'), { transaction: trx });
          } else if (readsOn) {
            await context.enqueue(
              measure,
              {
                ...payload,
                page: payload.page + 1,
                cursor: page.cursor,
                rows,
                bumped,
                newestSortedAt,
                oldestSortedAt,
                children,
              },
              { transaction: trx },
            );
          } else {
            await recordModelVolume(trx, {
              sourceId,
              sourceModelKey: slice.key,
              level: slice.level,
              sweptAt,
              activeCount: rows,
              pagesRead: payload.page,
              complete: ended && !cutShort,
            });
            if (splitCut) {
              for (const child of children) {
                await context.enqueue(measure, first(child, below), { transaction: trx });
              }
            }
          }
          await run.succeed(trx);
        });
        if (measured) {
          // The measurement's record for people: how many listings, how many of the rows were bumped rather than posted,
          // and the time the pages spanned, from which listings posted an hour follow (CS-33 criterion 5).
          context.log.info('slice measured', {
            slice: slice.key,
            level: slice.level,
            rows,
            bumped,
            pagesRead: payload.page,
            complete: ended && !cutShort,
            newestSortedAt,
            oldestSortedAt,
          });
        }
      });
    },
  });

  return { discover, listing, measure, all: [discover, listing, measure] };
}
