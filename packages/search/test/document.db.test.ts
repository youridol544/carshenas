import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { CATALOGUES } from '../src/catalogues.ts';
import { buildSearchDocuments, lockSearchBuild, refreshSearchWords } from '../src/document.ts';
import { FILTERS } from '../src/filters.ts';
import { catalogueSearch, type SearchFilters } from '../src/search.ts';
import {
  isFresh,
  matchesText,
  searchAfter,
  searchOrderBy,
  searchWhere,
  sortKeyOf,
  type SortKey,
} from '../src/sql.ts';
import { SORTS, type SortId } from '../src/sorts.ts';
import { CATALOGUE_CASES, FILTER_CASES } from './filter-cases.ts';
import { FIXTURE_NAMES, NOW, type FixtureName } from './fixture-names.ts';
import { openScratchDatabase, seedFixtures, webDatabase, type Fixtures } from './fixtures.ts';

// search_document (CS-59) on the scratch database `pnpm db:check` migrated: built from the fixtures by the build the
// worker runs, then read as the web app's own role. Every filter and catalogue keeps on it exactly what it keeps on
// listing_filter_row (criterion 1); every order pages by keyset to the same sequence as one read (criterion 1); the
// text matches however the words are typed (criterion 2); and only active listings of public sources and tracked
// models seen within 48 hours are in it (criterion 5).

let owner: Kysely<DB>;
let web: Kysely<DB>;
let fixtures: Fixtures;
/** Every listing of the test sources: the fixtures and the fillers that rank their models. */
let scope: number[];
let tracked: number[];

const CONTEXT = { alias: 'r', now: NOW } as const;

async function build(listingIds: readonly number[], trackedModelIds = tracked) {
  return owner.transaction().execute(async (trx) => {
    await lockSearchBuild(trx);
    return buildSearchDocuments(trx, { scope: { listingIds }, trackedModelIds, now: NOW });
  });
}

before(async () => {
  owner = await openScratchDatabase();
  web = webDatabase();
  fixtures = await seedFixtures(owner);
  // A title with a digit run, a zero-width non-joiner and Persian letters, and a Latin-typed alias of model city.
  await owner
    .updateTable('listing')
    .set({ title: `آلفا ۲۰۶تیپ ۲ بی${String.fromCodePoint(0x200c)}رنگ` })
    .where('id', '=', fixtures.A)
    .execute();
  const model = await owner
    .selectFrom('model')
    .select('id')
    .where('slug', '=', 'city')
    .executeTakeFirstOrThrow();
  await sql`
    INSERT INTO catalogue_alias (model_id, alias, script, status)
    VALUES (${model.id}, 'Pezho City', 'latin', 'curated')
    ON CONFLICT DO NOTHING`.execute(owner);
  const rows = await owner
    .selectFrom('listing')
    .select(['id', 'model_id'])
    .where('source_id', 'in', ['tst_search_a', 'tst_search_b'])
    .execute();
  scope = rows.map((row) => row.id);
  tracked = [...new Set(rows.flatMap((row) => (row.model_id === null ? [] : [row.model_id])))];
  await build(scope);
  await refreshSearchWords(owner);
});

after(async () => {
  await web.destroy();
  await owner.destroy();
});

function namesOf(ids: readonly number[]): FixtureName[] {
  return FIXTURE_NAMES.filter((name) => ids.includes(fixtures[name]));
}

async function keptOn(relation: 'listing_filter_row' | 'search_document', filters: SearchFilters) {
  const { rows } = await sql<{ listing_id: number }>`
    SELECT r.listing_id FROM ${sql.table(relation)} r
    WHERE r.listing_id = any(${Object.values(fixtures)}::bigint[]) AND ${searchWhere(filters, CONTEXT)}`.execute(
    web,
  );
  return namesOf(rows.map((row) => row.listing_id));
}

test('only searchable fixtures are in the table: E, matched to no model, is of no tracked model', async () => {
  assert.deepEqual(await keptOn('search_document', {}), ['A', 'B', 'C', 'D']);
});

// E is in no tracked model, so on search_document every filter keeps what it keeps on the view, without E.
const withoutE = (names: readonly FixtureName[]) => names.filter((name) => name !== 'E');

for (const filter of FILTERS) {
  test(`the ${filter.id} filter keeps on search_document what it keeps on the view`, async () => {
    for (const { value } of FILTER_CASES[filter.id]) {
      const filters = { [filter.id]: value };
      assert.deepEqual(
        await keptOn('search_document', filters),
        withoutE(await keptOn('listing_filter_row', filters)),
        `${filter.id} = ${JSON.stringify(value)}`,
      );
    }
  });
}

for (const catalogue of CATALOGUES) {
  test(`the ${catalogue.id} catalogue keeps on search_document its fixtures`, async () => {
    assert.deepEqual(
      await keptOn('search_document', catalogueSearch(catalogue.id).filters),
      withoutE([...CATALOGUE_CASES[catalogue.id]].sort()),
    );
  });
}

async function ordered(sort: SortId, after?: SortKey, limit?: number) {
  let query = web
    .selectFrom('search_document as r')
    .select(['r.listing_id', sortKeyOf(sort, CONTEXT).as('sort_key')])
    .where('r.listing_id', 'in', scope)
    .orderBy(searchOrderBy(sort, CONTEXT));
  if (after !== undefined) query = query.where(searchAfter(sort, after, CONTEXT));
  if (limit !== undefined) query = query.limit(limit);
  return query.execute();
}

for (const sort of SORTS) {
  test(`pages of the ${sort.id} order, read by keyset, give the same sequence as one read`, async () => {
    const all = await ordered(sort.id);
    assert.ok(all.length > 50, 'enough rows for several pages, with ties and rows without a value');
    for (const size of [1, 7]) {
      const paged: number[] = [];
      let key: SortKey | undefined;
      for (;;) {
        const page = await ordered(sort.id, key, size);
        paged.push(...page.map((row) => row.listing_id));
        const last = page.at(-1);
        if (page.length < size || last === undefined) break;
        key = { values: last.sort_key, listingId: last.listing_id };
      }
      assert.deepEqual(
        paged,
        all.map((row) => row.listing_id),
        `${sort.id}, pages of ${String(size)}`,
      );
    }
  });
}

async function matching(words: string): Promise<FixtureName[]> {
  const query = await sql<{ query: string | null }>`SELECT search_tsquery(${words})::text AS query`.execute(
    web,
  );
  const tsquery = query.rows[0]?.query ?? null;
  assert.notEqual(tsquery, null, `«${words}» has searchable words`);
  const rows = await web
    .selectFrom('search_document as r')
    .select('r.listing_id')
    .where('r.listing_id', 'in', Object.values(fixtures))
    .where(matchesText(tsquery ?? '', CONTEXT))
    .where(isFresh(CONTEXT, 48))
    .execute();
  return namesOf(rows.map((row) => row.listing_id));
}

test('Arabic yeh and kaf, the zero-width non-joiner and every digit script normalise to one form', async () => {
  const arabicYeh = String.fromCodePoint(0x64a);
  const arabicKaf = String.fromCodePoint(0x643);
  const persianYeh = String.fromCodePoint(0x6cc);
  const persianKaf = String.fromCodePoint(0x6a9);
  const zwnj = String.fromCodePoint(0x200c);
  const persianDigits = '۲۰۶';
  const arabicDigits = String.fromCodePoint(0x662, 0x660, 0x666);
  const variants = [
    `${persianKaf}${persianYeh}ا ${persianDigits} بی${zwnj}رنگ`,
    `${arabicKaf}${arabicYeh}ا ${arabicDigits} ب${arabicYeh} رنگ`,
    `${persianKaf}${persianYeh}ا 206 بی رنگ`,
  ];
  const { rows } = await sql<{ normalised: string }>`
    SELECT search_normalize(v) AS normalised FROM unnest(${variants}::text[]) v`.execute(web);
  assert.deepEqual(
    rows.map((row) => row.normalised),
    Array.from({ length: 3 }, () => `${persianKaf}${persianYeh}ا 206 بی رنگ`),
  );
  const split = await sql<{
    normalised: string;
  }>`SELECT search_normalize(${'تیپ۲ ۲۰۶تیپ'}) AS normalised`.execute(web);
  assert.equal(split.rows[0]?.normalised, 'تیپ 2 206 تیپ');
});

test('a query matches the listing however its words are typed', async () => {
  const arabicYeh = String.fromCodePoint(0x64a);
  // Persian, Arabic-Indic and Latin digits; the non-joiner typed as a space; Arabic yeh; a word run into a digit.
  assert.deepEqual(await matching('۲۰۶ تیپ ۲'), ['A']);
  assert.deepEqual(await matching(String.fromCodePoint(0x662, 0x660, 0x666)), ['A']);
  assert.deepEqual(await matching('206تیپ'), ['A']);
  assert.deepEqual(await matching('بی رنگ'), ['A']);
  assert.deepEqual(await matching(`ت${arabicYeh}پ پا${arabicYeh}ه`), ['A']);
  // A make's name with and without the madda.
  assert.deepEqual(await matching('آلفا'), ['A', 'B', 'D']);
  assert.deepEqual(await matching('الفا'), ['A', 'B', 'D']);
});

test('Latin-typed names match: the English name, a curated alias, in any case, and a prefix', async () => {
  assert.deepEqual(await matching('tst-alpha city'), ['A', 'B']);
  assert.deepEqual(await matching('PEZHO city'), ['A', 'B']);
  assert.deepEqual(await matching('pezh'), ['A', 'B']);
});

test('a word no listing has is tried with its closest word, and numbers are never corrected', async () => {
  // «پایح» for «پایه» (one letter), «pezhi» for «pezho».
  assert.deepEqual(await matching('پایح'), ['A']);
  assert.deepEqual(await matching('pezhi'), ['A', 'B']);
  assert.deepEqual(await matching('207'), []);
});

test('a listing leaves the table when it is sold, not seen for 48 hours, of an untracked model or of a private source', async () => {
  const inTable = async (id: number) =>
    (await web
      .selectFrom('search_document')
      .select('listing_id')
      .where('listing_id', '=', id)
      .executeTakeFirst()) !== undefined;
  assert.ok(await inTable(fixtures.D));

  await owner
    .updateTable('listing')
    .set({ status: 'gone', delisted_at: sql<Date>`now()` })
    .where('id', '=', fixtures.D)
    .execute();
  assert.deepEqual(await build([fixtures.D]), { written: 0, removed: 1 });
  assert.ok(!(await inTable(fixtures.D)));
  await owner
    .updateTable('listing')
    .set({ status: 'active', delisted_at: null })
    .where('id', '=', fixtures.D)
    .execute();
  assert.deepEqual(await build([fixtures.D]), { written: 1, removed: 0 });

  await owner
    .updateTable('listing')
    .set({ last_seen_at: sql<Date>`now() - interval '49 hours'` })
    .where('id', '=', fixtures.D)
    .execute();
  // Aged out: removed by any build, even one of other listings.
  assert.equal((await build([fixtures.A])).removed, 1);
  assert.ok(!(await inTable(fixtures.D)));
  await owner
    .updateTable('listing')
    .set({ last_seen_at: sql<Date>`now()` })
    .where('id', '=', fixtures.D)
    .execute();

  // D's model no longer tracked.
  const dModel = await owner
    .selectFrom('listing')
    .select('model_id')
    .where('id', '=', fixtures.D)
    .executeTakeFirstOrThrow();
  assert.deepEqual(
    await build(
      [fixtures.D],
      tracked.filter((id) => id !== dModel.model_id),
    ),
    { written: 0, removed: 1 },
  );
  assert.ok(!(await inTable(fixtures.D)));

  assert.deepEqual(await build([fixtures.D]), { written: 1, removed: 0 });

  await owner
    .updateTable('source')
    .set({ listing_visibility: 'requester_only' })
    .where('id', '=', 'tst_search_a')
    .execute();
  try {
    assert.deepEqual(await build([fixtures.D]), { written: 0, removed: 1 });
  } finally {
    await owner
      .updateTable('source')
      .set({ listing_visibility: 'public' })
      .where('id', '=', 'tst_search_a')
      .execute();
  }
  assert.deepEqual(await build([fixtures.D]), { written: 1, removed: 0 });
  assert.ok(await inTable(fixtures.D));
});

test('a build writes only rows whose values changed', async () => {
  assert.deepEqual(await build(scope), { written: 0, removed: 0 });
  await owner.updateTable('listing').set({ mileage_km: 21_000 }).where('id', '=', fixtures.A).execute();
  assert.deepEqual(await build(scope), { written: 1, removed: 0 });
  const row = await web
    .selectFrom('search_document')
    .select(['mileage_km', 'km_per_year'])
    .where('listing_id', '=', fixtures.A)
    .executeTakeFirstOrThrow();
  assert.deepEqual(row, { mileage_km: 21_000, km_per_year: 7_000 });
  await owner.updateTable('listing').set({ mileage_km: 20_000 }).where('id', '=', fixtures.A).execute();
  await build([fixtures.A]);
});
