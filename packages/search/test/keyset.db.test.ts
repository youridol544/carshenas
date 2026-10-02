import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { sql, type Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import { buildSearchDocuments, tryLockSearchBuild } from '../src/document.ts';
import {
  searchableWhere,
  searchOrderBy,
  searchPageSql,
  sortKeyOf,
  type SearchRead,
  type SortKey,
} from '../src/sql.ts';
import { SORTS, type SortId } from '../src/sorts.ts';
import { deleteBulk, seedBulk } from './bulk.ts';
import { NOW } from './fixture-names.ts';
import { openScratchDatabase, seedFixtures, webDatabase } from './fixtures.ts';

// A page costs the rows it shows, at any depth (CS-59, the database review of 2026-10-02): one OR condition cannot
// start an index scan, and at 90 % depth the page after it read about 20,000 buffers where each branch of a keyset page
// reads about thirty. Twelve thousand listings, a page at five depths of every order, one of which is in the null tail
// of each nullable column and one in the part that has values; the page is the rows an OFFSET read gives, and its
// buffers stay small whatever the depth.

const SOURCE = 'tst_search_deep';
const ROWS = 12_000;
/** A page of 25 reads a few index pages and a heap page for each row of each of at most three branches. */
const MAX_BUFFERS = 600;

let owner: Kysely<DB>;
let web: Kysely<DB>;

const CONTEXT = { alias: 'r', now: NOW } as const;
const READ: SearchRead = { filters: { make: ['tst-alpha'] }, tsquery: null };

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
  await seedBulk(owner, {
    source: SOURCE,
    count: ROWS,
    makeId: a.make_id,
    modelId: a.model_id,
    cityA: a.city_id,
    cityB: c.city_id,
    valuationRunId: run.id,
  });
  await owner.transaction().execute(async (trx) => {
    assert.ok(await tryLockSearchBuild(trx));
    await buildSearchDocuments(trx, { scope: 'all', now: NOW });
  });
  // The planner needs the statistics a worker's rebuild leaves.
  await sql`ANALYZE search_document`.execute(owner);
});

after(async () => {
  await deleteBulk(owner, SOURCE);
  await web.destroy();
  await owner.destroy();
});

type Ordered = { listing_id: number; sort_key: (string | null)[] };

/** The buffers a statement touched, from EXPLAIN (ANALYZE, BUFFERS). */
async function buffers(statement: ReturnType<typeof sql>): Promise<{ buffers: number; plan: string }> {
  const { rows } = await sql<{ 'QUERY PLAN': { Plan: Record<string, number> }[] }>`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement}`.execute(web);
  const plan = rows[0]?.['QUERY PLAN'][0]?.Plan;
  assert.ok(plan);
  return {
    buffers: (plan['Shared Hit Blocks'] ?? 0) + (plan['Shared Read Blocks'] ?? 0),
    plan: JSON.stringify(rows[0]?.['QUERY PLAN']),
  };
}

async function rowAt(sort: SortId, offset: number): Promise<Ordered | undefined> {
  const { rows } = await sql<Ordered>`
    SELECT r.listing_id, ${sortKeyOf(sort, CONTEXT)} AS sort_key FROM search_document r
    WHERE ${searchableWhere(READ, CONTEXT)} ORDER BY ${searchOrderBy(sort, CONTEXT)} OFFSET ${offset} LIMIT 1`.execute(
    web,
  );
  return rows[0];
}

async function ids(sort: SortId, offset: number, limit: number): Promise<number[]> {
  const { rows } = await sql<Ordered>`
    SELECT r.listing_id FROM search_document r
    WHERE ${searchableWhere(READ, CONTEXT)} ORDER BY ${searchOrderBy(sort, CONTEXT)} OFFSET ${offset} LIMIT ${limit}`.execute(
    web,
  );
  return rows.map((row) => row.listing_id);
}

for (const sort of SORTS) {
  test(`a page of the ${sort.id} order after a row at any depth is the rows after it and reads few buffers`, async () => {
    const { rows: count } = await sql<{ n: number }>`
      SELECT count(*)::integer AS n FROM search_document r WHERE ${searchableWhere(READ, CONTEXT)}`.execute(
      web,
    );
    const total = count[0]?.n ?? 0;
    assert.ok(total >= ROWS, `${String(total)} rows`);
    for (const depth of [0.05, 0.25, 0.6, 0.9, 0.99]) {
      const offset = Math.floor(total * depth);
      const at = await rowAt(sort.id, offset);
      assert.ok(at);
      const key: SortKey = { values: at.sort_key, listingId: at.listing_id };
      const page = searchPageSql({ read: READ, sort: sort.id, key, limit: 25, context: CONTEXT });
      const { rows } = await sql<Ordered>`SELECT p.listing_id FROM ${page} AS p`.execute(web);
      assert.deepEqual(
        rows.map((row) => row.listing_id),
        await ids(sort.id, offset + 1, 25),
        `${sort.id} at ${String(depth)}: the rows after the key`,
      );
      const measured = await buffers(sql`SELECT p.listing_id FROM ${page} AS p`);
      assert.ok(
        measured.buffers <= MAX_BUFFERS,
        `${sort.id} at depth ${String(depth)} read ${String(measured.buffers)} buffers: ${measured.plan.slice(0, 1500)}`,
      );
    }
  });
}

test('the one OR condition of before reads far more at depth: the test tells the two apart', async () => {
  const offset = Math.floor(ROWS * 0.9);
  const at = await rowAt('newest', offset);
  const instant = at?.sort_key[0];
  assert.ok(at && instant);
  const key: SortKey = { values: at.sort_key, listingId: at.listing_id };
  const sargable = await buffers(
    sql`SELECT p.listing_id FROM ${searchPageSql({ read: READ, sort: 'newest', key, limit: 25, context: CONTEXT })} AS p`,
  );
  // The keyset condition as the first version wrote it: beyond, or equal and beyond, or without a value.
  const oneCondition = await buffers(sql`
    SELECT r.listing_id FROM search_document r
    WHERE ${searchableWhere(READ, CONTEXT)}
      AND (r.listed_at < ${instant}::timestamptz
           OR (r.listed_at = ${instant}::timestamptz AND r.listing_id < ${at.listing_id}::bigint)
           OR r.listed_at IS NULL)
    ORDER BY ${searchOrderBy('newest', CONTEXT)} LIMIT 25`);
  assert.ok(sargable.buffers < 100, `the keyset page read ${String(sargable.buffers)} buffers`);
  assert.ok(
    oneCondition.buffers > 1_000,
    `the OR condition read ${String(oneCondition.buffers)} buffers against the page's ${String(sargable.buffers)}`,
  );
});
