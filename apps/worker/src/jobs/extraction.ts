import type { Kysely, Transaction } from 'kysely';
import * as z from 'zod';
import { ModelCallError } from '@carshenas/ai/errors';
import { REGISTRY } from '@carshenas/ai/registry';
import { nextStep, type ParsedFields } from '@carshenas/ai/tasks/listing-facts-review';
import type { ListingFactsInput, ShownPrice } from '@carshenas/ai/tasks/listing-facts';
import type { DB, JsonObject } from '@carshenas/db/db-types';
import type { Logger } from '@carshenas/observability/logger';
import { holdListing, latestSnapshots, writeDerivedListingOrRefusal } from '../db/attribute-store.ts';
import {
  failedCallsOf,
  queueInvalidAnswer,
  recordSpend,
  snapshotsToExtract,
  spentTodayUsdMicros,
  storeExtraction,
  type SnapshotToExtract,
  type Spend,
} from '../db/extraction-store.ts';
import { defineJob, type QueueJobDefinition, type WorkerModels } from '../runtime/job.ts';
import { divarListingText, type ListingText } from '../sources/divar/text.ts';
import { PARSERS, type Parser } from '../sources/parsers.ts';

// CS-52's extraction: each active listing's current snapshot is read by the listing.facts AI step once per prompt
// version, through the answer cache (an unchanged text costs nothing), until the day's paid calls reach the cap (the
// owner's decision of 2026-09-30: US$10 a Tehran day by default; the next day resumes). Every paid call is recorded in
// model_spend with its cost whatever it answered, and the job does not run without a known price. Each answer is stored with its
// fields and review items, and the listing is derived again in the same transaction, so the text's reading of the
// price reaches the listing at once (attribute-store.ts merges it). Only codes are stored: prices, mileage and years
// stay CS-34's, and a buyer never sees a number a model made. Lines carry ids and counts, never text.

const TASK = 'listing.facts';
const MODEL_ID = REGISTRY[TASK].model.id;

/**
 * What a call counts toward the cap when the layer could not measure it: a timed-out attempt may still be billed, and
 * a model may lose its price. The evaluation's Gemini calls cost US$0.003 on average and US$0.0064 at most with a
 * re-ask (2026-09-30), so a cent is a ceiling, not an average.
 */
const FAILED_CALL_ESTIMATE_USD = 0.01;

/** Failed calls of its own after which a snapshot goes to a person instead of being tried again. */
const FAILED_CALLS_BEFORE_REVIEW = 3;

/** What each source's snapshots say in the seller's own words. A source joins with its parser (CS-54). */
const TEXT_READERS: Readonly<Record<string, (payload: JsonObject) => ListingText | null>> = {
  divar: divarListingText,
};

export type ExtractionPayload = {
  /** Snapshots read in one run. */
  readonly limit: number;
  /** What listing.facts may spend in one Tehran day, in US dollars; answers from the cache cost nothing. */
  readonly dailyCapUsd: number;
};

export const DEFAULT_EXTRACTION: ExtractionPayload = { limit: 25, dailyCapUsd: 10 };

function isObject(payload: unknown): payload is JsonObject {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

/** The price the site shows, as the model reads it beside the text: an installment's figure is what the site shows. */
function shownPriceOf(snapshot: SnapshotToExtract): ShownPrice {
  switch (snapshot.priceType) {
    case 'asking':
      return snapshot.askingPriceToman === null
        ? { type: 'not_shown' }
        : { type: 'asking', toman: snapshot.askingPriceToman };
    case 'installment':
      return snapshot.downPaymentToman === null
        ? { type: 'not_shown' }
        : { type: 'asking', toman: snapshot.downPaymentToman };
    case 'negotiable':
    case 'placeholder':
      return { type: snapshot.priceType };
    case null:
      return { type: 'not_shown' };
  }
}

function parsedOf(snapshot: SnapshotToExtract): ParsedFields {
  return {
    priceType: snapshot.priceType,
    acceptsInstallments: snapshot.acceptsInstallments,
    acceptsSwap: snapshot.acceptsSwap,
    bodyCondition: snapshot.bodyCondition,
    frontChassisCondition: snapshot.frontChassisCondition,
    rearChassisCondition: snapshot.rearChassisCondition,
  };
}

export type ExtractionContext = {
  readonly db: Kysely<DB>;
  readonly models: WorkerModels;
  readonly log: Logger;
  readonly signal?: AbortSignal;
  count(name: string, by?: number): void;
  /** Each source's text reader and parser; the product's by default, a test source's in tests. */
  readonly readers?: Readonly<Record<string, (payload: JsonObject) => ListingText | null>>;
  readonly parsers?: Readonly<Record<string, Parser>>;
};

/**
 * Derives the listing again when this snapshot is still its latest, so the listing's columns carry the text's reading
 * at once; a newer snapshot is derived by the crawler and read by a later run.
 */
async function deriveAgain(
  trx: Transaction<DB>,
  snapshot: SnapshotToExtract,
  parser: Parser | undefined,
  context: ExtractionContext,
): Promise<void> {
  const [latest] = await latestSnapshots(trx, [snapshot.listingId]);
  if (!parser || latest?.snapshotId !== snapshot.snapshotId || !isObject(latest.payload)) return;
  const outcome = await writeDerivedListingOrRefusal(
    trx,
    snapshot.listingId,
    snapshot.snapshotId,
    parser(latest.payload, latest.fetchedAt),
  );
  if (outcome.refused) context.count('derivationsRefused');
  else if (outcome.written.attributes) context.count('listingsChanged');
}

/** Reads up to `limit` snapshots, stopping at the day's cap. Returns how many it read. */
export async function extractSnapshots(
  context: ExtractionContext,
  payload: ExtractionPayload,
): Promise<number> {
  const promptVersion = context.models.promptVersion(TASK);
  const readers = context.readers ?? TEXT_READERS;
  const parsers = context.parsers ?? PARSERS;
  const snapshots = await snapshotsToExtract(context.db, {
    sourceIds: Object.keys(readers),
    task: TASK,
    promptVersion,
    limit: payload.limit,
  });
  // An unknown price would make every call look free and the cap would never stop the job (CS-52 review).
  if (!context.models.hasPrice(TASK)) {
    context.log.warn('extraction stopped: the model has no known price', { promptVersion });
    context.count('stoppedWithoutPrice');
    return 0;
  }
  // Today's spend, read once; each call's own cost is added as it is recorded.
  let spentUsd = (await spentTodayUsdMicros(context.db, TASK)) / 1e6;
  const spend = async (
    snapshotId: number,
    outcome: Spend['outcome'],
    costUsd: number | null,
    errorReason?: Spend['errorReason'],
  ): Promise<void> => {
    // An attempt with no answer reports no tokens and may still be billed; a missing price is not free.
    const estimated = costUsd === null || errorReason === 'timeout';
    const counted =
      (costUsd ?? FAILED_CALL_ESTIMATE_USD) + (errorReason === 'timeout' ? FAILED_CALL_ESTIMATE_USD : 0);
    await recordSpend(context.db, {
      task: TASK,
      promptVersion,
      model: MODEL_ID,
      outcome,
      ...(errorReason ? { errorReason } : {}),
      costUsd: counted,
      estimated,
      snapshotId,
    });
    spentUsd += counted;
  };
  let read = 0;
  for (const snapshot of snapshots) {
    if (spentUsd >= payload.dailyCapUsd) {
      context.log.warn('extraction daily cap reached', {
        spentUsd,
        capUsd: payload.dailyCapUsd,
        promptVersion,
      });
      context.count('stoppedAtCap');
      break;
    }
    const text = isObject(snapshot.payload) ? readers[snapshot.sourceId]?.(snapshot.payload) : null;
    if (!text) {
      // Not a post its reader knows: a person looks, and it is not read again at this prompt version.
      await queueInvalidAnswer(context.db, {
        snapshotId: snapshot.snapshotId,
        task: TASK,
        promptVersion,
        outcome: 'empty',
        problems: [
          { path: '(the whole answer)', message: 'the snapshot has no title the reader could find' },
        ],
      });
      context.count('unreadable');
      continue;
    }
    const input: ListingFactsInput = { ...text, shownPrice: shownPriceOf(snapshot) };
    let result: Awaited<ReturnType<WorkerModels['call']>>;
    try {
      result = await context.models.call(TASK, input, context.signal ? { signal: context.signal } : {});
    } catch (error) {
      if (!(error instanceof ModelCallError)) throw error;
      await spend(snapshot.snapshotId, 'error', error.costUsd, error.reason);
      // A snapshot whose own calls keep failing (a timeout, a request the provider refuses) goes to a person after
      // FAILED_CALLS_BEFORE_REVIEW, and the job goes on with the next one; an outage, a key or a balance fails the
      // run, and the queue retries it later.
      const own = error.reason === 'timeout' || error.reason === 'rejected';
      if (!own) throw error;
      const failed = await failedCallsOf(context.db, { snapshotId: snapshot.snapshotId, promptVersion });
      if (failed < FAILED_CALLS_BEFORE_REVIEW) throw error;
      await queueInvalidAnswer(context.db, {
        snapshotId: snapshot.snapshotId,
        task: TASK,
        promptVersion,
        outcome: 'error',
        problems: [
          { path: '(the whole answer)', message: `no answer after ${String(failed)} calls: ${error.reason}` },
        ],
      });
      context.count('failedToReview');
      continue;
    }
    if (result.cached) context.count('cached');
    else {
      await spend(snapshot.snapshotId, result.outcome, result.costUsd);
      if (result.costUsd === null) {
        context.log.warn('extraction stopped: the model has no known price', { promptVersion });
        context.count('stoppedWithoutPrice');
        break;
      }
    }
    const step = nextStep(result, input, parsedOf(snapshot));
    await context.db.transaction().execute(async (trx) => {
      if (!(await holdListing(trx, snapshot.listingId))) return;
      if (step.action === 'review') {
        await queueInvalidAnswer(trx, {
          snapshotId: snapshot.snapshotId,
          task: TASK,
          promptVersion: result.promptVersion,
          outcome: step.outcome,
          problems: step.problems,
        });
        context.count('invalid');
        return;
      }
      if (step.answerId === undefined)
        throw new Error('an ok answer has no stored row: the worker caches answers');
      await storeExtraction(trx, {
        snapshotId: snapshot.snapshotId,
        listingId: snapshot.listingId,
        answerId: step.answerId,
        fields: step.fields,
        hold: step.hold,
      });
      context.count('extracted');
      if (step.hold.length > 0) context.count('held');
      context.count('fieldsForReview', step.fields.filter((field) => !field.accepted).length);
      await deriveAgain(trx, snapshot, parsers[snapshot.sourceId], context);
    });
    read += 1;
  }
  return read;
}

export function extractionJobs(options: {
  readonly scheduled: boolean;
}): QueueJobDefinition<ExtractionPayload> {
  return defineJob({
    name: 'extraction.read',
    payload: z.strictObject({
      limit: z.number().int().min(1).max(200),
      dailyCapUsd: z.number().min(0).max(1000),
    }),
    callsModels: true,
    // Up to 25 snapshots, each one call of at most 30 s and one re-ask.
    timeoutSeconds: 30 * 60,
    schedules: options.scheduled
      ? [{ key: 'every-5-minutes', cron: '*/5 * * * *', payload: DEFAULT_EXTRACTION }]
      : [],
    async run(payload, context) {
      await extractSnapshots(
        {
          db: context.db,
          models: context.models,
          log: context.log,
          signal: context.signal,
          count: (name, by) => {
            context.count(name, by);
          },
        },
        payload,
      );
    },
  });
}
