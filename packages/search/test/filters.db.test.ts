import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { CATALOGUES } from '../src/catalogues.ts';
import { FILTERS } from '../src/filters.ts';
import { readFilterOptions } from '../src/options-queries.ts';
import {
  catalogueSearch,
  fromStoredSearch,
  toStoredSearch,
  type Search,
  type SearchFilters,
} from '../src/search.ts';
import { searchOrderBy, searchWhere } from '../src/sql.ts';
import { SORTS } from '../src/sorts.ts';
import { CATALOGUE_CASES, FILTER_CASES } from './filter-cases.ts';
import { FIXTURE_NAMES, NOW, type FixtureName } from './fixture-names.ts';
import { openScratchDatabase, seedFixtures, webDatabase, type Fixtures } from './fixtures.ts';

// Every filter's predicate and every catalogue's results on the five fixtures (CS-58 criterion 5), read from
// listing_filter_row as the web app's own role reads it, on the scratch database `pnpm db:check` migrated; the options
// of the database-backed filters (criterion 3); and a search stored as a search file and read back runs the same SQL.

let owner: Kysely<DB>;
let web: Kysely<DB>;
let fixtures: Fixtures;

before(async () => {
  owner = await openScratchDatabase();
  web = webDatabase();
  fixtures = await seedFixtures(owner);
});

after(async () => {
  await web.destroy();
  await owner.destroy();
});

const CONTEXT = { alias: 'r', now: NOW } as const;

function namesOf(ids: readonly number[]): FixtureName[] {
  return FIXTURE_NAMES.filter((name) => ids.includes(fixtures[name]));
}

async function kept(filters: SearchFilters): Promise<FixtureName[]> {
  const rows = await web
    .selectFrom('listing_filter_row as r')
    .select('r.listing_id')
    .where('r.listing_id', 'in', Object.values(fixtures))
    .where(searchWhere(filters, CONTEXT))
    .execute();
  return namesOf(rows.map((row) => row.listing_id ?? 0));
}

for (const filter of FILTERS) {
  test(`the ${filter.id} filter keeps exactly its cases' fixtures`, async () => {
    for (const { value, keeps } of FILTER_CASES[filter.id]) {
      assert.deepEqual(
        await kept({ [filter.id]: value }),
        [...keeps].sort(),
        `${filter.id} = ${JSON.stringify(value)}`,
      );
    }
  });
}

for (const catalogue of CATALOGUES) {
  test(`the ${catalogue.id} catalogue keeps its fixtures`, async () => {
    const search = catalogueSearch(catalogue.id);
    assert.deepEqual(await kept(search.filters), [...CATALOGUE_CASES[catalogue.id]].sort());
  });
}

test('no filter keeps a listing the view has no row for, and the empty search keeps every fixture', async () => {
  assert.deepEqual(await kept({}), [...FIXTURE_NAMES]);
});

test('a newer snapshot that was not read yet does not inherit an older snapshot’s facts', async () => {
  const row = await web
    .selectFrom('listing_filter_row')
    .select(['paint_free', 'accident'])
    .where('listing_id', '=', fixtures.E)
    .executeTakeFirstOrThrow();
  assert.deepEqual(row, { paint_free: null, accident: null });
});

test('every order runs, ends on the listing id and puts rows without its value last', async () => {
  for (const sort of SORTS) {
    const rows = await web
      .selectFrom('listing_filter_row as r')
      .select('r.listing_id')
      .where('r.listing_id', 'in', Object.values(fixtures))
      .orderBy(searchOrderBy(sort.id, CONTEXT))
      .execute();
    assert.equal(rows.length, FIXTURE_NAMES.length, sort.id);
  }
  const bestDeal = await web
    .selectFrom('listing_filter_row as r')
    .select('r.listing_id')
    .where('r.listing_id', 'in', Object.values(fixtures))
    .orderBy(searchOrderBy(undefined, CONTEXT))
    .execute();
  // Best deal first: A (-12 %), B (-6 %), D (+1 %), E (+21 %), then C, which has no rating.
  assert.deepEqual(
    bestDeal.map((row) => row.listing_id),
    [fixtures.A, fixtures.B, fixtures.D, fixtures.E, fixtures.C],
  );
  const cheapest = await web
    .selectFrom('listing_filter_row as r')
    .select('r.listing_id')
    .where('r.listing_id', 'in', Object.values(fixtures))
    .orderBy(searchOrderBy('price_asc', CONTEXT))
    .execute();
  assert.deepEqual(
    cheapest.map((row) => row.listing_id),
    [fixtures.E, fixtures.A, fixtures.D, fixtures.B, fixtures.C],
  );
});

test('a search stored as a search file and read back keeps the same listings', async () => {
  const search: Search = {
    filters: { make: ['tst-alpha'], price: { max: 1_000_000_000 }, paint_free: true, posted_within: 3 },
    sort: 'price_asc',
  };
  const stored: unknown = JSON.parse(JSON.stringify(toStoredSearch(search)));
  const readBack = fromStoredSearch(stored);
  assert.ok(readBack.success);
  assert.deepEqual(await kept(readBack.data.filters), await kept(search.filters));
  assert.deepEqual(await kept(readBack.data.filters), ['A', 'D']);
});

test('the database-backed filters offer only values active listings have, with their Persian names', async () => {
  const options = await readFilterOptions(web);
  const make = options.make.find((option) => option.value === 'tst-alpha');
  assert.equal(make?.label, 'آلفا');
  assert.ok(make.count >= 3 + 80);
  assert.ok(options.model.some((option) => option.value === 'tst-alpha.city' && option.label === 'مدل city'));
  assert.ok(options.trim.some((option) => option.value === 'tst-alpha.city.base'));
  assert.ok(options.body_type.some((option) => option.value === 'suv' && option.label === 'شاسی‌بلند'));
  assert.ok(options.city.some((option) => option.value === 'tst-city-b' && option.label === 'شهر ب'));
  assert.ok(options.district.some((option) => option.value === 'ونک'));
  assert.ok(
    options.source.some((option) => option.value === 'tst_search_b' && option.label === 'منبع tst_search_b'),
  );
  // Body types in the catalogue's order; a body type without active listings is not offered.
  const positions = options.body_type.map((option) => option.value);
  assert.ok(positions.indexOf('sedan') < positions.indexOf('suv'));
  assert.ok(!options.body_type.some((option) => option.value === 'van'));
  for (const list of Object.values(options))
    assert.ok(list.every((option) => option.count > 0 && option.label !== ''));
});

test('a new source or body type is offered, and filtered on, without a code change', async () => {
  await owner
    .insertInto('source')
    .values({
      id: 'tst_search_new',
      origin: 'external',
      access_method: 'official_api',
      name_fa: 'منبع تازه',
      base_url: 'https://test.example',
      listing_visibility: 'public',
    })
    .onConflict((conflict) => conflict.doNothing())
    .execute();
  await owner
    .insertInto('body_type')
    .values({ code: 'tst_body', label_fa: 'بدنه‌ی تازه', position: 99 })
    .onConflict((conflict) => conflict.doNothing())
    .execute();
  const make = await owner
    .selectFrom('make')
    .select('id')
    .where('slug', '=', 'tst-beta')
    .executeTakeFirstOrThrow();
  const model = await owner
    .insertInto('model')
    .values({ make_id: make.id, slug: 'new-body', name_en: 'new-body', body_type: 'tst_body' })
    .onConflict((conflict) => conflict.constraint('model_slug_unique').doUpdateSet({ body_type: 'tst_body' }))
    .returning('id')
    .executeTakeFirstOrThrow();
  const listing = await owner
    .insertInto('listing')
    .values({
      source_id: 'tst_search_new',
      source_listing_key: `new${String(Date.now())}`,
      url: 'https://test.example/new',
      status: 'active',
      listed_at: NOW,
      last_seen_at: NOW,
      make_id: make.id,
      model_id: model.id,
      catalogue_match: 'model',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const options = await readFilterOptions(web);
  assert.ok(
    options.source.some((option) => option.value === 'tst_search_new' && option.label === 'منبع تازه'),
  );
  assert.ok(
    options.body_type.some((option) => option.value === 'tst_body' && option.label === 'بدنه‌ی تازه'),
  );
  for (const filters of [
    { source: ['tst_search_new'] },
    { body_type: ['tst_body'] },
  ] satisfies SearchFilters[]) {
    const rows = await web
      .selectFrom('listing_filter_row as r')
      .select('r.listing_id')
      .where(searchWhere(filters, CONTEXT))
      .where('r.status', '=', 'active')
      .execute();
    assert.ok(
      rows.some((row) => row.listing_id === listing.id),
      JSON.stringify(filters),
    );
  }
});
