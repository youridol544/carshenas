import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test, type TestContext } from 'node:test';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '@carshenas/db/database';
import type { DB } from '@carshenas/db/db-types';
import { createTestSource, openScratchDatabase } from '../db/test-database.ts';
import { env } from '../env.ts';
import { JOBS } from './registry.ts';
import { rebuildSearch, refreshSearch } from './search.ts';

// Keeping search_document fresh (CS-59 criterion 3): the triggers mark the listings whose rows may have changed, and
// search.refresh, as the worker's own role, rebuilds exactly those rows, drains the marks and refreshes the counts;
// search.rebuild (`pnpm search:rebuild`) rebuilds every row. On the scratch database `pnpm db:check` migrated.

let owner: Kysely<DB>;
let worker: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
  worker = createDatabase({
    connectionString: env.databaseUrl,
    applicationName: 'carshenas-worker-search-tests',
    max: 2,
    onIdleError: () => undefined,
  });
});

after(async () => {
  await worker.destroy();
  await owner.destroy();
});

type Scene = {
  readonly sourceId: string;
  readonly brandModel: string;
  readonly modelId: number;
  readonly makeId: number;
};

/** A source of its own with a tracked model the catalogue knows by the source's key. */
async function scene(t: TestContext): Promise<Scene> {
  const sourceId = await createTestSource(owner, t, { crawlState: 'paused' });
  const slug = `tst-${randomBytes(4).toString('hex')}`;
  const make = await owner
    .insertInto('make')
    .values({ slug, name_en: slug, name_fa: 'خودروساز آزمایشی' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const model = await owner
    .insertInto('model')
    .values({ make_id: make.id, slug: 'x', name_en: `${slug} x`, name_fa: 'مدل آزمایشی', body_type: null })
    .returning('id')
    .executeTakeFirstOrThrow();
  const brandModel = `${slug} X`;
  await owner
    .insertInto('catalogue_source_key')
    .values({ source_id: sourceId, source_model_key: brandModel, level: 'model', make_id: make.id, model_id: model.id })
    .execute();
  return { sourceId, brandModel, modelId: model.id, makeId: make.id };
}

async function addListing(scene: Scene, values: { readonly title?: string } = {}): Promise<number> {
  const key = randomBytes(6).toString('hex');
  const row = await owner
    .insertInto('listing')
    .values({
      source_id: scene.sourceId,
      source_listing_key: key,
      url: `https://test.example/${key}`,
      status: 'active',
      listed_at: sql<Date>`now() - interval '1 hour'`,
      last_seen_at: sql<Date>`now()`,
      source_model_key: scene.brandModel,
      make_id: scene.makeId,
      model_id: scene.modelId,
      catalogue_match: 'model',
      model_year_sh: 1400,
      mileage_km: 50_000,
      price_type: 'asking',
      asking_price_toman: 900_000_000,
      ...(values.title === undefined ? {} : { title: values.title }),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function marked(ids: readonly number[]): Promise<number[]> {
  const rows = await owner
    .selectFrom('search_document_stale')
    .select('listing_id')
    .where('listing_id', 'in', [...ids])
    .orderBy('listing_id')
    .execute();
  return rows.map((row) => row.listing_id);
}

async function unmark(ids: readonly number[]): Promise<void> {
  await owner.deleteFrom('search_document_stale').where('listing_id', 'in', [...ids]).execute();
}

test('a listing, a photo, a text fact or a successful valuation run marks the listings whose rows may change', async (t) => {
  const s = await scene(t);
  const id = await addListing(s);
  assert.deepEqual(await marked([id]), [id], 'a new listing');
  await unmark([id]);

  await owner.updateTable('listing').set({ mileage_km: 50_000 }).where('id', '=', id).execute();
  assert.deepEqual(await marked([id]), [], 'an update that changes nothing marks nothing');
  await owner.updateTable('listing').set({ mileage_km: 51_000 }).where('id', '=', id).execute();
  assert.deepEqual(await marked([id]), [id], 'a changed value');
  await unmark([id]);

  await owner
    .insertInto('listing_photo')
    .values({ listing_id: id, position: 1, url: 'https://test.example/1.jpg' })
    .execute();
  assert.deepEqual(await marked([id]), [id], 'a photo');
  await unmark([id]);

  const snapshot = await owner
    .insertInto('snapshot')
    .values({
      listing_id: id,
      first_fetched_at: sql<Date>`now()`,
      url: 'https://test.example/api',
      canonical_version: 1,
      payload: { id },
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const answer = await owner
    .insertInto('ai_answer')
    .values({
      cache_key: randomBytes(32),
      task: 'listing.facts',
      prompt_version: '0123456789abcdef',
      provider: 'google',
      model: 'test-model',
      answering_model: 'test-model',
      output: { paint: 'none' },
      cost_usd_micros: 0,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const extraction = await owner
    .insertInto('extraction')
    .values({ snapshot_id: snapshot.id, listing_id: id, ai_answer_id: answer.id, status: 'usable', hold_reasons: [] })
    .returning('id')
    .executeTakeFirstOrThrow();
  assert.deepEqual(await marked([id]), [], 'an extraction without facts yet');
  await owner
    .insertInto('extraction_field')
    .values({
      extraction_id: extraction.id,
      field: 'paint',
      value: 'none',
      evidence: 'بدون رنگ',
      confidence: '0.9',
      threshold: '0.75',
      status: 'accepted',
    })
    .execute();
  assert.deepEqual(await marked([id]), [id], 'a text fact');
  await unmark([id]);

  const run = await owner
    .insertInto('valuation_run')
    .values({
      as_of_date: '2098-01-01',
      method_version: 99,
      status: 'running',
      reference_year_sh: 1405,
      mileage_norm_km_per_year: 20_000,
      window_days: 30,
      prior_strength: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  t.after(() => owner.deleteFrom('valuation_run').where('id', '=', run.id).execute());
  assert.deepEqual(await marked([id]), [], 'a run still running');
  await owner
    .updateTable('valuation_run')
    .set({
      status: 'succeeded',
      finished_at: sql<Date>`now()`,
      comparable_count: 0,
      valued_count: 0,
      rated_count: 0,
    })
    .where('id', '=', run.id)
    .execute();
  assert.deepEqual(await marked([id]), [id], 'a run that succeeded marks every active listing');
  await unmark([id]);
});

test('search.refresh, as the worker, builds the marked listings’ rows, drains the marks and refreshes the counts', async (t) => {
  const s = await scene(t);
  const trackedModels = [{ brandModel: s.brandModel, nameFa: 'مدل آزمایشی' }];
  const first = await addListing(s, { title: 'مدل آزمایشی تمیز' });
  const second = await addListing(s);
  // Other tests' marks are drained too; this test looks only at its own listings.
  const refreshed = await refreshSearch(worker, { sourceId: s.sourceId, trackedModels });
  assert.ok(refreshed.written >= 2);
  assert.equal(refreshed.trackedModels, 1);
  assert.deepEqual(await marked([first, second]), []);
  const rows = await owner
    .selectFrom('search_document')
    .select(['listing_id', 'model_key', 'km_per_year'])
    .where('listing_id', 'in', [first, second])
    .orderBy('listing_id')
    .execute();
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.model_key?.endsWith('.x') === true));

  const counted = await owner
    .selectFrom('search_facet_count')
    .select('listing_count')
    .where('facet', '=', 'model')
    .where('value', '=', rows[0]?.model_key ?? '')
    .executeTakeFirstOrThrow();
  assert.equal(counted.listing_count, 2);
  const word = await owner
    .selectFrom('search_word')
    .select('listing_count')
    .where('word', '=', 'تمیز')
    .executeTakeFirst();
  assert.ok((word?.listing_count ?? 0) >= 1);

  // Nothing marked: the next refresh writes nothing.
  assert.deepEqual(
    (({ written, removed }) => ({ written, removed }))(
      await refreshSearch(worker, { sourceId: s.sourceId, trackedModels }),
    ),
    { written: 0, removed: 0 },
  );

  // Sold: its row leaves at the next refresh.
  await owner.updateTable('listing').set({ status: 'gone', delisted_at: sql<Date>`now()` }).where('id', '=', second).execute();
  const afterSale = await refreshSearch(worker, { sourceId: s.sourceId, trackedModels });
  assert.equal(afterSale.removed, 1);
  const left = await owner.selectFrom('search_document').select('listing_id').where('listing_id', '=', second).execute();
  assert.deepEqual(left, []);
});

test('search.rebuild, as the worker, rebuilds every row and writes nothing when nothing changed', async (t) => {
  const s = await scene(t);
  const trackedModels = [{ brandModel: s.brandModel, nameFa: 'مدل آزمایشی' }];
  const id = await addListing(s);
  const built = await rebuildSearch(worker, { sourceId: s.sourceId, trackedModels });
  assert.ok(built.written >= 1);
  const row = await owner.selectFrom('search_document').select('listing_id').where('listing_id', '=', id).execute();
  assert.equal(row.length, 1);
  assert.equal((await rebuildSearch(worker, { sourceId: s.sourceId, trackedModels })).written, 0);
});

test('the worker runs both search jobs, on a schedule', () => {
  const refresh = JOBS.find((job) => job.name === 'search.refresh');
  const rebuild = JOBS.find((job) => job.name === 'search.rebuild');
  assert.deepEqual(refresh?.schedules?.map((schedule) => schedule.cron), ['* * * * *']);
  assert.deepEqual(rebuild?.schedules?.map((schedule) => schedule.cron), ['30 4 * * *']);
});
