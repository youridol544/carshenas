---
paths:
  - "db/**"
  - "compose.yaml"
  - "scripts/db.sh"
  - "packages/db/**"
  - "apps/worker/src/db/**"
  - "apps/web/src/server/db/**"
  - "apps/web/src/features/*/server/**"
  - "packages/ai/src/answer-store.ts"
---

# Database: schema, migrations and queries (PostgreSQL 18, Kysely, dbmate)

Load the `database` skill before designing a table, writing a migration or writing a query beyond a one-line change; its `references/craft.md` has the reasons and sources. Decisions: ADR-0011 (PostgreSQL only), ADR-0012 (Kysely, dbmate), ADR-0013 (modeling rules); the model is `docs/design/data-model.md`. Already enforced, so fix what the message says: Squawk on migrations, lint on SQL built from strings and on driver imports outside `src/server/db`, and the schema tests on names, types, keys, foreign-key indexes and generated types. This file is what they cannot see.

## Schema

- Design from the rules the data must obey, then make each one a constraint: NOT NULL unless unknown is a real state, CHECK for row rules (a CHECK passes when its expression is NULL, so write `IS NOT NULL` where a nullable column must be set), UNIQUE for natural keys, a foreign key with a chosen ON DELETE for every reference. A rule that reads other rows is a composite key, a partial unique index or an exclusion constraint; a trigger only as a backstop that locks what it reads.
- Name every constraint `<table>_<meaning>_<kind>` so its violation reads as the rule it guards; comment every table and every column whose meaning, unit or source is not obvious. Units go in column names.
- Observations are never updated: a new fetch is a new row. Only a purge for a removal request deletes them.
- A new table is closed to the app: grant exactly what `carshenas_web`, `carshenas_worker` and, for the superadmin section, `carshenas_admin` need, in the same migration. The section's role changes a curated row only through a function that records which superadmin changed it (ADR-0023).
- Keep planned tables in the task that needs them, and update `docs/design/data-model.md` in the same commit.

## Migrations

- `pnpm db:new <name>`, one concern per file, then `pnpm db:migrate`, which refreshes `db/schema.sql` and `db-types.ts`; commit all three together. Never edit, rename or delete a migration that is on `main`; write the next one. To change one that is not on `main` yet, `pnpm db:rollback` first, then edit and migrate: dbmate undoes a migration with the file's current down section.
- On a table that already has rows: add constraints `NOT VALID`, validate in a later file; build indexes `CONCURRENTLY` alone in a `transaction:false` file; add columns without volatile defaults; expand, migrate, contract instead of renaming or dropping in one step; backfill in batches outside the DDL transaction.
- A CHECK list on a column needs its union in `.kysely-codegenrc.json`; an identity or generated column needs `ColumnType<…, never, never>` there. The schema tests say which.

## Queries

- Reads in `*-queries.ts` on `readDatabase()`; writes in `*-mutations.ts` on `database()`; functions that run inside someone else's transaction take the executor as a parameter.
- List the columns a caller needs and return plain DTOs (camelCase, ISO dates, numbers); never pass rows or `selectAll()` out of `server/`.
- Let the database decide: insert, and map a violation with `constraintViolation()` to a Farsi result; upsert with `ON CONFLICT` on a named constraint. Never read to check before writing.
- Keep transactions short and free of network calls; enqueue follow-up jobs inside them, perform side effects after commit.
- Every query on a page or a hot worker path gets `EXPLAIN (ANALYZE, BUFFERS)` on realistic data before it ships; an index arrives with the query that needs it, sorted and filtered exactly as that query is. Pages use keyset pagination, never `OFFSET`.
- `sql` fragments live in named, tested helpers in `src/server/db`; partial-index predicates are literals (`sql.lit`), never parameters.

## Verify before calling it done

`pnpm check` (Squawk, lint, schema tests) and `pnpm db:check` (replay up, down, up; schema and type drift; integration tests), then the `database-reviewer` agent for any migration or new query. Never run destructive commands against the local database; the guard hook refuses them, and the person runs them if they want to.
