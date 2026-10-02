import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { buildSearchDocuments, tryLockSearchBuild } from '../src/document.ts';
import { FILTERS } from '../src/filters.ts';
import type { SearchFilters } from '../src/search.ts';
import { searchableWhere, searchFacetCountsSql, type FacetCountRow, type SearchRead } from '../src/sql.ts';
import { deleteBulk, seedBulk } from './bulk.ts';
import { NOW } from './fixture-names.ts';
import { openScratchDatabase, seedFixtures, webDatabase } from './fixtures.ts';

// The facets of a filtered search (CS-59): each option's count without its own filter. The facets whose filter is not in
// the search share one scan and the others have one each; whichever way a facet is counted, it is the count of the
// search's matches with every other filter applied.

const SOURCE = 'tst_search_facets';
const CONTEXT = { alias: 'r', now: NOW } as const;

let owner: Kysely<DB>;
let web: Kysely<DB>;

before(async () => {
  owner = await openScratchDatabase();
  web = webDatabase();
  const fixtures = await seedFixtures(owner);
  const a = await owner
    .selectFrom('listing')
    .select(['make_id', 'model_id', 'city_id'])
    .where('id', '=', fixtures.A)
    .executeTakeFirstOrThrow();
  const c = await owner
    .selectFrom('listing')
    .select('city_id')
    .where('id', '=', fixtures.C)
    .executeTakeFirstOrThrow();
  const { rows: runs } = await sql<{ id: number }>`
    SELECT id FROM valuation_run WHERE as_of_date = '2099-12-30'`.execute(owner);
  const run = runs[0];
  if (
    a.make_id === null ||
    a.model_id === null ||
    a.city_id === null ||
    c.city_id === null ||
    run === undefined
  )
    throw new Error('the fixtures lack a catalogue row or a valuation run');
  const ids = await seedBulk(owner, {
    source: SOURCE,
    count: 120,
    makeId: a.make_id,
    modelId: a.model_id,
    cityA: a.city_id,
    cityB: c.city_id,
    valuationRunId: run.id,
  });
  await owner.transaction().execute(async (trx) => {
    assert.ok(await tryLockSearchBuild(trx));
    await buildSearchDocuments(trx, {
      scope: { listingIds: [...Object.values(fixtures), ...ids] },
      now: NOW,
    });
  });
});

after(async () => {
  await deleteBulk(owner, SOURCE);
  await web.destroy();
  await owner.destroy();
});

const COLUMNS = {
  make: 'make_key',
  model: 'model_key',
  trim: 'trim_key',
  body_type: 'body_type',
  city: 'city_key',
  district: 'district_key',
  source: 'source_id',
} as const;

/** The count of each option of a facet, the slow and plain way: one grouped scan of the matches without its filter. */
async function naive(read: SearchRead, kind: keyof typeof COLUMNS): Promise<Map<string, number>> {
  const filter = FILTERS.find((candidate) => 'optionsFrom' in candidate && candidate.optionsFrom === kind);
  assert.ok(filter);
  const column = COLUMNS[kind];
  const { rows } = await sql<{ value: string; count: number }>`
    SELECT r.${sql.ref(column)}::text AS value, count(*)::integer AS count FROM search_document r
    WHERE ${searchableWhere(read, CONTEXT, { without: filter.id })} AND r.${sql.ref(column)} IS NOT NULL
    GROUP BY 1`.execute(web);
  return new Map(rows.map((row) => [row.value, row.count]));
}

const OURS: SearchFilters = { make: ['tst-alpha', 'tst-beta'] };

for (const [name, filters] of [
  ['a make only (its own facet has a scan of its own, the others share one)', OURS],
  ['a gearbox with the make', { ...OURS, gearbox: ['automatic'] }],
  ['a city and a gearbox with the make', { ...OURS, city: ['tst-city-a'], gearbox: ['manual'] }],
  [
    'a make, a model and a city (three facets with their own scans)',
    { ...OURS, model: ['tst-alpha.city'], city: ['tst-city-a'] },
  ],
  ['no filter at all (every facet shares one scan)', {}],
] as [string, SearchFilters][]) {
  test(`facets for ${name} equal the plain count of each`, async () => {
    const read: SearchRead = { filters, tsquery: null };
    const { rows } =
      await sql<FacetCountRow>`SELECT * FROM ${searchFacetCountsSql(read, CONTEXT)} AS f`.execute(web);
    for (const kind of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) {
      const expected = await naive(read, kind);
      const got = new Map(rows.filter((row) => row.facet === kind).map((row) => [row.value, row.count]));
      assert.deepEqual(got, expected, kind);
    }
    assert.ok(rows.length > 0);
  });
}

test('words narrow every facet, and a filter in the search leaves its own facet showing the other options', async () => {
  const { rows: words } = await sql<{
    tsquery_text: string;
  }>`SELECT tsquery_text FROM search_query('کارکرده')`.execute(web);
  const tsquery = words[0]?.tsquery_text;
  assert.ok(tsquery);
  const read: SearchRead = { filters: { ...OURS, city: ['tst-city-b'] }, tsquery };
  const { rows } =
    await sql<FacetCountRow>`SELECT * FROM ${searchFacetCountsSql(read, CONTEXT)} AS f`.execute(web);
  const cities = new Map(rows.filter((row) => row.facet === 'city').map((row) => [row.value, row.count]));
  assert.ok((cities.get('tst-city-a') ?? 0) > 0, 'the other city is still offered while one is chosen');
  assert.ok((cities.get('tst-city-b') ?? 0) > 0);
  for (const kind of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) {
    assert.deepEqual(
      new Map(rows.filter((row) => row.facet === kind).map((row) => [row.value, row.count])),
      await naive(read, kind),
      kind,
    );
  }
});
