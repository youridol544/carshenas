import { sql, type Kysely } from 'kysely';
import type { DB, Json } from '@carshenas/db/db-types';
import { anyOf } from './listing-store.ts';

// What listing.facts read from a listing's text, stored (CS-52; docs/design/data-model.md, layer 2): an extraction
// linking the snapshot to its validated answer, each field with its confidence and the threshold it was held to, and
// the review queue. Every write is an insert that a unique constraint deduplicates, so a job that runs twice stores
// nothing twice; nothing is read to check before it is written. Invalid answers are only review items, never values
// (CS-52 #1). The listing's derivation reads the text's price back (textPriceMeaningOf) and merges it with CS-34's.

/** One field as the call site computed it (packages/ai's listing-facts-review.ts FieldReading). */
export type StoredField = {
  readonly fact: string;
  readonly value: string;
  readonly evidence: string;
  readonly confidence: number;
  readonly threshold: number;
  readonly accepted: boolean;
};

export type NewExtraction = {
  readonly snapshotId: number;
  readonly listingId: number;
  readonly answerId: number;
  readonly fields: readonly StoredField[];
  readonly hold: readonly ('addressed_model' | 'hidden_characters')[];
};

/** The open review item's subject, as the partial unique index names it; its predicate is a literal. */
const OPEN_SUBJECT = ['extraction_id', 'field', 'kind', 'snapshot_id', 'prompt_version'] as const;

/**
 * Stores an extraction, its fields and its review items; returns the extraction's id. Run inside the caller's
 * transaction, which holds the listing.
 */
export async function storeExtraction(db: Kysely<DB>, extraction: NewExtraction): Promise<number> {
  const inserted = await db
    .insertInto('extraction')
    .values({
      snapshot_id: extraction.snapshotId,
      listing_id: extraction.listingId,
      ai_answer_id: extraction.answerId,
      status: extraction.hold.length > 0 ? 'held' : 'usable',
      hold_reasons: [...extraction.hold],
    })
    .onConflict((conflict) => conflict.constraint('extraction_snapshot_answer_unique').doNothing())
    .returning('id')
    .executeTakeFirst();
  // Stored before, by a run that stopped after it: that row, its fields and its items stand.
  if (!inserted) {
    const stored = await db
      .selectFrom('extraction')
      .select('id')
      .where('snapshot_id', '=', extraction.snapshotId)
      .where('ai_answer_id', '=', extraction.answerId)
      .executeTakeFirstOrThrow();
    return stored.id;
  }
  const id = inserted.id;
  if (extraction.fields.length > 0) {
    await db
      .insertInto('extraction_field')
      .values(
        extraction.fields.map((field) => ({
          extraction_id: id,
          field: field.fact,
          value: field.value,
          evidence: field.evidence,
          confidence: field.confidence.toFixed(3),
          threshold: field.threshold.toFixed(3),
          status: field.accepted ? ('accepted' as const) : ('needs_review' as const),
        })),
      )
      .execute();
  }
  const items = [
    ...extraction.fields
      .filter((field) => !field.accepted)
      .map((field) => ({ kind: 'extraction_field' as const, extraction_id: id, field: field.fact })),
    ...(extraction.hold.length > 0 ? [{ kind: 'extraction_held' as const, extraction_id: id }] : []),
  ];
  if (items.length > 0) {
    await db
      .insertInto('review_item')
      .values(items)
      .onConflict((conflict) =>
        conflict
          .columns(OPEN_SUBJECT)
          .where(sql<boolean>`status = 'open'`)
          .doNothing(),
      )
      .execute();
  }
  return id;
}

export type InvalidAnswer = {
  readonly snapshotId: number;
  readonly task: string;
  readonly promptVersion: string;
  readonly outcome: 'invalid' | 'refusal' | 'truncated' | 'empty' | 'error';
  /** The layer's problems; they quote the listing, so they go here and never to a log. */
  readonly problems: readonly { readonly path: string; readonly message: string }[];
};

/** Queues an answer that never validated for a person, once per snapshot and prompt version. Nothing else is stored. */
export async function queueInvalidAnswer(db: Kysely<DB>, invalid: InvalidAnswer): Promise<void> {
  await db
    .insertInto('review_item')
    .values({
      kind: 'answer_invalid',
      snapshot_id: invalid.snapshotId,
      task: invalid.task,
      prompt_version: invalid.promptVersion,
      outcome: invalid.outcome,
      problems: JSON.stringify(invalid.problems),
    })
    .onConflict((conflict) =>
      conflict
        .columns(OPEN_SUBJECT)
        .where(sql<boolean>`status = 'open'`)
        .doNothing(),
    )
    .execute();
}

export type TextPriceMeaning = 'full_price' | 'down_payment' | 'starting_from';

/**
 * What the latest extraction of the snapshot being derived says its shown price is, when that extraction is usable and
 * the field was accepted; null otherwise (not read yet, held, below its threshold, or not stated). Only this snapshot's
 * reading counts: a new snapshot with a new price is never given an older snapshot's reading. The derivation merges it
 * with CS-34's price reading; extraction_snapshot_answer_unique serves the lookup.
 */
export async function textPriceMeaningOf(
  db: Kysely<DB>,
  snapshotId: number,
): Promise<TextPriceMeaning | null> {
  const row = await db
    .selectFrom('extraction')
    .innerJoin('extraction_field', 'extraction_field.extraction_id', 'extraction.id')
    .select(['extraction.status', 'extraction_field.value', 'extraction_field.status as fieldStatus'])
    .where('extraction.snapshot_id', '=', snapshotId)
    .where('extraction_field.field', '=', 'price_meaning')
    .orderBy('extraction.id', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (row?.status !== 'usable' || row.fieldStatus !== 'accepted') return null;
  return row.value === 'full_price' || row.value === 'down_payment' || row.value === 'starting_from'
    ? row.value
    : null;
}

/** A snapshot waiting for extraction, with what CS-34 parsed from its listing (the model sees the shown price). */
export type SnapshotToExtract = {
  readonly snapshotId: number;
  readonly listingId: number;
  readonly sourceId: string;
  readonly payload: Json;
  readonly priceType: 'asking' | 'negotiable' | 'installment' | 'placeholder' | null;
  readonly askingPriceToman: number | null;
  readonly downPaymentToman: number | null;
  readonly acceptsInstallments: boolean | null;
  readonly acceptsSwap: boolean | null;
  readonly bodyCondition: string | null;
  readonly frontChassisCondition: string | null;
  readonly rearChassisCondition: string | null;
};

/**
 * The current snapshot of each active listing of these sources that the task has not read at this prompt version: no
 * extraction through an answer of that version, and no open review of that snapshot at that version. A listing's
 * current snapshot is the one its latest fetch with content returned, as the derivation takes it (latestSnapshots in
 * attribute-store.ts), so a page that changed and changed back is read as the older snapshot again; a listing whose
 * snapshots no fetch here records (copied from another database) takes the one first fetched last. Only listings of a
 * tracked model are taken (ADR-0037). Listings are taken
 * in id order, so no commit order can hide one.
 */
export async function snapshotsToExtract(
  db: Kysely<DB>,
  options: {
    readonly sourceIds: readonly string[];
    readonly task: string;
    readonly promptVersion: string;
    readonly limit: number;
  },
): Promise<SnapshotToExtract[]> {
  return (
    db
      .selectFrom('listing as l')
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom('fetch_log as f')
            .select('f.snapshot_id')
            .whereRef('f.listing_id', '=', 'l.id')
            .whereRef('f.source_id', '=', 'l.source_id')
            .where('f.snapshot_id', 'is not', null)
            .orderBy('f.requested_at', 'desc')
            .orderBy('f.id', 'desc')
            .limit(1)
            .as('latest'),
        (join) => join.onTrue(),
      )
      .innerJoin('snapshot as s', (join) =>
        join
          .onRef('s.listing_id', '=', 'l.id')
          .on((eb) =>
            eb(
              's.id',
              '=',
              eb.fn.coalesce(
                'latest.snapshot_id',
                eb
                  .selectFrom('snapshot as copied')
                  .select('copied.id')
                  .whereRef('copied.listing_id', '=', 'l.id')
                  .orderBy('copied.first_fetched_at', 'desc')
                  .orderBy('copied.id', 'desc')
                  .limit(1),
              ),
            ),
          ),
      )
      .select([
        's.id as snapshotId',
        'l.id as listingId',
        'l.source_id as sourceId',
        's.payload',
        'l.price_type as priceType',
        'l.asking_price_toman as askingPriceToman',
        'l.down_payment_toman as downPaymentToman',
        'l.accepts_installments as acceptsInstallments',
        'l.accepts_swap as acceptsSwap',
        'l.body_condition as bodyCondition',
        'l.front_chassis_condition as frontChassisCondition',
        'l.rear_chassis_condition as rearChassisCondition',
      ])
      .where('l.source_id', '=', anyOf(options.sourceIds))
      .where('l.status', '=', 'active')
      // Only what the superadmin has Carshenas read in depth: the paid step is spent on tracked models (ADR-0037); a
      // paused or untracked model keeps the facts already extracted.
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('tracked_model as t')
            .select('t.id')
            .whereRef('t.model_id', '=', 'l.model_id')
            .where('t.state', '=', 'tracking')
            .where((scope) =>
              scope.or([scope('t.trim_id', 'is', null), scope('t.trim_id', '=', scope.ref('l.trim_id'))]),
            ),
        ),
      )
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('extraction as e')
              .innerJoin('ai_answer as a', 'a.id', 'e.ai_answer_id')
              .select('e.id')
              .whereRef('e.snapshot_id', '=', 's.id')
              .where('a.task', '=', options.task)
              .where('a.prompt_version', '=', options.promptVersion),
          ),
        ),
      )
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('review_item as r')
              .select('r.id')
              .whereRef('r.snapshot_id', '=', 's.id')
              .where('r.kind', '=', 'answer_invalid')
              .where('r.task', '=', options.task)
              .where('r.prompt_version', '=', options.promptVersion)
              .where('r.status', '=', 'open'),
          ),
        ),
      )
      .orderBy('l.id')
      .limit(options.limit)
      .execute()
  );
}

/** Today's start in Tehran, as the database's clock has it. */
const TEHRAN_DAY_START = sql<Date>`(date_trunc('day', now() AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'Asia/Tehran')`;

/**
 * What the task's paid calls cost since the start of today in Tehran, in millionths of a US dollar, whatever they
 * answered (model_spend). Calls answered from the cache have no row.
 */
export async function spentTodayUsdMicros(db: Kysely<DB>, task: string): Promise<number> {
  const row = await db
    .selectFrom('model_spend')
    .select((eb) => eb.fn.coalesce(eb.fn.sum<string>('cost_usd_micros'), sql<string>`0`).as('spent'))
    .where('task', '=', task)
    .where('created_at', '>=', TEHRAN_DAY_START)
    .executeTakeFirstOrThrow();
  return Number(row.spent);
}

export type Spend = {
  readonly task: string;
  readonly promptVersion: string;
  readonly model: string;
  readonly outcome: 'ok' | 'invalid' | 'refusal' | 'truncated' | 'empty' | 'error';
  readonly errorReason?:
    'timeout' | 'aborted' | 'rate_limited' | 'unavailable' | 'unauthorized' | 'no_credit' | 'rejected';
  readonly costUsd: number;
  readonly estimated: boolean;
  readonly snapshotId: number;
};

/** Records one paid call, in its own statement, so it counts even when the job then fails. */
export async function recordSpend(db: Kysely<DB>, spend: Spend): Promise<void> {
  await db
    .insertInto('model_spend')
    .values({
      task: spend.task,
      prompt_version: spend.promptVersion,
      model: spend.model,
      outcome: spend.outcome,
      error_reason: spend.errorReason ?? null,
      cost_usd_micros: Math.round(spend.costUsd * 1_000_000),
      estimated: spend.estimated,
      snapshot_id: spend.snapshotId,
    })
    .execute();
}

/** How many of this snapshot's calls at this prompt version got no answer for a reason of its own. */
export async function failedCallsOf(
  db: Kysely<DB>,
  options: { readonly snapshotId: number; readonly promptVersion: string },
): Promise<number> {
  const row = await db
    .selectFrom('model_spend')
    .select((eb) => eb.fn.countAll<string>().as('failed'))
    .where('snapshot_id', '=', options.snapshotId)
    .where('prompt_version', '=', options.promptVersion)
    .where('outcome', '=', 'error')
    .where('error_reason', 'in', ['timeout', 'rejected'])
    .executeTakeFirstOrThrow();
  return Number(row.failed);
}
