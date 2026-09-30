import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, test, type TestContext } from 'node:test';
import type { Kysely } from 'kysely';
import type { DB, JsonObject } from '@carshenas/db/db-types';
import { writeDerivedListingOrRefusal } from './db/attribute-store.ts';
import {
  queueInvalidAnswer,
  storeExtraction,
  textPriceMeaningOf,
  type NewExtraction,
  type StoredField,
} from './db/extraction-store.ts';
import { createTestSource, openScratchDatabase } from './db/test-database.ts';
import { jsonObjectOf } from './sources/divar/answers.ts';
import { deriveDivarListing } from './sources/divar/attributes.ts';
import { THRESHOLD } from '@carshenas/ai/tasks/listing-facts-review';
import { testWorkerDatabase } from './test-support/runtime.ts';

// CS-52's storage on a scratch database, on the worker's own role: an extraction with its fields and review items,
// stored once however often a job runs; an answer that never validated queued without a value; and the derivation
// that merges the text's reading of the price with the site's, so a re-derivation keeps it (the owner's decision of
// 2026-09-30).

let owner: Kysely<DB>;
let worker: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
  worker = testWorkerDatabase();
});

after(async () => {
  await worker.destroy();
  await owner.destroy();
});

const PAYLOAD: JsonObject = (() => {
  const text = readFileSync(
    new URL('./test-support/divar-snapshots/private-206-both-calendars.json', import.meta.url),
    'utf8',
  );
  const payload = jsonObjectOf(text);
  if (payload === undefined) throw new Error('not a JSON object');
  return payload;
})();

/** The fixture's own asking price, «۱,۱۴۰,۰۰۰,۰۰۰ تومان». */
const SHOWN_TOMAN = 1_140_000_000;

async function listingWithSnapshot(context: TestContext): Promise<{ listingId: number; snapshotId: number }> {
  const sourceId = await createTestSource(owner, context);
  const listing = await owner
    .insertInto('listing')
    .values({
      source_id: sourceId,
      source_listing_key: `gaX${randomBytes(4).toString('hex')}`,
      url: 'https://divar.ir/v/test',
      status: 'active',
      listed_at: new Date('2026-09-29T06:00:00Z'),
      last_seen_at: new Date('2026-09-30T08:00:00Z'),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const snapshot = await owner
    .insertInto('snapshot')
    .values({
      listing_id: listing.id,
      first_fetched_at: new Date('2026-09-30T08:00:00Z'),
      url: 'https://api.divar.ir/v8/posts-v2/web/test',
      canonical_version: 1,
      payload: PAYLOAD,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { listingId: listing.id, snapshotId: snapshot.id };
}

async function answer(): Promise<number> {
  const row = await owner
    .insertInto('ai_answer')
    .values({
      cache_key: randomBytes(32),
      task: 'listing.facts',
      prompt_version: '0123456789abcdef',
      provider: 'google',
      model: 'gemini-3.7-flash',
      answering_model: 'gemini-3.7-flash',
      output: { price_meaning: 'down_payment' },
      cost_usd_micros: 1600,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

const field = (fact: string, value: string, evidence: string, confidence = 1): StoredField => ({
  fact,
  value,
  evidence,
  confidence,
  threshold: 0.75,
  accepted: confidence >= 0.75,
});

async function priceOf(listingId: number) {
  return owner
    .selectFrom('listing')
    .select(['price_type', 'asking_price_toman', 'down_payment_toman'])
    .where('id', '=', listingId)
    .executeTakeFirstOrThrow();
}

async function derive(listingId: number, snapshotId: number): Promise<void> {
  await worker.transaction().execute(async (trx) => {
    const outcome = await writeDerivedListingOrRefusal(
      trx,
      listingId,
      snapshotId,
      deriveDivarListing(PAYLOAD),
    );
    assert.equal(outcome.refused, undefined);
  });
}

async function reviewItems(extractionId: number) {
  return owner
    .selectFrom('review_item')
    .select(['kind', 'field'])
    .where('extraction_id', '=', extractionId)
    .orderBy('id')
    .execute();
}

test('an extraction is stored once with its fields, and fields below their threshold wait in review', async (context) => {
  const { listingId, snapshotId } = await listingWithSnapshot(context);
  const extraction: NewExtraction = {
    snapshotId,
    listingId,
    answerId: await answer(),
    fields: [
      field('paint', 'partial', 'کاپوت رنگ'),
      field('swap', 'yes', 'معاوضه', 0.6),
      field('plate', 'not_stated', ''),
    ],
    hold: [],
  };
  const id = await worker.transaction().execute((trx) => storeExtraction(trx, extraction));
  const again = await worker.transaction().execute((trx) => storeExtraction(trx, extraction));
  assert.equal(again, id, 'a second run finds the first extraction');
  const fields = await owner
    .selectFrom('extraction_field')
    .select(['field', 'status'])
    .where('extraction_id', '=', id)
    .orderBy('field')
    .execute();
  assert.deepEqual(fields, [
    { field: 'paint', status: 'accepted' },
    { field: 'plate', status: 'accepted' },
    { field: 'swap', status: 'needs_review' },
  ]);
  assert.deepEqual(await reviewItems(id), [{ kind: 'extraction_field', field: 'swap' }]);
});

test('a held extraction is one review item, and none of its fields reaches the listing', async (context) => {
  const { listingId, snapshotId } = await listingWithSnapshot(context);
  const answerId = await answer();
  const id = await worker.transaction().execute((trx) =>
    storeExtraction(trx, {
      snapshotId,
      listingId,
      answerId,
      fields: [field('price_meaning', 'down_payment', 'قیمت درج شده پیش پرداخت')],
      hold: ['addressed_model'],
    }),
  );
  assert.deepEqual(await reviewItems(id), [{ kind: 'extraction_held', field: null }]);
  assert.equal(await textPriceMeaningOf(worker, snapshotId), null);
});

test("the derivation merges the text's down payment with the site's price, and a later reading undoes it", async (context) => {
  const { listingId, snapshotId } = await listingWithSnapshot(context);
  await derive(listingId, snapshotId);
  assert.deepEqual(await priceOf(listingId), {
    price_type: 'asking',
    asking_price_toman: SHOWN_TOMAN,
    down_payment_toman: null,
  });

  await worker.transaction().execute(async (trx) =>
    storeExtraction(trx, {
      snapshotId,
      listingId,
      answerId: await answer(),
      fields: [field('price_meaning', 'down_payment', 'قیمت درج شده پیش پرداخت')],
      hold: [],
    }),
  );
  await derive(listingId, snapshotId);
  assert.deepEqual(await priceOf(listingId), {
    price_type: 'installment',
    asking_price_toman: null,
    down_payment_toman: SHOWN_TOMAN,
  });
  // The next crawl derives the same snapshot again: the text's reading stays.
  await derive(listingId, snapshotId);
  assert.equal((await priceOf(listingId)).price_type, 'installment');

  // A newer prompt version reads the price as not stated: the site's asking price comes back.
  await worker.transaction().execute(async (trx) =>
    storeExtraction(trx, {
      snapshotId,
      listingId,
      answerId: await answer(),
      fields: [field('price_meaning', 'not_stated', '')],
      hold: [],
    }),
  );
  await derive(listingId, snapshotId);
  assert.equal((await priceOf(listingId)).price_type, 'asking');
});

test("a new snapshot is derived from its own reading only: an older snapshot's down payment never reaches it", async (context) => {
  const { listingId, snapshotId } = await listingWithSnapshot(context);
  const answerId = await answer();
  await worker.transaction().execute((trx) =>
    storeExtraction(trx, {
      snapshotId,
      listingId,
      answerId,
      fields: [field('price_meaning', 'down_payment', 'قیمت درج شده پیش پرداخت')],
      hold: [],
    }),
  );
  await derive(listingId, snapshotId);
  assert.equal((await priceOf(listingId)).price_type, 'installment');
  // The seller rewrites the listing; the crawler stores and derives the new snapshot before any extraction reads it.
  const newer = await owner
    .insertInto('snapshot')
    .values({
      listing_id: listingId,
      first_fetched_at: new Date('2026-10-01T08:00:00Z'),
      url: 'https://api.divar.ir/v8/posts-v2/web/test',
      canonical_version: 1,
      payload: { ...PAYLOAD, rewritten: true },
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await derive(listingId, newer.id);
  assert.deepEqual(await priceOf(listingId), {
    price_type: 'asking',
    asking_price_toman: SHOWN_TOMAN,
    down_payment_toman: null,
  });
});

test("the thresholds the call site applies are extraction_field_def's", async () => {
  const rows = await worker.selectFrom('extraction_field_def').select(['code', 'min_confidence']).execute();
  assert.deepEqual(Object.fromEntries(rows.map((row) => [row.code, Number(row.min_confidence)])), THRESHOLD);
});

test('an answer that never validated is queued once per snapshot and prompt version, with no value', async (context) => {
  const { snapshotId } = await listingWithSnapshot(context);
  const invalid = {
    snapshotId,
    task: 'listing.facts',
    promptVersion: '0123456789abcdef',
    outcome: 'invalid' as const,
    problems: [{ path: 'paint_evidence', message: 'does not appear in the listing' }],
  };
  await queueInvalidAnswer(worker, invalid);
  await queueInvalidAnswer(worker, invalid);
  const items = await owner
    .selectFrom('review_item')
    .select(['kind', 'outcome'])
    .where('snapshot_id', '=', snapshotId)
    .execute();
  assert.deepEqual(items, [{ kind: 'answer_invalid', outcome: 'invalid' }]);
  const extractions = await owner
    .selectFrom('extraction')
    .select('id')
    .where('snapshot_id', '=', snapshotId)
    .execute();
  assert.deepEqual(extractions, []);
});
