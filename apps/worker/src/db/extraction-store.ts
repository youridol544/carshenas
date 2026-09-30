import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';

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
  readonly outcome: 'invalid' | 'refusal' | 'truncated' | 'empty';
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
