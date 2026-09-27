# Access layer, migrations and job queue for Carshenas (CS-4, research pass B)

- Date: 2026-09-27
- Question: how should the web app (Next.js 16.3.5) and the ingestion worker talk to PostgreSQL: raw SQL, a query builder or an ORM, and which library? Which migration tool? Which PostgreSQL job queue?
- Method: current documentation (Context7 and each library's own site), npm and GitHub release data, GitHub issues, and a Docker lab. The lab ran PostgreSQL 17.11 with pgvector 0.8.6 and implemented the same schema and five operations in postgres.js, Drizzle, Kysely and Prisma, plus a Next.js 16.3.5 smoke build. Two sub-passes covered, first, migration tools and queues (with their own labs) and, second, the minor libraries, agent resources and telemetry.
- Lab files: the research session's lab (not kept). Each library had its own folder (`raw-postgres/`, `drizzle/`, `kysely/`, `prisma/`). Migration tools and queues were in `fork-a/`, the Next.js app in `next-smoke/`, and the network logs in `netlog/`.
- Conventions: quotes are verbatim and at most 25 words. "Lab" means reproduced here. "Inference" marks reasoning that was not measured.

## Short answer

**Winner: Kysely 0.29 on node-postgres (`pg` 8.23).** The rest of the stack:
- The schema lives in plain SQL migrations applied by **dbmate**.
- **kysely-codegen** generates the `DB` types from the migrated database.
- **Squawk** lints every migration.
- **pg-boss 12** is the job queue.

Why:
1. **Our hardest queries are PostgreSQL-specific, and Kysely writes most of them natively.** The builder covered ON CONFLICT … RETURNING, a CTE with `FOR UPDATE SKIP LOCKED` and `UPDATE … FROM`, `count(*) FILTER`, keyset comparison of `(deal_score, id)` pairs, window functions and JSONB `->>`. It needed its `sql` template only for the search operators (`@@`, `websearch_to_tsquery`, `ts_rank`, `%`, `<=>`) and `now()`.
   - That was **6 raw fragments across the five operations**. Drizzle needed 11.
   - Prisma could not run three of the five operations (search, facets and dequeue) through its API; they had to be hand-written SQL.
2. **Types come from the database.** The schema can therefore use every PostgreSQL feature: generated columns, CHECK, EXCLUDE, and partial, expression and HNSW indexes. There is no ORM schema language that cannot express them. `kysely-codegen --verify` fails CI when the types drift.
3. **It stays SQL.** The logged SQL matches the code clause by clause, which is what Armin Ronacher asks of agent-written data code. It also adds compile-time errors, which is what ADR-0004 relies on to steer agents.
   - Kysely 0.29's `ReadonlyKysely` made an insert in a read-only module a compile error (lab).
4. **It is the smallest typed option.** It is 3.5 MB, with no install scripts, no telemetry and nothing fetched outside npm. It had 14 releases in 2026.

What we accept:
- **Kysely is still 0.x.** 0.29.0 (2026-05-08) went ESM-only and moved the migrator import, so pin exact versions.
- **`sql<T>` fragments are unchecked type assertions.** Wrap them in small, tested helpers.
- **There is less training data** than for Prisma or Drizzle.
- **Its own migrator is weak for us.** It runs TypeScript migrations in one transaction with no checksums, so we do not use it.

**Runner-up: plain SQL with postgres.js.**
- It has tagged templates with composable fragments, is 408 KB with no dependencies, prepares statements automatically and was the fastest in the lab.
- It loses on two points that matter when agents write the code:
  - Row types are unchecked casts: `bigint` came back as a string and nothing warned.
  - Maintenance has slowed: 2 releases and 8 commits in 2026, 311 open issues, one maintainer.
- If chosen, add SafeQL to check raw SQL against the database at lint time.

**Not now: Drizzle ORM 0.45 with Drizzle Kit 0.31.** Four defects hit exactly the features we need. Each reproduced in the lab and each is an open GitHub issue:
- `CREATE INDEX CONCURRENTLY` cannot run, because all pending migrations share one transaction (#860, open since 2023-07).
- `drizzle-kit migrate` failed with exit code 1 and printed no error (#5521, #6121).
- An edited, already-applied migration was ignored, and `drizzle-kit check` reported "Everything's fine".
- An index declared `.desc()` is emitted as `DESC NULLS LAST`, while `desc()` in a query means `NULLS FIRST`. PostgreSQL therefore sorted instead of using the index for our main sort (#5978, also reproduced on 1.0.0-rc.4).

Version 1.0 has been a release candidate since 2026-04-30 (rc.4 on 2026-06-27), while Drizzle's docs already install `@rc`. Revisit when 1.0 is stable and #860 and #5978 are closed.

**No: Prisma ORM 7.10.**
- **It is mid-rewrite.**
  - `npm i prisma` now installs 8.0.0-rc.17, while `@prisma/client@latest` is still 7.10.0.
  - The unversioned docs describe Prisma 8.
  - Prisma 7 is promised support for twelve months from 2026-03-04.
- **Its schema language cannot express** generated columns, CHECK constraints, HNSW indexes or EXCLUDE constraints.
- **Hand-written additions fight the diff.** After I hand-edited the migration, `migrate diff` wanted to drop our HNSW index.
- **Constraint errors are poorly surfaced.** A CHECK violation came back as P2039, a code missing from the v7 error reference.
- **It reaches outside npm.** Installing downloaded a 23.5 MB engine from `binaries.prisma.sh`, and every CLI command called `checkpoint.prisma.io`.
- **It is heavy:** the lab install was 363 MB.

**Migrations: dbmate 2.36, plus Squawk and three CI checks:**
- merged migrations are unchanged;
- a schema-dump diff;
- `kysely-codegen --verify`.

Runner-up: graphile-migrate. It detects edited migrations, but its stable 1.4.1 dates from 2022 and 2.0 has been a release candidate since 2024.

**Queue: pg-boss 12.35**, with the guardrails in "Job queue". Runner-up: graphile-worker 0.18. A hand-written queue is not worth it.

Confidence:
- **High** that Prisma and Drizzle are the wrong choices today.
- **Medium-high** for Kysely over plain SQL. The margin is compile-time checking and safe composition of dynamic search filters.
- **Medium** for pg-boss over graphile-worker.

## Comparison table

Versions are as of 2026-09-27. "Lab" means observed in this pass's Docker lab.

| | postgres.js (raw SQL) | node-postgres `pg` (raw SQL) | **Kysely + pg** | Drizzle ORM + Drizzle Kit | Prisma ORM |
|---|---|---|---|---|---|
| Latest stable | 3.4.9 (2026-04-05) | 8.23.0 (2026-08-08) | 0.29.6 (2026-09-16); 0.30.0-beta.2 | 0.45.3 / Kit 0.31.11 (2026-09-21); 1.0.0-rc.4 (2026-06-27) | 7.10.0 (2026-08-25); `prisma@latest` is 8.0.0-rc.17 (2026-09-24) |
| Full-text, trigram, pgvector operators | SQL | SQL | `sql` template, typed by assertion | `sql` template. The pgvector column type and distance helpers are built in | Only through `$queryRaw` or TypedSQL. `tsvector` and `vector` are `Unsupported` and invisible to the client |
| CTE, window, JSONB, FILTER, row tuples | SQL | SQL | Built in: `with`, `over`, `ref(col,'->>').key()`, `filterWhere`, `refTuple`/`tuple` (lab) | CTEs built in. FILTER and row tuples need `sql` (lab) | Not in the client API: `groupBy` has no FILTER, and cursor pagination works differently. TypedSQL instead |
| ON CONFLICT … RETURNING | SQL | SQL | `onConflict(oc => oc.columns([...]).doNothing())` + `returning` (lab) | `onConflictDoNothing({ target })` + `returning` (lab) | `createManyAndReturn({ skipDuplicates })` emits `ON CONFLICT DO NOTHING` **with no target**, so it swallows every unique violation (lab) |
| SKIP LOCKED, advisory locks | SQL | SQL | `forUpdate().skipLocked()`; locks through `sql` (lab) | `.for('update', { skipLocked: true })`; locks through `sql` (lab) | Raw SQL only |
| Schema features (generated, CHECK, EXCLUDE, partial, expression, HNSW) | Anything, in SQL migrations | Same | The schema builder has generated `.stored()`, CHECK, partial and expression indexes; types, operator classes and EXCLUDE need `sql`. **We use SQL migrations instead** | Generated, CHECK, partial, expression and HNSW in TypeScript; EXCLUDE and extensions need custom SQL | Partial indexes (preview). No generated columns (#6336, open since 2021), no CHECK (#3388, since 2019), no HNSW, no EXCLUDE |
| Where types come from | Hand-written generics, unchecked | Same | The live database, through kysely-codegen; `sql<T>` is asserted | The TypeScript schema; `sql<T>` is asserted | `schema.prisma`. TypedSQL takes types from the database, with conservative nullability |
| Own migration tool | None | None | TypeScript files; all pending run in one transaction; no checksums | Generated SQL; one transaction; **no CONCURRENTLY; edits and failures go unreported** (lab) | Generated SQL with checksums and a shadow-database drift check; unsupported features must be hand-edited, then fought by the diff (lab) |
| Error code and constraint name | `PostgresError.code`, `.constraint_name` (lab) | `DatabaseError.code`, `.constraint` (lab) | Same as pg (lab) | The driver error is wrapped in `DrizzleQueryError.cause` (lab) | P2002 and P2003 keep the name in `meta.driverAdapterError.cause.constraint.index`. A CHECK violation gives P2039 with the name only in the message text (lab) |
| Values: bigint, numeric, timestamptz, arrays, jsonb, vector | string, string, Date, array, object, `'[…]'` string (lab) | Same, until you override the type parsers | As pg; int8 mapped to number with a parser (lab) | number or bigint (per-column mode), string, Date, array, typed through `$type<T>()`, `number[]` (lab) | `bigint`, Decimal.js object, Date, array, `JsonValue`, not readable (lab) |
| Next.js 16.3.5 with Cache Components | Bundled; works (lab) | On Next's built-in external list | Works; pg is external (lab) | Bundled; works (lab) | External; works, but a Decimal came back as a **string** after `'use cache'` while still typed as Decimal (lab) |
| Pool and prepared statements (lab) | Own pool (default max 10); named prepared statements, automatic | Pool; unnamed statements unless a `name` is given | pg Pool; unnamed | The driver's pool; queries went through postgres.js `unsafe()`, unnamed | pg Pool through the adapter; unnamed |
| Test isolation | `sql.begin` | BEGIN / ROLLBACK | `startTransaction()` plus savepoints | `db.transaction` | Interactive transactions; TypedSQL generation needs a live database in CI |
| Activity in 2026 | 2 releases, 8 commits, 311 open issues, 1 maintainer | 7 minor releases, 531 open issues | 14 releases plus 0.30 betas, 177 open issues | Very active; PlanetScale hired the core team in March 2026; the 1.0 RC has stalled since June; 2,072 open issues | Very active; mid-rewrite to Prisma 8; repository renamed `prisma/orm`; 2,656 open issues |
| Agent resources | README only | None | llms.txt and llms-full (310 KB), regenerated on every push | llms.txt and a 3.7 MB llms-full, but the docs install `@rc` | llms.txt, an official skills repository and an AI-agent guard; the docs are split between v7 and v8 |
| Install size, on disk (lab) | 408 KB, 1 package | 164 KB plus 12 small packages | kysely 3.5 MB (plus pg); kysely-codegen 1.4 MB (dev) | drizzle-orm 17 MB; drizzle-kit 9.9 MB (dev) | client 72 MB, CLI 41 MB, engines 24 MB, studio-core 43 MB; the lab tree was 363 MB |
| Outside npm, telemetry (lab) | None | None | None | None (Studio loads its UI from local.drizzle.studio, per its docs) | `binaries.prisma.sh` at install; `checkpoint.prisma.io` on every CLI command |
| **Verdict** | Runner-up | Driver under Kysely | **Winner** | Not now | No |

Other libraries, briefly. Sub-pass B desk research; none were in the lab.

| Library | Types from | Status in 2026 | Verdict |
|---|---|---|---|
| MikroORM 7.2.1 | Entity definitions | Very active. Since 7.0, "Kysely is now used as the query runner" (Martin Adámek, 2026-03-11). | No: a unit-of-work ORM, and the search, facet and queue SQL would bypass it |
| TypeORM 1.1.1 (1.0 on 2026-05-19) | Entity classes | New maintainer team; 676 open issues. Broadest DDL support (tsvector, vector, `@Check`, `@Exclusion`), but query fragments are strings | No |
| Slonik 49.10 | A Zod schema per query, checked at run time | Active; 1 maintainer; the best error classes (`constraint`, `table`, `detail`) | Possible, but a Zod schema per query |
| PgTyped 2.4.3 | The database describes each query | "version 2.x is in maintenance mode"; no release since 2025-03 | No |
| Zapatos 6.6.1 | Introspection | No release in 2026 | No |
| sqlc TypeScript plugin 0.1.3 | sqlc parses the schema and the queries | Plugin untouched since 2024; "Here be dragons!" | No |
| SafeQL 5.4.1 | The live database at lint time | Active; its postgres.js plugin is experimental | Add-on for the runner-up |
| kysely-codegen 0.20 / kanel-kysely 4.0 | Introspection | kysely-codegen has one maintainer and 80 open issues; kanel is active | kysely-codegen with the winner |

## Lab

### Setup

- **Software.** PostgreSQL 17.11 with pgvector 0.8.6 (`pgvector/pgvector:pg17`) and pg_trgm 1.6. Node 22.14, TypeScript 5.9.3 (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), tsx.
- **Versions:** postgres 3.4.9; drizzle-orm 0.45.3 with drizzle-kit 0.31.11; kysely 0.29.6 with pg 8.23.0 and kysely-codegen 0.20.0; prisma, @prisma/client and @prisma/adapter-pg 7.10.0.
- **Schema.** Each library had its own database with the same tables:
  - `sources`.
  - `snapshots`: unique `(source_id, content_hash)`, jsonb payload.
  - `listings`:
    - Columns: bigint identity; `price_toman bigint` with `CHECK (price_toman > 0)`; `deal_score numeric(5,2)`; `deal_rating` with a CHECK list; `text[]` photos; jsonb attributes; `vector(3)` embedding.
    - A generated `tsvector` column: `to_tsvector('simple'::regconfig, title || ' ' || description)`.
    - Indexes: GIN on the tsvector, trigram GIN, HNSW, and btree on `(deal_score desc, id desc)`.
  - `jobs`: a partial index `WHERE status = 'queued'`.
- **Fixtures.** The same 10 listings from Bama, Karnameh and Khodro45, and 4 jobs.
- **The five operations:**
  1. Insert a snapshot with `ON CONFLICT DO NOTHING RETURNING`.
  2. Full-text search with optional make and price filters, best deal first, and keyset pagination on `(deal_score, id)`.
  3. Facet counts with `count(*) FILTER`.
  4. Dequeue a job with `FOR UPDATE SKIP LOCKED`. The test held one claimed job open in a transaction while a second call claimed the next one.
  5. Insert a duplicate listing, a zero price and an unknown source, and map 23505, 23514 and 23503 to domain results by constraint name.
- **Evidence capture.** SQL came from `log_statement = all` on the server plus each library's logger. Network activity came from a Node preload that logs every DNS lookup and TCP connect, plus `strace -e connect`.
- **Result.** All five operations gave identical results in all four libraries:
  - the same rows and pages;
  - the same facet counts (پژو 4 / great 1 / under one billion 3);
  - the second worker got job 1 while the first held job 2;
  - all three violations were recognised.

### Numbers

| | postgres.js | Drizzle | Kysely | Prisma |
|---|---|---|---|---|
| Schema definition (non-blank lines) | 59 SQL | 65 TS + 2 custom SQL | 67 TS with 19 `sql` fragments (or plain SQL under dbmate) | 78 PSL + 8 hand-edited SQL lines |
| The five operations | 81 | 73 (11 `sql` fragments) | 75 (6 `sql` fragments) | 34 TS + 27 SQL in 3 TypedSQL files |
| Setup and config | 7 | 24 | 57 (including a 20-line migration runner that dbmate makes unnecessary) | 15 |
| Generated artefacts | none | 60-line SQL migration plus JSON snapshots | 69-line `db-types.ts` | 8,892-line generated client |
| Raw SQL needed | everything (by design) | search predicate and rank, FILTER, keyset tuple, `now()`, `attempts + 1` | search predicate and rank, `now()` | whole queries for search, facets and dequeue; embedding writes |
| Lab `node_modules` (all include TypeScript 23 MB + tsx) | 38 MB | 85 MB | 55 MB | 363 MB |

Latency is indicative only: one connection, 2,000 sequential runs after 200 warm-ups, a 10-row table, statement logging on, and other labs sharing the machine.

| | p50 | p95 |
|---|---|---|
| postgres.js, listing by id | 0.160 ms | 0.598 ms |
| postgres.js, search page | 0.245 ms | 0.382 ms |
| Kysely, listing by id | 0.279 ms | 0.924 ms |
| Kysely, search page | 0.315 ms | 1.080 ms |
| Drizzle, listing by id | 0.415 ms | 1.668 ms |
| Drizzle, listing by id with `.prepare()` | 0.274 ms | 0.735 ms |
| Drizzle, search page | 0.399 ms | 1.539 ms |
| Prisma, `findUnique` | 0.492 ms | 1.790 ms |
| Prisma, search page (TypedSQL) | 0.486 ms | 1.913 ms |

The differences are a few tenths of a millisecond per query, so speed does not decide this.

### postgres.js (baseline)

```ts
export async function searchListings(i: { q: string; make?: string; maxPriceToman?: number;
  after?: { dealScore: string; id: string }; limit: number }) {
  const query = sql`websearch_to_tsquery('simple', ${i.q})`;
  return sql<ListingCard[]>`
    SELECT id, title, make, model, model_year_jalali, city, price_toman, deal_score, deal_rating,
           ts_rank(search_vector, ${query}) AS rank
    FROM listings
    WHERE search_vector @@ ${query}
      ${i.make ? sql`AND make = ${i.make}` : sql``}
      ${i.maxPriceToman ? sql`AND price_toman <= ${i.maxPriceToman}` : sql``}
      ${i.after ? sql`AND (deal_score, id) < (${i.after.dealScore}::numeric, ${i.after.id}::bigint)` : sql``}
    ORDER BY deal_score DESC, id DESC
    LIMIT ${i.limit}`;
}
// operation 5
} catch (e) {
  if (e instanceof postgres.PostgresError) {
    if (e.code === '23505' && e.constraint_name === 'listings_source_id_source_listing_id_key')
      return { ok: false as const, reason: 'duplicate' as const };
    if (e.code === '23514' && e.constraint_name === 'listings_price_toman_positive')
      return { ok: false as const, reason: 'invalid_price' as const };
```

The SQL sent is the SQL written. Friction:
- `ListingCard` is whatever the author declares. `price_toman` arrives as the string `"850000000"`, because postgres.js returns bigint "as a string" for JSON safety, and a wrong declaration would still compile.
- `vector` values come back as the text `'[0.1,0.2,0.3]'`.
- Snake-to-camel conversion needs `transform: postgres.camel`.
- Transaction handles have their own type (`TransactionSql`), so shared functions take a union.

### Drizzle 0.45.3 / Drizzle Kit 0.31.11

```ts
searchVector: tsvector().generatedAlwaysAs((): SQL =>
  sql`to_tsvector('simple'::regconfig, ${listings.title} || ' ' || ${listings.description})`),
// …
index('listings_deal_score_id_idx').on(t.dealScore.desc(), t.id.desc()),

// operation 2
return db.select({ /* columns */ rank: sql<number>`ts_rank(${listings.searchVector}, ${query})` })
  .from(listings)
  .where(and(
    sql`${listings.searchVector} @@ ${query}`,
    i.make ? eq(listings.make, i.make) : undefined,
    i.maxPriceToman ? lte(listings.priceToman, i.maxPriceToman) : undefined,
    i.after ? sql`(${listings.dealScore}, ${listings.id}) < (${i.after.dealScore}::numeric, ${i.after.id}::bigint)` : undefined))
  .orderBy(desc(listings.dealScore), desc(listings.id)).limit(i.limit);
// operation 5
const cause = e instanceof DrizzleQueryError ? e.cause : e;   // the PostgresError is wrapped
```

Generated SQL for the dequeue:

```sql
with "next" as (select "id" from "jobs" where ("jobs"."queue" = $1 and "jobs"."status" = $2
  and "jobs"."run_at" <= now()) order by "jobs"."priority" desc, "jobs"."run_at" limit $3 for update skip locked)
update "jobs" set "status" = $4, "attempts" = "jobs"."attempts" + 1, "locked_at" = now()
from "next" where "jobs"."id" = "next"."id" returning "jobs"."id", "jobs"."payload", "jobs"."attempts"
```

Migration: `drizzle-kit generate` produced clean, reviewable SQL with `--> statement-breakpoint` markers.
- Extensions needed a `--custom` migration.
- Foreign keys are named `listings_source_id_sources_id_fk`, not PostgreSQL's `…_fkey`.
- The index became `("deal_score" DESC NULLS LAST,"id" DESC NULLS LAST)`.
- `drizzle-kit migrate` ran every pending file inside one `begin … commit` and recorded a sha256 hash per file.

Friction, all reproduced:
1. **The index cannot serve the query it was built for.** `EXPLAIN` of `ORDER BY deal_score DESC, id DESC LIMIT 2` gave `Sort → Bitmap Heap Scan` on the Drizzle database. The same query with a plain `DESC` index gave `Index Only Scan`.
   - PostgreSQL documents that "NULLS FIRST is the default for ORDER BY DESC", so a `DESC NULLS LAST` index does not match.
   - Open issue #5978 (2026-07-02) describes the same trap and reproduces it on 1.0.0-rc.4.
2. **`CREATE INDEX CONCURRENTLY` cannot run.** `.concurrently()` generates it, but migrate wraps it in the shared transaction, and PostgreSQL returns `CREATE INDEX CONCURRENTLY cannot run inside a transaction block`. Issue #860 has been open since 2023-07-04.
3. **That failure was silent.** The CLI exited 1 and printed only two `NOTICE` objects and a spinner, with no error text on stdout or stderr. Issues #5521 (2026-03-21) and #6121 (2026-08-10) report the same.
4. **Edits to applied migrations are not detected.** I added a column to the already-applied `0001_initial.sql`. `migrate` printed "migrations applied successfully!", `drizzle-kit check` printed "Everything's fine 🐶🔥", and the column was never created.
   - Issue #5769 describes a related silent skip of pending migrations: "The skip is silent — no log, no warning, no non-zero exit."
5. **Queries are not server-side prepared.** They go through postgres.js's `unsafe()` path; the server log showed unnamed statements.
6. **The docs target 1.0.** Drizzle's pages already use 1.0 APIs (for example `getColumns`, "requires drizzle-orm@1.0.0-beta.2"), while `npm i drizzle-orm` installs 0.45.3.

### Kysely 0.29.6 on pg 8.23.0

```ts
// operation 2: dynamic filters stay typed
const query = sql`websearch_to_tsquery('simple', ${i.q})`;
return db.selectFrom('listings')
  .select(['id', 'title', 'make', 'model', 'model_year_jalali', 'city', 'price_toman', 'deal_score', 'deal_rating'])
  .select(sql<number>`ts_rank(search_vector, ${query})`.as('rank'))
  .where(sql<boolean>`search_vector @@ ${query}`)
  .$if(i.make !== undefined, (qb) => qb.where('make', '=', i.make!))
  .$if(i.maxPriceToman !== undefined, (qb) => qb.where('price_toman', '<=', i.maxPriceToman!))
  .$if(after !== undefined, (qb) => qb.where(({ eb, refTuple, tuple }) =>
    eb(refTuple('deal_score', 'id'), '<', tuple(after!.dealScore, after!.id))))
  .orderBy('deal_score', 'desc').orderBy('id', 'desc').limit(i.limit).execute();

// operation 3: FILTER without raw SQL
.select((eb) => ['make',
  eb.cast<number>(eb.fn.countAll(), 'integer').as('total'),
  eb.cast<number>(eb.fn.countAll().filterWhere('deal_rating', '=', 'great'), 'integer').as('great'),
  eb.cast<number>(eb.fn.countAll().filterWhere('price_toman', '<', 1_000_000_000), 'integer').as('under_one_billion')])

// operation 4
return executor
  .with('next', (qc) => qc.selectFrom('jobs').select('id')
    .where('queue', '=', queue).where('status', '=', 'queued').where('run_at', '<=', sql<Date>`now()`)
    .orderBy('priority', 'desc').orderBy('run_at').limit(1).forUpdate().skipLocked())
  .updateTable('jobs').from('next')
  .set((eb) => ({ status: 'running', attempts: eb('attempts', '+', 1), locked_at: sql<Date>`now()` }))
  .whereRef('jobs.id', '=', 'next.id')
  .returning(['jobs.id', 'jobs.payload', 'jobs.attempts']).executeTakeFirst();

// operation 5
if (e instanceof pg.DatabaseError && e.code === '23505' && e.constraint === 'listings_source_id_source_listing_id_key') …
```

Generated SQL, which reads like the code:

```sql
select "make", cast(count(*) as integer) as "total",
       cast(count(*) filter(where "deal_rating" = $1) as integer) as "great",
       cast(count(*) filter(where "price_toman" < $2) as integer) as "under_one_billion"
from "listings" where search_vector @@ websearch_to_tsquery('simple', $3)
group by "make" order by "total" desc, "make"
```

An extra check went beyond the five operations. It used a window function, JSONB, a trigram operator, pgvector and an advisory lock. It compiled and ran, and the inferred type included `gearbox: string | null` for `attributes->>'gearbox'`.

```sql
select "id", "model", "price_toman", rank() over(partition by "model" order by "price_toman" asc) as "price_rank_in_model",
  "attributes"->>'gearbox' as "gearbox", similarity(title, $1) as "trgm", embedding <=> $2::vector as "cosine_distance"
from "listings" where title % $3 order by "cosine_distance" limit $4
```

kysely-codegen read the migrated database in under 0.2 s and produced a 69-line `db-types.ts`.
- With `typeMapping: { int8: "number" }` plus a `pg` int8 parser with a safe-integer guard, ids and prices are numbers.
- `overrides` turn the CHECK-listed `deal_rating` into a union, type the JSONB attributes, and mark identity and generated columns `GeneratedAlways`.
- `kysely-codegen --verify` printed "Generated types are up-to-date!"
- It connected to nothing but the database.

Friction:
- Before the mapping, `where('price_toman', '<=', 900_000_000)` failed type-checking, because int8 is a string by default. Correct, but it needs to be configured.
- By default, codegen types generated-always columns as insertable (`Generated<…>`). The override fixes this.
- `vector` is a string.
- The Kysely `Migrator` needed 19 `sql` fragments for types, defaults, the generated expression, CHECKs and operator classes. It runs all pending migrations in one transaction under an advisory lock and stores only names. One more reason to write migrations in SQL.
- `ReadonlyKysely<DB>` rejected an insert with "not allowed with a read-only Kysely instance." at compile time (lab).

### Prisma ORM 7.10.0 (Rust-free client, `@prisma/adapter-pg`)

```prisma
embedding    Unsupported("vector(3)")?
searchVector Unsupported("tsvector")? @default(dbgenerated()) @map("search_vector")
@@index([title(ops: raw("gin_trgm_ops"))], map: "listings_title_trgm_idx", type: Gin)
@@index([queue, priority(sort: Desc), runAt], map: "jobs_ready_idx", where: { status: "queued" })
```

```sql
-- prisma/sql/searchListings.sql (TypedSQL: optional filters must be written as catch-all predicates)
-- @param {String} $1:q
-- @param {String} $2:make?
-- @param {BigInt} $3:maxPriceToman?
WHERE search_vector @@ websearch_to_tsquery('simple', $1)
  AND ($2::text IS NULL OR make = $2)
  AND ($3::bigint IS NULL OR price_toman <= $3)
  AND ($4::numeric IS NULL OR (deal_score, id) < ($4, $5::bigint))
```

TypedSQL generated `{ id: bigint; …; price_toman: bigint; deal_score: Decimal; deal_rating: DealRating; rank: number | null }`. The facets query came out as `total: number | null`, even though the value can never be null.

`migrate dev --create-only` produced:
- `"search_vector" tsvector,` with no generated expression;
- no CHECK constraints and no HNSW index;
- `SERIAL`/`BIGSERIAL` instead of identity columns;
- unique constraints as unique indexes;
- a PostgreSQL enum type;
- `ON UPDATE CASCADE` on foreign keys;
- a **nullable** `photos TEXT[]`, although the client types it as non-null.

I hand-edited 8 lines, and it applied. After that, `prisma migrate diff --from-config-datasource --to-schema` printed only `DROP INDEX "listings_embedding_idx";`. Every future `migrate dev` would propose dropping the HNSW index. This matches open issue #27770, "Trying to create custom hnsw index but prisma drops it".

Friction:
1. **Three of the five operations are raw SQL files.** Embeddings can only be written with `$executeRaw`.
2. **The snapshot insert has no conflict target.** `createManyAndReturn({ skipDuplicates: true })` sent `ON CONFLICT DO NOTHING` without one, and `fetched_at` carried the Node process's clock, not the database's `now()`. Prisma fills `@default(now())` in the client.
3. **Constraint errors are uneven.**
   - The duplicate came back as `P2002` with the constraint under `meta.driverAdapterError.cause.constraint.index`.
   - The unknown source came back as `P2003`.
   - The CHECK violation came back as **`P2039`**. That code is absent from the v7 error reference, which jumps from P2037 to P3000. It was added in April 2026 to "surface unmapped driver errors as user-facing P2039" (PR #29512), and the constraint name exists only inside `originalMessage`.
4. **Prisma's own tooling was hard to run in an agent's non-interactive shell.** `prisma migrate dev` stalled with no output after its shadow-database diff until I killed it (90–120 s); only `migrate diff` showed why.
5. **A Decimal changes type across the cache.** A `Decimal` returned from a `'use cache'` function arrived as the string "91.5" (see the smoke test).
6. **The CLI reaches outside npm.**
   - The CLI install ran a postinstall that fetched `schema-engine` (23,510,888 bytes, an ELF binary) from `binaries.prisma.sh` into `node_modules/@prisma/engines` and `~/.cache/prisma`.
   - `migrate dev`, `migrate dev --create-only` and `generate --sql` each contacted `checkpoint.prisma.io`.
7. **Unpinned installs pull the RC.** `@prisma/client` declares `prisma` as an optional peer, and `npm i prisma` without a version installs the 8.0 release candidate.

### Next.js 16.3.5 smoke test

- **Setup.** A scratch app (Turbopack, `cacheComponents: true`) with one page per library. Each page calls the search query inside a `'use cache'` function under `<Suspense>`, with clients held on `globalThis`.
- **Build and serve.** `next build` compiled in 3.8 s and prerendered all four pages. `next start` served the correct Persian titles for each.
- **Values after the `'use cache'` boundary:**
  - postgres.js: id, price and score were strings.
  - Drizzle and Kysely: id and price were numbers, the score a string.
  - Prisma: id and price were `bigint`, and `deal_score` was the string `"91.5"` while its TypeScript type still said `Decimal`.
- **Consequence.** Inference: Flight serialisation used Decimal's `toJSON`. So query functions must return plain DTOs, as ADR-0004 already requires. Code that trusts the type (`deal_score.toFixed(2)`) would fail at run time.
- **Bundling.** Next.js 16.3.5 lists `pg`, `prisma` and `@prisma/client` in its built-in `serverExternalPackages`. postgres.js, Drizzle and Kysely were bundled without trouble.

### Findings that apply to every library

1. **Parameterised literals can hide partial indexes.** Every builder sent `status = 'queued'` as a bound parameter (`status = $2`).
   - Under a generic plan (`plan_cache_mode = force_generic_plan`, `enable_seqscan = off`), the parameterised form could not use `jobs_ready_idx … WHERE status = 'queued'` and fell back to a sequential scan. The literal form used the index.
   - PostgreSQL may switch a named prepared statement to a generic plan after five executions "if its cost is not so much higher than the average custom-plan cost…".
   - Unnamed statements (pg, Kysely, Prisma) are planned per execution with the values, so the risk applies mainly to named ones (postgres.js).
   - Rule: write partial-index predicates as literals.
2. **Constraint names are part of the contract.** Defaults differ: PostgreSQL uses `listings_source_id_fkey`, Drizzle `listings_source_id_sources_id_fk`, and Prisma writes uniques as indexes. Name every constraint explicitly in the migration.
3. **An index and its query must agree on direction and NULLS placement.** The Drizzle trap can be written by hand too. Check with `EXPLAIN`.

## Migrations

Sub-pass A tested dbmate, graphile-migrate, node-pg-migrate and Squawk in its own lab, and read Atlas, Drizzle Kit and Prisma Migrate from the docs and source. I tested Drizzle Kit, Prisma Migrate and Kysely's Migrator above.

| Tool | Format | Outside a transaction (CONCURRENTLY) | Edited applied migration | Drift | Down | Outside npm / telemetry | 2026 activity |
|---|---|---|---|---|---|---|---|
| **dbmate 2.36.0** | Plain SQL, `-- migrate:up` / `-- migrate:down` | `transaction:false` per file, one statement per file (lab) | Not detected: "dbmate only stores the version number, not the contents" | `db/schema.sql` from the host's `pg_dump`, skipped silently if the dump fails (lab) | Yes | Go binary through npm optionalDependencies; no install scripts, no telemetry | 15 releases, 7.4k stars |
| graphile-migrate 1.4.1 (2.0.0-rc.5) | Plain SQL; `current.sql` plus hash-chained `committed/` | `--! no-transaction`; "migrations must contain exactly one statement" | Detected on a fresh replay (`Hash … does not match … has the file been tampered with?`), not by `migrate` on a migrated database (lab) | Shadow-database replay on every `commit` | No | None | Stable release 2022-12-20; release candidates in 2026 |
| node-pg-migrate 9.0.0 | JS/TS builder or `.sql` | Only `pgm.noTransaction()` in JS/TS; `.sql` files cannot opt out (lab) | Not detected | None | Yes | None | 9.0.0 on 2026-07-17 |
| Atlas | SQL plus `atlas.sum` | `-- atlas:txmode none` | `atlas.sum` checksum | Lint and drift need Pro and a login (since v0.38) | Pro only | Downloads from atlasbinaries.com and release.ariga.io; telemetry on by default | Active |
| Drizzle Kit 0.31.11 | Generated SQL | **Impossible** (lab, #860) | **Not detected** (lab) | `check` covers the history only | No | None | 1.0 RC since 2026-04 |
| Prisma Migrate 7.10 | Generated SQL | Needs its own migration file (docs) | Checksum: `dev` offers a reset, `deploy` warns | Shadow database in `dev` | No | `binaries.prisma.sh`, `checkpoint.prisma.io` (lab) | Replaced in Prisma 8 by `migration.ts` plus `ops.json` |
| Kysely Migrator 0.29.6 | TypeScript | `disableTransactions` for the whole run only | Not detected (names only) | None | Yes | None | – |

Findings:

- **The CONCURRENTLY trap applies to every SQL-file tool.** Even with dbmate's `transaction:false` or graphile-migrate's `--! no-transaction`, a file holding `CREATE EXTENSION pg_trgm` and a `CREATE INDEX CONCURRENTLY` failed with `25001`. PostgreSQL runs a multi-statement simple query "as a single transaction". It worked only once the index was alone in its file (lab, sub-pass A).
- **dbmate's log misleads on failure.** For the failing no-transaction migration it printed `Applied: …` and then the error, even though the migration had been rolled back and was absent from `schema_migrations`.
- **dbmate's schema dump can be skipped silently.** Its dump uses the host's `pg_dump`. A 16-versus-17 version mismatch aborted the dump without failing `up`. Run the dump in a `postgres:17` container in CI.
- **Squawk 2.66.0 is a 25 MB binary through optionalDependencies, with no network use.**
  - Three risky files produced 14 findings: `require-concurrent-index-creation`, `constraint-missing-not-valid`, `adding-field-with-default`, `changing-column-type`, `require-lock-timeout`, `require-statement-timeout`, `prefer-robust-stmts`.
  - Use a `.squawk.toml` with `pg_version = "17.0"` and `assume_in_transaction = true`, plus one `squawk-ignore` in each no-transaction file.
  - There is a GitHub Action (`sbdchd/squawk-action`) and a pre-commit hook.
  - Squawk lints SQL files, so it covers dbmate, graphile-migrate, Drizzle Kit and Prisma 7 output.

Recommendation: **dbmate 2.36 with Squawk 2.66**. Confidence: high on the facts, medium on the pick. The CI rules:
1. Migrations are plain SQL and immutable once merged. CI fails if `git diff --diff-filter=MD origin/main -- db/migrations` is not empty.
2. CI replays every migration on a fresh PostgreSQL 17 with pgvector, dumps the schema in a matching container, and requires `git diff --exit-code db/schema.sql`.
3. CI runs `kysely-codegen --verify` against the replayed database.
4. Every `CREATE INDEX CONCURRENTLY` or `VALIDATE CONSTRAINT` sits alone in a `transaction:false` file. Constraints are added `NOT VALID` first and validated in a later file.
5. Every DDL migration sets `lock_timeout`.
6. Squawk runs in pre-commit and CI.

## Job queue

Sub-pass A ran pg-boss 12.35.0, graphile-worker 0.18.0 and a hand-written SKIP LOCKED queue against PostgreSQL 17.

| | pg-boss 12.35.0 | graphile-worker 0.18.0 | Hand-written SKIP LOCKED |
|---|---|---|---|
| Retries | `retryLimit` and `retryBackoff` with jitter (lab: 2.0 s, 4.0 s, 7.0 s, then `failed`) | `maxAttempts` (default 25), `exp(least(10, attempt))` s (lab) | Build it |
| Crashed worker | `expireInSeconds` (default 900) plus optional heartbeat | Jobs "remain locked for at least 4 hours"; faster recovery only in the paid Worker Pro | Lease plus a reaper |
| Dead letters | `deadLetter` queue (lab) | None; the failed row keeps `last_error` | Build it |
| Scheduling and cron | `startAfter`; cron with `tz` (Asia/Tehran ran in the lab) | `runAt`; crontab in UTC only | Build it |
| Dedup | `singletonKey`, but it did **not** dedupe on a standard queue (lab) | `jobKey` (lab: one row) | Partial unique index |
| Per-source concurrency | `localGroupConcurrency: 1` held exactly (lab); the global `groupConcurrency` reached 3 against a limit of 1 ("may be … slightly exceeded during race conditions") | A named queue per source gives exactly one at a time (lab), but no N > 1 | Slot table worked (lab); a naive count check allowed 8 against 1 |
| Wake-ups | LISTEN/NOTIFY opt-in (15 ms pickup), otherwise 2 s polling | LISTEN/NOTIFY always (6 ms) | Build it |
| Enqueue in our transaction | `fromKysely(trx)` adapter or the `db` option (lab: rollback removed the job) | SQL `graphile_worker.add_job` in any transaction (lab) | Native |
| Payload types | `work<T>`, but `send()` accepts any object | Declaration merging; a misspelled field failed `tsc` (lab) | Yours |
| Install and runtime | 8.8 MB, 23 packages, Node ≥ 22.12 | 13 MB, 68 packages, Node ≥ 22.18 (ran on 22.14) | pg only |
| Activity | 58 releases in 2026; one main maintainer | 0.17 to 0.18 in 2026; one main maintainer | – |

Recommendation: **pg-boss 12** (confidence: medium).

Why:
- Carshenas will run one worker process, and in one process `localGroupConcurrency` gives an exact per-source cap.
- The open-source version includes dead letters, expiry and heartbeat recovery.
- Cron takes a time zone.
- Completed jobs are kept for 7 days.
- `fromKysely` enqueues follow-up jobs in the same transaction as the snapshot insert.

Guardrails:
- With `notify: true`, set a short backstop poll or `burstWhenReadyExceeds`. With the defaults, a backlog drained 4 jobs per 30 s.
- Do not rely on `singletonKey` outside a singleton or throttled queue.
- Implement ADR-0008's stop-on-403, 429 or challenge as a per-source pause that handlers check before fetching.
- Wrap `send()` in a helper keyed by queue name, so payloads are typed.
- If several worker processes ever need a hard cap, move to a slot table.

Runner-up: **graphile-worker**. It is simpler and faster, and it has exact serial lanes, typed payloads and enqueueing from SQL. Its weaknesses are the four-hour lock after a crash and UTC-only cron.

A hand-written queue would need about 500–900 lines and tests (inference): leases, backoff, dead letters, cron with leader election, notify with reconnect, slot caps, graceful shutdown and retention. The core statement is simple, and the lab proved it (8 workers, 80 jobs, zero duplicate claims):

```sql
WITH next AS (
  SELECT id FROM jobs
  WHERE state = 'queued' AND run_at <= now()
  ORDER BY priority DESC, run_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED)
UPDATE jobs j SET state = 'running', attempts = j.attempts + 1,
       locked_by = $1, locked_until = now() + interval '5 minutes'
FROM next WHERE j.id = next.id
RETURNING j.*;
```

Suggested layout for Carshenas:
- **Crawl:** one queue grouped by `sourceId` with `localGroupConcurrency: N`. Politeness delays through `sendAfter`.
- **Extract:** its own queue, with concurrency sized to the LLM provider's limit.
- **Revalue:** a nightly schedule with `tz: 'Asia/Tehran'`.
- **Index:** unnecessary if search stays in PostgreSQL.

## Iran reachability and telemetry

Every option needs the npm registry, so it is not a differentiator.
- This lab reached `registry.npmjs.org` (Cloudflare addresses), with two install timeouts and no IPv6 route.
- I did not check where the lab machine is.
- Whether the registry and Docker Hub (the `pgvector/pgvector` image) are reachable from the production host inside Iran belongs to CS-23. It is not verified here.

| Component | Contacted beyond the npm registry | Telemetry | Override |
|---|---|---|---|
| Kysely, pg, kysely-codegen (winner) | Nothing. Codegen connected only to the database (lab); no install scripts (npm metadata) | None | – |
| dbmate, squawk-cli | Nothing: platform binaries are npm optionalDependencies, with no install scripts (npm metadata) | None | – |
| pg-boss, graphile-worker | Nothing | None | – |
| postgres.js | Nothing (lab) | None | – |
| Drizzle ORM and Drizzle Kit | Nothing during install, generate or migrate (lab). Studio's interface is hosted at `local.drizzle.studio` (docs) | None found in the bundle (sub-pass B; medium-high confidence) | – |
| Prisma 7.10 | `binaries.prisma.sh` at install (the postinstall of `@prisma/engines`; lab), and again later if the engine is missing (inference) | `checkpoint.prisma.io` on every CLI command (lab) | `CHECKPOINT_DISABLE=1`, `PRISMA_ENGINES_MIRROR`, `PRISMA_SCHEMA_ENGINE_BINARY` |
| Prisma 8 RC | No engine download found (sub-pass B) | Anonymous usage data, on by default, sent to a `prisma.build` endpoint | `prisma telemetry disable`, `DO_NOT_TRACK=1` |
| Atlas | `atlasgo.sh`, `atlasbinaries.com`, `release.ariga.io`, `vercheck.ariga.io` | On by default | `ATLAS_NO_ANON_TELEMETRY=true` |
| sqlc TypeScript plugin | WASM plugin from `downloads.sqlc.dev` | – | Host the file yourself (inference) |
| Next.js | – | On by default | `NEXT_TELEMETRY_DISABLED=1` |

Note on pnpm 10, which this repo uses: it skips dependency build scripts unless they are allowed. Prisma's postinstall would not run, and the engine would be fetched on first use (inference).

## How coding agents should use the winner (rules to adopt)

These rules are written for `.claude/rules/` and the database skill. Mechanical enforcement is noted where possible.

**Where the code lives**

1. **One database module per process.**
   - `src/server/db.ts` (`import 'server-only'`) creates one `pg.Pool` and one `Kysely<DB>`. The pool gets an explicit `max`, an `application_name`, and a `statement_timeout` through `options`.
   - In development the instance is cached on `globalThis`, to survive hot reload.
   - Nothing else imports `pg` or constructs `Kysely`. Lint enforces this with `no-restricted-imports`.
   - The worker has its own module and pool. Budget the connections: web plus worker plus pg-boss must fit PostgreSQL's `max_connections`.
   - Move the module to `packages/db` when both processes import it (ADR-0003's trigger).
2. **Reads cannot write.** `*-queries.ts` functions use `ReadonlyKysely<DB>`. Writes live in `*-mutations.ts` with `Kysely<DB>` or a `Transaction<DB>`. An insert through the read-only type fails `tsc` (lab).

**Types**

3. **`db-types.ts` is generated, never edited.**
   - kysely-codegen reads the migrated local database, using `.kysely-codegenrc.json`:
     - int8 maps to number;
     - overrides give CHECK-listed text columns a union and give JSONB columns their shapes;
     - identity and generated columns are `GeneratedAlways`;
     - `vector` gets a type.
   - `pnpm check` runs `kysely-codegen --verify`.
4. **Parse deliberately.**
   - Register an int8 parser that returns a number and throws if `Number.isSafeInteger` fails. Toman prices and ids fit.
   - `numeric` stays a string until a DTO converts it on purpose.
   - `timestamptz` arrives as a `Date` and leaves as an ISO string in DTOs.
   - Money is always an integer (AGENTS.md).
5. **Return DTOs, not rows.** List columns explicitly: no `selectAll()` in anything that leaves `server/`. Return plain JSON-safe values. The lab showed a library's value changing type across `'use cache'`.

**Writing queries**

6. **Builder first, `sql` second.**
   - Use the builder for structure: `select`, `where`, `join`, `with`, `onConflict`, `forUpdate().skipLocked()`, `filterWhere`, `over`, `refTuple`, `cast`, `$if`.
   - Use `sql` only for operators the builder lacks.
   - Put those in named helpers in one file, each tested against real PostgreSQL: `matchesQuery`, `searchRank`, `trigramSimilar`, `cosineDistance`, `tryAdvisoryLock`.
   - `sql<T>` is an assertion, not a check.
   - Never pass user input to `sql.raw`, `sql.lit` or `sql.ref`.
7. **Partial-index predicates are literals**: `sql.lit('queued')`, not a bound parameter (lab `EXPLAIN`).
8. **Sort order and index agree exactly.** A new index and the query it serves use the same direction and NULLS placement. `EXPLAIN` shows an index scan, not a `Sort` node.
9. **Result pages use keyset pagination**, with `refTuple`/`tuple` over `(sort_key, id)`. Never OFFSET.

**Integrity**

10. **Insert and catch.**
    - Let constraints decide.
    - Catch `pg.DatabaseError` and map `code` plus `constraint` to domain results in one helper: 23505 unique, 23503 foreign key, 23514 check, 23P01 exclusion.
    - Never pre-check uniqueness with a read.
    - Name every constraint explicitly in migrations; the names are the contract.
11. **Compose through transactions.**
    - Use `db.transaction().execute(async (trx) => …)`.
    - Functions take an executor parameter, so they compose.
    - Enqueue follow-up jobs inside the same transaction with pg-boss's `fromKysely(trx)`.

**Migrations and verification**

12. **Migrations are plain SQL under dbmate.**
    - Create them with `dbmate new`, one concern per file.
    - CONCURRENTLY and VALIDATE go alone in `transaction:false` files.
    - Every DDL migration sets `lock_timeout`.
    - Squawk must pass.
    - Merged files are immutable (CI).
    - `dbmate up` is followed by type regeneration in the same commit.
13. **Prove it against real PostgreSQL.**
    - Tests run against PostgreSQL 17 with pgvector in Docker. Each test runs inside `startTransaction()` and is rolled back; no database mocks.
    - In development, log SQL with its parameters through Kysely's `log` hook, so the agent can compare the code with the SQL it produced.
    - Every new query on a hot path gets `EXPLAIN (ANALYZE, BUFFERS)` on realistic data. The detailed rules are pass D's.
14. **Pin and read.**
    - Pin exact versions of kysely, kysely-codegen, pg, dbmate, squawk-cli and pg-boss. Kysely 0.x breaks in minor releases, so read the release notes before bumping.
    - Agents consult `https://kysely.dev/llms.txt`, which is regenerated on every push, rather than memory.

## Disagreements and open questions

- **Plain SQL or a declarative schema for agents?** Armin Ronacher: "Use plain SQL. I mean it. You get excellent SQL out of agents and they can match the SQL they write with the SQL logs." Prisma's Nurul Sundarani argues the opposite: "A declarative schema is cheap, high-quality context: one parseable file that the client, the migrations, and the agent all start from."
  - The Prisma post measured tokens and type-check cost, not the correctness of agent-written queries. I found no independent measurement of LLM accuracy with Prisma, Drizzle or SQL (medium confidence).
  - The recommended stack gives agents both: SQL they can match against logs, and one generated 69-line type file describing the whole schema.
- **Prisma's own sources disagree about Prisma 8's status.**
  - The March blog says Prisma 7 "remains the recommended version of Prisma for production applications and will continue to receive updates and support for the next 12 months".
  - The docs say "Prisma ORM 8 is the current release, as a release candidate".
  - The skills README calls Prisma 8 early access (`0.x`).
- **When did Drizzle reach 1.0?** A secondary comparison site (PkgPulse, 2026-03-09) claims mid-2025. npm and GitHub releases contradict it; trust the primary sources.
- **Queue choice.** Medium confidence. graphile-worker wins on simplicity and typed payloads; pg-boss wins on crash recovery, dead letters and time-zone cron.
- **Open questions:**
  - A `vector` round-trips as a `'[…]'` string in pg and Kysely, so a small helper is needed; its shape is for pass D.
  - The maturity of SafeQL's postgres.js plugin, if the runner-up is ever chosen.
  - Registry and Docker Hub reachability from the Iranian host (CS-23).

## Sources consulted

All accessed on 2026-09-27; publication dates are given where the page has one. Context7 retrievals are marked.

**Libraries: documentation and source**
- Rasmus Porsager, postgres.js README ("Prepared statements will automatically be created for any queries where it can be inferred that the query is static."), https://github.com/porsager/postgres; also through Context7 `/porsager/postgres`
- Brian Carlson, node-pg-types README ("node-postgres cannot confidently parse int8 data type results as numbers because if you have a huge number it will overflow"), https://github.com/brianc/node-pg-types
- node-postgres, "Data Types", https://node-postgres.com/features/types
- Kysely, "Migrations" ("The migration methods use a lock on the database level and parallel calls are executed serially"), https://kysely.dev/docs/migrations
- Kysely, `src/migration/migrator.ts` ("When `true`, don't run migrations in transactions even if the dialect supports transactional DDL."), https://github.com/kysely-org/kysely/blob/master/src/migration/migrator.ts
- Kysely, "Generating types" (kysely-codegen "generates Kysely database schema type definitions by connecting to and introspecting your database."), https://kysely.dev/docs/generating-types
- Kysely, release v0.29.0 ("The library no longer ships CommonJS files."), https://github.com/kysely-org/kysely/releases/tag/v0.29.0, 2026-05-08
- Kysely docs, through Context7 `/websites/kysely_dev`; kysely-codegen `--help` output (0.20.0, lab)
- Drizzle Team, "Migrations" ("Database schema in your codebase is a source of truth and is under version control."), https://orm.drizzle.team/docs/migrations
- Drizzle Team, docs on generated columns and full-text search, and pgvector extensions, through Context7 `/drizzle-team/drizzle-orm-docs`
- Drizzle Team, "Sustainability" ("As of March 2026 PlanetScale hired entire Drizzle core team and becomes the biggest backer we have!"), https://orm.drizzle.team/docs/sustainability
- Drizzle Team, "v0 → v1 updates", https://orm.drizzle.team/docs/v0-v1-changes; "drizzle-kit migrate", https://orm.drizzle.team/docs/drizzle-kit-migrate; "Custom migrations", https://orm.drizzle.team/docs/kit-custom-migrations (sub-pass A)
- Prisma, "TypedSQL" (v7) ("TypedSQL does not natively support constructing SQL queries with dynamically added columns."), https://www.prisma.io/docs/orm/v7/prisma-client/using-raw-sql/typedsql
- Prisma, "Unsupported database features" (v7), https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features
- Prisma, "Error reference" (v7; P2004 "A constraint failed on the database: `{database_error}`"; no P2039), https://www.prisma.io/docs/orm/v7/reference/error-reference
- Prisma, the unversioned error reference, which now documents the Prisma 8 error system, https://www.prisma.io/docs/orm/reference/error-reference
- Prisma, "PostgreSQL extensions" and "Indexes" (v7, partial indexes), through Context7 `/websites/prisma_io`
- Prisma, "What is Prisma 8?", https://www.prisma.io/docs/orm/v8; "Coming from Prisma ORM 7", https://www.prisma.io/docs/orm/coming-from-prisma-orm-7; CLI reference v7 (AI safety guardrails), https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference; environment variables v7, https://www.prisma.io/docs/orm/v7/reference/environment-variables-reference (sub-pass B)
- Prisma, `prisma/skills` README, https://github.com/prisma/skills (sub-pass B)
- Next.js 16.3.5 docs, `serverExternalPackages` ("Next.js includes a short list of popular packages that currently are working on compatibility and automatically opt-ed out"), a local copy in `node_modules/next/dist/docs`, and `server-external-packages.jsonc`
- Minor libraries (sub-pass B):
  - TypeORM, "TypeORM 1.0 is here", https://typeorm.io/blog/typeorm-1-0/, 2026-05-19
  - Martin Adámek, "MikroORM 7: Unchained", https://mikro-orm.io/blog/mikro-orm-7-released, 2026-03-11
  - Gajus Kuizinas, Slonik README, https://github.com/gajus/slonik
  - PgTyped issue #597 (maintainer's comment of 2025-02-10), https://github.com/adelsz/pgtyped/issues/597
  - Zapatos, https://jawj.github.io/zapatos/
  - sqlc-gen-typescript README, https://github.com/sqlc-dev/sqlc-gen-typescript
  - SafeQL, https://safeql.dev/
  - kanel README, https://github.com/kristiandupont/kanel
- llms.txt files (sub-pass B): prisma.io/docs, orm.drizzle.team, kysely.dev, worker.graphile.org; node-postgres.com and pgboss.io returned 404

**Releases and registry data**
- The npm registry (`npm view` versions, dist-tags, publish times and scripts for every package named here) and the GitHub API (releases, stars, open issues, commits since 2026-01-01) for porsager/postgres, brianc/node-postgres, kysely-org/kysely, drizzle-team/drizzle-orm and prisma/orm (formerly prisma/prisma)
- Drizzle releases 0.45.3 and drizzle-kit 0.31.11, https://github.com/drizzle-team/drizzle-orm/releases, 2026-09-21
- Prisma release v8.0.0-rc.12, https://github.com/prisma/orm/releases/tag/v8.0.0-rc.12, 2026-09-24 (sub-pass B)

**GitHub issues and pull requests**
- Drizzle #860, "[BUG]: Can't create index concurrently due to transaction block", https://github.com/drizzle-team/drizzle-orm/issues/860, 2023-07-04
- Drizzle #5521, "drizzle-kit migrate CLI silently fails with exit code 1 - SQL errors not printed", https://github.com/drizzle-team/drizzle-orm/issues/5521, 2026-03-21; #6121, https://github.com/drizzle-team/drizzle-orm/issues/6121, 2026-08-10
- Drizzle #5769 ("The skip is silent — no log, no warning, no non-zero exit."), https://github.com/drizzle-team/drizzle-orm/issues/5769, 2026-05-16
- Drizzle #5978, "`.desc()` index (DESC NULLS LAST) contradicts `desc()` orderBy…", https://github.com/drizzle-team/drizzle-orm/issues/5978, 2026-07-02; #5312, https://github.com/drizzle-team/drizzle-orm/issues/5312, 2026-01-28
- Drizzle #5660 ("when will we have v1.0.0?"), https://github.com/drizzle-team/drizzle-orm/issues/5660, 2026-04-18 (sub-pass B)
- Prisma #27770, "Trying to create custom hnsw index but prisma drops it", https://github.com/prisma/orm/issues/27770, 2025-07-29
- Prisma #3388, "Support SQL Check constraints", https://github.com/prisma/orm/issues/3388, 2019-12-03
- Prisma #6336, "Generated columns", https://github.com/prisma/orm/issues/6336, 2021-03-31
- Prisma #18442, "Support for `pg_vector`", https://github.com/prisma/orm/issues/18442, 2023-03-23
- Prisma #12914, "Prisma drops indexes defined outside of Prisma", https://github.com/prisma/orm/issues/12914, 2022-04-21
- Prisma PR #29512, "fix(client-engine-runtime): surface unmapped driver errors as user-facing P2039", https://github.com/prisma/orm/pull/29512, 2026-04-24

**Practitioners and vendors**
- Armin Ronacher, "Agentic Coding Recommendations", https://lucumr.pocoo.org/2025/6/12/agentic-coding/, 2025-06-12
- Will Madden and Ankur Datta (Prisma), "The Next Evolution of Prisma ORM", https://www.prisma.io/blog/the-next-evolution-of-prisma-orm, 2026-03-04 (updated since)
- Nurul Sundarani (Prisma), "Prisma Schema as LLM Context: Why Agents Read It Best", https://www.prisma.io/blog/prisma-schema-as-llm-context, 2026-08-06 (sub-pass B)
- Will Madden (Prisma), "Don't Let Your AI Agent Delete Your Production Database", https://www.prisma.io/blog/stop-your-ai-agent-dropping-your-database, 2026-07-30 (sub-pass B)
- Sam Lambert (PlanetScale), "Drizzle joins PlanetScale", https://planetscale.com/blog/drizzle-joins-planetscale, 2026-03-03 (sub-pass B)
- PkgPulse Team, "Drizzle ORM v1 vs Prisma 6 vs Kysely 2026", https://www.pkgpulse.com/guides/drizzle-orm-v1-vs-prisma-6-vs-kysely-2026, 2026-03-09 (secondary; contradicted)

**PostgreSQL**
- PostgreSQL Global Development Group, "Indexes and ORDER BY" ("NULLS FIRST is the default for ORDER BY DESC."), https://www.postgresql.org/docs/17/indexes-ordering.html
- PostgreSQL Global Development Group, "PREPARE" (generic and custom plans), https://www.postgresql.org/docs/17/sql-prepare.html
- PostgreSQL Global Development Group, "Message Flow", "SELECT" (SKIP LOCKED) and "Transaction Isolation", https://www.postgresql.org/docs/17/protocol-flow.html, https://www.postgresql.org/docs/17/sql-select.html, https://www.postgresql.org/docs/17/transaction-iso.html (sub-pass A)

**Migration tools and queues** (sub-pass A)
- amacneil, dbmate README ("dbmate only stores the version number, not the contents…"), https://github.com/amacneil/dbmate
- Graphile, graphile-migrate README ("`--! no-transaction` migrations must contain exactly one statement."), https://github.com/graphile/migrate
- Salsita, node-pg-migrate, "Defining Migrations", https://salsita.github.io/node-pg-migrate/migrations/
- Ariga, Atlas docs: "Migration Linting", https://atlasgo.io/versioned/lint; "Community Edition", https://atlasgo.io/community-edition; "Data Privacy and the CLI", https://atlasgo.io/cli/data-privacy; "Applying Migrations", https://atlasgo.io/versioned/apply
- sbdchd, Squawk README and CLI docs, https://github.com/sbdchd/squawk, https://squawkhq.com/docs/cli
- Tim Jones, pg-boss docs ("…the limit is slightly exceeded during race conditions when multiple workers fetch jobs simultaneously."), https://pgboss.io/api/workers; the `dist/types.d.ts` of 12.35.0 (`fromKysely` and the other adapters)
- Graphile, graphile-worker "Error handling" ("the jobs that that worker was executing remain locked for at least 4 hours"), https://github.com/graphile/worker/blob/main/website/docs/error-handling.md; "Worker Pro: recovery", https://github.com/graphile/worker/blob/main/website/docs/pro/recovery.md
- Prisma, "About the shadow database", https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database; pgfence guide, https://www.prisma.io/docs/guides/integrations/pgfence
