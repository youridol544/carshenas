import * as z from 'zod';
import { toToman } from '@carshenas/locale/toman';
import { databaseNow, recordModelVolume } from '../db/crawl-store.ts';
import { measureFreshness } from '../db/freshness-store.ts';
import {
  expireListings,
  knownListings,
  markMissingGone,
  missingFromSlice,
  recordSweptPage,
  type KnownListing,
  type SweptRow,
} from '../db/listing-store.ts';
import {
  defineJob,
  defineLaneJob,
  type JobDefinition,
  type LaneJobDefinition,
  type QueueJobDefinition,
} from '../runtime/job.ts';
import { DivarShapeError, searchRefusal } from '../sources/divar/answers.ts';
import { listingPageUrl, searchBody, searchUrl, TOKEN } from '../sources/divar/api.ts';
import { PAGE_ROWS, readSearchPage, type SearchRow } from '../sources/divar/search.ts';
import {
  backfillCandidates,
  fulfilCrawlRequests,
  queuedBackfillTokens,
  resolveTracked,
} from '../db/tracked-store.ts';
import type { TrackedModelsSource, TrackedPriority } from '../sources/divar/tracked-models.ts';
import { parseShownPrice, samePrice, type ShownPrice } from '../sources/price.ts';
import { crawlStep } from './crawl-step.ts';
import { listingPayload, readListingPage, type ListingPayload } from './divar.ts';

// Keeping Divar's listings fresh (CS-35; ADR-0017 points 3, 5 and 6), in Divar's lane, one request per job:
//   - sweeps read list pages only: the tracked models every day, the rest of the market every week, slice by slice
//     (make, model, trim) so no search reaches Divar's cap of about 1,200 results. A page refreshes when each listing
//     was last seen, records a price event for every row that shows another price (the page's request is the
//     evidence), and backfills the details of tracked listings it finds without one (priority 20, ADR-0017's backfill:
//     the first sweeps of a model find thousands, and they must not hold the sweep's own pages back); a slice read to
//     its end records its model's volume
//     and finds the listings it no longer shows: a tracked one is checked with one request, an untracked one is marked
//     gone at once (the owner's decision of 2026-09-30);
//   - a check or a buyer's re-check reads one listing's page, as a detail does (readListingPage);
//   - once an hour, listings past Divar's own end date are marked expired, without a request.
// Priorities follow ADR-0017's order (budget.ts): re-checks 50, the tracked sweep and its checks 30, the untracked sweep
// 10. A slice's next page goes one above its kind, so a slice is read to its end before the next one starts.

export type SweepLimits = {
  /** A slice is read at most this deep; one that has more is swept again one level down. */
  readonly slicePages: number;
  /**
   * A slice whose pages end after at least this many rows while its oldest row is younger than `completeAfterDays` was
   * cut short by the source (about 1,200 results a search), so it is swept again one level down.
   */
  readonly cutAfterRows: number;
  readonly completeAfterDays: number;
  /**
   * A complete slice that no longer shows more than this share of its listings (and more than `missingFloor`) is
   * doubted, not believed: nothing is checked or marked gone, and a line is logged for a person.
   */
  readonly missingShareHeld: number;
  readonly missingFloor: number;
};

const SWEEP: SweepLimits = {
  slicePages: 50,
  cutAfterRows: 1_000,
  completeAfterDays: 25,
  missingShareHeld: 0.5,
  missingFloor: 20,
};

export type DivarFreshnessOptions = {
  readonly sourceId: string;
  readonly apiUrl: string;
  /** The models read in depth: a fixed list, or the table tracked_model read each time a job runs (CS-53). */
  readonly trackedModels: TrackedModelsSource;
  /** Whether the sweeps, expiry and re-checks run by themselves; the tests send them. */
  readonly scheduled: boolean;
  readonly sweep?: Partial<SweepLimits>;
  readonly backfill?: Partial<BackfillLimits>;
};

export type BackfillLimits = {
  /**
   * The planner keeps about this many backfill jobs waiting in the source's lane and sends more only below it: the lane
   * and the daily budget decide how fast they are read, and the queue stays small however many listings wait.
   */
  readonly queueTarget: number;
};

const BACKFILL: BackfillLimits = { queueTarget: 150 };

/** A tracked model's share of the planner's room, and the priority of its jobs inside the backfill tier (20 to 29). */
const BACKFILL_WEIGHT: Record<TrackedPriority, number> = { high: 3, normal: 2, low: 1 };
const BACKFILL_PRIORITY: Record<TrackedPriority, number> = { high: 22, normal: 21, low: 20 };

const instant = z.iso.datetime({ offset: true });
const scope = z.enum(['tracked', 'untracked']);
const level = z.enum(['all', 'brand', 'model', 'trim']);

const startPayload = z.strictObject({ scope });
export type StartSweepPayload = z.infer<typeof startPayload>;

const sweepPayload = z.strictObject({
  scope,
  /** When the sweep started, by the database's clock: a listing not seen since is missing from a complete slice. */
  sweptAt: instant,
  /** Divar's brand_model value, or ROOT for every car. */
  slice: z.strictObject({ key: z.string().min(1), level }),
  page: z.int().min(1),
  cursor: z.unknown().optional(),
  /** Rows counted on the slice's pages before this one. */
  rows: z.int().min(0),
  oldestSortedAt: instant.nullable(),
  /** The values one level down, from the slice's first page, for sweeping it again if the source cut it short. */
  children: z.array(z.string()),
  /**
   * A complete slice's first page, read once more before its missing listings are judged: a listing bumped while the
   * slice was being read moved above the pages already read, and shows here (rows then holds the slice's count).
   */
  confirming: z.boolean().optional(),
});
export type SweepPayload = z.infer<typeof sweepPayload>;

const tokenPayload = z.strictObject({ token: z.string().regex(TOKEN) });
export type TokenPayload = z.infer<typeof tokenPayload>;

export type DivarFreshnessJobs = {
  readonly startSweep: QueueJobDefinition<StartSweepPayload>;
  readonly sweepTracked: LaneJobDefinition<SweepPayload>;
  readonly sweepUntracked: LaneJobDefinition<SweepPayload>;
  readonly check: LaneJobDefinition<TokenPayload>;
  readonly backfill: LaneJobDefinition<ListingPayload>;
  readonly recheck: LaneJobDefinition<TokenPayload>;
  readonly expire: QueueJobDefinition<Record<string, never>>;
  readonly measure: QueueJobDefinition<Record<string, never>>;
  /** Sends the details of tracked models' already-seen listings to the lane, newest first (CS-53). */
  readonly planBackfill: QueueJobDefinition<Record<string, never>>;
  readonly all: readonly JobDefinition[];
};

const NEXT_LEVEL = { brand: 'model', model: 'trim' } as const;
const JSON_BODY = { 'content-type': 'application/json' } as const;

/** A value one level below `parent` in Divar's brand_model tree: under every car, any brand; else the parent's own. */
function isChildOf(parent: string, value: string): boolean {
  return parent === 'ROOT' ? value !== 'ROOT' : value.startsWith(`${parent} `);
}

/** A row's price as the price history records it: an amount only for an asking price. */
function priceOfRow(row: SearchRow): SweptRow['price'] {
  const shown = row.priceText === undefined ? undefined : parseShownPrice(row.priceText);
  if (shown === undefined) return undefined;
  return { type: shown.type, toman: shown.type === 'asking' ? shown.toman : null };
}

/** The listing's latest price event as a shown price; a placeholder keeps no figure, and none is compared. */
function latestShown(latest: NonNullable<KnownListing['latestPrice']>): ShownPrice | undefined {
  if (latest.type === 'asking' && latest.toman !== null)
    return { type: 'asking', toman: toToman(latest.toman) };
  if (latest.type === 'negotiable') return { type: 'negotiable' };
  if (latest.type === 'placeholder') return { type: 'placeholder', toman: toToman(0) };
  return undefined;
}

function rowPriceChanged(row: SearchRow, known: KnownListing): boolean {
  const shown = row.priceText === undefined ? undefined : parseShownPrice(row.priceText);
  const latest = known.latestPrice === undefined ? undefined : latestShown(known.latestPrice);
  return shown !== undefined && latest !== undefined && !samePrice(shown, latest);
}

function earlierOf(a: string | null, rows: readonly SearchRow[]): string | null {
  const low = rows.reduce<Date | undefined>(
    (min, row) => (row.sortedAt && (!min || row.sortedAt < min) ? row.sortedAt : min),
    undefined,
  );
  if (low === undefined) return a;
  return a === null || new Date(a) > low ? low.toISOString() : a;
}

export function divarFreshnessJobs(options: DivarFreshnessOptions): DivarFreshnessJobs {
  const { sourceId, apiUrl } = options;
  const limits = { ...SWEEP, ...options.sweep };
  const backfillLimits = { ...BACKFILL, ...options.backfill };
  /** The tracked models' keys now: the table is read when a job runs, so a change is seen by the next one. */
  const trackedKeys = async (db: Parameters<typeof resolveTracked>[1]) =>
    (await resolveTracked(options.trackedModels, db)).map((model) => model.brandModel);
  /** A tracked model's own key, or a trim under it. */
  const trackedBy = (tracked: readonly string[]) => (key: string | null) =>
    key !== null && tracked.some((model) => key === model || key.startsWith(`${model} `));

  const check: LaneJobDefinition<TokenPayload> = defineLaneJob({
    name: 'crawl.divar-check',
    priority: 30,
    payload: tokenPayload,
    source: () => sourceId,
    run: ({ token }, context) => readListingPage(context, { sourceId, apiUrl }, token, 'check'),
  });

  const recheck: LaneJobDefinition<TokenPayload> = defineLaneJob({
    name: 'crawl.divar-recheck',
    priority: 50,
    payload: tokenPayload,
    source: () => sourceId,
    run: ({ token }, context) => readListingPage(context, { sourceId, apiUrl }, token, 'recheck'),
  });

  const backfill: LaneJobDefinition<ListingPayload> = defineLaneJob({
    name: 'crawl.divar-backfill',
    priority: 20,
    payload: listingPayload,
    source: () => sourceId,
    run: ({ token }, context) => readListingPage(context, { sourceId, apiUrl }, token, 'detail'),
  });

  const makeSweep = (name: string, priority: number): LaneJobDefinition<SweepPayload> => {
    const job: LaneJobDefinition<SweepPayload> = defineLaneJob({
      name,
      priority,
      payload: sweepPayload,
      source: () => sourceId,
      // A page the budget holds back waits for the next Tehran day; one still waiting after eight days belongs to a
      // sweep the next weekly one has replaced.
      retentionDays: 8,
      async run(payload, context) {
        const { slice } = payload;
        const tracked = await trackedKeys(context.db);
        const isTracked = trackedBy(tracked);
        const sweptAt = new Date(payload.sweptAt);
        await crawlStep(context, 'sweep', async (run) => {
          const answer = await run.fetch(searchUrl(apiUrl), {
            method: 'POST',
            headers: JSON_BODY,
            body: searchBody({
              brandModels: slice.key === 'ROOT' ? [] : [slice.key],
              cursor: payload.cursor,
            }),
            // Every car in Tehran is never an empty page; any other slice may end in one (the measurement's rule).
            detectBlock: searchRefusal(slice.level === 'all' && payload.page === 1),
          });
          if (answer.status !== 200)
            throw new DivarShapeError(`the search answered ${String(answer.status)}`);
          const page = readSearchPage(answer.body);
          // Each listing once: a model's volume is its listings, whatever a page repeats.
          const ordinary = [
            ...new Map(page.rows.filter((row) => !row.promoted).map((row) => [row.token, row])).values(),
          ];
          // A page that is not full is a slice's last, whatever Divar says (the measurement, 2026-09-29).
          const hasMore = page.hasNextPage && page.rows.length >= PAGE_ROWS;
          const rows = payload.rows + ordinary.length;
          const oldestSortedAt = earlierOf(payload.oldestSortedAt, ordinary);
          const children =
            payload.page === 1
              ? page.childValues.filter((value) => isChildOf(slice.key, value))
              : payload.children;
          // The untracked sweep leaves the tracked models to the daily one.
          const childSlices =
            payload.scope === 'untracked' ? children.filter((child) => !isTracked(child)) : children;
          const root = slice.level === 'all';
          const splitBrand = slice.level === 'brand' && payload.page === 1 && hasMore && children.length > 0;
          const readsOn = !root && !splitBrand && hasMore && payload.page < limits.slicePages;
          const limited = hasMore && payload.page >= limits.slicePages;
          const ended = !hasMore;
          const cutShort =
            ended &&
            rows >= limits.cutAfterRows &&
            oldestSortedAt !== null &&
            new Date(oldestSortedAt).getTime() > Date.now() - limits.completeAfterDays * 86_400_000;
          const below =
            slice.level === 'brand' || slice.level === 'model' ? NEXT_LEVEL[slice.level] : undefined;
          const splitCut = (cutShort || limited) && below !== undefined && children.length > 0;
          const confirming = payload.confirming === true;
          const finished = !confirming && !root && !splitBrand && !readsOn;
          // Read to its end: its missing listings are judged after its first page is read once more.
          const complete = finished && ended && !cutShort;
          const sliceTracked = isTracked(slice.key);
          const known = await knownListings(
            context.db,
            sourceId,
            page.rows.map((row) => row.token),
          );
          const first = (key: string, childLevel: SweepPayload['slice']['level']): SweepPayload => ({
            scope: payload.scope,
            sweptAt: payload.sweptAt,
            slice: { key, level: childLevel },
            page: 1,
            rows: 0,
            oldestSortedAt: null,
            children: [],
          });
          run.count('rows', page.rows.length);
          await context.db.transaction().execute(async (trx) => {
            const fetchLogId = await run.logAnswer(trx, answer, 'ok');
            // Every car's first page only names the brands: its rows are anyone's, so they carry no model key.
            if (!root) {
              const written = await recordSweptPage(trx, {
                sourceId,
                sliceKey: slice.key,
                sweptAt,
                seenAt: answer.startedAt,
                fetchLogId,
                rows: page.rows.map((row) => ({
                  key: row.token,
                  url: listingPageUrl(row.token),
                  listedAt: row.sortedAt ?? answer.startedAt,
                  price: priceOfRow(row),
                })),
              });
              run.count('newListings', written.newKeys.length);
              run.count('priceEvents', written.priceEvents);
              // The re-read of a complete slice only refreshes sightings: its backfills were asked for already.
              if (sliceTracked && !confirming) {
                // ADR-0017 point 3: a tracked listing first seen, or whose row shows another price, gets its details,
                // as a backfill: the row has already recorded any new price, and discovery reads the newest listings.
                // Once per listing, even when the page shows it twice (a promoted row and its ordinary one).
                for (const row of new Map(page.rows.map((shown) => [shown.token, shown])).values()) {
                  const listing = known.get(row.token);
                  const reason = !listing?.hasSnapshot
                    ? 'new'
                    : rowPriceChanged(row, listing)
                      ? 'changed'
                      : undefined;
                  if (reason === undefined) continue;
                  run.count(reason === 'new' ? 'detailsNew' : 'detailsChanged');
                  await context.enqueue(backfill, { token: row.token, reason }, { transaction: trx });
                }
              }
            }
            if (confirming) {
              // Nothing more to read or count: the rows above refreshed whatever a bump moved up.
            } else if (root) {
              for (const brand of childSlices)
                await context.enqueue(job, first(brand, 'brand'), { transaction: trx });
            } else if (splitBrand) {
              for (const model of childSlices)
                await context.enqueue(job, first(model, 'model'), { transaction: trx });
              run.count('slicesSplit');
            } else if (readsOn) {
              await context.enqueue(
                job,
                { ...payload, page: payload.page + 1, cursor: page.cursor, rows, oldestSortedAt, children },
                { transaction: trx, priority: priority + 1 },
              );
            } else {
              await recordModelVolume(trx, {
                sourceId,
                sourceModelKey: slice.key,
                level: slice.level,
                sweptAt,
                activeCount: rows,
                pagesRead: payload.page,
                complete,
              });
              if (splitCut) {
                for (const child of childSlices)
                  await context.enqueue(job, first(child, below), { transaction: trx });
                run.count('slicesSplit');
              }
            }
            if (complete) {
              await context.enqueue(
                job,
                { ...first(slice.key, slice.level), rows, confirming: true },
                { transaction: trx, priority: priority + 1 },
              );
            }
            if (confirming) {
              const { rows: sliceRows } = payload;
              const missing = (await missingFromSlice(trx, sourceId, slice.key, sweptAt)).filter(
                (listing) => payload.scope === 'tracked' || !isTracked(listing.sourceModelKey),
              );
              const doubtful =
                missing.length > limits.missingFloor && missing.length > sliceRows * limits.missingShareHeld;
              if (doubtful) {
                run.count('missingHeld', missing.length);
              } else if (payload.scope === 'tracked') {
                for (const listing of missing) {
                  await context.enqueue(check, { token: listing.key }, { transaction: trx });
                }
                run.count('missingChecks', missing.length);
              } else {
                run.count(
                  'markedGone',
                  await markMissingGone(
                    trx,
                    missing.map((listing) => listing.listingId),
                    sweptAt,
                  ),
                );
              }
              if (doubtful) {
                context.log.warn('sweep slice missed too many listings to believe', {
                  slice: slice.key,
                  rows: sliceRows,
                  missing: missing.length,
                });
              }
            }
            await run.succeed(trx);
          });
        });
      },
    });
    return job;
  };

  const sweepTracked = makeSweep('crawl.divar-sweep-tracked', 30);
  const sweepUntracked = makeSweep('crawl.divar-sweep', 10);

  const startSweep: QueueJobDefinition<StartSweepPayload> = defineJob({
    name: 'divar.start-sweep',
    payload: startPayload,
    schedules: options.scheduled
      ? [
          // Tehran time: the tracked models every night, the rest of the market every Friday.
          { key: 'tracked-daily', cron: '30 2 * * *', payload: { scope: 'tracked' } },
          { key: 'untracked-weekly', cron: '30 3 * * 5', payload: { scope: 'untracked' } },
        ]
      : [],
    async run(payload, context) {
      const sweptAt = (await databaseNow(context.db)).toISOString();
      const tracked = await trackedKeys(context.db);
      const firstOf = (key: string, sliceLevel: SweepPayload['slice']['level']): SweepPayload => ({
        scope: payload.scope,
        sweptAt,
        slice: { key, level: sliceLevel },
        page: 1,
        rows: 0,
        oldestSortedAt: null,
        children: [],
      });
      await context.db.transaction().execute(async (trx) => {
        if (payload.scope === 'tracked') {
          for (const model of tracked) {
            await context.enqueue(sweepTracked, firstOf(model, 'model'), { transaction: trx });
          }
        } else {
          await context.enqueue(sweepUntracked, firstOf('ROOT', 'all'), { transaction: trx });
        }
      });
      context.count('slices', payload.scope === 'tracked' ? tracked.length : 1);
    },
  });

  const expire: QueueJobDefinition<Record<string, never>> = defineJob({
    name: 'divar.expire-listings',
    payload: z.strictObject({}),
    schedules: options.scheduled ? [{ key: 'hourly', cron: '12 * * * *', payload: {} }] : [],
    async run(_payload, context) {
      context.count('markedExpired', await expireListings(context.db, sourceId));
    },
  });

  const measure: QueueJobDefinition<Record<string, never>> = defineJob({
    name: 'divar.measure-freshness',
    payload: z.strictObject({}),
    schedules: options.scheduled ? [{ key: 'hourly', cron: '5 * * * *', payload: {} }] : [],
    async run(_payload, context) {
      // The whole source first, then each tracked model with its trims (CS-35 criterion 6).
      for (const key of [null, ...(await trackedKeys(context.db))]) {
        const figures = await measureFreshness(context.db, sourceId, key);
        if (figures === undefined) {
          context.count('alreadyMeasured');
          continue;
        }
        context.count('measured');
        if (key === null) context.log.info('freshness measured', { source: sourceId, ...figures });
      }
    },
  });

  const planBackfill: QueueJobDefinition<Record<string, never>> = defineJob({
    name: 'divar.plan-backfill',
    payload: z.strictObject({}),
    schedules: options.scheduled ? [{ key: 'every-5-minutes', cron: '*/5 * * * *', payload: {} }] : [],
    async run(_payload, context) {
      // An approved request whose model has been read is done, whatever the crawl is doing now.
      context.count('requestsFulfilled', await fulfilCrawlRequests(context.db));
      const models = (await resolveTracked(options.trackedModels, context.db)).filter(
        (model) => model.modelId !== undefined,
      );
      if (models.length === 0) return;
      await context.db.transaction().execute(async (trx) => {
        const queued = await queuedBackfillTokens(trx, sourceId, backfill.name);
        const room = backfillLimits.queueTarget - queued.length;
        context.count('queued', queued.length);
        if (room <= 0) return;
        const weight = models.reduce((sum, model) => sum + BACKFILL_WEIGHT[model.priority ?? 'normal'], 0);
        const taken = new Set(queued);
        let remaining = room;
        for (const model of models) {
          if (remaining <= 0) break;
          const priority = model.priority ?? 'normal';
          const share = Math.min(
            remaining,
            Math.max(1, Math.ceil((room * BACKFILL_WEIGHT[priority]) / weight)),
          );
          const candidates = await backfillCandidates(
            trx,
            sourceId,
            { modelId: model.modelId ?? 0, trimId: model.trimId ?? null },
            [...taken],
            share,
          );
          for (const candidate of candidates) {
            taken.add(candidate.key);
            remaining -= 1;
            await context.enqueue(
              backfill,
              { token: candidate.key, reason: 'new' },
              { transaction: trx, priority: BACKFILL_PRIORITY[priority] },
            );
          }
          context.count('backfillsSent', candidates.length);
        }
      });
    },
  });

  return {
    startSweep,
    sweepTracked,
    sweepUntracked,
    check,
    backfill,
    recheck,
    expire,
    measure,
    planBackfill,
    all: [startSweep, sweepTracked, sweepUntracked, check, backfill, recheck, expire, measure, planBackfill],
  };
}
