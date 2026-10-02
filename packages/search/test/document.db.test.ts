import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { CATALOGUES } from '../src/catalogues.ts';
import {
  areCountsStale,
  buildSearchDocuments,
  fullRebuildDue,
  isVocabularyStale,
  readBuildState,
  refreshFacetCounts,
  refreshSearchWords,
  removeAgedDocuments,
  takeStaleListings,
  tryLockSearchBuild,
  waitForSearchBuild,
} from '../src/document.ts';
import { FILTERS } from '../src/filters.ts';
import { catalogueSearch, type SearchFilters } from '../src/search.ts';
import {
  matchesText,
  searchableWhere,
  searchAfter,
  searchAfterBranches,
  searchOrderBy,
  searchPageSql,
  sortKeyOf,
  type SearchRead,
  type SortKey,
} from '../src/sql.ts';
import { SORTS, type SortId } from '../src/sorts.ts';
import { deleteBulk, seedBulk } from './bulk.ts';
import { CATALOGUE_CASES, FILTER_CASES } from './filter-cases.ts';
import { FIXTURE_NAMES, NOW, type FixtureName } from './fixture-names.ts';
import { openScratchDatabase, seedFixtures, webDatabase, type Fixtures } from './fixtures.ts';

// search_document (CS-59) on the scratch database `pnpm db:check` migrated: built from the fixtures and a hundred and
// fifty more listings by the build the worker runs, then read as the web app's own role. Every filter and catalogue
// keeps on it exactly what it keeps on listing_filter_row (criterion 1); every order pages by keyset, in every
// branch and at random places, to the order's own sequence (criterion 1); the text matches however the words are
// typed and a typo is replaced only by a common word one edit away (criterion 2); a list row is not searchable until
// its details are read, and a listing leaves when it is sold, not seen for 48 hours or of a private source
// (criterion 5); and the build writes only what changed, in chunks, and records what it did (criterion 3).

const BULK_SOURCE = 'tst_search_bulk';

let owner: Kysely<DB>;
let web: Kysely<DB>;
let fixtures: Fixtures;
let bulkIds: number[];
/** Every listing of this run: the fixtures and the bulk. */
let scope: number[];

const CONTEXT = { alias: 'r', now: NOW } as const;
/** The makes of the fixtures and the bulk, so a read sees these listings and no other test's. */
const OURS: SearchFilters = { make: ['tst-alpha', 'tst-beta'] };
const READ: SearchRead = { filters: OURS, tsquery: null };

async function build(listingIds: readonly number[]) {
  return owner.transaction().execute(async (trx) => {
    assert.ok(await tryLockSearchBuild(trx), 'no other build runs in this test');
    return buildSearchDocuments(trx, { scope: { listingIds }, now: NOW });
  });
}

before(async () => {
  owner = await openScratchDatabase();
  web = webDatabase();
  fixtures = await seedFixtures(owner);
  // A title with a digit run, a zero-width non-joiner and Persian letters, and a Latin-typed alias of A's model.
  await owner
    .updateTable('listing')
    .set({ title: `آلفا ۲۰۶تیپ ۲ بی${String.fromCodePoint(0x200c)}رنگ` })
    .where('id', '=', fixtures.A)
    .execute();
  // A's own make and model, by id: another test's catalogue may hold a model slugged city too. Their English names
  // are set here, since the fixtures' upserts keep a name an earlier run gave them.
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
  if (a.make_id === null || a.model_id === null || a.city_id === null || c.city_id === null)
    throw new Error('the fixtures lack a catalogue row');
  await owner.updateTable('make').set({ name_en: 'tst-alpha' }).where('id', '=', a.make_id).execute();
  await owner.updateTable('model').set({ name_en: 'city' }).where('id', '=', a.model_id).execute();
  await sql`
    INSERT INTO catalogue_alias (model_id, alias, script, status)
    VALUES (${a.model_id}, 'Pezho City', 'latin', 'curated')
    ON CONFLICT DO NOTHING`.execute(owner);
  const { rows: runs } = await sql<{ id: number }>`
    SELECT id FROM valuation_run WHERE as_of_date = '2099-12-30'`.execute(owner);
  const run = runs[0];
  if (run === undefined) throw new Error('the fixtures made no valuation run');
  bulkIds = await seedBulk(owner, {
    source: BULK_SOURCE,
    count: 150,
    makeId: a.make_id,
    modelId: a.model_id,
    cityA: a.city_id,
    cityB: c.city_id,
    valuationRunId: run.id,
  });
  // Words for the text tests: «سالم» in all of them, «نقدی» and «207i» in half, «مدارک» in a tenth, and «ویژه» in
  // four (a rare word).
  await sql`
    UPDATE listing SET title = title || ' سالم'
      || CASE WHEN substr(source_listing_key, 5)::int % 2 = 0 THEN ' نقدی 207i' ELSE '' END
      || CASE WHEN substr(source_listing_key, 5)::int % 10 = 0 THEN ' مدارک' ELSE '' END
      || CASE WHEN source_listing_key IN ('bulk1', 'bulk2', 'bulk3', 'bulk4') THEN ' ویژه' ELSE '' END
    WHERE source_id = ${BULK_SOURCE}`.execute(owner);
  scope = [...Object.values(fixtures), ...bulkIds];
  await build(scope);
  await refreshFacetCounts(owner);
  await refreshSearchWords(owner);
});

after(async () => {
  await deleteBulk(owner, BULK_SOURCE);
  await web.destroy();
  await owner.destroy();
});

function namesOf(ids: readonly number[]): FixtureName[] {
  return FIXTURE_NAMES.filter((name) => ids.includes(fixtures[name]));
}

async function keptOn(relation: 'listing_filter_row' | 'search_document', filters: SearchFilters) {
  const { rows } = await sql<{ listing_id: number }>`
    SELECT r.listing_id FROM ${sql.table(relation)} r
    WHERE r.listing_id = any(${Object.values(fixtures)}::bigint[])
      AND ${searchableWhere({ filters, tsquery: null }, CONTEXT, { freshnessHours: 24 * 365 })}`.execute(web);
  return namesOf(rows.map((row) => row.listing_id));
}

async function inTable(id: number): Promise<boolean> {
  const row = await web
    .selectFrom('search_document')
    .select('listing_id')
    .where('listing_id', '=', id)
    .executeTakeFirst();
  return row !== undefined;
}

// Criterion 1: filters and catalogues.

test('every fixture is in the table, with the rows of the bulk: all of them have their details read', async () => {
  assert.deepEqual(await keptOn('search_document', {}), [...FIXTURE_NAMES]);
  const { rows } = await sql<{ n: number }>`
    SELECT count(*)::integer AS n FROM search_document WHERE listing_id = any(${bulkIds}::bigint[])`.execute(
    web,
  );
  assert.equal(rows[0]?.n, bulkIds.length);
});

for (const filter of FILTERS) {
  test(`the ${filter.id} filter keeps on search_document what it keeps on the view`, async () => {
    for (const { value, keeps } of FILTER_CASES[filter.id]) {
      const filters = { [filter.id]: value };
      assert.deepEqual(
        await keptOn('search_document', filters),
        await keptOn('listing_filter_row', filters),
        `${filter.id} = ${JSON.stringify(value)}`,
      );
      assert.deepEqual(await keptOn('search_document', filters), [...keeps].sort());
    }
  });
}

for (const catalogue of CATALOGUES) {
  test(`the ${catalogue.id} catalogue keeps on search_document its fixtures`, async () => {
    assert.deepEqual(
      await keptOn('search_document', catalogueSearch(catalogue.id).filters),
      [...CATALOGUE_CASES[catalogue.id]].sort(),
    );
  });
}

// Criterion 1: orders and keyset pages.

type Ordered = { listing_id: number; sort_key: (string | null)[] };

async function fullOrder(sort: SortId): Promise<Ordered[]> {
  const { rows } = await sql<Ordered>`
    SELECT r.listing_id, ${sortKeyOf(sort, CONTEXT)} AS sort_key FROM search_document r
    WHERE ${searchableWhere(READ, CONTEXT)} ORDER BY ${searchOrderBy(sort, CONTEXT)}`.execute(web);
  return rows;
}

async function page(sort: SortId, key: SortKey | undefined, limit: number): Promise<Ordered[]> {
  const { rows } = await sql<Ordered>`
    SELECT p.listing_id, p.sort_key FROM ${searchPageSql({ read: READ, sort, key, limit, context: CONTEXT })} AS p`.execute(
    web,
  );
  return rows;
}

for (const sort of SORTS) {
  test(`pages of the ${sort.id} order, read by keyset, are the order's own sequence`, async () => {
    const all = await fullOrder(sort.id);
    assert.ok(all.length >= 150, 'enough rows for pages, ties and rows without a value');
    for (const size of [1, 7, 25]) {
      const paged: number[] = [];
      let key: SortKey | undefined;
      for (;;) {
        const rows = await page(sort.id, key, size);
        paged.push(...rows.map((row) => row.listing_id));
        const last = rows.at(-1);
        if (rows.length < size || last === undefined) break;
        key = { values: last.sort_key, listingId: last.listing_id };
      }
      assert.deepEqual(
        paged,
        all.map((row) => row.listing_id),
        `${sort.id}, pages of ${String(size)}`,
      );
    }
  });

  test(`after any row of the ${sort.id} order, the branches, their union and the one condition give the rows after it`, async () => {
    const all = await fullOrder(sort.id);
    // The first row, the last, the border of every run of equal first values, a null tail's first and last rows, and
    // others spread through: where a branch is most likely to be wrong.
    const picks = new Set<number>([0, all.length - 1, 1, Math.floor(all.length / 2)]);
    all.forEach((row, index) => {
      const next = all[index + 1];
      if (next === undefined || next.sort_key[0] !== row.sort_key[0]) {
        picks.add(index);
        picks.add(Math.min(index + 1, all.length - 1));
      }
    });
    for (let index = 0; index < all.length; index += 5) picks.add(index);
    for (const index of picks) {
      const at = all[index];
      if (at === undefined) continue;
      const key = { values: at.sort_key, listingId: at.listing_id };
      const expected = all.slice(index + 1).map((row) => row.listing_id);
      const { rows: single } = await sql<{ listing_id: number }>`
        SELECT r.listing_id FROM search_document r
        WHERE ${searchableWhere(READ, CONTEXT)} AND ${searchAfter(sort.id, key, CONTEXT)}
        ORDER BY ${searchOrderBy(sort.id, CONTEXT)}`.execute(web);
      assert.deepEqual(
        single.map((row) => row.listing_id),
        expected,
        `${sort.id} after row ${String(index)}: the one condition`,
      );
      const branched: number[] = [];
      for (const branch of searchAfterBranches(sort.id, key, CONTEXT)) {
        const { rows } = await sql<{ listing_id: number }>`
          SELECT r.listing_id FROM search_document r
          WHERE ${searchableWhere(READ, CONTEXT)} AND ${branch}`.execute(web);
        branched.push(...rows.map((row) => row.listing_id));
      }
      assert.equal(
        new Set(branched).size,
        branched.length,
        `${sort.id} after row ${String(index)}: no row in two branches`,
      );
      assert.deepEqual(
        new Set(branched),
        new Set(expected),
        `${sort.id} after row ${String(index)}: the branches' union`,
      );
      const limited = await page(sort.id, key, 10);
      assert.deepEqual(
        limited.map((row) => row.listing_id),
        expected.slice(0, 10),
        `${sort.id} after row ${String(index)}: the page`,
      );
    }
  });
}

// Criterion 2: Persian analysis, Latin names and typos.

async function plan(words: string) {
  const { rows } = await sql<{
    tsquery_text: string | null;
    corrections: { from: string; to: string }[];
    unmatched: string[];
  }>`SELECT * FROM search_query(${words})`.execute(web);
  const row = rows[0];
  assert.ok(row);
  return row;
}

async function matching(words: string): Promise<FixtureName[]> {
  const { tsquery_text: tsquery } = await plan(words);
  assert.notEqual(tsquery, null, `«${words}» has searchable words`);
  const { rows } = await sql<{ listing_id: number }>`
    SELECT r.listing_id FROM search_document r
    WHERE r.listing_id = any(${Object.values(fixtures)}::bigint[]) AND ${matchesText(tsquery ?? '', CONTEXT)}`.execute(
    web,
  );
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

test('a typo is replaced by a common word one edit away, as the exact word', async () => {
  // «کارکرذه» for «کارکرده» (a substitution, in a word of seven letters).
  const substituted = await plan('کارکرذه');
  assert.deepEqual(substituted.corrections, [{ from: 'کارکرذه', to: 'کارکرده' }]);
  assert.deepEqual(substituted.unmatched, []);
  assert.equal(substituted.tsquery_text, "'کارکرده'");
  // «سلام» for «سالم»: neighbours swapped, one edit although Levenshtein counts two.
  assert.deepEqual((await plan('سلام')).corrections, [{ from: 'سلام', to: 'سالم' }]);
  // «pezhi» for «pezho», a Latin alias of the model.
  assert.deepEqual((await plan('pezhi')).corrections, [{ from: 'pezhi', to: 'pezho' }]);
  // The corrected word finds the listings.
  assert.deepEqual(await matching('pezhi city'), ['A', 'B']);
});

test('a word that is not corrected: known, a prefix of a known word, short, with a digit, rare, or too far', async () => {
  const none = { corrections: [], unmatched: [] };
  // Known as typed, and the prefix of a known word.
  assert.deepEqual(
    (({ corrections, unmatched }) => ({ corrections, unmatched }))(await plan('کارکرده')),
    none,
  );
  const prefix = await plan('کارک');
  assert.deepEqual({ corrections: prefix.corrections, unmatched: prefix.unmatched }, none);
  assert.equal(prefix.tsquery_text, "'کارک':*");
  // Under four letters («سلم» for «سالم»).
  const short = await plan('سلم');
  assert.deepEqual(
    { corrections: short.corrections, unmatched: short.unmatched },
    {
      corrections: [],
      unmatched: ['سلم'],
    },
  );
  // With a digit: «208i» is not «207i», which half the listings carry.
  const model = await plan('208i');
  assert.deepEqual(
    { corrections: model.corrections, unmatched: model.unmatched },
    {
      corrections: [],
      unmatched: ['208i'],
    },
  );
  // A rare word: «ویژه» is in four listings, so «ویذه» is no typo of it.
  const rare = await plan('ویذه');
  assert.deepEqual(
    { corrections: rare.corrections, unmatched: rare.unmatched },
    {
      corrections: [],
      unmatched: ['ویذه'],
    },
  );
  // Too far: «مزدا» is three edits from «مدارک», which a tenth of the listings carry; the prefix «مدا» is no word.
  const far = await plan('مزدا');
  assert.deepEqual(
    { corrections: far.corrections, unmatched: far.unmatched },
    {
      corrections: [],
      unmatched: ['مزدا'],
    },
  );
  // A number is never corrected: «208» has no listing, «206» has.
  assert.deepEqual((await plan('208')).unmatched, ['208']);
  assert.deepEqual((await plan('206')).unmatched, []);
});

test('at most three words of a query are tried for a correction', async () => {
  const many = await plan('کارکرذه سلام نقذی سالمم کارکردهه');
  assert.deepEqual(many.corrections, [
    { from: 'کارکرذه', to: 'کارکرده' },
    { from: 'سلام', to: 'سالم' },
    { from: 'نقذی', to: 'نقدی' },
  ]);
  // The fourth and the fifth would each be corrected alone; here they are only reported.
  assert.deepEqual(many.unmatched, ['سالمم', 'کارکردهه']);
  assert.deepEqual((await plan('سالمم')).corrections, [{ from: 'سالمم', to: 'سالم' }]);
});

test('words with nothing to search give no query', async () => {
  const none = await plan('!!! ؟؟ --');
  assert.equal(none.tsquery_text, null);
  assert.deepEqual(
    { corrections: none.corrections, unmatched: none.unmatched },
    {
      corrections: [],
      unmatched: [],
    },
  );
});

// Criterion 5: who is searchable.

test('a list row is not searchable until its details are read, and then enters by itself', async () => {
  const key = `bare${String(Date.now())}`;
  const bare = await owner
    .insertInto('listing')
    .values({
      source_id: 'tst_search_a',
      source_listing_key: key,
      url: `https://test.example/${key}`,
      status: 'active',
      listed_at: sql<Date>`now()`,
      last_seen_at: sql<Date>`now()`,
      catalogue_match: 'unmatched',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  assert.deepEqual(await build([bare.id]), { written: 0, removed: 0 });
  assert.ok(!(await inTable(bare.id)), 'a list row alone is not in the table');
  // The marks a trigger left: none for a listing without details.
  const marks = await owner
    .selectFrom('search_document_stale')
    .select('id')
    .where('listing_id', '=', bare.id)
    .execute();
  assert.deepEqual(marks, [], 'a list row is not marked, so a sweep that touches it costs nothing');

  await owner
    .updateTable('listing')
    .set({ price_type: 'asking', asking_price_toman: 700_000_000, title: 'خودروی تازه' })
    .where('id', '=', bare.id)
    .execute();
  const taken = await owner.transaction().execute((trx) => takeStaleListings(trx, 1_000_000));
  assert.ok(taken.listingIds.includes(bare.id), 'reading its details marks it');
  assert.deepEqual(await build([bare.id]), { written: 1, removed: 0 });
  assert.ok(await inTable(bare.id), 'with its details read it is searchable');
});

test('a listing leaves the table when it is sold, not seen for 48 hours, or of a private source', async () => {
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

  // 49 hours pass without a sighting: the listing's, and the row's copy of it, which the next refresh would carry.
  await owner
    .updateTable('listing')
    .set({ last_seen_at: sql<Date>`now() - interval '49 hours'` })
    .where('id', '=', fixtures.D)
    .execute();
  await owner
    .updateTable('search_document')
    .set({ last_seen_at: sql<Date>`now() - interval '49 hours'` })
    .where('listing_id', '=', fixtures.D)
    .execute();
  // Expired by the minute's own delete, whatever else the run builds; only the aged row goes.
  assert.ok((await removeAgedDocuments(owner)) >= 1);
  assert.ok(!(await inTable(fixtures.D)));
  assert.ok(await inTable(fixtures.A));
  // A listing not seen for 48 hours is not built either.
  assert.deepEqual(await build([fixtures.D]), { written: 0, removed: 0 });
  await owner
    .updateTable('listing')
    .set({ last_seen_at: sql<Date>`now()` })
    .where('id', '=', fixtures.D)
    .execute();
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

// Criterion 3: the build.

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

test('building every row in chunks of 40 listings gives the rows a build by id gives', async () => {
  const snapshot = async () => {
    const { rows } = await sql<{ listing_id: number; row: string }>`
      SELECT d.listing_id, (to_jsonb(d) - 'refreshed_at')::text AS row
      FROM search_document d WHERE d.listing_id = any(${scope}::bigint[]) ORDER BY d.listing_id`.execute(
      owner,
    );
    return rows;
  };
  const before_ = await snapshot();
  assert.ok(before_.length >= 155);
  await owner.deleteFrom('search_document').where('listing_id', 'in', scope).execute();
  const chunks: number[] = [];
  const built = await owner.transaction().execute(async (trx) => {
    assert.ok(await tryLockSearchBuild(trx));
    return buildSearchDocuments(trx, {
      scope: 'all',
      now: NOW,
      chunkSize: 40,
      onChunk: (chunk) => chunks.push(chunk.index),
    });
  });
  assert.ok(chunks.length >= 4, `${String(chunks.length)} chunks`);
  assert.deepEqual(
    chunks,
    [...chunks.keys()].map((index) => index + 1),
  );
  assert.ok(built.written >= before_.length);
  assert.deepEqual(await snapshot(), before_, 'the same rows, whatever the chunks');
  // Every listing is in some chunk, the newest too, and a second build changes nothing.
  assert.deepEqual(
    await owner
      .transaction()
      .execute((trx) => buildSearchDocuments(trx, { scope: 'all', now: NOW, chunkSize: 40 })),
    { written: 0, removed: 0 },
  );
});

test('the counts have the searchable total and the listings seen, and a list row is seen but not searchable', async () => {
  const counted = async () => {
    await refreshFacetCounts(owner, NOW);
    const rows = await owner
      .selectFrom('search_facet_count')
      .select(['facet', 'listing_count'])
      .where('facet', 'in', ['total', 'seen'])
      .execute();
    const count = (facet: string) => rows.find((row) => row.facet === facet)?.listing_count ?? -1;
    return { searchable: count('total'), seen: count('seen') };
  };
  const first = await counted();
  const { rows: table } = await sql<{
    n: number;
  }>`SELECT count(*)::integer AS n FROM search_document`.execute(owner);
  assert.equal(first.searchable, table[0]?.n);
  assert.ok(first.seen >= first.searchable);
  const key = `seen${String(Date.now())}`;
  await owner
    .insertInto('listing')
    .values({
      source_id: 'tst_search_a',
      source_listing_key: key,
      url: `https://test.example/${key}`,
      status: 'active',
      listed_at: sql<Date>`now()`,
      last_seen_at: sql<Date>`now()`,
      catalogue_match: 'unmatched',
    })
    .execute();
  const second = await counted();
  assert.equal(second.seen, first.seen + 1, 'a list row a crawl saw is seen');
  assert.equal(second.searchable, first.searchable, 'and not yet searchable');
});

test('the build records its events, and a part built before the last change is stale', async () => {
  await refreshSearchWords(owner);
  await refreshFacetCounts(owner, NOW);
  let state = await readBuildState(owner);
  assert.ok(!isVocabularyStale(state) && !areCountsStale(state));
  // A change to the rows, committed, and then the run fails before the vocabulary and the counts: the events say so,
  // so the next run builds them whatever it changes itself.
  await owner.updateTable('listing').set({ mileage_km: 22_000 }).where('id', '=', fixtures.A).execute();
  assert.equal((await build([fixtures.A])).written, 1);
  state = await readBuildState(owner);
  assert.ok(isVocabularyStale(state), 'the vocabulary was built before the rows last changed');
  assert.ok(areCountsStale(state));
  await refreshSearchWords(owner);
  state = await readBuildState(owner);
  assert.ok(!isVocabularyStale(state));
  assert.ok(areCountsStale(state), 'the counts are stale until they are counted');
  await refreshFacetCounts(owner, NOW);
  assert.ok(!areCountsStale(await readBuildState(owner)));
  // A build that changes nothing is no change: the events stay as they were.
  const quiet = await readBuildState(owner);
  assert.deepEqual(await build([fixtures.A]), { written: 0, removed: 0 });
  assert.deepEqual((await readBuildState(owner)).documentsChangedAt, quiet.documentsChangedAt);
  await owner.updateTable('listing').set({ mileage_km: 20_000 }).where('id', '=', fixtures.A).execute();
  await build([fixtures.A]);
  await refreshSearchWords(owner);
  await refreshFacetCounts(owner, NOW);
  assert.equal(fullRebuildDue({ ...quiet, documents: 0 }), 'empty');
});

test('a second build does not wait for the first: it is told the lock is held', async () => {
  const held = new Promise<void>((resolve, reject) => {
    owner
      .transaction()
      .execute(async (first) => {
        assert.ok(await tryLockSearchBuild(first));
        // While the first holds it, another connection neither waits nor fails.
        const started = Date.now();
        assert.equal(await tryLockSearchBuild(web), false);
        assert.ok(Date.now() - started < 1_000, 'it answered at once');
        const waited = Date.now();
        assert.equal(await waitForSearchBuild(web, { timeoutMs: 600, pollMs: 100 }), false);
        const spent = Date.now() - waited;
        assert.ok(
          spent >= 500 && spent < 2_000,
          `it gave up after its limit, not before or long after: ${String(spent)} ms`,
        );
      })
      .then(resolve, reject);
  });
  await held;
  // Released with the first transaction: the next takes it.
  assert.equal(await web.transaction().execute((trx) => tryLockSearchBuild(trx)), true);
});
