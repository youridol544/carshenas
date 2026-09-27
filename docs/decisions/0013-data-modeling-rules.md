# ADR-0013: Model one listing table for every origin, keep integrity in the database, and name everything

- Status: accepted
- Date: 2026-09-27 (decided by the owner on 2026-09-27)
- Deciders: Pedrum
- Related: ADR-0008 (point 7 amended), ADR-0011, ADR-0012; tasks CS-4, CS-2, CS-6, CS-8, CS-10, CS-11, CS-19; `docs/design/data-model.md`; `docs/research/2026-09-27-database-craft.md` and its appendix (`integrity.md`, `data-model.md`)

## Context

Carshenas collects listings from other sites now, and may later let people list cars on Carshenas itself, as a trading hub. The owner asked for "the best model for future", for the rules a senior engineer follows on where checks live and how inserts handle duplicates, and chose, on 2026-09-27, among the options the research laid out. The lab model passed 60 of 60 constraint cases and took the native-listings migration as one additive change on top of crawled rows.

## Decision

1. **One `listing` table for every origin.** `origin` is `external` now and `native` later; Carshenas itself becomes the source `carshenas`, and a composite foreign key `(source_id, origin)` stops a listing from claiming another origin than its source. Data that belongs to one origin lives in that origin's tables (fetch log and snapshots now; accounts, revisions and contact requests later). Native listings arrive with one additive migration that drops `listing_only_external_for_now`.
2. **Keys**: every table has a `bigint GENERATED ALWAYS AS IDENTITY` key, except tiny curated vocabularies keyed by a text code (`source.id = 'bama'`). Natural keys are named UNIQUE constraints. Anything whose possession grants access is a random token stored hashed, never an id. `uuidv7()` is used only for ids minted outside the database.
3. **Integrity lives in the database.** Every rule one row, one key or one reference can state is a constraint: NOT NULL, CHECK, UNIQUE (partial or NULLS NOT DISTINCT where needed), a foreign key with a deliberate ON DELETE, or EXCLUDE. Rules across rows use composite keys, partial unique indexes or exclusion constraints, and a trigger only as a backstop. Code repeats a check only to give a Farsi message before the round trip; the database's rejection is the guard, mapped by SQLSTATE and constraint name (`database-errors.ts`). Nothing is checked-then-inserted; upserts use `ON CONFLICT` on a named constraint.
4. **Every foreign key has an index on its columns**, unless the migration names the exception in the constraint's comment, starting with `unindexed:` and saying why.
5. **Names**: singular lower_snake_case tables, units in column names (`_ms`, `_days`, `_toman`), constraints and indexes named `<table>_<meaning>_<kind>` (`_pkey`, `_fk`, `_unique`, `_excl`, `_idx`; a CHECK never ends in `_check`), and a comment on every table.
6. **Types and time**: text with a CHECK instead of `varchar(n)`, `char` or enums; `timestamptz` only, stored in UTC, with Tehran calendar days computed in queries and half-open ranges; money as `bigint` in one named unit (CS-2 decides the unit), never a float; `jsonb` only for raw payloads, with every field we filter, join, constrain or value in its own column.
7. **Observations are append-only**: policy checks, the fetch log and snapshots (later price events and duplicate verdicts) refuse UPDATE and DELETE, except inside a purge that honours a removal request (`SET LOCAL carshenas.purge = 'on'`).
8. **Privacy and access**: snapshots are stored with personal data removed; phone numbers are stored only as keyed HMAC-SHA-256 hashes with a key version, never plain or salted (ADR-0008 point 7); the app connects as least-privileged roles granted table by table (`carshenas_web` now, `carshenas_worker` with CS-6), never as the owner; native sellers' rows get row-level security when they exist.
9. **Locale**: databases use the builtin `C.UTF-8` locale, which never changes with the operating system; a page that sorts Persian names alphabetically says `COLLATE "fa-x-icu"` in its query.

The schema tests (`apps/web/src/server/db/schema-*.test.ts`) enforce points 2, 3, 4 and 5 on every migration.

## Alternatives considered

- **Separate tables per origin, or one table of nullable columns for both**: queries, valuations and search would union two tables or carry columns that mean nothing for half the rows; a polymorphic id cannot have a foreign key.
- **UUID primary keys**: larger indexes and random insert order for no gain while every id is minted by the database.
- **Checks in application code only**: every writer (web, worker, scripts, a future admin) must repeat them, and check-then-insert races under concurrency (reproduced in the lab).
- **Salted phone hashes**: a phone number has too few possible values; a salted hash is reversed by enumerating them, while an HMAC is not without its key.
- **Indexing a foreign key only when a query needs it** (Laurenz Albe's position): leaner, but the owner chose one rule an agent cannot misjudge, with named exceptions.
- **Soft deletes** (`deleted_at`): silently disable foreign keys and uniqueness; we record states with times and delete only what must be removed.

## Consequences

- Positive: native listings are an additive migration, not a redesign; a bug in any writer is stopped at the database; errors carry names that map to messages; the tests hold every future migration to the same rules.
- Negative / risks: more DDL per table (named constraints, comments, grants, indexes); triggers and constraints must be learned before changing a table; the HMAC key is one more secret to keep and rotate.
- Follow-ups: CS-2 fixes the money unit and the model-year columns; CS-6 adds the worker role and the crawl-policy backstop triggers; CS-11 stores phone hashes and photo hashes; CS-19 decides how long a pasted listing is kept; the native-listings task, when planned, follows `docs/design/data-model.md`.
