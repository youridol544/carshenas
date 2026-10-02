// Measures the search's query shapes with EXPLAIN (ANALYZE, BUFFERS) on the database DATABASE_URL names (the web
// role reads it): a first page of every order and catalogue, of rare and of common filter values, a keyset page at
// depth, the capped counts and the facets of a filtered search. One markdown table on stdout: the statement's
// execution time, the buffers it touched and the scans it chose. `pnpm --filter @carshenas/search measure`.
// docs/evidence/search-api/2026-10-02/ keeps its output on the lane's data and on synthetic tables of 25,000 and
// 100,000 listings (seed-scale.ts).
import { sql, type RawBuilder } from 'kysely';
import { createDatabase } from '@carshenas/db/database';
import { CATALOGUES } from '../src/catalogues.ts';
import { FILTERS } from '../src/filters.ts';
import { catalogueSearch, type SearchFilters } from '../src/search.ts';
import { DEFAULT_SORT, SORTS, type SortId } from '../src/sorts.ts';
import {
  searchableWhere,
  searchOrderBy,
  searchFacetCountsSql,
  searchPageSql,
  searchQuerySql,
  sortKeyOf,
  type SearchRead,
  type SortKey,
} from '../src/sql.ts';

const url = process.env.DATABASE_URL;
if (url === undefined) {
  process.stderr.write('DATABASE_URL names the database to measure\n');
  process.exit(2);
}
const db = createDatabase({
  connectionString: url,
  applicationName: 'carshenas-search-measure',
  max: 2,
  onIdleError: () => undefined,
});
const context = { alias: 'r', now: new Date() } as const;
const COUNT_CAP = 1_000;

type Plan = { 'Node Type': string; 'Index Name'?: string; Plans?: Plan[] } & Record<string, unknown>;

function scans(plan: Plan): string[] {
  const own = plan['Node Type'].includes('Scan')
    ? [
        `${plan['Node Type'].replace(' Scan', '')}${plan['Index Name'] === undefined ? '' : ` ${plan['Index Name'].replace('search_document_', '')}`}`,
      ]
    : [];
  return [...own, ...(plan.Plans ?? []).flatMap(scans)];
}

async function explain(statement: RawBuilder<unknown>) {
  const run = async () => {
    const { rows } = await sql<{ 'QUERY PLAN': { Plan: Plan; 'Execution Time': number }[] }>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement}`.execute(db);
    const top = rows[0]?.['QUERY PLAN'][0];
    if (top === undefined) throw new Error('no plan');
    const hit = Number(top.Plan['Shared Hit Blocks'] ?? 0);
    const read = Number(top.Plan['Shared Read Blocks'] ?? 0);
    return { ms: top['Execution Time'], buffers: hit + read, scans: [...new Set(scans(top.Plan))] };
  };
  await run(); // the first run warms the cache; the second is the one reported
  return run();
}

const rows: string[] = [];
async function measure(name: string, statement: RawBuilder<unknown>) {
  const result = await explain(statement);
  rows.push(`| ${name} | ${result.ms.toFixed(2)} | ${String(result.buffers)} | ${result.scans.join(', ')} |`);
}

async function tsqueryOf(words: string): Promise<string | null> {
  const plan = await db.selectFrom(searchQuerySql(words).as('q')).selectAll().executeTakeFirstOrThrow();
  return plan.tsquery_text;
}

function page(read: SearchRead, sort: SortId | undefined, key?: SortKey) {
  return sql`SELECT p.listing_id FROM ${searchPageSql({ read, sort, key, limit: 25, context })} AS p`;
}

const everything: SearchRead = { filters: {}, tsquery: null };
const total = (await sql<{ n: number }>`SELECT count(*)::integer AS n FROM search_document`.execute(db))
  .rows[0]?.n;
rows.push(`Table: ${String(total)} rows.`, '', '| Query | ms | buffers | scans |', '|---|---|---|---|');

// A first page of every order, and of every catalogue.
for (const sort of SORTS) await measure(`all, first page, ${sort.id}`, page(everything, sort.id));
for (const catalogue of CATALOGUES) {
  const search = catalogueSearch(catalogue.id);
  await measure(`catalogue ${catalogue.id}`, page({ filters: search.filters, tsquery: null }, search.sort));
}

// Rare and common values of the filters that are not an order's own: the planner walks the order's index until it has
// 25 matches, or reads the table; either costs the rows it passes.
const rare: [string, SearchFilters][] = [
  ['fuel plug_in_hybrid (0.02 %)', { fuel: ['plug_in_hybrid'] }],
  ['fuel electric (0.05 %)', { fuel: ['electric'] }],
  ['fuel hybrid (1.7 %)', { fuel: ['hybrid'] }],
  ['fuel dual_fuel_factory (3 %)', { fuel: ['dual_fuel_factory'] }],
  ['gearbox automatic (16 %)', { gearbox: ['automatic'] }],
  ['body_type crossover (0.3 %)', { body_type: ['crossover'] }],
  ['body_type suv (4.7 %)', { body_type: ['suv'] }],
  ['colour purple (0.05 %)', { colour: ['purple'] }],
  ['colour red (3 %)', { colour: ['red'] }],
  ['seller dealer (19 %)', { seller: ['dealer'] }],
  ['engine needs_repair (0.6 %)', { engine_condition: ['needs_repair'] }],
  ['chassis damaged (0.5 %)', { chassis: ['damaged'] }],
  ['body_condition salvage (0.2 %)', { body_condition: 'salvage' } as unknown as SearchFilters],
  ['city scale-city-5 (0.04 %)', { city: ['scale-city-5'] }],
  ['model scale.three (4.7 %)', { model: ['scale.three'] }],
  ['model tiny.four (0.3 %)', { model: ['tiny.four'] }],
  ['make tiny (0.3 %)', { make: ['tiny'] }],
  ['make scale (99.7 %)', { make: ['scale'] }],
  ['trim scale.one.rare (0.1 %)', { trim: ['scale.one.rare'] }],
  ['trim scale.two.sport (30 %)', { trim: ['scale.two.sport'] }],
  ['district tehran.محله 79 (0.1 %)', { district: ['tehran.محله 79'] }],
  ['district tehran.محله 40', { district: ['tehran.محله 40'] }],
  ['installments (2 %)', { installments: true }],
  ['swap (10 %)', { swap: true }],
  ['paint_free (40 %)', { paint_free: true }],
  ['deal great', { deal: 'great' }],
  ['fuel electric + gearbox automatic', { fuel: ['electric'], gearbox: ['automatic'] }],
  ['price at most 400m + year from 1400', { price: { max: 400_000_000 }, year: { min: 1400 } }],
  ['mileage under 50,000', { mileage: { max: 50_000 } }],
];
for (const [name, filters] of rare) {
  const known = FILTERS.some((filter) => filter.id in filters);
  if (!known) continue;
  await measure(`${name}, best_deal`, page({ filters, tsquery: null }, DEFAULT_SORT));
}
for (const [name, filters] of rare.slice(0, 2)) {
  for (const sort of ['newest', 'price_asc'] as const)
    await measure(`${name}, ${sort}`, page({ filters, tsquery: null }, sort));
}

// Words.
for (const words of ['خودرو', 'سالم', 'تمیز', 'سالم تمیز', 'خودروی 4']) {
  const tsquery = await tsqueryOf(words);
  if (tsquery !== null) await measure(`words «${words}»`, page({ filters: {}, tsquery }, DEFAULT_SORT));
}

// A keyset page at depth, after the row at that depth of each order.
for (const sort of SORTS) {
  for (const depth of [0.25, 0.9]) {
    const offset = Math.floor((total ?? 0) * depth);
    const { rows: at } = await sql<{ listing_id: number; sort_key: (string | null)[] }>`
      SELECT r.listing_id, ${sortKeyOf(sort.id, context)} AS sort_key FROM search_document r
      WHERE ${searchableWhere(everything, context)} ORDER BY ${searchOrderBy(sort.id, context)}
      OFFSET ${offset} LIMIT 1`.execute(db);
    const row = at[0];
    if (row === undefined) continue;
    await measure(
      `keyset page at ${String(depth * 100)} % depth, ${sort.id}`,
      page(everything, sort.id, { values: row.sort_key, listingId: row.listing_id }),
    );
  }
}

// The capped counts (the API counts up to 1,000 and says «بیش از ۱٬۰۰۰» above).
for (const [name, filters] of [
  ['count, no filter beyond freshness', {}],
  ['count, gearbox automatic', { gearbox: ['automatic'] }],
  ['count, fuel electric', { fuel: ['electric'] }],
  ['count, price at most 400m', { price: { max: 400_000_000 } }],
] as [string, SearchFilters][]) {
  await measure(
    name,
    sql`SELECT count(*) FROM (SELECT 1 FROM search_document r WHERE ${searchableWhere({ filters, tsquery: null }, context)} LIMIT ${COUNT_CAP + 1}) capped`,
  );
}

// The facets of a filtered search: each option's count without its own filter. The facets whose filter is not in the
// search share one scan, the others have a scan each.
const facetFilters: [string, SearchFilters][] = [
  ['facets, gearbox automatic', { gearbox: ['automatic'] }],
  ['facets, fuel electric', { fuel: ['electric'] }],
  ['facets, price at most 400m', { price: { max: 400_000_000 } }],
  ['facets, make scale + gearbox automatic', { make: ['scale'], gearbox: ['automatic'] }],
  ['facets, city scale-city-5 + gearbox manual', { city: ['scale-city-5'], gearbox: ['manual'] }],
  [
    'facets, make + model + city + district',
    { make: ['scale'], model: ['scale.one'], city: ['tehran'], district: ['tehran.محله 40'] },
  ],
];
for (const [name, filters] of facetFilters) {
  await measure(
    name,
    sql`SELECT * FROM ${searchFacetCountsSql({ filters, tsquery: null }, context)} AS facets`,
  );
}

process.stdout.write(`${rows.join('\n')}\n`);
await db.destroy();
