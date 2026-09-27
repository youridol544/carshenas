# ADR-0012: Kysely on node-postgres, plain SQL migrations with dbmate, types generated from the database

- Status: accepted
- Date: 2026-09-27 (decided by the owner on 2026-09-27)
- Deciders: Pedrum
- Related: ADR-0003, ADR-0004, ADR-0011, ADR-0013; tasks CS-4, CS-6, CS-22; `docs/research/2026-09-27-postgresql-only-data-stack.md` and its appendix (`access-layer.md`, `harness.md`)

## Context

The owner asked how the app should talk to PostgreSQL: raw SQL, Prisma, Drizzle or another, with a clear winner. Our hardest queries are PostgreSQL-specific (upserts on named constraints, `SKIP LOCKED`, `FILTER`, keyset comparisons, full-text and trigram operators, vectors), our schema uses features ORM schema languages cannot express (generated columns, CHECK, EXCLUDE, partial and HNSW indexes), and the code is written mostly by agents, which need to compare what they wrote with the SQL it sent and need compile errors to steer them. The research implemented the same five operations in postgres.js, Drizzle, Kysely and Prisma against PostgreSQL with pgvector.

## Decision

1. **Kysely 0.29.6 on node-postgres 8.23.0**, pinned exactly (Kysely is 0.x and breaks in minor releases). `apps/web/src/server/db/database.ts` owns one pool per process: `readDatabase()` returns a type-level read-only instance for `*-queries.ts`, `database()` the writable one for mutations and transactions. `bigint` arrives as a number with a safe-integer guard, `numeric` as a string. The `sql` template is used only inside `src/server/db`, in named helpers; lint keeps `pg` and Kysely values there and rejects SQL built from strings.
2. **The schema is plain SQL migrations in `db/migrations`, applied by dbmate 2.36.0**: one concern per file, created with `pnpm db:new`, each with an up and a down section and its own `lock_timeout` and `statement_timeout`; `CREATE INDEX CONCURRENTLY` and `VALIDATE CONSTRAINT` alone in a `transaction:false` file. A migration on `main` is never edited or deleted, only followed by another. `db/schema.sql` is dumped by the container's own `pg_dump` and committed with each migration.
3. **Types are generated from the migrated database** by kysely-codegen 0.20.0 into `db-types.ts`, never edited. `.kysely-codegenrc.json` types every column limited by a CHECK list as that union and every identity or generated column as never inserted; the schema tests fail when it falls behind.
4. **Checks**: Squawk 2.66.0 lints every migration's up section in `pnpm check`, with the schema tests (PostgreSQL 18 in PGlite: constraints by SQLSTATE and name, and the catalog conventions of ADR-0013). `pnpm db:check` replays every migration up, down and up on a scratch database, compares the dump with `db/schema.sql`, verifies the generated types, and runs the integration tests against real PostgreSQL.

## Alternatives considered

- **Prisma ORM 7.10**: mid-rewrite (Prisma 8 in release candidates), its schema language cannot express generated columns, CHECK, EXCLUDE or HNSW indexes, `migrate diff` wanted to drop our hand-written index, and it downloads an engine and calls a telemetry host from every CLI command.
- **Drizzle ORM 0.45**: `CREATE INDEX CONCURRENTLY` cannot run in its migrator, a failing migration exited without an error message, an edited applied migration went unnoticed, and a descending index was emitted with the wrong NULLS order. Revisit when 1.0 is stable and those issues are closed.
- **Raw SQL with postgres.js** (runner-up): the smallest and fastest, but row types are unchecked casts and maintenance has slowed.
- **Kysely's own migrator, graphile-migrate, Atlas**: TypeScript migrations in one transaction without checksums; a stable release from 2022; lint and drift features behind a paid login with telemetry.

## Consequences

- Positive: code reads like the SQL in the logs; the database's types reach the compiler; migrations can use every PostgreSQL feature; nothing contacts a host outside npm.
- Negative / risks: Kysely has less training data than Prisma or Drizzle (agents read `https://kysely.dev/llms.txt` and the `database` skill's verified patterns); `sql<T>` fragments are unchecked type assertions, so they live in tested helpers; dbmate does not detect edited migrations, so `pnpm db:lint` and CI do; two test layers to maintain.
- Follow-ups: CS-6 moves `src/server/db` into `packages/db` when the worker imports it (ADR-0003's trigger) and adds pg-boss (ADR-0011); CS-22 runs Squawk, the migration immutability check and `pnpm db:check` against a PostgreSQL 18 service container in CI.
