import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test, type TestContext } from 'node:test';
import type { Kysely } from 'kysely';
import type { DB, JsonObject } from '@carshenas/db/db-types';
import { refreshCatalogue } from '../jobs/catalogue.ts';
import { jsonObjectOf } from '../sources/divar/answers.ts';
import { testWorkerDatabase } from '../test-support/runtime.ts';
import { matchShares } from './catalogue-store.ts';
import { createTestSource, openScratchDatabase } from './test-database.ts';

// The catalogue's upkeep (CS-50) on a scratch database, as the worker's role: Divar's curated makes and models, the
// keys the listings bring learned as trims or models, Persian names from a real post, and every listing matched to a
// trim, a model, or explicitly unmatched, never guessed (criterion 1).

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

async function listing(sourceId: string, key: string, sourceModelKey: string | null): Promise<number> {
  const row = await owner
    .insertInto('listing')
    .values({
      source_id: sourceId,
      source_listing_key: key,
      url: `https://divar.ir/v/${key}`,
      status: 'active',
      listed_at: new Date('2026-09-24T06:17:00Z'),
      last_seen_at: new Date('2026-09-30T08:00:00Z'),
      source_model_key: sourceModelKey,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

function realPost(): JsonObject {
  const text = readFileSync(
    new URL('../test-support/divar-snapshots/private-206-both-calendars.json', import.meta.url),
    'utf8',
  );
  const payload = jsonObjectOf(text);
  if (payload === undefined) throw new Error('not a JSON object');
  return payload;
}

type Match = {
  catalogue_match: string | null;
  make: string | null;
  model: string | null;
  trim: string | null;
};

async function matchOf(listingId: number): Promise<Match> {
  return owner
    .selectFrom('listing as l')
    .leftJoin('make as mk', 'mk.id', 'l.make_id')
    .leftJoin('model as m', 'm.id', 'l.model_id')
    .leftJoin('trim as t', 't.id', 'l.trim_id')
    .select(['l.catalogue_match', 'mk.name_en as make', 'm.name_en as model', 't.name_en as trim'])
    .where('l.id', '=', listingId)
    .executeTakeFirstOrThrow();
}

async function source(context: TestContext): Promise<string> {
  return createTestSource(owner, context);
}

test('every listing is matched to a trim, a model, or explicitly unmatched, and a second run changes nothing', async (context) => {
  const sourceId = await source(context);
  const trim = await listing(sourceId, 'gaCAT001', 'Peugeot 206 SD V8');
  const model = await listing(sourceId, 'gaCAT002', 'Peugeot 206');
  const makeOnly = await listing(sourceId, 'gaCAT003', 'Peugeot');
  const unknown = await listing(sourceId, 'gaCAT004', 'Trabant 601');
  const noKey = await listing(sourceId, 'gaCAT005', null);
  const learned = await listing(sourceId, 'gaCAT006', 'Chevrolet Camaro');

  const first = await refreshCatalogue(worker, sourceId);
  assert.equal(first.makes, 161);
  assert.equal(first.models, 807);
  assert.deepEqual([first.trimsLearned, first.modelsLearned], [1, 1]);

  assert.deepEqual(await matchOf(trim), {
    catalogue_match: 'trim',
    make: 'Peugeot',
    model: 'Peugeot 206',
    trim: 'Peugeot 206 SD V8',
  });
  assert.deepEqual(await matchOf(model), {
    catalogue_match: 'model',
    make: 'Peugeot',
    model: 'Peugeot 206',
    trim: null,
  });
  assert.deepEqual(await matchOf(learned), {
    catalogue_match: 'model',
    make: 'Chevrolet',
    model: 'Chevrolet Camaro',
    trim: null,
  });
  const unmatched = { catalogue_match: 'unmatched', make: null, model: null, trim: null };
  for (const listingId of [makeOnly, unknown, noKey]) assert.deepEqual(await matchOf(listingId), unmatched);

  // Body types: the curated model's, a trim that differs (Peugeot's SD versions are sedans), and none for a model
  // only a listing named, until a person classifies it.
  const bodies = await owner
    .selectFrom('model as m')
    .leftJoin('trim as t', 't.model_id', 'm.id')
    .select(['m.name_en as model', 'm.body_type as modelBody', 't.body_type as trimBody'])
    .where('m.name_en', 'in', ['Peugeot 206', 'Chevrolet Camaro'])
    .orderBy('m.name_en')
    .execute();
  assert.deepEqual(bodies, [
    { model: 'Chevrolet Camaro', modelBody: null, trimBody: null },
    { model: 'Peugeot 206', modelBody: 'hatchback', trimBody: 'sedan' },
  ]);

  const second = await refreshCatalogue(worker, sourceId);
  assert.deepEqual([second.trimsLearned, second.modelsLearned, second.named, second.matched], [0, 0, 0, 0]);

  const shares = await matchShares(worker, sourceId, ['Peugeot 206']);
  assert.deepEqual(shares, [
    { scope: null, listings: 6, trim: 1, model: 2, unmatched: 3 },
    { scope: 'Peugeot 206', listings: 2, trim: 1, model: 1, unmatched: 0 },
  ]);
});

test('a trim is named in Persian by what its post calls it, kept as a suggested alias that fa_normalize finds', async (context) => {
  const sourceId = await source(context);
  const listed = await listing(sourceId, 'gaCAT101', 'Peugeot 206 5');
  await owner
    .insertInto('snapshot')
    .values({
      listing_id: listed,
      first_fetched_at: new Date('2026-09-30T08:00:00Z'),
      url: 'https://api.divar.ir/v8/posts-v2/web/test',
      canonical_version: 1,
      payload: realPost(),
    })
    .execute();

  await refreshCatalogue(worker, sourceId);
  const trim = await owner
    .selectFrom('trim')
    .select(['id', 'name_fa'])
    .where('name_en', '=', 'Peugeot 206 5')
    .executeTakeFirstOrThrow();
  assert.equal(trim.name_fa, 'پژو 206 تیپ ۵');
  // Persian and Latin digits are one alias: «پژو ۲۰۶ تیپ 5» finds the trim.
  const found = await owner
    .selectFrom('catalogue_alias')
    .select(['trim_id', 'status', 'source_id'])
    .where('alias_norm', '=', (eb) => eb.fn('fa_normalize', [eb.val('پژو ۲۰۶ تیپ 5')]))
    .execute();
  assert.deepEqual(found, [{ trim_id: trim.id, status: 'suggested', source_id: sourceId }]);
  assert.equal((await matchOf(listed)).catalogue_match, 'trim');
});
