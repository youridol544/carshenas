# Database review checklist

What the `database-reviewer` agent applies to a migration, a schema change or a query, and what an author checks before asking. It follows GitLab's database review contract in spirit (the raw SQL of every changed query and its plan; the output of migrating and rolling back), with our own rules from `craft.md`, whose section names are cited. Judge each item **pass**, **fix** or **cannot judge**; every **fix** names the file and line, what the evidence showed, what it should be, and the rule it breaks. Report the most severe first. [H-23; GitLab database review guidelines]

## The evidence a change must carry

Produce it yourself; a claim in a diff, a task note or a commit message is not evidence.

| Evidence | How |
|---|---|
| Squawk and migration history | `pnpm db:lint`: every up section linted; a migration already on `main` edited or deleted fails |
| Schema tests | `pnpm --filter @carshenas/web test src/server/db` (PGlite): catalog conventions and every constraint by SQLSTATE |
| Replay, drift, integration | `pnpm db:check`: up, every down, up again on a scratch `carshenas_<pid>_check`; `db/schema.sql` identical to the replay; `kysely-codegen --verify`; the `*.db.test.ts` tests. If the container is down, `pnpm db:up` first and say so |
| The SQL of each new or changed query | `CARSHENAS_LOG_SQL=1 pnpm dev` and use the page, or Kysely's `.compile()` in a throwaway script outside `src/` that you delete; never review the builder code alone |
| Its plan | `pnpm db:psql -c "EXPLAIN (ANALYZE, BUFFERS) <the SQL with realistic values>"`, run twice (cold, then warm); for a changed query, the plan before and after |
| Plans of writes | the read-only role cannot `EXPLAIN` an `INSERT`, `UPDATE` or `DELETE` (permission denied; with `ANALYZE`, a read-only transaction), so the author records them from a scratch database; the reviewer checks the access path of the `WHERE` clause by explaining it as a `SELECT` [lab 2026-09-27] |
| Data size | the row counts of the tables in the plan. On a near-empty table a sequential scan is the right answer: say so, state the plan you expect at production size and why, and do not approve an index or a query on an empty table |

## Migrations

**Data loss and corruption**
- A rename, a type change or a drop done in one step on a table that has (or will soon have) rows, instead of expand, migrate, contract. (craft: Migrations)
- A migration that is already on `main` edited or deleted, instead of a new one. (craft: Migrations)
- `ON DELETE CASCADE` on a curated parent (a source, a make, a model), or `SET NULL` that would break a CHECK; each ON DELETE must be deliberate. (craft: Migration checklist)
- An UPDATE or DELETE path into an append-only table other than a purge that sets `carshenas.purge`. (craft: Modeling)
- A backfill inside the migration's transaction, or one that cannot be rerun safely. (craft: Migrations)

**Integrity**
- An invariant a row, key or reference must satisfy that is left to application code, or a nullable column with no documented meaning for NULL. (craft: Where checks live)
- A CHECK over a nullable column that forgets NULL: a CHECK passes when its expression is NULL, so `access_method <> 'crawl' OR min_request_interval_ms >= 3000` accepted a crawled source with no interval until `IS NOT NULL` was spelled out (CS-4 review). Try the NULL case in a test. (craft: Keys, types and time)
- A trigger that validates new rows BEFORE INSERT: it also judges the row an upsert proposes, before the conflict turns it into an update. (craft: Where checks live)
- Two references that must agree (a fetch's source and its listing's source) without a composite key that makes them agree. (craft: Modeling)
- A cross-row rule written as a CHECK that reads other rows or the clock, or as a trigger that does not lock what it reads. (craft: Where checks live)
- A reference without a foreign key; a foreign key without an index that starts with its columns and without an `unindexed:` comment giving the reason. (craft: Indexes)
- A natural key without a named UNIQUE constraint. (craft: Keys, types and time)
- Money not `bigint` in its named unit; instants not `timestamptz`; strings in `varchar(n)` or `char`; keys not `bigint` identity or a text code; `serial`. (craft: Keys, types and time)
- A lifecycle expressed as a CHECK of pairs instead of rows in a transition table. (craft: Modeling)
- The `.kysely-codegenrc.json` overrides missing or stale for new CHECK lists, identity or generated columns (the schema tests say which). (craft: Conventions the tests enforce)

**Locking and migration safety**
- A transactional file without `SET LOCAL lock_timeout` and `statement_timeout` in both sections. (craft: Migrations)
- A constraint added to a table with rows without `NOT VALID`, or validated in the same file. (craft: Migrations)
- An index on a table with rows built without `CONCURRENTLY`, or a concurrent build sharing its file with anything but the two Squawk comments (a `SET` line makes it fail with 25001). (craft: Migrations)
- A default that is volatile or evaluated once where each old row needs its own value; a change that rewrites a large table without a plan. (craft: Migrations)
- An extension that is not trusted (`vector`, `pg_stat_statements`) created by a migration instead of by the superuser bootstrap; an extension added without its PGlite module in the schema tests. (craft: Migrations)
- A down section that does not undo its up section (`pnpm db:check` proves it).
- A migration that is on `main` edited, deleted or renamed (`pnpm db:lint` compares with `--no-renames`); an unmerged one edited without being rolled back first, which leaves the development database on the old version.

**Security and privacy**
- A grant wider than the role needs, a new table left without the grants its readers need, or an application role that owns objects. (craft: Security and privacy)
- A phone number, name or other personal detail stored outside the rules of ADR-0008 point 7 (HMAC only for phone numbers, nothing personal in snapshots, logs, cache keys or tags). (craft: Security and privacy)
- A SECURITY DEFINER function without a pinned `search_path`, or EXECUTE left granted to PUBLIC; a trigger or helper that reads a table by an unqualified name, where a temporary table could stand in for it. (craft: Security and privacy)
- TEMPORARY granted to a role other than `carshenas_migrate`; bind parameters written to the server log. (craft: Security and privacy)

**Names and documentation**
- A constraint or index outside `<table>_<meaning>_<kind>`; a table or a non-obvious column without a `COMMENT`; units missing from a name. (craft: Names and documentation)
- `docs/design/data-model.md` not updated in the same commit; the task or ADR not named in the migration's header comment.

## Queries

**Correctness**
- Uniqueness checked by a read before the write; a batch path that inserts and catches instead of `ON CONFLICT`; an upsert without a change guard; `ON CONFLICT` naming columns instead of the constraint. (craft: Writes and errors)
- A violation mapped by message text instead of SQLSTATE and constraint name; a user-facing constraint without its Farsi message and test. (craft: Writes and errors)
- A read-modify-write in code under READ COMMITTED without an atomic update, a lock, a version or a retried SERIALIZABLE transaction; a retry that does not rerun the whole transaction. (craft: Transactions and concurrency)
- A network call, a model call or a message send inside a transaction; a follow-up job enqueued outside the transaction that wrote its rows. (craft: Transactions and concurrency)
- A keyset cursor that is not exact in the column's type (a `real` literal, a `Date` for a microsecond timestamp). (craft: Query patterns)
- Three-valued logic traps: `NOT IN` over a nullable list, `=` where `IS DISTINCT FROM` is meant. (craft: Keys, types and time)

**Performance** (each with its plan)
- No index serves the filter, or the index's columns are not equality first; the sort is not delivered by the index (a `Sort` node, `top-N heapsort`), or the direction and NULLS placement differ. (craft: Indexes)
- A partial index's predicate sent as a parameter instead of `literal()`. (craft: Indexes)
- The LIMIT trap not tested on skewed data for a "filter plus sort plus LIMIT" query. (craft: Indexes)
- A new index on a column the crawler rewrites on every pass (it kills HOT updates), or an index that duplicates an existing one or a unique constraint. (craft: Indexes)
- `OFFSET` pagination; an exact count where a capped or estimated one is honest; facets counted live over a broad set that should come from the precomputed table. (craft: Query patterns; `search.md`)
- N+1 round trips; `IN ($1, $2, …)` lists that change the statement text; `selectAll()` or rows leaving `server/`; wide columns (`payload`, embeddings) read by list pages. (craft: Query patterns)
- A vector query whose operator does not match the index's operator class, a filtered approximate search without iterative scans or a B-tree prefilter, or an approximate index without a recall number. (`vectors.md`)

**Boundaries** (lint catches most; confirm the rest)
- `sql` fragments outside named, tested helpers in `src/server/db`; `sql.raw`; values interpolated into SQL text; the driver imported outside `src/server/db`. (craft: Query patterns; `kysely.md`)
- A read in a `*-mutations.ts` file or a write through `readDatabase()` (the type forbids the latter).

## The verdict

End with one line: **ready**, or **not ready: <the one thing to fix first>**. Taste in naming beyond the convention, and whether a feature needs the data at all, are the owner's calls: list them under "left for you to decide".
