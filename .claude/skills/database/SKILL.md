---
name: database
description: Design, change and query Carshenas's data in PostgreSQL 18 the way a senior database engineer does. Use when designing a table, a key, a constraint or a lifecycle; when writing or reviewing a migration (dbmate SQL, Squawk findings, locks, NOT VALID, CONCURRENTLY, backfills); when writing a Kysely query or mutation in `src/server/db` or a feature's `server/`; when deciding whether a check belongs in the database or in the app, or whether to insert and handle a unique or foreign-key violation instead of reading first; when a transaction, lock, retry, SKIP LOCKED claim or advisory lock is involved; when choosing, testing or dropping an index, reading EXPLAIN (ANALYZE, BUFFERS), or measuring with pg_stat_statements; when paginating, counting or building Persian full-text search and facets in PostgreSQL; when storing or searching embeddings with pgvector or perceptual photo hashes; when handling personal data, roles or grants; or when reviewing any database code.
---

# database: Carshenas's data on PostgreSQL 18

PostgreSQL is the only data service: records, search, vectors and the job queue (ADR-0011). Code reaches it through Kysely on node-postgres; the schema lives in plain SQL migrations applied by dbmate and linted by Squawk; the TypeScript types are generated from the migrated database (ADR-0012). The modelling rules are ADR-0013, the model itself is `docs/design/data-model.md`, and `.claude/rules/database.md` is the short list every diff must satisfy. This skill is the how and the why. Where it disagrees with general advice, an agent skill, the vendored pgvector guide or a blog, it wins, and `references/craft.md` says why.

## Non-negotiables

1. **Invariants live in the database.** Types, NOT NULL, CHECK, UNIQUE, foreign keys with a chosen ON DELETE, exclusion constraints. The app repeats a check only to show a Farsi message early, and turns the database's rejection into the same message by SQLSTATE and constraint name (`constraintViolation()` in `src/server/db/database-errors.ts`).
2. **Never read to check before writing.** Batch writes are `INSERT … ON CONFLICT ON CONSTRAINT <name>` with a change guard; a single write a person triggers inserts and maps 23505, 23503, 23514 or 23P01 to a result.
3. **Every constraint and index is named `<table>_<meaning>_<kind>`**, and every table, plus every column whose meaning, unit or source is not obvious, has a `COMMENT`.
4. **Keys and types:** `bigint GENERATED ALWAYS AS IDENTITY` keys with the natural key as a named UNIQUE; text codes for tiny curated vocabularies; money as `bigint` whole tomans named `_toman`, each column with its range CHECK `BETWEEN <low> AND 999999999999999` (ADR-0014); instants as `timestamptz`; never `timestamp`, `varchar(n)`, `char`, `money`, `json` or `serial`.
5. **Every foreign key has an index that starts with its columns**, or a `COMMENT ON CONSTRAINT` starting `unindexed:` that says why not (owner, 2026-09-27).
6. **Observations are append-only** (snapshots, fetches, policy checks, price events); "current" is derived; rows leave only through a purge for a removal request (ADR-0008 point 8).
7. **Migrations** come from `pnpm db:new`, carry one concern, set `lock_timeout` and `statement_timeout`, use the lock-safe forms on tables that have rows, and are never edited once they are on `main`.
8. **Queries** read through `readDatabase()` in `*-queries.ts` and write through `database()` in `*-mutations.ts`, list their columns and return DTOs. Values are always parameters; `sql` fragments exist only as named, tested helpers in `src/server/db`; a partial index's predicate is a literal in the SQL text.
9. **No index without a query that needs it**, shown by `EXPLAIN (ANALYZE, BUFFERS)` on realistic data, with the filter's equality columns first and the sort's direction matched. Pages paginate by keyset, never `OFFSET`.
10. **Transactions are short and hold no network call.** Follow-up jobs are enqueued inside the transaction; side effects happen after commit.
11. **Roles:** the app never connects as the owner; a new table grants each role exactly what it needs in the same migration; agents inspect through the read-only role (`pnpm db:psql`); destructive commands are the person's to run (the guard hook refuses them).
12. **Personal data:** phone numbers only as HMAC-SHA-256 with the key outside the database (ADR-0008 point 7); no personal data in snapshots, logs, cache keys or tags.

## Workflow

1. **Model.** Read `docs/design/data-model.md` and the glossary. Write down what determines what (functional dependencies) and the rules the rows must obey; each rule becomes a constraint or, if it spans rows, a key, a partial unique index, an exclusion constraint or a locked transaction. Decide ON DELETE and grants per table. Origin-specific facts go into side tables of the one `listing` table.
2. **Write the migration.** `pnpm db:new <snake_case_name>` creates the file from the house template; fill `-- migrate:up` and `-- migrate:down`. Walk `references/craft.md`, "Migration checklist".
3. **Apply it.** `pnpm db:migrate` applies it and refreshes `db/schema.sql` and `packages/db/src/db-types.ts`. Add the `packages/db/.kysely-codegenrc.json` overrides the schema tests ask for.
4. **Prove the rules.** Add a test per new constraint or trigger to `schema-constraints.test.ts`, asserting SQLSTATE and constraint name. Anything about the pool, the driver, concurrency or commits goes into a `*.db.test.ts`.
5. **Write the query** with the builder (`references/kysely.md`). Print its SQL (`CARSHENAS_LOG_SQL=1 pnpm dev`, or `.compile()`), then run `EXPLAIN (ANALYZE, BUFFERS)` on realistic data through `pnpm db:psql`, twice; add the index the plan asks for, in its own migration; record the before and after plans in the task.
6. **Verify.** `pnpm check` (Squawk, lint, schema tests) and `pnpm db:check` (replay up, down, up on a scratch database; schema and type drift; integration tests).
7. **Review.** Ask the `database-reviewer` agent; fix one finding at a time. Update `docs/design/data-model.md` in the same commit, and `docs/learnings.md` when something surprised you.

## Commands

| Command | What it does |
|---|---|
| `pnpm db:up` / `db:stop` / `db:restart` | the local PostgreSQL 18 container (`compose.yaml`, `db/postgresql.conf`) |
| `pnpm db:new <name>` | a migration from the house template |
| `pnpm db:migrate` / `db:rollback` / `db:status` | dbmate as `carshenas_migrate`, then `db/schema.sql` and the Kysely types |
| `pnpm db:lint` | Squawk on every up section, file names, no edits to merged migrations (part of `pnpm check`) |
| `pnpm db:check` | up, down, up on a scratch `carshenas_<pid>_check`; schema and type drift; `*.db.test.ts` |
| `pnpm db:psql [-c "…"]` | psql as `carshenas_readonly` (read-only sessions) |
| `pnpm db:top-queries` / `db:unused-indexes` | pg_stat_statements' top ten by total time; indexes never scanned |

## Read the reference you need

| Reference | Read when |
|---|---|
| `references/craft.md` | the rules with their reasons and sources: modelling, where checks live, writes and errors, transactions, keys and types, names, migrations (with the checklist), indexes, measuring, query patterns, connections and configuration, testing, security, the conventions the tests enforce, and the resolved disagreements |
| `references/kysely.md` | writing a query, a mutation, a transaction, an upsert, keyset pagination or a `sql` helper; every snippet type-checked, linted and run |
| `references/search.md` | anything about finding listings by text, filters, sorts, facets or counts |
| `references/vectors.md` | embeddings, similarity, duplicate detection, perceptual photo hashes |
| `references/review.md` | reviewing a migration or a query, yours or someone else's; what evidence a change must carry |
| `references/vendor/pgvector-semantic-search.md` | background on pgvector tuning; `vectors.md` and `vendor/VENDORED.md` say where our rules differ |

Library facts change: check Kysely, node-postgres, dbmate, Squawk and pgvector against Context7 or their changelogs (Kysely is 0.x and breaks in minor releases) before relying on memory.
