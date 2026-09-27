# Research pass C (CS-4): database craft, part 1 — modeling, integrity, errors, transactions, migrations, testing and security in PostgreSQL

Date: 2026-09-27. Pass (c) of CS-4's research plan ("modeling, integrity and concurrency craft"). It answers the owner's questions 1, 2, 6, 7 and 9 and lists small, sourced details in the format of CS-26's UI craft passes. Out of scope here and covered by other passes: indexing, EXPLAIN and pgvector (pass d), the access layer, migration tool and job queue (pass b), search (pass a), and the Carshenas table design itself (pass f), which this pass constrains only by principle.

**Method.** Every cited page was fetched on 2026-09-26 or 2026-09-27 (with `curl`, read as text; saved in the research session's lab, not kept), and every quote below was checked mechanically against the saved text (two scripts, `checkq.py` and `checkall.py`, in the research session's lab, not kept: 243 quotes found, none longer than 25 words). "PostgreSQL docs" means the current docs, which on 2026-09-27 are PostgreSQL 18; PostgreSQL 19 docs are Beta 4. Claims about behaviour were reproduced where possible in a lab: Docker `pgvector/pgvector:pg17` (PostgreSQL 17.11, pgvector 0.8.6), two or more concurrent `psql` sessions; the exact SQL and output are in the Lab section; the files were in the research session's lab (not kept). "(inference)" marks my own reasoning. Examples are Carshenas's own: sources, snapshots, listings, price history, valuations, duplicate groups, saved searches and alerts, and future native listings and sellers.

**Confidence.** High: official documentation, or two independent credible sources, or reproduced in the lab. Medium: one credible source, or sources that agree on the mechanism but not on numbers. Low: inference.

**Versions (the uuidv7 question).** The current major is PostgreSQL 18 (18.0 released 2025-09-25; 18.6 on 2026-08-13); PostgreSQL 19 is at Beta 4 (2026-09-24); the pulled lab image is 17.11. PostgreSQL 18 ships `uuidv7()`; 17.11 does not (`ERROR: function uuidv7() does not exist`, lab 1), and 17's `uuid_extract_timestamp()` reads version 1 only, so it returns NULL for a v7 value. pgvector publishes PostgreSQL 18 images (`pgvector/pgvector:0.8.6-pg18`, pushed 2026-08-13). Recommendation (inference): CS-4's compose file should pin a PostgreSQL 18 image, not the pulled pg17 one, because several tips below rely on 18 (`uuidv7()`, `RETURNING old/new`, `NOT NULL ... NOT VALID`, virtual generated columns, `WITHOUT OVERLAPS`, `LIKE` on nondeterministic collations). PostgreSQL 19 adds `INSERT ... ON CONFLICT DO SELECT` and `REPACK CONCURRENTLY`; revisit after its release.

## Short answers to the owner's questions

### 1. Where do checks live: database constraints or application code?

Both, with different jobs. **The database owns every invariant that one row, one key or one reference must satisfy**, because it is the only layer every write passes through: the crawler, the extraction worker, Server Actions, a future seller app, a hand-run fix in `psql`, a migration's backfill. **The application repeats the checks a person can trip over**, earlier and in Farsi next to the field, and treats the database's rejection (SQLSTATE plus constraint name) as the final word, translated into the same message (C-24, C-25). **Rules that span rows or depend on the outside world** («this seller already has three active free listings», «this price is implausible for a 1400 Pride», «Divar is never crawled») live in application code, inside a transaction that makes them safe: lock the parent row or run SERIALIZABLE and retry (C-39, lab 8). Never emulate them with a CHECK that calls a function or with a plain trigger; both race (C-30).

For Carshenas, in PostgreSQL: types; NOT NULL; CHECK for `asking_price_toman > 0`, `mileage_km >= 0`, model-year ranges and state values; `UNIQUE (source_id, source_listing_id)`; one market value per segment and day (`NULLS NOT DISTINCT`, lab 6); foreign keys with a chosen `ON DELETE`. In the app or worker: plausibility against the market value, LLM confidence thresholds and the review queue, per-seller quotas, crawl policy. The split is not "simple checks in the database, complex ones in the app": it is "invariants in the database, judgments and cross-row policies in the app, messages in both".

### 2. Insert and catch the duplicate, or check first?

Neither, as usually written. **Declare the unique constraint; it is the only thing that is actually safe** (lab 2a: two sessions that both checked first inserted the same Bama listing twice). **Then write the insert so that a conflict is not an error**: `INSERT ... ON CONFLICT (source_id, source_listing_id) DO NOTHING`, or `DO UPDATE ... WHERE ... IS DISTINCT FROM ...` to skip no-op writes (C-31, C-33). A check-first query is fine only as a courtesy to the person («این نام قبلاً استفاده شده» before they submit) and never replaces handling the conflict. Plain insert-and-catch works but costs more than it looks: the failed INSERT (23505) aborts the surrounding transaction, so every later statement fails with 25P02 unless a savepoint wrapped the insert, and it leaves a dead tuple and burns an identity value (lab 3: 1,000 failed inserts left 1,000 dead tuples and grew the heap from 72 to 136 kB) (C-34). If you need the existing row back (get-or-create), `DO NOTHING ... RETURNING` returns nothing for it, and under concurrency even the common "UNION ALL with a SELECT" form returns zero rows (lab 2d); re-select in a new statement on PostgreSQL 18, or use `ON CONFLICT DO SELECT` on 19 (C-32). `MERGE` is not a concurrency-safe upsert (lab 17) (C-35).

### 6. How does a senior engineer work with the database and its code?

- **Schema is the most durable code in the product.** Every change is a reviewed, linted, forward-only migration written for a busy table: `lock_timeout` and retries, `NOT VALID` then `VALIDATE`, `CONCURRENTLY`, expand and contract, batched backfills (C-46 to C-52).
- **SQL is code.** Explicit, parameterized queries in server-only modules; every constraint named; errors read by SQLSTATE and constraint name, never by message text (C-22, C-25, C-59).
- **The database guards invariants and concurrency, not the app's memory.** Constraints and `ON CONFLICT` for uniqueness; one atomic `UPDATE`, a row lock, a version column or SERIALIZABLE with a retry wrapper for read-modify-write; short transactions with no network calls inside; side effects staged in the same transaction (C-37 to C-45).
- **Knows the driver's edges.** `bigint` and `numeric` arrive as strings, a JavaScript `Date` keeps milliseconds only, `DATE` is parsed in the process's local time zone, a transaction needs one client (C-9, C-17).
- **Operates by role.** Separate owner/migrator, web, worker and read-only roles, with timeouts and `application_name` per role; the app never connects as owner or superuser (C-45, C-58).
- **Proves behaviour against a real PostgreSQL.** Template-cloned test databases, constraint and policy tests by SQLSTATE, two-session concurrency tests like this pass's lab, migrations run from empty in CI (C-53 to C-57).
- **Measures instead of arguing**: the lab numbers here, and EXPLAIN and index measurement in pass d.

### 7. Data-modeling lessons, the way a strong CS student learns them

1. **Dependencies first.** Write the functional dependencies, decompose until every fact is stored once (BCNF), accept 3NF only where decomposition would lose a dependency you must enforce; any redundancy you keep is either enforced (a composite foreign key) or derived with a rebuild path (C-1 to C-3).
2. **Keys.** A `bigint` identity surrogate for joins, the natural key as a UNIQUE constraint, UUIDv7 only for identifiers minted outside the database; identifiers are neither counts nor secrets (C-4, C-5).
3. **NULL means unknown**, not zero or empty; NOT NULL by default; learn three-valued logic's traps (C-7).
4. **Types carry rules**: `text` with CHECK, `bigint` money in a named unit, `timestamptz` instants, `date` days computed in Asia/Tehran, one state column with CHECK instead of booleans, JSONB for payloads rather than for modeling, child tables rather than arrays you search (C-8 to C-15).
5. **Time and history**: immutable snapshots and append-only observations; "current" values are derived; periods with non-overlap constraints; status instead of soft delete; an audit trail where people edit (C-16 to C-21).
6. **Names and comments are documentation** a reviewer and an agent will read (C-22, C-23).
7. **Model the future by subtypes, not by nullable columns or polymorphic ids** (C-6).

### 9. A model that stays right when Carshenas adds native listings

Principles for pass f (the table design is pass f's job):

- **One `listings` supertype** holds what search, valuation, price history and duplicate detection need, plus `origin` (`crawled` or `native`). Origin-specific facts live in one-to-one subtype tables whose rows can attach only to a listing of their own origin (`UNIQUE (id, origin)` on the supertype, a composite foreign key and a CHECK on the subtype). No polymorphic `owner_type`/`owner_id`, no single table where every origin-specific column is nullable (C-6).
- **Provenance on every fact.** Crawled facts point to the immutable snapshot they were extracted from; native facts point to the seller's listing revision (who, when). Price history and market value then read one observation stream regardless of origin (C-18, C-21). Carshenas itself can be a row in `sources` so every listing has a source (inference).
- **People.** Crawled sellers are never accounts and their personal data is never republished (phone numbers only as keyed hashes, C-61); native sellers are accounts that consented to what is shown. Ownership (`seller_id`) exists only on the native subtype, and row-level security is the second lock behind the app's authorization (C-60, lab 14).
- **Two lifecycles, stated separately.** A crawled listing is observed (active, delisted, with first- and last-seen times); a native listing is asserted and moderated (draft, pending review, published, sold, withdrawn, expired). One status column per lifecycle, with CHECK constraints that tie allowed values to origin (C-10, C-20).
- **Cross-row seller rules** (a quota of active free listings, one active listing per VIN per seller) use a partial unique index where they can be expressed as uniqueness (C-26), and a lock on the seller's row or SERIALIZABLE otherwise (C-39, lab 8).
- **Duplicate groups span both origins**: a native seller may also have posted the same car on Divar or Bama.

### Decisions this pass surfaces for CS-4 (for the owner)

1. **Run PostgreSQL 18 locally, not the pulled 17 image** (Versions note): pin `pgvector/pgvector:0.8.6-pg18` in the compose file.
2. **Amend ADR-0008 point 7**: "salted hashes" of phone numbers cannot be matched across listings if the salt is per row, and are reversible by enumeration if there is no secret; the workable form is a keyed hash (HMAC-SHA-256) with the key outside the database (C-61, lab 15).
3. **Defaults for pass f and the future database skill**: `bigint` identity keys with natural keys as named UNIQUE constraints (C-4); states as `text` with CHECK rather than enums (C-10); every constraint named, with a Farsi message per user-reachable constraint (C-22, C-25); `ON CONFLICT` for every batch write (C-31); timeouts per role (C-45); migrations linted and run with `lock_timeout` and retries (C-46, C-52).
4. **Requirements on pass b's choices**: the migration tool must run statements outside a transaction (for `CONCURRENTLY`) and let each migration set `lock_timeout` (C-46, C-49); the driver must expose SQLSTATE and constraint name on errors and let `bigint` and `date` be parsed deliberately (C-9, C-17, C-25); tests need template-cloned databases, not rollback-only isolation (C-54).

## Tips

Each tip: the title as an instruction; the owner's question it answers (1, 2, 6, 7, 9 or new); why; how, with PostgreSQL and TypeScript specifics on Carshenas examples; sources as author — title — URL — date — "quote of at most 25 words"; confidence; conflicts. Lab numbers refer to the Lab section.

### Modeling fundamentals

### C-1: Write down the functional dependencies before you draw tables
- Owner question: 7
- Why: Normal forms are consequences of functional dependencies (FDs). A schema whose dependencies were never written down drifts into the anomalies Widom's CS145 notes start from (redundancy, update and deletion anomalies): the make repeated on every listing and disagreeing, a model renamed in one place only. FDs are constraints on the real world, so they also tell you which constraints to declare.
- How: Keep the FD list in the data-model document (pass f) and review it with every schema change. Carshenas examples: `trim_id → model_id`; `model_id → make_id`; `(source_id, source_listing_id) → listing_id`; `snapshot_id → (source_id, source_listing_id, fetched_at, payload)`; `(model_id, trim_id, model_year_solar, valued_on) → market_value_toman`. Every FD whose left side is not a key of its table is either a decomposition (`make_id` lives on `models`, not on `listings`) or a constraint to add (the valuation FD becomes the unique key of `valuations`, C-26). The list also tells you what a listing must not store: the source's display name, the make's Farsi label.
- Sources: Jennifer Widom — CS145 Lecture Notes (6): Relational Database Design, Stanford — http://infolab.stanford.edu/~ullman/fcdb/jw-notes06/reldesign.html — Spring 2006 — "Functional dependency "A -> B" says a given A value always has the same B value."; Andy Pavlo — Lecture #01: Relational Model & Algebra, CMU 15-445/645 — https://15445.courses.cs.cmu.edu/fall2025/notes/01-relationalmodel.pdf — Fall 2025 — "A constraint is a user-defined condition that must hold for any instance of the database."
- Confidence: high.
- Conflicts: none.

### C-2: Normalise to BCNF by default, and keep a redundant column only when a constraint keeps it true
- Owner question: 7
- Why: BCNF stores each dependency exactly once. 3NF is the textbook fallback when decomposing to BCNF would split a dependency across tables so that no single-table constraint can check it. Redundancy kept for convenience or speed must be enforced, or it rots.
- How: Listings are filtered by model and by trim, and a trim implies its model, so storing both on `listings` is redundant. Keep it honest with a composite foreign key instead of trusting the extractor: `ALTER TABLE trims ADD CONSTRAINT trims_id_model_key UNIQUE (id, model_id);` and on listings `CONSTRAINT listings_trim_model_fkey FOREIGN KEY (trim_id, model_id) REFERENCES trims (id, model_id)`. With the default `MATCH SIMPLE`, a NULL `trim_id` (trim unknown) skips the check, and a trim that belongs to another model is rejected: a real LLM extraction error becomes a named constraint violation (C-25). Do not copy `make_id` onto listings unless the same technique guards it.
- Sources: Jennifer Widom — CS145 Lecture Notes (6) — http://infolab.stanford.edu/~ullman/fcdb/jw-notes06/reldesign.html — Spring 2006 — "Boyce-Codd Normal Form says if A,B are both in relation R, then A must be a key => A-B connection stored only once." and "BCNF/4NF decomposition does not guarantee that all of the original FDs can be enforced on the individual decomposed relations."; Jun Yang — CS145 Lecture Notes #14: Lossless Decomposition, 3NF, 4NF, Stanford — http://infolab.stanford.edu/~ullman/fcdb/spr99/lec14.pdf — Spring 1999 — "If we decompose, we cannot check all FD’s in decomposed relations"; PostgreSQL docs — 5.5 Constraints — https://www.postgresql.org/docs/current/ddl-constraints.html — 18 — "A foreign key must reference columns that either are a primary key or form a unique constraint, or are columns from a non-partial unique index." and "Normally, a referencing row need not satisfy the foreign key constraint if any of its referencing columns are null."
- Confidence: high for the theory; medium for the composite-key guard as applied here (inference).
- Conflicts: none.

### C-3: Denormalise only with a derivation rule, a single owner and a rebuild path
- Owner question: 7
- Why: Derived data (market values, a model's daily price trend, match keys, counts) is what makes Carshenas useful, and it is safe only if it can be recomputed from the record. ADR-0007 already states that everything derived can be rebuilt from snapshots.
- How: Choose the lightest mechanism that fits. (1) An expression in the query, or a virtual generated column (the PostgreSQL 18 default kind, computed on read; it cannot use user-defined functions and cannot be indexed in 18): for example the price gap percentage. (2) A stored generated column (immutable functions of the same row only; adding one to an existing table rewrites it, C-50): for example a normalised title used for matching, which can be indexed (C-12). (3) A materialized view refreshed by the worker: for example the model page's daily median price; `REFRESH MATERIALIZED VIEW CONCURRENTLY` needs a unique index on the view. (4) A derived table owned by one job: `valuations` and duplicate groups, with `computed_at`, `algorithm_version` and an input hash so a rerun can be compared and cached (ADR-0007's LLM caching rule). Never let two writers (a trigger and the app) maintain the same derived value (inference).
- Sources: PostgreSQL docs — 5.4 Generated Columns — https://www.postgresql.org/docs/current/ddl-generated-columns.html — 18 — "a virtual generated column is similar to a view and a stored generated column is similar to a materialized view" and "the generation expression of a virtual generated column must not reference user-defined functions or types"; PostgreSQL — Release 18 — https://www.postgresql.org/docs/18/release-18.html — 2025-09-25 — "Virtual generated columns generate their values when the columns are read, not written."; Haki Benita — Unconventional PostgreSQL Optimizations — https://hakibenita.com/postgresql-unconventional-optimizations — 2026-01-20 — "PostgreSQL 18 does not support indexes on virtual generated columns"; PostgreSQL docs — REFRESH MATERIALIZED VIEW — https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html — 18 — "This option is only allowed if there is at least one UNIQUE index on the materialized view"; Martin Kleppmann — Turning the database inside-out — https://martin.kleppmann.com/2015/03/04/turning-the-database-inside-out.html — 2015-03-04 — "An index is a data structure derived from table data"; Andrew Atkinson — CORE Database Schema Design — https://andyatkinson.com/constraint-driven-optimized-responsive-efficient-core-db-design — 2025-06-09 — "Relational data is initially stored in a normalized form to eliminate duplication, but later denormalizations can be performed when read access is more important."
- Confidence: high.
- Conflicts: none.

### Keys and identifiers

### C-4: Give every entity a bigint identity key and keep its natural key as a named UNIQUE constraint
- Owner question: 7
- Why: A surrogate key is small, stable and cheap to join; the natural key (the listing's id on its source) can change format but must still be unique, so it is declared, not implied. `bigint` because `integer` can run out and converting a busy primary key later is a multi-release project; identity rather than `serial` because it is standard, owns its sequence cleanly and, with `GENERATED ALWAYS`, refuses hand-typed ids that would collide later.
- How: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` on entity tables; `CONSTRAINT listings_source_listing_key UNIQUE (source_id, source_listing_id)` (lab 2); for snapshots, a uniqueness rule that makes an identical refetch a no-op, such as `UNIQUE (source_id, source_listing_id, content_sha256)` with `ON CONFLICT DO NOTHING` (inference). Identity values have gaps by design: every conflicting `ON CONFLICT` row still consumed one (lab 3: the identity advanced by 1,000 on each rerun of 1,000 existing listings), and so do rollbacks, so never show ids as counts or use them to order events across tables. Foreign-key columns referencing these keys are `bigint` too.
- Sources: Laurenz Albe — UUID, serial or identity columns for PostgreSQL auto-generated primary keys? — https://www.cybertec-postgresql.com/en/uuid-serial-or-identity-columns-for-postgresql-auto-generated-primary-keys/ — 2021-05, updated 2022-05-14 — "You should always use bigint." and "You should use an identity column, unless you have to support old PostgreSQL versions."; PostgreSQL wiki — Don't Do This — https://wiki.postgresql.org/wiki/Don%27t_Do_This — edited 2024-11-21 — "For new applications, identity columns should be used instead."; Nikolay Samokhvalov — Postgres.fm, Schema design checklist (transcript) — https://postgres.fm/episodes/schema-design-checklist — 2026-04-17 — "If you are prepared for really large volumes of data, it must not be int4, it should be int8."; GitLab — Foreign keys and associations — https://docs.gitlab.com/development/database/foreign_keys/ — read 2026-09-27 — "When adding a new foreign key, you should define it as bigint."; PostgreSQL docs — 5.5 Constraints — https://www.postgresql.org/docs/current/ddl-constraints.html — 18 — "Relational database theory dictates that every table must have a primary key."
- Confidence: high.
- Conflicts: Andrew Atkinson — CORE Database Schema Design — https://andyatkinson.com/constraint-driven-optimized-responsive-efficient-core-db-design — 2025-06-09 — "For small databases, use integer primary keys." Laurenz, Nikolay and GitLab's integer-to-bigint procedure argue the other way; `bigint` costs four bytes a row at Carshenas's size and saves a risky migration later.

### C-5: Use UUIDv7 only for identifiers minted outside the database, never UUIDv4 as a primary key, and never treat any identifier as a secret
- Owner question: 7
- Why: Random version-4 keys scatter B-tree inserts across pages (splits, larger indexes, more WAL and cache pressure). Version 7 is time-ordered and inserts almost like a sequence, but it is still twice the size of `bigint` and it embeds the creation time. RFC 9562 warns that UUIDs are not hard to guess, so they are no substitute for authorization.
- How: Default to `bigint` identity (C-4). Use `uuid DEFAULT uuidv7()` (PostgreSQL 18) where an identifier must exist before its row: for example the object key of a listing photo that the worker uploads to ArvanCloud before recording it (CS-29), or ids created by a client offline (inference). On 17 there is no `uuidv7()` (lab 1); the SQL fallback published by postgres.ai works but orders only to the millisecond (lab 1: about half of 4,999 consecutive pairs, 2,477 and 2,499 in two runs, sorted backwards within the same millisecond; none across milliseconds) and 17's `uuid_extract_timestamp()` returns NULL for it, which is one more reason to run 18. Listing pages may use the `bigint` id in URLs, since listings are public anyway; saved searches and a seller's drafts are protected by authorization and row-level security (C-60), not by unguessable ids.
- Sources: PostgreSQL docs — 9.14 UUID Functions — https://www.postgresql.org/docs/current/functions-uuid.html — 18 — "Generates a version 7 (time-ordered) UUID."; PostgreSQL 17 docs — 9.14 UUID Functions — https://www.postgresql.org/docs/17/functions-uuid.html — 17 — "This function extracts a timestamp with time zone from UUID version 1. For other versions, this function returns null."; Andrew Atkinson — PostgreSQL 18: 23x Faster Inserts With UUID v7 — https://andyatkinson.com/postgresql-18-uuidv7 — 2026-08-26 — "The biggest speedup was 23x faster average execution time for a multi-row insert query" and "This can be viewed as “leaking” or exposing the creation time of the record via that timestamp"; Nikolay Samokhvalov — Postgres.fm, Schema design checklist — https://postgres.fm/episodes/schema-design-checklist — 2026-04-17 — "avoid UUID version 4 if you want good performance on large volumes of data"; K. Davis, B. Peabody, P. Leach — RFC 9562 — https://www.rfc-editor.org/rfc/rfc9562 — May 2024 — "Implementations SHOULD NOT assume that UUIDs are hard to guess." and "Timestamps embedded in the UUID do pose a very small attack surface."; Laurenz Albe — UUID, serial or identity columns — (URL as C-4) — 2021 — "My advice is to use a sequence unless you use database sharding or have some other reason to generate primary keys in a "decentralized" fashion".
- Confidence: high.
- Conflicts: Michael Christofides — Postgres.fm, Schema design checklist — 2026-04-17 — "But now that we have first-class support for time-ordered UUIDs, I don't see many reasons not to go with that." Nikolay answers with the doubled size. Carshenas mints almost all ids inside the database, so `bigint` stays the default (inference).

### C-6: Model the two listing origins as subtypes of one supertype, not as polymorphic ids or a table of nullable columns
- Owner question: 9
- Why: Crawled and native listings share everything that search, valuation, price history and duplicate detection use, but each has required facts the other lacks (a source and its id; a seller account and a moderation state). One wide table forces every origin-specific column to be nullable; a polymorphic `owner_type`/`owner_id` pair cannot have a foreign key. The exclusive-subtype pattern (a supertype table, one table per subtype, a composite foreign key on `(id, type)` and a CHECK on the type) keeps both kinds correct declaratively. Portas credits it to Joe Celko.
- How (a sketch for pass f; names follow C-22):
  ```sql
  CREATE TABLE listings (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    origin text NOT NULL CONSTRAINT listings_origin_check CHECK (origin IN ('crawled', 'native')),
    model_id bigint NOT NULL REFERENCES models,
    asking_price_toman bigint CONSTRAINT listings_asking_price_check CHECK (asking_price_toman > 0),
    -- ...facts shared by every origin
    CONSTRAINT listings_id_origin_key UNIQUE (id, origin)
  );
  CREATE TABLE crawled_listings (
    listing_id bigint PRIMARY KEY,
    origin text NOT NULL DEFAULT 'crawled' CONSTRAINT crawled_listings_origin_check CHECK (origin = 'crawled'),
    source_id bigint NOT NULL REFERENCES sources,
    source_listing_id text NOT NULL,
    CONSTRAINT crawled_listings_listing_fkey FOREIGN KEY (listing_id, origin)
      REFERENCES listings (id, origin) ON DELETE CASCADE,
    CONSTRAINT crawled_listings_source_listing_key UNIQUE (source_id, source_listing_id)
  );
  CREATE TABLE native_listings (
    listing_id bigint PRIMARY KEY,
    origin text NOT NULL DEFAULT 'native' CONSTRAINT native_listings_origin_check CHECK (origin = 'native'),
    seller_id bigint NOT NULL REFERENCES sellers,
    status text NOT NULL CONSTRAINT native_listings_status_check
      CHECK (status IN ('draft', 'pending_review', 'published', 'sold', 'withdrawn', 'expired')),
    CONSTRAINT native_listings_listing_fkey FOREIGN KEY (listing_id, origin)
      REFERENCES listings (id, origin) ON DELETE CASCADE
  );
  ```
  A native row cannot attach to a crawled listing. The reverse rule, "every listing has exactly one subtype row", is not declarative: create both rows in one function inside one transaction and cover it with a test (a deferred constraint trigger could enforce it if it ever matters) (inference). Code that does not care about origin reads `listings` alone.
- Sources: GitLab — Polymorphic associations — https://docs.gitlab.com/development/database/polymorphic_associations/ — read 2026-09-27 — "Summary: always use separate tables instead of polymorphic associations."; GitLab — Single Table Inheritance — https://docs.gitlab.com/development/database/single_table_inheritance/ — read 2026-09-27 — "Summary: Don’t design new tables using Single Table Inheritance (STI)."; Martin Fowler — Class Table Inheritance (PoEAA) — https://martinfowler.com/eaaCatalog/classTableInheritance.html — 2003-03-05 — "Represents an inheritance hierarchy of classes with one table for each class."; David Portas — Exclusive Subtyping in SQL (archived) — http://web.archive.org/web/20160102183531/http://www.dpxo.net/articles/exclusivesubtypes.htm — 2007, archived 2016-01-02 — "The solution I like to use is to create separate tables for the generic (supertype) attributes" and "Joe later used my example in the 4th edition of his SQL for Smarties book (page 83)."; PostgreSQL docs — 5.5 Constraints — (URL as C-2) — 18 — "A foreign key must reference columns that either are a primary key or form a unique constraint, or are columns from a non-partial unique index."
- Confidence: medium (an established pattern, applied here by inference).
- Conflicts: Fowler also documents Single Table Inheritance to avoid joins, and at Carshenas's size one table with CHECKs would work; the disjoint required columns and the seller-ownership boundary for row-level security favour subtypes. GitLab's ban on STI is partly driven by its scale.

### Types

### C-7: Make columns NOT NULL unless "unknown" is a real, documented state, and learn three-valued logic's traps
- Owner question: 7
- Why: NULL means unknown and propagates: comparisons with it are unknown, a CHECK accepts unknown, `NOT IN` against a list containing NULL matches nothing, and unique constraints treat NULLs as distinct by default (C-26). Schemas generated by AI tools tend to omit NOT NULL, per Postgres.fm.
- How: Make "no price" explicit instead of overloading NULL: `price_kind text NOT NULL CHECK (price_kind IN ('fixed', 'negotiable', 'installment'))` with `CONSTRAINT listings_price_matches_kind CHECK ((price_kind = 'fixed') = (asking_price_toman IS NOT NULL))`, so «توافقی» and a forgotten price cannot be confused and installment bait stays out of market value (glossary). A bare `CHECK (asking_price_toman > 0)` accepts NULL (lab 6). Use `IS DISTINCT FROM` for change detection (C-33) and `NOT EXISTS` instead of `NOT IN (subquery)` (lab 6: `x NOT IN (2, NULL)` returned 0 of 3 rows; `NOT EXISTS` returned 2). In TypeScript, map SQL NULL to `null`, never to `undefined`; postgres.js rejects `undefined` parameters outright.
- Sources: PostgreSQL docs — 5.5 Constraints — https://www.postgresql.org/docs/current/ddl-constraints.html — 18 — "In most database designs the majority of columns should be marked not null." and "It should be noted that a check constraint is satisfied if the check expression evaluates to true or the null value."; Markus Winand — The Three-Valued Logic of SQL — https://modern-sql.com/concept/three-valued-logic — read 2026-09-27 — "Check constraints follow the reverse logic: they reject false, rather than accepting true as the other clauses do."; Markus Winand — NULL — https://modern-sql.com/concept/null — read 2026-09-27 — "Comparisons (<, >, =, …) to null are neither true nor false but instead return the third logical value of SQL: unknown."; PostgreSQL wiki — Don't Do This — (URL as C-4) — 2024-11-21 — "NOT IN behaves in unexpected ways if there is a null present"; Andrew Atkinson — CORE Database Schema Design — (URL as C-3) — 2025-06-09 — "Use NOT NULL for columns by default. Create foreign key constraints for table relationships by default."
- Confidence: high (documentation and lab).
- Conflicts: none.

### C-8: Store strings as text with a CHECK for the real rule; never char(n), and varchar(n) only when a length limit is the rule
- Owner question: 7
- Why: `text`, `varchar` and `varchar(n)` perform the same; an arbitrary `varchar(255)` is a future production error, and a CHECK can express the actual rule (minimum length, pattern, maximum). A CHECK can later be replaced online (NOT VALID then VALIDATE), which a type change cannot.
- How: `title text NOT NULL CONSTRAINT listings_title_length_check CHECK (char_length(title) BETWEEN 3 AND 200)`; `source_listing_id text NOT NULL CHECK (source_listing_id ~ '^[A-Za-z0-9_-]{1,64}$')`; `vin text CHECK (vin ~ '^[A-HJ-NPR-Z0-9]{17}$')`. `char_length` counts characters, and the zero-width non-joiner is one of them, so Persian limits need a little headroom (inference). Mirror the same limits in the zod schemas that validate forms, and test that they agree (C-25).
- Sources: PostgreSQL docs — 8.3 Character Types — https://www.postgresql.org/docs/current/datatype-character.html — 18 — "There is no performance difference among these three types, apart from increased storage space when using the blank-padded type"; PostgreSQL wiki — Don't Do This — (URL as C-4) — 2024-11-21 — "Don't use the type varchar(n) by default. Consider varchar (without the length limit) or text instead."; GitLab — Strings and the Text data type — https://docs.gitlab.com/development/database/strings_and_the_text_data_type/ — read 2026-09-27 — "text columns should always have a limit set"
- Confidence: high.
- Conflicts: GitLab wants a limit on every text column; the wiki wants a limit only where a real rule exists. For Carshenas: limits where the product has a rule (titles, identifiers), no invented 255s (inference).

### C-9: Store money as bigint in one named unit with a range check; never money or floats; convert it deliberately in TypeScript
- Owner question: 7
- Why: Amounts must be exact. The `money` type depends on the database's locale and floats are inexact. Car prices run to billions of toman, beyond `integer`'s 2,147,483,647 even in toman; `bigint` is ample, and a JavaScript Number holds integers exactly up to 9,007,199,254,740,991. AGENTS.md already fixes "money as integers" and leaves the unit to CS-2.
- How: `asking_price_toman bigint CONSTRAINT listings_asking_price_range_check CHECK (asking_price_toman BETWEEN 1000000 AND 100000000000000)` (placeholder bounds for CS-2 to set). The database rejects the impossible (zero, negative, absurd); the implausible (ten times the market value, a rial amount typed as toman) is the valuation step's job and goes to the review queue: question 1's split in miniature. Put the unit in the name (`_toman` or `_rial`, whichever CS-2 chooses) and in a COMMENT (C-23). Use `numeric` only for true fractions such as a rate with decimals (inference). Drivers return `bigint` as a string (node-postgres has no parser for it by default, and postgres.js returns a string too): convert at the query boundary with a `Number.isSafeInteger` guard or use `BigInt`, never `parseFloat` (lab 12: 12,000,000,000 is a safe integer).
- Sources: PostgreSQL docs — 8.1 Numeric Types — https://www.postgresql.org/docs/current/datatype-numeric.html — 18 — "If you require exact storage and calculations (such as for monetary amounts), use the numeric type instead."; PostgreSQL docs — 8.2 Monetary Types — https://www.postgresql.org/docs/current/datatype-money.html — 18 — "it might not work to load money data into a database that has a different setting of lc_monetary"; PostgreSQL wiki — Don't Do This — (URL as C-4) — 2024-11-21 — "The money data type isn't actually very good for storing monetary values."; Elizabeth Christensen (Crunchy Data) — Working with Money in Postgres — https://www.crunchydata.com/blog/working-with-money-in-postgres — 2023-10-11 — "This is not recommended because it doesn’t handle fractions of a cent and currency is tied to a database locale setting."; node-postgres — Data Types — https://node-postgres.com/features/types — read 2026-09-27 — "node-postgres will convert a database type to a JavaScript string if it doesn’t have a registered type parser for the database type."; Porsager — postgres.js README — https://github.com/porsager/postgres — read 2026-09-27 — "Postgres.js will return it as a string"
- Confidence: high.
- Conflicts: Christensen also writes "numeric is widely considered the ideal datatype for storing money in Postgres." That fits currencies with fractional units; toman and rial amounts in listings are whole numbers, so `bigint` is exact and faster, and the owner has already chosen integers.

### C-10: Represent a state as one text column with a CHECK, or a lookup table when the values carry data; not enums, not clusters of booleans
- Owner question: 7, 9
- Why: Enum values cannot be removed, and even deleting their uses does not make removal safe; a CHECK list changes online in two steps (C-48). Separate booleans (`is_active`, `is_sold`, `is_deleted`) admit impossible combinations; one state column with a CHECK admits only real states (inference).
- How: Crawled listings: `status text NOT NULL CHECK (status IN ('active', 'delisted'))`; the native lifecycle lives on the native subtype (C-6). Deal ratings (`great`, `good`, `fair`, `high`, `overpriced`, per the glossary) carry an order and Farsi labels, so they fit a small lookup table `deal_ratings (code text PRIMARY KEY, rank smallint NOT NULL UNIQUE, label_fa text NOT NULL)` with a foreign key from wherever a rating is stored. Growing vocabularies (makes, models, trims, cities, sources) are tables with foreign keys, never CHECK lists. On the TypeScript side, derive the union type from the same list or read it from the lookup table, and test that the two agree (inference).
- Sources: PostgreSQL docs — 8.7 Enumerated Types — https://www.postgresql.org/docs/current/datatype-enum.html — 18 — "Existing values cannot be removed from an enum type"; Supabase — Managing Enums in Postgres — https://supabase.com/docs/guides/database/postgres/enums — read 2026-09-27 — "There is no ALTER TYPE DELETE VALUE in Postgres."; Craig Kerstiens (Crunchy Data) — Enums vs Check Constraints in Postgres — https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres — 2022-12-08 — "My vote, if you’re thinking about enums, do a test drive of the CHECK constraint."; Nikolay Samokhvalov — Postgres.fm, Schema design checklist — (URL as C-4) — 2026-04-17 — "what is usually underused is check constraints"
- Confidence: high.
- Conflicts: none against CHECK; enums remain defensible for a small set that never changes.

### C-11: Use a domain for a rule shared by many columns, let the domain allow NULL, and create it together with its tables
- Owner question: 7
- Why: A domain names a rule once (`toman_amount` is a positive `bigint`) for asking prices, market values and price-drop amounts. But a domain's NOT NULL can be bypassed (outer joins, an empty scalar subquery), adding a column of a constrained domain to an existing table rewrites the table, and changing the domain's constraint re-checks every column that uses it.
- How: `CREATE DOMAIN toman_amount AS bigint CONSTRAINT toman_amount_positive CHECK (VALUE > 0);` then `asking_price_toman toman_amount` with NOT NULL on the column where required. Create domains in the same migration as the tables that use them; to change a domain's rule later, add the new constraint `NOT VALID` and validate it separately (inference from C-48).
- Sources: PostgreSQL docs — CREATE DOMAIN — https://www.postgresql.org/docs/current/sql-createdomain.html — 18 — "Best practice therefore is to design a domain's constraints so that a null value is allowed"; PostgreSQL docs — ALTER TABLE, Notes — https://www.postgresql.org/docs/current/sql-altertable.html — 18 — "will cause the entire table and its indexes to be rewritten" (said of, among others, a column whose domain has constraints); Squawk — ban-create-domain-with-constraint — https://squawkhq.com/docs/ban-create-domain-with-constraint — read 2026-09-27 — "Postgres domains, which associate a data type with an optional check constraint, have poor support for online migrations when associated with a check constraint."
- Confidence: medium.
- Conflicts: Squawk discourages constrained domains; the PostgreSQL docs present them as the tool for shared rules. Resolution above: use them, but only in new tables.

### C-12: Normalise Persian text on write into a separate matching column, keep the original, and don't reach for citext
- Owner question: 7
- Why: Matching titles, trims and seller names across sources fails on Arabic ي and ك against Persian ی and ک, on Persian, Arabic and Latin digits, on the zero-width non-joiner and on tatweel (ADR-0007 lists the same rules for search). `citext` only folds case, following the database's locale; the PostgreSQL docs themselves suggest nondeterministic collations instead, and those gained `LIKE` support only in 18. None of that addresses Persian's variants (inference).
- How: An `IMMUTABLE` SQL function `normalize_fa(text)` built from `translate()` and `regexp_replace()` (ي to ی, ك to ک, ۰–۹ and ٠–٩ to 0–9, drop U+0640, collapse spaces, one consistent rule for the non-joiner per purpose), used by a stored generated column `title_match text GENERATED ALWAYS AS (normalize_fa(title)) STORED` created with the table: a virtual column may not call a user-defined function, and adding a stored one later rewrites the table (C-50). Alternatively compute it in the extraction step and store it. Test the function with fixtures that keep «آگهی‌ها» (UI craft T-22). For Latin e-mail addresses of future sellers, a unique index on `lower(email)` is enough (inference).
- Sources: PostgreSQL docs — F.9 citext — https://www.postgresql.org/docs/current/citext.html — 18 — "Consider using nondeterministic collations (see Section 23.2.2.4) instead of this module."; PostgreSQL — Release 18 — https://www.postgresql.org/docs/18/release-18.html — 2025-09-25 — "Allow LIKE with nondeterministic collations"; PostgreSQL docs — 5.4 Generated Columns — (URL as C-3) — 18 — "the generation expression of a virtual generated column must not reference user-defined functions or types"
- Confidence: medium (documented mechanisms; the Persian function is inference, and search normalisation proper belongs to pass a).
- Conflicts: none.

### C-13: Keep raw payloads in JSONB, and give every field you filter, join, constrain or value its own typed column
- Owner question: 7
- Why: JSONB suits an immutable snapshot of a source's page data and an LLM's raw output kept for audit. As a modeling tool it hides fields from constraints and from the planner's statistics, repeats every key in every row, and locks the whole document on any update. An entity-attribute-value table is worse still.
- How: `snapshots.payload jsonb NOT NULL CONSTRAINT snapshots_payload_object_check CHECK (jsonb_typeof(payload) = 'object')`; `extractions.output jsonb NOT NULL` next to `extractions.schema_version`. On listings, typed columns: `mileage_km integer CHECK (mileage_km >= 0)`, `model_year_solar smallint`, `gearbox text CHECK (gearbox IN ('manual', 'automatic'))`, `fuel text CHECK (...)`, `asking_price_toman bigint`. Source-specific extras no feature reads stay in the payload until a feature needs one; then a migration promotes it to a column. Never `listing_attributes (listing_id, key, value text)`.
- Sources: PostgreSQL docs — 8.14 JSON Types — https://www.postgresql.org/docs/current/datatype-json.html — 18 — "it is still recommended that JSON documents have a somewhat fixed structure." and "keep in mind that any update acquires a row-level lock on the whole row."; Dan Robinson (Heap) — When To Avoid JSONB In A PostgreSQL Schema — https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema — 2016-09-01 — "your data doesn’t have statistics, so the query planner is flying blind." and "for values that occur in most of your rows, it’s still a good idea to keep them separate."; GitLab — Serializing data — https://docs.gitlab.com/development/database/serializing_data/ — read 2026-09-27 — "don’t store serialized data in the database, use separate columns and/or tables instead."; Joe Celko — Avoiding the EAV of Destruction (Simple Talk) — https://www.red-gate.com/simple-talk/databases/sql-server/t-sql-programming-sql-server/avoiding-the-eav-of-destruction/ — 2009-06-18 — "a very common schema design error for programmers who started with an OO or a loosely typed programming language."
- Confidence: high.
- Conflicts: Heap's statistics complaint predates later planner work on expression statistics (not verified here); the constraint argument stands regardless.

### C-14: Use child tables, not arrays, for anything you search, constrain or reference
- Owner question: 7
- Why: An array cannot carry a foreign key or a per-element CHECK that the planner understands, and searching inside arrays is the documented smell.
- How: `listing_photos (listing_id bigint REFERENCES listings ON DELETE CASCADE, position smallint, object_key text, width integer, height integer, PRIMARY KEY (listing_id, position))`, because CS-29 stores metadata per photo. Body condition as rows: `listing_body_panels (listing_id, panel text CHECK (panel IN ('hood', 'roof', 'front_left_door', ...)), condition text CHECK (condition IN ('spot', 'painted', 'replaced')))`, because «سقف تعویض» is searched and priced. An array is fine for a small list read and written as a whole, such as `extraction_warnings text[]` (inference).
- Sources: PostgreSQL docs — 8.15 Arrays — https://www.postgresql.org/docs/current/arrays.html — 18 — "Arrays are not sets; searching for specific array elements can be a sign of database misdesign."
- Confidence: medium (one source plus inference).
- Conflicts: none.

### C-15: Order the columns of large tables by alignment when you create them
- Owner question: 7
- Why: PostgreSQL pads each column to its type's alignment, so a `smallint` before a `bigint` wastes six bytes in every row. On `snapshots` and `listings`, the tables that will grow, that is free space at creation time and a rewrite later.
- How: 8-byte types first (`bigint`, `timestamptz`, `double precision`), then 4-byte (`integer`, `date`), 2-byte (`smallint`), 1-byte (`boolean`), then variable-length (`text`, `jsonb`, arrays). Only for big tables and only at creation; not worth a rewrite of an existing table (inference).
- Sources: GitLab — Ordering Table Columns in PostgreSQL — https://docs.gitlab.com/development/database/ordering_table_columns/ — read 2026-09-27 — "For GitLab we require that columns of new tables are ordered to use the least amount of space."; Nikolay Samokhvalov — Postgres.fm, Schema design checklist — (URL as C-4) — 2026-04-17 — "Due to padding alignment, if int2, for example, is followed by int8, you will see a gap of 6 bytes of zeros in every row."
- Confidence: high.
- Conflicts: none.

### Time and history

### C-16: Store instants as timestamptz, compute calendar days in Asia/Tehran, and use half-open ranges
- Owner question: 7
- Why: `timestamptz` is an absolute instant, stored in UTC; `timestamp` is "a picture of a clock". Fixed offsets are wrong for history: Iran abolished daylight saving time after 2022, so June 2021 in Tehran was UTC+04:30 and June 2026 is UTC+03:30 (lab 12). A "daily" market value is a Tehran day: 21:00 UTC on 26 September is already 27 September in Tehran (lab 12). `timestamp(0)` rounds up to half a second into the future.
- How: `fetched_at`, `first_seen_at`, `last_seen_at`, `delisted_at` are `timestamptz NOT NULL` where applicable; `valued_on date NOT NULL`, set by the valuation job as `(computed_at AT TIME ZONE 'Asia/Tehran')::date`, never `now()::date` in a UTC session. Give every connection an explicit `TimeZone` (UTC for workers, for deterministic logs) and convert explicitly; show Jalali dates only in the UI (AGENTS.md). Query ranges as `fetched_at >= $1 AND fetched_at < $2`, never BETWEEN. Model years are not dates: `model_year_solar smallint` and `model_year_gregorian smallint` with range CHECKs (glossary).
- Sources: Laurenz Albe — Time zone management in PostgreSQL — https://www.cybertec-postgresql.com/en/time-zone-management-in-postgresql/ — 2022-05 — "it would be more appropriate to call it “absolute timestamp”" and "Don't try hybrid solutions, they will probably lead to pain and confusion."; PostgreSQL wiki — Don't Do This — (URL as C-4) — 2024-11-21 — "So if what you want to store is a point in time, rather than a picture of a clock, use timestamptz." and "Because it rounds off the fractional part rather than truncating it as everyone would expect."; PostgreSQL docs — 8.5 Date/Time Types — https://www.postgresql.org/docs/current/datatype-datetime.html — 18 — "All timezone-aware dates and times are stored internally in UTC."; IANA — tz database 2022b NEWS — https://data.iana.org/time-zones/tzdb-2022b/NEWS — 2022-08-10 — "Iran no longer observes DST after 2022."
- Confidence: high (documentation and lab).
- Conflicts: Laurenz accepts "`timestamp` everywhere, UTC by convention" as the other consistent option; the wiki does not. Both forbid mixing.

### C-17: Know what the TypeScript driver does to time and numbers before you rely on equality
- Owner question: 6, 7
- Why: PostgreSQL keeps microseconds; a JavaScript `Date` keeps milliseconds. node-postgres parses `timestamptz` into a `Date`, and `DATE` and `timestamp` into the Node process's local time. `now()` is the transaction's start time.
- How: Lab 12: `2026-09-26 22:40:05.123456+00` became `2026-09-26T22:40:05.123Z` in JavaScript, and the database no longer considers the two equal. Therefore: (a) never use `updated_at` as an optimistic-concurrency token; use an integer `version` (C-38); (b) register a type parser that returns `date` values (OID 1082) as their `YYYY-MM-DD` string, so a valuation day never shifts with `TZ` (inference from the documented local-time conversion); (c) remember that every row written by one import transaction gets the same `now()`, and use `clock_timestamp()` where each row needs its own time (lab 10); (d) convert `bigint` deliberately (C-9); (e) run a transaction on one checked-out client, never with `pool.query('BEGIN')`.
- Sources: MDN — Date — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date — read 2026-09-27 — "A JavaScript date is fundamentally specified as the time in milliseconds that has elapsed since the epoch"; node-postgres — Data Types — https://node-postgres.com/features/types — read 2026-09-27 — "node-postgres converts DATE and TIMESTAMP columns into the local time of the node process set at process.env.TZ"; PostgreSQL docs — 9.9 Date/Time Functions — https://www.postgresql.org/docs/current/functions-datetime.html — 18 — "the intent is to allow a single transaction to have a consistent notion of the “current” time"; node-postgres — Transactions — https://node-postgres.com/features/transactions — read 2026-09-27 — "You must use the same client instance for all statements within a transaction."
- Confidence: high (documentation and lab).
- Conflicts: none.

### C-18: Keep snapshots immutable and price history append-only, and derive "current" values from them
- Owner question: 7, 9
- Why: Immutable facts can always be re-derived, which is how ADR-0007 makes every derived table rebuildable. Immutability is better enforced by privileges than by discipline (inference).
- How: The worker's role may only insert and read snapshots: `GRANT SELECT, INSERT ON snapshots TO carshenas_worker;` with no UPDATE or DELETE; retention runs under its own role (C-62). Price history as observations: `listing_price_observations (listing_id bigint REFERENCES listings, observed_at timestamptz, asking_price_toman bigint, snapshot_id bigint REFERENCES snapshots, PRIMARY KEY (listing_id, observed_at))`, appended whenever a snapshot shows a different price (or on every sighting, if storage allows); price drops come from `lag()` over it; the listing's current price is updated in the same transaction as the observation, or read from a view. Native listings append revisions instead (C-21), and both feed the same observation table.
- Sources: Martin Kleppmann — Turning the database inside-out — (URL as C-3) — 2015-03-04 — "structure all of your data as immutable facts"; PostgreSQL docs — 5.8 Privileges — https://www.postgresql.org/docs/current/ddl-priv.html — 18 — "The right to modify or destroy an object is inherent in being the object's owner"
- Confidence: medium (the principle is well supported; the tables are inference).
- Conflicts: none.

### C-19: When you store a period, store it as a range with a non-overlap constraint
- Owner question: 7
- Why: Application time ("when was this true of the car") differs from system time ("when did the database learn it"). Crawled prices are points (seen at a moment); periods appear with native listings and business rules, and a range with an exclusion constraint makes overlapping periods impossible rather than merely unlikely.
- How: A promoted placement: `promotions (listing_id bigint, during tstzrange NOT NULL, CONSTRAINT promotions_no_overlap_excl EXCLUDE USING gist (listing_id WITH =, during WITH &&))` with the `btree_gist` extension; on 18, `PRIMARY KEY (listing_id, during WITHOUT OVERLAPS)` says the same thing, and temporal foreign keys use `PERIOD`. A catalogue trim whose canonical specification changes: keep type 2 versions with `valid_during daterange`, so an old valuation still explains itself with the specification it used (inference). Use `[)` bounds; temporal keys reject empty ranges.
- Sources: PostgreSQL 19 (Beta) docs — 5.7 Temporal Tables — https://www.postgresql.org/docs/19/ddl-temporal-tables.html — Beta 4 — "Application time tracks the history of a thing out in the world, and system time tracks the history of the database itself."; PostgreSQL docs — 8.17 Range Types — https://www.postgresql.org/docs/current/rangetypes.html — 18 — "While UNIQUE is a natural constraint for scalar values, it is usually unsuitable for range types."; PostgreSQL docs — CREATE TABLE — https://www.postgresql.org/docs/current/sql-createtable.html — 18 — "In effect, such a constraint is enforced with an EXCLUDE constraint rather than a UNIQUE constraint."; Hubert "depesz" Lubaczewski — Waiting for PostgreSQL 18 – Add temporal PRIMARY KEY and UNIQUE constraints — https://www.depesz.com/2024/09/30/waiting-for-postgresql-18-add-temporal-primary-key-and-unique-constraints/ — 2024-09-30 — "These are backed by GiST indexes instead of B-tree indexes"; Kimball Group — Type 2: Add New Row — https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/type-2/ — read 2026-09-27 — "Slowly changing dimension type 2 changes add a new row in the dimension with the updated attribute values."
- Confidence: high.
- Conflicts: none.

### C-20: Record that a listing left its source as a state with a time; delete only what must be removed
- Owner question: 7, 9
- Why: A crawled listing that disappears is a fact about the market (days on market, a probable sale), not a deletion. Soft deletion (a `deleted_at` filter on every query) silently weakens foreign keys, leaks deleted rows into queries that forget the filter, and is almost never used to undelete. Where data must really go (a seller closes their account; a source asks for removal, ADR-0008 point 8), delete it.
- How: Crawled listings carry `status`, `last_seen_at` and `delisted_at`; a delisted listing still anchors its price history and valuations. Native listings end as `sold` or `withdrawn` (C-6). Real deletions are hard `DELETE`s with `ON DELETE CASCADE` for components; if support needs a trace, archive into `deleted_records (original_table text, original_id bigint, deleted_at timestamptz, data jsonb)` in the same statement and purge it on a schedule, but never archive personal data whose removal was requested (inference). The UI's undo for deleting a saved search (UI craft L-33) is a short pending state or a re-insert from the archive within the undo window, not a permanent filter (inference).
- Sources: Brandur Leach — Soft Deletion Probably Isn't Worth It — https://brandur.org/soft-deletion — 2022-07-19 — "Another consequence of soft deletion is that foreign keys are effectively lost." and "never once, in ten plus years, did anyone at any of these places ever actually use soft deletion to undelete something." and, of the archive table, "Foreign keys still work."; Nikolay Samokhvalov — Postgres.fm, Soft delete (transcript) — https://postgres.fm/episodes/soft-delete — 2024-06-28 — "it's actually the same data, we just don't show it in 1 place, but we show it in another place."; Michael Christofides — same episode — "If you get a GDPR request, you can't just search on normal tables for that data."
- Confidence: high.
- Conflicts: UI craft L-33 says "act at once, soft-delete, show undo". Reconciled above: the undo window is a state or an archive, not a global `deleted_at`.

### C-21: Give native listings an append-only revision trail, and use trigger-based audit only where writes are rare
- Owner question: 9
- Why: Moderation, disputes and a native listing's own price history need to know who changed what and when. PostgreSQL has no built-in system-time history, and generic audit triggers slow every write they watch.
- How: `listing_revisions (listing_id bigint, revision integer, changed_by_user_id bigint NOT NULL, changed_at timestamptz NOT NULL, asking_price_toman bigint, change jsonb NOT NULL, reason text, PRIMARY KEY (listing_id, revision))`, written by the same function that updates `native_listings`, in one transaction; moderation decisions append to `moderation_events`. A generic trigger audit (supa_audit style) suits low-write administrative tables such as catalogue edits; crawler tables need none, because snapshots already are their history (inference).
- Sources: PostgreSQL 19 (Beta) docs — 5.7 Temporal Tables — (URL as C-19) — Beta 4 — "PostgreSQL does not currently support system time, but it could be emulated using triggers"; Oliver Rice (Supabase) — Postgres Auditing in 150 lines of SQL — https://supabase.com/blog/postgres-audit — 2022-03-08 — "Auditing tables always reduces throughput of inserts, updates, and deletes."
- Confidence: medium.
- Conflicts: none.

### Names and documentation

### C-22: Name everything so that it reads well in an error message: lower_snake_case, units in names, every constraint named, under 63 bytes
- Owner question: 6, 7
- Why: Constraint names become part of the application's interface once errors are mapped to messages (C-25) and migrations refer to them. PostgreSQL silently truncates identifiers longer than 63 bytes, with only a NOTICE (lab 16: a 75-character constraint name became 63 characters). Upper-case names force quoting forever.
- How: Plural table names (`listings`), singular columns, `<entity>_id` for foreign keys, `_at` for `timestamptz`, `_on` for `date`, units as suffixes (`_toman`, `_km`), `is_`/`has_` for the rare boolean. Name every constraint and index explicitly with one scheme, for example PostgreSQL's own suffixes (`listings_source_listing_key`, `listings_source_id_fkey`, `listings_asking_price_check`, `promotions_no_overlap_excl`) or GitLab's prefixes; pick one and lint it (inference). Identifiers are English terms from the glossary (AGENTS.md).
- Sources: PostgreSQL wiki — Don't Do This — (URL as C-4) — 2024-11-21 — "Stick to using a-z, 0-9 and underscore for names and you never have to worry about quoting them."; PostgreSQL docs — 5.5 Constraints — (URL as C-2) — 18 — "This clarifies error messages and allows you to refer to the constraint when you need to change it."; GitLab — Constraints naming conventions — https://docs.gitlab.com/development/database/constraint_naming_convention/ — read 2026-09-27 — "Prefixes are preferred over suffixes because they make it easier to identify the type of a given constraint quickly"
- Confidence: high.
- Conflicts: GitLab prefers prefixes; PostgreSQL's generated names use suffixes. Either works if consistent; suffixes match what PostgreSQL generates for any constraint someone forgets to name (inference).

### C-23: Document meaning, units and provenance in the schema with COMMENT ON
- Owner question: 6
- Why: A comment lives in the catalog next to the column, shows in `\d+`, travels with dumps and disappears with the object, so it cannot drift the way a wiki page does. The future database reviewer and agents can read it through `col_description()` (inference).
- How: `COMMENT ON COLUMN listings.model_year_solar IS 'Model year in the Solar Hijri calendar as the seller wrote it (glossary: model year). NULL when only a Gregorian year was given.';` and `COMMENT ON TABLE snapshots IS 'Immutable raw copy of a listing page at fetch time; everything else is derived from it (ADR-0007).';`
- Sources: PostgreSQL docs — COMMENT — https://www.postgresql.org/docs/current/sql-comment.html — 18 — "COMMENT stores, replaces, or removes the comment on a database object." and "Comments are automatically dropped when their object is dropped."
- Confidence: medium.
- Conflicts: none.

### Constraints as the last line of defence

### C-24: Declare every invariant that one row, one key or one reference must satisfy, because the database is the only layer every write passes through
- Owner question: 1
- Why: Application checks are skipped by whatever path does not call them: a backfill, a fix run by hand, a second service, code an agent writes next month in another framework. Bailis and colleagues measured the cost of keeping integrity in the application tier (they call it feral concurrency control): uniqueness validations that are not backed by a constraint admit duplicates under concurrency.
- How: For every table, walk this list: types (C-8 to C-14); NOT NULL (C-7); CHECK for ranges, patterns, state lists and rules within one row, such as `CHECK (delisted_at IS NULL OR delisted_at >= first_seen_at)` and the price-kind rule in C-7; UNIQUE for natural keys (C-4, C-26); a foreign key for every reference (C-27); EXCLUDE for periods (C-19). Keep zod validation in the app for messages (C-25). PostgreSQL 18's `NOT ENFORCED` exists only to document a rule you knowingly cannot afford to check; it is never a default.
- Sources: Nikolay Samokhvalov — Postgres.fm, Constraints (transcript) — https://postgres.fm/episodes/constraints — 2023-12-08 — "Implementation of constraints in application code is weak because it's not guaranteed. Only the database can guarantee it."; Nikolay Samokhvalov — Postgres.fm, Schema design checklist — https://postgres.fm/episodes/schema-design-checklist — 2026-04-17 — "I don't trust constraints outside."; Jeremy Evans — Sequel, Model Validations — https://sequel.jeremyevans.net/rdoc/files/doc/validations_rdoc.html — read 2026-09-27 — "Data integrity is best handled by the database itself."; Peter Bailis, Alan Fekete, Michael J. Franklin, Ali Ghodsi, Joseph M. Hellerstein, Ion Stoica — Feral Concurrency Control (SIGMOD) — http://www.bailis.org/papers/feral-sigmod2015.pdf — 2015 — "unless the database is configured for serializable isolation, integrity violations may result." and, quoting a Rails committer, "the only way to handle [uniqueness] properly is at the database layer with a unique constraint on the column"; PostgreSQL docs — CREATE TABLE — https://www.postgresql.org/docs/current/sql-createtable.html — 18 — "NOT ENFORCED constraints can be useful as documentation if the actual checking of the constraint at run time is too expensive."
- Confidence: high.
- Conflicts: the opposite school is quoted in the same paper (David Heinemeier Hansson): "I consider stored procedures and constraints vile and reckless destroyers of coherence." The paper's measurements are the answer.

### C-25: Validate in the app for the message, then turn the database's rejection into the same Farsi message by SQLSTATE and constraint name
- Owner question: 1, 6
- Why: A person needs an immediate, specific message in Farsi next to the field (UI craft: the reserved message line). The database will still reject what slips past (a race, another writer), and that rejection must become the same message, not a 500. PostgreSQL reports the constraint name for integrity errors, node-postgres exposes it, and Sequel's `pg_auto_constraint_validations` plugin is prior art for exactly this mapping. Message text is not an interface.
- How:
  ```ts
  import pg from 'pg'; // node-postgres re-exports pg-protocol's DatabaseError; pass b picks the driver, and field names differ
  const { DatabaseError } = pg;

  // One entry per named constraint a person can trigger; the key is the constraint name.
  const constraintMessages = {
    saved_searches_user_name_key: { field: 'name', message: 'جست‌وجویی با این نام دارید.' },
    native_listings_asking_price_check: { field: 'askingPrice', message: 'قیمت باید بیشتر از صفر باشد.' },
  } as const satisfies Record<string, { field: string; message: string }>;

  const integrityCodes = new Set(['23502', '23503', '23505', '23514', '23P01']); // not null, FK, unique, check, exclusion

  export function toFieldError(error: unknown) {
    if (!(error instanceof DatabaseError) || !integrityCodes.has(error.code ?? '')) return null;
    const name = error.constraint as keyof typeof constraintMessages | undefined;
    return (name && constraintMessages[name]) ?? null; // unknown name: generic error, logged with the name
  }
  ```
  Add a test that lists user-reachable constraints from `pg_constraint` and fails when one has no message, so a new constraint cannot ship without its Farsi text (a mechanical check; inference). Lab 2c shows the fields PostgreSQL sends: `SCHEMA NAME: public`, `TABLE NAME: listings`, `CONSTRAINT NAME: listings_source_listing_key`.
- Sources: PostgreSQL docs — Appendix A, Error Codes — https://www.postgresql.org/docs/current/errcodes-appendix.html — 18 — "Applications that need to know which error condition has occurred should usually test the error code, rather than looking at the textual error message."; PostgreSQL docs — 54.8 Error and Notice Message Fields — https://www.postgresql.org/docs/current/protocol-error-fields.html — 18 — "Constraint name: if the error was associated with a specific constraint, the name of the constraint."; node-postgres — pg-protocol `messages.ts` (DatabaseError) — https://github.com/brianc/node-postgres/blob/master/packages/pg-protocol/src/messages.ts — read 2026-09-27 — "public constraint: string | undefined"; Jeremy Evans — Sequel, pg_auto_constraint_validations — https://sequel.jeremyevans.net/rdoc-plugins/classes/Sequel/Plugins/PgAutoConstraintValidations.html — read 2026-09-27 — "The purpose of validations is to provide nice error messages for the user"; Jeremy Evans — Sequel, Model Validations — (URL as C-24) — "Validations are primarily useful for associating error messages to display to the user with specific attributes on the model."; Nikolay Samokhvalov — Postgres.fm, Constraints — (URL as C-24) — 2023-12-08 — "constraint checks on frontend make sense a lot"
- Confidence: high for the mechanism; medium for the exact TypeScript, which depends on pass b's library.
- Conflicts: none. The protocol docs warn that these fields exist only for some errors, so the mapper must tolerate a missing name.

### C-26: Express conditional and NULL-aware uniqueness with partial unique indexes and NULLS NOT DISTINCT
- Owner question: 1
- Why: "One of these per that, among the active ones" is uniqueness over a predicate. Optional columns in a unique key let duplicates through, because two NULLs are not equal by default (lab 6: two market values stored for one segment and day).
- How: One market value per segment and day, where a NULL trim means "all trims of the model": `CONSTRAINT valuations_segment_day_key UNIQUE NULLS NOT DISTINCT (model_id, trim_id, model_year_solar, valued_on)` (lab 6: rejected the second value; the revaluation upsert on the same constraint worked). One primary photo per listing: `CREATE UNIQUE INDEX listing_photos_one_primary_idx ON listing_photos (listing_id) WHERE is_primary;`. Saved-search names unique per user among live searches: `... ON saved_searches (user_id, lower(name)) WHERE archived_at IS NULL`. For native listings later: one live listing per VIN per seller, `... ON native_listings (seller_id, vin) WHERE status IN ('pending_review', 'published')`. To use a partial index as an `ON CONFLICT` arbiter, repeat its predicate: `ON CONFLICT (listing_id) WHERE is_primary DO NOTHING`. In PostgreSQL an all-NULL key also counts once (lab 6: a second `(NULL, NULL)` was rejected), but the SQL standard leaves that case implementation-defined, so a portable schema should not rely on it.
- Sources: PostgreSQL docs — 5.5 Constraints — https://www.postgresql.org/docs/current/ddl-constraints.html — 18 — "By default, two null values are not considered equal in this comparison." and "it is possible to enforce such a restriction by creating a unique partial index."; Markus Winand — NULL — https://modern-sql.com/concept/null — read 2026-09-27 — "Nulls not distinct means that one null value rules out further null values in the same column."; Markus Winand — Partial Indexes (Use The Index, Luke) — https://use-the-index-luke.com/sql/where-clause/partial-and-filtered-indexes — read 2026-09-27 — "A partial index is useful for commonly used where conditions that use constant values"; PostgreSQL docs — INSERT — https://www.postgresql.org/docs/current/sql-insert.html — 18 — "If an index_predicate is specified, it must, as a further requirement for inference, satisfy arbiter indexes."
- Confidence: high (documentation and lab).
- Conflicts: none.

### C-27: Put a foreign key on every reference, index the referencing columns, and choose ON DELETE per relationship
- Owner question: 1, 7
- Why: Referential integrity is what makes joins trustworthy, and it is often the first thing large systems drop. PostgreSQL does not index referencing columns for you, so deleting a parent scans the children. `ON DELETE` says what the relationship means, and a cascade through a million rows cannot meet an interactive latency budget.
- How: `listings.source_id REFERENCES sources ON DELETE RESTRICT` (a source is retired by status, never deleted while it has listings); the same for `snapshots`; `listing_photos → listings ON DELETE CASCADE` (a component); `saved_searches.user_id → users ON DELETE CASCADE` (the person's own data leaves with them); `listings.duplicate_group_id → duplicate_groups ON DELETE SET NULL` (grouping is optional, derived information) (inference). Index each referencing column (`CREATE INDEX CONCURRENTLY listings_source_id_idx ON listings (source_id)`) unless a measured reason says otherwise (pass d). Deleting a seller with thousands of listings deletes the children in batches in a job before the parent (inference from Nikolay's warning). Foreign-key checks take a `FOR KEY SHARE` lock on the parent row, which is why C-40 prefers `FOR NO KEY UPDATE`.
- Sources: PostgreSQL docs — 5.5 Constraints — (URL as C-26) — 18 — "the declaration of a foreign key constraint does not automatically create an index on the referencing columns." and "If the two tables represent independent objects, then RESTRICT or NO ACTION is more appropriate"; GitLab — Foreign keys and associations — https://docs.gitlab.com/development/database/foreign_keys/ — read 2026-09-27 — "when adding a foreign key, you must always add an index first."; Laurenz Albe — Foreign Key Indexing and Performance in PostgreSQL — https://www.cybertec-postgresql.com/en/index-your-foreign-key/ — 2018-10 — "create all missing indexes, wait a couple of days and then get rid of the indexes that were never used."; Brandur Leach — Feature Casualties of Large Databases — https://brandur.org/large-database-casualties — 2020-12-01 — "Referential integrity guarantees that if a key exists somewhere in a database, then the object its referencing does as well."; Nikolay Samokhvalov — Postgres.fm, Schema design checklist — (URL as C-24) — 2026-04-17 — "deletion of 1000000 rows, it cannot meet our requirements"
- Confidence: high.
- Conflicts: none; Laurenz's "create all, drop the unused later" and GitLab's "always add an index first" agree on indexing by default.

### C-28: Use exclusion constraints for "never overlapping", and remember they cannot arbitrate ON CONFLICT DO UPDATE
- Owner question: 1
- Why: Non-overlap is a cross-row rule that PostgreSQL can enforce declaratively (C-19). Its limits matter when writing upserts.
- How: Periods such as promotions or a dealer's plan periods use `EXCLUDE USING gist (... WITH =, during WITH &&)`; a violation is SQLSTATE 23P01 (map it, C-25). Upserts against an exclusion constraint can only be `DO NOTHING`. A hash-based `EXCLUDE` can enforce uniqueness of long values such as full source URLs more compactly than a B-tree, but it cannot be the target of a foreign key and `ON CONFLICT` must name it; for source listings, uniqueness on the source's short id (C-4) avoids the question (inference).
- Sources: PostgreSQL docs — INSERT — https://www.postgresql.org/docs/current/sql-insert.html — 18 — "Note that exclusion constraints are not supported as arbiters with ON CONFLICT DO UPDATE."; Haki Benita — Unconventional PostgreSQL Optimizations — https://hakibenita.com/postgresql-unconventional-optimizations — 2026-01-20 — "PostgreSQL requires that a foreign key reference a unique constraint."
- Confidence: high.
- Conflicts: none.

### C-29: Make a constraint deferrable only where one statement or transaction must pass through an invalid state
- Owner question: 1
- Why: PostgreSQL checks a non-deferrable unique constraint row by row, so a statement that swaps two values fails even though its end state is valid. Deferrability fixes that, at a price: deferrable constraints cannot arbitrate `ON CONFLICT`, they are slower, and a test that rolls back never reaches their deferred check.
- How: Reordering a listing's photos: `CONSTRAINT listing_photos_position_key UNIQUE (listing_id, position) DEFERRABLE INITIALLY IMMEDIATE` (lab 19: `UPDATE ... SET position = 3 - position` failed with the immediate constraint and succeeded with the deferrable one; `ON CONFLICT` against it then errors). Re-pointing listings while merging duplicate groups may need `INITIALLY DEFERRED` foreign keys. In tests, run `SET CONSTRAINTS ALL IMMEDIATE` before the assertions (lab 10: without it, a foreign-key violation passed a rolled-back test).
- Sources: PostgreSQL docs — CREATE TABLE — (URL as C-24) — 18 — "PostgreSQL checks for uniqueness immediately whenever a row is inserted or modified." and "To obtain standard-compliant behavior, declare the constraint as DEFERRABLE but not deferred (i.e., INITIALLY IMMEDIATE)." and "Note that deferrable constraints cannot be used as conflict arbiters in an INSERT statement that includes an ON CONFLICT clause."
- Confidence: high (documentation and lab).
- Conflicts: none.

### C-30: Never enforce a cross-row rule with a CHECK that queries other rows or with a plain trigger
- Owner question: 1, 9
- Why: PostgreSQL assumes a CHECK looks only at the row being written; a CHECK calling a function that counts other rows can be violated by later changes to those rows and can break dump and restore. A trigger that counts rows before allowing an insert is check-then-act, and it races exactly like application code (lab 8a shows the race).
- How: First try to restate the rule as UNIQUE, a partial unique index, EXCLUDE or a foreign key (C-26 to C-28). Otherwise enforce it in application code inside a transaction that locks the parent row or runs SERIALIZABLE (C-39): «a seller may have at most three active free listings» locks the seller's row, counts and inserts (lab 8c). For derived aggregates such as "a duplicate group has at least two members", let the job that owns the groups maintain them and add a scheduled consistency query that alerts when it finds a violation (inference).
- Sources: PostgreSQL docs — 5.5 Constraints — (URL as C-26) — 18 — "PostgreSQL does not support CHECK constraints that reference table data other than the new or updated row being checked." and "If possible, use UNIQUE, EXCLUDE, or FOREIGN KEY constraints to express cross-row and cross-table restrictions."; Laurenz Albe — Triggers to enforce constraints in PostgreSQL — https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/ — 2019-04 — "If you don't want to be vulnerable to race conditions with a trigger that enforces a constraint, use locking or higher isolation levels."
- Confidence: high.
- Conflicts: none.

### Writes, errors and idempotency

### C-31: Upsert crawled listings with INSERT ... ON CONFLICT on the natural key; never check first and then insert
- Owner question: 2
- Why: Check-then-insert races (lab 2a: both sessions saw no row and both inserted). Wrapping it in a transaction changes nothing under READ COMMITTED. Only the unique index serializes the two inserts (lab 2c: the second insert waited 1.5 s for the first transaction, then failed with 23505), and `ON CONFLICT` turns that wait into a defined outcome. SERIALIZABLE also catches the race (lab 2b: 40001), but then every caller must retry.
- How:
  ```sql
  INSERT INTO listings AS l (source_id, source_listing_id, asking_price_toman)
  VALUES ($1, $2, $3)
  ON CONFLICT ON CONSTRAINT listings_source_listing_key DO UPDATE
     SET asking_price_toman = EXCLUDED.asking_price_toman
   WHERE l.asking_price_toman IS DISTINCT FROM EXCLUDED.asking_price_toman
  RETURNING l.id, (l.xmax = 0) AS inserted;          -- C-33
  ```
  For a whole crawl page, one statement with `INSERT ... SELECT * FROM unnest($1::text[], $2::bigint[])` (inference), after removing duplicate keys from the batch, because a row cannot be affected twice by one upsert (SQLSTATE 21000). A column that changes on every sighting, such as `last_seen_at`, turns every upsert into a write; keep sightings in their own narrow table or update them in bulk (inference; pass d measures write volume).
- Sources: PostgreSQL docs — INSERT — https://www.postgresql.org/docs/current/sql-insert.html — 18 — "one of those two outcomes is guaranteed, even under high concurrency." and "Rows proposed for insertion should not duplicate each other in terms of attributes constrained by an arbiter index or constraint."; GitLab — SQL Query Guidelines (".find_or_create_by is not atomic") — https://docs.gitlab.com/development/sql/ — read 2026-09-27 — "Using transactions does not solve this problem."; Bailis et al. — Feral Concurrency Control — (URL as C-24) — 2015 — "the only way to handle [uniqueness] properly is at the database layer with a unique constraint on the column"
- Confidence: high (lab).
- Conflicts: none.

### C-32: For get-or-create, expect ON CONFLICT DO NOTHING to return nothing for the existing row, and read it in a new statement (or use DO SELECT on 19)
- Owner question: 2
- Why: `RETURNING` reports only rows that were inserted or updated. When the conflicting row was inserted by a transaction that committed while you waited, even a `UNION ALL SELECT` in the same statement reads the old snapshot and returns nothing (lab 2d: 0 rows, no error; the next statement returned id 23). PostgreSQL 19 adds `ON CONFLICT DO SELECT` for exactly this.
- How:
  ```ts
  // Mapping a source's raw model label to the catalogue: insert once, otherwise read the winner.
  export async function getOrCreateModelAlias(client: PoolClient, sourceId: string, rawLabel: string, modelId: string) {
    const inserted = await client.query(
      `INSERT INTO model_aliases (source_id, raw_label, model_id) VALUES ($1, $2, $3)
       ON CONFLICT (source_id, raw_label) DO NOTHING
       RETURNING id, model_id`,
      [sourceId, rawLabel, modelId],
    );
    if (inserted.rowCount === 1) return inserted.rows[0];
    // A new statement under READ COMMITTED takes a new snapshot and sees the concurrent winner.
    const existing = await client.query(
      `SELECT id, model_id FROM model_aliases WHERE source_id = $1 AND raw_label = $2`,
      [sourceId, rawLabel],
    );
    return existing.rows[0]; // under REPEATABLE READ or SERIALIZABLE the snapshot is fixed: retry the transaction instead
  }
  ```
  On 19: `INSERT ... ON CONFLICT (source_id, raw_label) DO SELECT RETURNING id, model_id`. Do not use `DO UPDATE SET raw_label = EXCLUDED.raw_label` just to make `RETURNING` work: it rewrites the row every time (C-33).
- Sources: Haki Benita — How to Get or Create in PostgreSQL — https://hakibenita.com/postgresql-get-or-create — 2024-08-05, section added 2024-08-23 — "It's better to crash once in this case and handle the unique constraint violation rather than risk ending up with incorrect data."; PostgreSQL docs — INSERT — (URL as C-31) — 18 — "Only rows that were successfully inserted or updated will be returned."; PostgreSQL docs — 13.2 Transaction Isolation — https://www.postgresql.org/docs/current/transaction-iso.html — 18 — "may have insertion not proceed for a row due to the outcome of another transaction whose effects are not visible to the INSERT snapshot"; PostgreSQL 19 (Beta) docs — INSERT — https://www.postgresql.org/docs/19/sql-insert.html — Beta 4 — "ON CONFLICT DO SELECT similarly allows an atomic INSERT or SELECT outcome. This is also known as idempotent insert or get or create."
- Confidence: high (documentation and lab).
- Conflicts: Haki prefers a loud failure to a silent empty result; the follow-up read returns the right row without failing, and a missing row after it should be treated as an error, never as "not found" (inference).

### C-33: Skip no-op updates in upserts, and tell inserted from updated rows with xmax on 17 or RETURNING old/new on 18
- Owner question: 2
- Why: An UPDATE writes a new row version even when nothing changed. Lab 3: re-upserting 1,000 unchanged listings with a plain `DO UPDATE` performed 1,000 updates, left 1,000 dead tuples and grew the heap from 136 to 200 kB; with `WHERE ... IS DISTINCT FROM EXCLUDED...` it performed none. A crawl report ("new listings, price changes") needs to know which rows were inserted: lab 4 shows `xmax = 0` on the inserted row, the updating transaction's id on the updated row, and no row at all for the unchanged one.
- How: The upsert in C-31. On 17, `RETURNING l.id, (l.xmax = 0) AS inserted`: widely used, but `xmax` is an implementation detail rather than a documented contract (inference). On 18, prefer `RETURNING l.id, old.id IS NULL AS inserted, old.asking_price_toman AS previous_price_toman`, which also hands the previous price to the price-observation insert in the same round trip (inference from the documentation).
- Sources: Haki Benita — How to Get or Create in PostgreSQL — (URL as C-32) — 2024-08-05 — "In PostgreSQL, when you update a row you essentially delete and insert a new row."; PostgreSQL docs — INSERT — (URL as C-31) — 18 — "for an INSERT with an ON CONFLICT DO UPDATE clause, the old values may be non-NULL."; PostgreSQL — Release 18 — https://www.postgresql.org/docs/18/release-18.html — 2025-09-25 — "Add OLD/NEW support to RETURNING in DML queries"
- Confidence: high for skipping no-op updates and for `old`/`new` (documentation and lab); medium for `xmax`, which the lab confirms on 17.11 only.
- Conflicts: none.

### C-34: Budget for what a failed INSERT costs before choosing insert-and-catch
- Owner question: 2
- Why: A unique violation inside a transaction aborts the whole transaction; every later statement fails with 25P02 until it rolls back (lab 5: the crawl page's first, valid listing was lost too). Only a savepoint recovers, and each savepoint is a subtransaction: more than 64 live ones per transaction degrade the whole server, which is why GitLab removed them. Each failed insert also leaves a dead tuple and consumes an identity value (lab 3: 1,000 failed inserts, 1,000 dead tuples, heap 72 to 136 kB, identity +1,000).
- How: Insert-and-catch is right for rare conflicts in single-row writes a person triggers, outside a larger transaction: saving a search under a name already used, caught as 23505 and mapped by constraint name (C-25). Batch paths (crawler, extraction, revaluation) use `ON CONFLICT` so a conflict is not an error (lab 5, last part: the same page with `DO NOTHING` inserted the two new listings). Never give each row of a 500-row page its own savepoint (inference from the 64 limit); ORMs and drivers that nest transactions use savepoints silently, so they count.
- Sources: PostgreSQL docs — 3.4 Transactions (tutorial) — https://www.postgresql.org/docs/current/tutorial-transactions.html — 18 — "ROLLBACK TO is the only way to regain control of a transaction block that was put in aborted state by the system"; GitLab — SQL Query Guidelines — (URL as C-31) — "If the INSERT fails, it leaves a dead tuple around and increment the primary key sequence (if any), among other downsides."; Laurenz Albe — Subtransactions and performance in PostgreSQL — https://www.cybertec-postgresql.com/en/subtransactions-and-performance-in-postgresql/ — 2020-03 — "If you need concurrency, don't start more than 64 subtransactions per transaction."; Grzegorz Bizon, Stan Hu (GitLab) — Why we spent the last month eliminating PostgreSQL subtransactions — https://about.gitlab.com/blog/2021/09/29/why-we-spent-the-last-month-eliminating-postgresql-subtransactions/ — 2021-09-29 — "to eliminate all SAVEPOINT queries from our code."; GitLab — Migration Style Guide — https://docs.gitlab.com/development/migration_style_guide/ — read 2026-09-27 — "Subtransactions are disallowed in general."
- Confidence: high (documentation and lab).
- Conflicts: none.

### C-35: Use MERGE for single-writer synchronisation, not for concurrent upserts
- Owner question: 2
- Why: When `MERGE`'s `WHEN NOT MATCHED THEN INSERT` meets a row inserted concurrently, it raises a unique violation instead of switching to its update branch (lab 17: 23505 after waiting for the other transaction). It is still the right tool when one job reconciles a whole set with insert, update and delete branches, and PostgreSQL 17 added `RETURNING merge_action()` (lab 16).
- How: The nightly revaluation job, the only writer of a given day's `valuations`, can MERGE the computed set: `WHEN MATCHED AND v.market_value_toman IS DISTINCT FROM s.market_value_toman THEN UPDATE ... WHEN NOT MATCHED THEN INSERT ... WHEN NOT MATCHED BY SOURCE AND v.valued_on = $1 THEN DELETE RETURNING merge_action(), ...`, run under a singleton guard so it really is the only writer (C-42) (inference). Crawler and user writes use `ON CONFLICT`.
- Sources: PostgreSQL docs — 13.2 Transaction Isolation — (URL as C-32) — 18 — "If MERGE attempts an INSERT and a unique index is present and a duplicate row is concurrently inserted, then a uniqueness violation error is raised"; PostgreSQL docs — MERGE — https://www.postgresql.org/docs/current/sql-merge.html — 18 — "consider using INSERT ... ON CONFLICT as an alternative statement which offers the ability to run an UPDATE if a concurrent INSERT occurs"; Haki Benita — How to Get or Create in PostgreSQL — (URL as C-32) — "Inconsistent behavior between MERGE WHEN MATCHED DO NOTHING to INSERT ON CONFLICT DO NOTHING"
- Confidence: high (documentation and lab).
- Conflicts: none.

### C-36: Make once-only side effects idempotent with a key stored under a unique constraint
- Owner question: 2, 6
- Why: Retries are normal (a job re-runs, a network call times out, a finger taps twice); a Telegram alert or a native listing submission must still happen once. The UI craft rules already require an idempotency key generated in the event handler (L-31); this is the database half.
- How: Alerts: `alert_deliveries (saved_search_id bigint, listing_id bigint, kind text CHECK (kind IN ('new_listing', 'price_drop')), observed_price_toman bigint, status text NOT NULL DEFAULT 'pending', sent_at timestamptz, PRIMARY KEY (saved_search_id, listing_id, kind, observed_price_toman))`. The alert job inserts with `ON CONFLICT DO NOTHING RETURNING` and sends only if a row came back; it marks `sent` after the Telegram call, and a reaper retries rows stuck in `pending` (the send is a foreign state mutation outside any transaction) (inference following Brandur's recovery points). Native listing submission: `idempotency_keys (user_id bigint, key uuid, request_sha256 bytea, response jsonb, created_at timestamptz, PRIMARY KEY (user_id, key))`; a retry with the same key returns the stored response, a different body under the same key is rejected; purge after a day or two.
- Sources: Brandur Leach — Implementing Stripe-like Idempotency Keys in Postgres — https://brandur.org/idempotency-keys — 2017-10-27 — "An idempotency key is a unique value that’s generated by a client and sent to an API along with a request." and "once we make our first foreign state mutation, we’re committed one way or another"
- Confidence: high.
- Conflicts: none.

### Transactions and concurrency

### C-37: Know what READ COMMITTED protects and what it does not
- Owner question: 6
- Why: It is PostgreSQL's default. Each statement sees a new snapshot, so a value read by one statement and written back by a later one can overwrite a concurrent change (lost update), and two transactions can each check a rule and then write different rows that together break it (write skew). Kleppmann's Hermitage tests record PostgreSQL's "read committed" as preventing neither P4 (lost update) nor G2-item (write skew), and "repeatable read" as preventing lost updates but not write skew; lab 7a and lab 8a reproduce both.
- How: List Carshenas's read-modify-write sites and give each a fix from C-38 or C-39: merging duplicate groups (member count, cheapest listing), recomputing a valuation, a saved search's price threshold edited in two tabs, a moderator and a seller editing the same native listing, a seller's quota of active listings.
- Sources: PostgreSQL docs — 13.2 Transaction Isolation — (URL as C-32) — 18 — "Read Committed is the default isolation level in PostgreSQL."; Martin Kleppmann — Hermitage README — https://github.com/ept/hermitage — read 2026-09-27 — "an attempt to nail down precisely what different database systems actually mean with their isolation levels"; Martin Kleppmann — Hermitage: Testing the "I" in ACID — https://martin.kleppmann.com/2014/11/25/hermitage-testing-the-i-in-acid.html — 2014-11-25 — "If you don’t understand the concurrency guarantees, you have no idea whether your code will still behave correctly when processing a few simultaneous requests."; Andy Pavlo — Lecture #20: Multi-Version Concurrency Control, CMU 15-445/645 — https://15445.courses.cs.cmu.edu/fall2025/notes/20-multiversioning.pdf — Fall 2025 — "Write Skew Anomaly can occur in Snapshot Isolation when two concurrent transactions modify different objects resulting in non-serializable schedules."; Todd Warszawski, Peter Bailis — ACIDRain (SIGMOD, Stanford InfoLab) — http://www.bailis.org/papers/acidrain-sigmod2017.pdf — 2017 — "database transactions frequently execute under weak isolation that exposes programs to a range of concurrency anomalies"
- Confidence: high (documentation, Hermitage and lab).
- Conflicts: none.

### C-38: Fix read-modify-write in this order: one atomic UPDATE, a row lock, a version column, or REPEATABLE READ or SERIALIZABLE with a retry
- Owner question: 6
- Why: Lab 7, two workers each adding one matched listing to a duplicate group of 2: application arithmetic under READ COMMITTED ended at 3 (a lost update); an atomic `UPDATE ... SET listing_count = listing_count + 1` ended at 4; `SELECT ... FOR NO KEY UPDATE` ended at 4 (the second worker waited 0.7 s); a version check ended at 4 after one retry (`UPDATE 0`, re-read, `UPDATE 1`); REPEATABLE READ and SERIALIZABLE each failed the second worker with 40001 and ended at 4 after a retry.
- How: (1) Push arithmetic into SQL wherever the new value is a function of the old one. (2) When code must decide from current values (a merge choosing the cheapest listing), lock with `FOR NO KEY UPDATE` in a short transaction (C-40). (3) When a decision spans a person's think time (a seller editing a native listing in a form; a moderator approving it), use optimistic concurrency: `version integer NOT NULL DEFAULT 0`, the form carries the version, `UPDATE native_listings SET ..., version = version + 1 WHERE listing_id = $1 AND version = $2`, and `rowCount === 0` becomes «این آگهی در این فاصله تغییر کرده است» with the fresh values; never hold a database transaction open across user input. The token is an integer, not `updated_at` (C-17). (4) Whole-transaction REPEATABLE READ or SERIALIZABLE with a retry when the decision reads many rows (C-39).
- Sources: Andy Pavlo — Lecture #17: Concurrency Control Theory, CMU 15-445/645 — https://15445.courses.cs.cmu.edu/fall2025/notes/17-concurrencycontrol.pdf — Fall 2025 — "Optimistic: The DBMS assumes that conflicts between transactions are rare, so it chooses to deal with conflicts after they happen."; Haki Benita — How to Manage Concurrency in Django Models — https://hakibenita.com/how-to-manage-concurrency-in-django-models — 2017-07-07 — "If you have updates happening outside the ORM (for example, directly in the database) the pessimistic approach is safer." and "The optimistic approach does not protect from modifications made to the object outside the app."; PostgreSQL docs — 13.3 Explicit Locking — https://www.postgresql.org/docs/current/explicit-locking.html — 18 — "This means it is a bad idea for applications to hold transactions open for long periods of time (e.g., while waiting for user input)."
- Confidence: high (lab).
- Conflicts: none.

### C-39: For rules that read many rows, lock the parent row or use SERIALIZABLE, and retry the whole transaction
- Owner question: 1, 6, 9
- Why: Lab 8, a seller at two of three allowed active listings, two concurrent submissions: REPEATABLE READ let both in (4 active); SERIALIZABLE aborted one with 40001 (3 active); READ COMMITTED with `SELECT ... FROM sellers WHERE id = 42 FOR NO KEY UPDATE` first made the second submission wait and then see 3 (3 active). PostgreSQL does not retry for you, because only the application can re-run its own decisions.
- How:
  ```ts
  const retryable = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected

  export async function inTransaction<T>(
    pool: Pool,
    isolation: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE',
    work: (client: PoolClient) => Promise<T>, // every read and decision happens in here, fresh on each attempt
    maxAttempts = 5,
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const client = await pool.connect();
      try {
        await client.query(`BEGIN ISOLATION LEVEL ${isolation}`); // a closed union, never user input (C-59)
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        const code = (error as { code?: string }).code;
        if (!code || !retryable.has(code) || attempt >= maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 * 2 ** attempt)); // jittered backoff
      } finally {
        client.release();
      }
    }
  }
  ```
  `work` must have no side effects outside the database, since it may run several times (C-43). Retry 23505 only where the key was chosen from earlier reads; otherwise it is a real error. For a rule with one natural parent (a seller's quota), lock the parent row: cheaper than SERIALIZABLE and clear to read (lab 8c).
- Sources: PostgreSQL docs — 13.5 Serialization Failure Handling — https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html — 18 — "It is important to retry the complete transaction, including all logic that decides which SQL to issue and/or which values to use." and "It may also be advisable to retry deadlock failures." and "more care is needed when retrying these other error codes, since they might represent persistent error conditions rather than transient failures."; PostgreSQL docs — 13.2 Transaction Isolation — (URL as C-32) — 18 — "Applications using this level must be prepared to retry transactions due to serialization failures." and "Consistent use of Serializable transactions can simplify development."; Martin Kleppmann — Transactions: myths, surprises and opportunities (Strange Loop) — https://martin.kleppmann.com/2015/09/26/transactions-at-strange-loop.html — 2015-09-26 — "The purpose of transactions is to make application code simpler, by reducing the amount of failure handling you need to do yourself."
- Confidence: high (documentation and lab).
- Conflicts: SERIALIZABLE everywhere simplifies reasoning, as the PostgreSQL docs say, but costs retries and predicate-lock memory; for single-parent rules the row lock is cheaper (inference).

### C-40: Lock rows with FOR NO KEY UPDATE unless you delete them or change their key, and use NOWAIT and SKIP LOCKED on purpose
- Owner question: 6
- Why: `FOR UPDATE` conflicts with the `FOR KEY SHARE` lock that every foreign-key check takes on the parent row, so locking a duplicate group or a seller with `FOR UPDATE` blocks inserts of rows that reference it. `FOR NO KEY UPDATE` does not.
- How: Merge duplicate groups with `FOR NO KEY UPDATE` so the crawler can keep inserting listings that reference them; add `NOWAIT` on interactive paths where an immediate «دوباره تلاش کنید» beats waiting (SQLSTATE 55P03); keep `SKIP LOCKED` for queues (C-41).
- Sources: Laurenz Albe — SELECT FOR UPDATE considered harmful in PostgreSQL — https://www.cybertec-postgresql.com/en/select-for-update-considered-harmful-postgresql/ — 2025-06 — "Unless you plan to delete a row or modify a key column, always use SELECT FOR NO KEY UPDATE."; PostgreSQL docs — 13.3 Explicit Locking — (URL as C-38) — 18 — "this lock will not block SELECT FOR KEY SHARE commands that attempt to acquire a lock on the same rows."
- Confidence: high.
- Conflicts: none.

### C-41: Claim queued work with FOR UPDATE SKIP LOCKED in short transactions, and keep long transactions away from queue tables
- Owner question: 6
- Why: `SKIP LOCKED` lets several workers take different rows without waiting on each other, which is its only proper use. A long-running transaction anywhere in the database stops vacuum from removing dead rows, and a queue table, which is mostly dead rows, slows down as the oldest transaction ages (Brandur measured it).
- How: A PostgreSQL-backed job queue (pass b) does this already. For a hand-rolled claim, such as crawl targets per source: `UPDATE crawl_targets SET claimed_by = $2, claimed_until = now() + interval '5 minutes' WHERE id = (SELECT id FROM crawl_targets WHERE source_id = $1 AND due_at <= now() AND (claimed_until IS NULL OR claimed_until < now()) ORDER BY due_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *;`, commit, fetch outside any transaction (C-43), record the result in a second short transaction. Put timeouts on analytics and batch sessions (C-45) so that none of them silently holds the oldest snapshot.
- Sources: PostgreSQL docs — SELECT, The Locking Clause — https://www.postgresql.org/docs/current/sql-select.html — 18 — "Skipping locked rows provides an inconsistent view of the data, so this is not suitable for general purpose work" and "can be used to avoid lock contention with multiple consumers accessing a queue-like table"; Brandur Leach — Postgres Job Queues & Failure By MVCC — https://brandur.org/postgres-queues — 2015-05-18 — "As the age of the oldest transaction increases, the number of dead tuples in the jobs table grows continually." and "when an operation fails and rolls back, an injected job rolls back with it."; PostgreSQL docs — 19.11 Client Connection Defaults — https://www.postgresql.org/docs/current/runtime-config-client.html — 18 — "an open transaction prevents vacuuming away recently-dead tuples that may be visible only to this transaction"
- Confidence: high.
- Conflicts: none.

### C-42: Use an advisory lock or a lease row for "only one at a time", and know which one survives a crash and a connection pooler
- Owner question: 6
- Why: ADR-0008 requires one request at a time per host, so one crawler per source; the revaluation job must be the only writer of its day (C-35). Advisory locks are fast and leave no dead rows, but session-level ones ignore transaction boundaries and are unsupported through PgBouncer's transaction pooling. A long crawl must not hold a transaction open just to keep a transaction-level lock.
- How: Short critical sections: `SELECT pg_try_advisory_xact_lock(hashtextextended('revalue:' || $1, 0))` at the start of the revaluation transaction; if it returns false, another run is active, so exit. Long exclusive work (a crawl run of minutes): a lease row, `source_leases (source_id bigint PRIMARY KEY REFERENCES sources, holder text NOT NULL, leased_until timestamptz NOT NULL)`, taken with `UPDATE source_leases SET holder = $2, leased_until = now() + interval '2 minutes' WHERE source_id = $1 AND leased_until < now() RETURNING *`, renewed by a heartbeat, visible to anyone with SQL, expiring by itself if the worker dies (inference). Alternatively a session-level advisory lock on a dedicated direct connection. The chosen job queue may offer singleton jobs (pass b).
- Sources: PostgreSQL docs — 13.3 Explicit Locking, Advisory Locks — (URL as C-38) — 18 — "advisory locks are faster, avoid table bloat, and are automatically cleaned up by the server at the end of the session." and "Unlike standard lock requests, session-level advisory lock requests do not honor transaction semantics"; PgBouncer — Features — https://www.pgbouncer.org/features.html — read 2026-09-27 — the feature table lists "Session-level advisory locks" under transaction pooling as "Never"; ADR-0008 point 5 (repository).
- Confidence: medium (the mechanisms are documented; the lease design is inference).
- Conflicts: none.

### C-43: Keep transactions short and free of network calls; stage side effects inside the transaction and perform them after commit
- Owner question: 6
- Why: Locks are held until the transaction ends, and a transaction that waits on HTTP or an LLM holds them for as long as the network decides; it also blocks migrations (lab 9) and vacuum. Once a call leaves the system, rolling back the database does not undo it.
- How: Crawler: fetch the page outside any transaction; then one short transaction inserts the snapshot, upserts the listing, appends the price observation and enqueues the extraction job (with a PostgreSQL-backed queue, the enqueue commits or rolls back with the data); commit. Extraction: read the input, call the model with no transaction open, then write the result keyed by the input hash in a short transaction (idempotent on retry). Alerts: enqueue in the transaction that detected the price drop; the job sends to Telegram after commit, guarded by C-36. In Server Actions, nothing is awaited between `BEGIN` and `COMMIT` except SQL.
- Sources: GitLab — Transaction guidelines — https://docs.gitlab.com/development/database/transaction_guidelines/ — read 2026-09-27 — "Ideally, a transaction should only contain database statements."; Brandur Leach — Implementing Stripe-like Idempotency Keys in Postgres — (URL as C-36) — 2017-10-27 — "Work should always be offloaded to background queues wherever possible."; Brandur Leach — Transactionally Staged Job Drains in Postgres — https://brandur.org/job-drain — 2017-09-20 — "the ACID properties of the running transaction keep them invisible until they’re ready to be worked"
- Confidence: high.
- Conflicts: none.

### C-44: Take locks in one global order, and retry deadlocks
- Owner question: 6
- Why: Two transactions that lock the same rows in opposite orders deadlock; PostgreSQL resolves it by aborting one (40P01). Ordering prevents it; retrying absorbs the rest.
- How: Merging duplicate groups A and B: `SELECT id FROM duplicate_groups WHERE id = ANY($1::bigint[]) ORDER BY id FOR NO KEY UPDATE` locks both in id order before any update. Batch updates lock in primary-key order first (`SELECT ... ORDER BY id FOR NO KEY UPDATE`) and update second, because `UPDATE` has no `ORDER BY` (inference). The retry wrapper in C-39 already treats 40P01 as retryable.
- Sources: PostgreSQL docs — 13.3 Explicit Locking, Deadlocks — (URL as C-38) — 18 — "avoid them by being certain that all applications using a database acquire locks on multiple objects in a consistent order"; Andy Pavlo — Lecture #18: Two-Phase Locking, CMU 15-445/645 — https://15445.courses.cs.cmu.edu/fall2025/notes/18-twophaselocking.pdf — Fall 2025 — "2PL can still have dirty reads and it can also lead to deadlocks."; PostgreSQL docs — 13.5 Serialization Failure Handling — (URL as C-39) — "It may also be advisable to retry deadlock failures."
- Confidence: high.
- Conflicts: none.

### C-45: Set timeouts and application_name per role, never globally in postgresql.conf
- Owner question: 6
- Why: A statement timeout in `postgresql.conf` also hits maintenance and migrations. Idle-in-transaction sessions hold locks and stop vacuum. `transaction_timeout` (PostgreSQL 17, present in the lab image) caps a whole transaction. `application_name` tells you in `pg_stat_activity` which process is holding what.
- How: `ALTER ROLE carshenas_web SET statement_timeout = '5s'; ALTER ROLE carshenas_web SET idle_in_transaction_session_timeout = '10s'; ALTER ROLE carshenas_web SET transaction_timeout = '15s';` (starting values; inference); the worker role gets a longer statement timeout, and a known long job raises it with `SET LOCAL` inside its own transaction; the migrator sets `lock_timeout` per migration (C-46). Each process sets `application_name` (`carshenas-web`, `carshenas-worker`, `carshenas-migrate`) in its connection settings. Alert on SQLSTATE 57014 (statement timeout) and 25P03 (idle-in-transaction timeout) in the logs.
- Sources: PostgreSQL docs — 19.11 Client Connection Defaults — (URL as C-41) — 18 — "Setting statement_timeout in postgresql.conf is not recommended because it would affect all sessions."; PostgreSQL docs — 13.2 Transaction Isolation — (URL as C-32) — 18 — "Don't leave connections dangling “idle in transaction” longer than necessary."; Craig Kerstiens (Crunchy Data) — Control Runaway Postgres Queries With Statement Timeout — https://www.crunchydata.com/blog/control-runaway-postgres-queries-with-statement-timeout — 2020-06-10 — "A sane default is 30 or 60 seconds"; PostgreSQL docs — 19.8 Error Reporting and Logging (application_name) — https://www.postgresql.org/docs/current/runtime-config-logging.html — 18 — "The name will be displayed in the pg_stat_activity view and included in CSV log entries."
- Confidence: high for the mechanisms; the values are inference.
- Conflicts: Kerstiens sets one database-wide default (`ALTER DATABASE ... SET statement_timeout = '60s'`); per-role settings let the web role be much stricter than the worker (inference).

### Migrations

### C-46: Give every DDL statement a short lock_timeout and retry it, because a waiting ALTER blocks everyone queued behind it
- Owner question: 6
- Why: Most DDL needs an ACCESS EXCLUSIVE lock for an instant, but it must first wait for every open transaction that touched the table, and while it waits, plain reads queue behind it. Lab 9: a worker held a read transaction for 4 s; an `ALTER TABLE listings ADD COLUMN delisted_at timestamptz` (a metadata-only change) waited for it, and a buyer's plain `SELECT count(*) FROM listings` waited 3.0 s behind the ALTER. With `SET lock_timeout = '200ms'`, the ALTER failed after 200 ms with 55P03 and the same read returned at once.
- How: The migration runner (tool chosen in pass b) sets `lock_timeout` (1 s by default, lower on hot tables) and `statement_timeout` for every migration and retries a step that fails with 55P03, with jittered backoff; long-running statements by nature (`CREATE INDEX CONCURRENTLY`, `VALIDATE CONSTRAINT`) get a generous `statement_timeout` but keep the short `lock_timeout` (inference). Migrations connect directly to PostgreSQL, not through a transaction pooler, so their `SET`s hold (GitLab does the same). For his busiest table, Atkinson's retry function allowed up to 50 attempts with 50 to 250 ms of jittered backoff.
- Sources: Squawk — Applying migrations safely — https://squawkhq.com/docs/safe_migrations — read 2026-09-27 — "To safely apply a migration you must set a lock_timeout in Postgres." and "A migration that passes Squawk's lint is not automatically safe to run."; Hubert "depesz" Lubaczewski — How to run short ALTER TABLE without long locking concurrent queries — https://www.depesz.com/2019/09/26/how-to-run-short-alter-table-without-long-locking-concurrent-queries/ — 2019-09-26 — "alter table has to wait with continuing till previous locks are gone."; Nikolay Samokhvalov — Zero-downtime Postgres schema migrations need this: lock_timeout and retries — https://postgres.ai/blog/20210923-zero-downtime-postgres-schema-migrations-lock-timeout-and-retries — 2021-09-23 — "Without that trick in place, anyone using Postgres can (and will) hit that wall one day."; GitLab — Migration Style Guide — https://docs.gitlab.com/development/migration_style_guide/ — read 2026-09-27 — "Multiple shorter attempts to acquire the necessary lock allow the database to process other statements."; Andrew Atkinson — PostgreSQL 18: 23x Faster Inserts With UUID v7 — https://andyatkinson.com/postgresql-18-uuidv7 — 2026-08-26 — "Try up to 50 times (max attempts is configurable)"
- Confidence: high (lab and five independent sources).
- Conflicts: none.

### C-47: Change a shape by expanding, migrating and contracting; never rename or drop in one step
- Owner question: 6
- Why: During a deploy, old and new code run against the same schema, and a dropped or renamed column breaks whichever version still uses it. Destructive steps cannot be rolled back.
- How: Renaming `asking_price` to `asking_price_toman` on a live system: add the new column; deploy code that writes both (or a temporary trigger that copies); backfill in batches (C-51); add the constraints with `NOT VALID` then `VALIDATE` (C-48); switch reads; stop writing the old column; drop it in a later release. Before launch, a plain migration is fine; the habit starts when CS-23 puts Carshenas in front of reviewers (inference).
- Sources: Jacqueline Xu (Stripe) — Online migrations at scale — https://stripe.com/blog/online-migrations — 2017-02-02 — "There’s a common 4 step dual writing pattern that people often use to do large online migrations like this." and "Dual writing to the existing and new tables to keep them in sync."; GitLab — Avoiding downtime in migrations — https://docs.gitlab.com/development/database/avoiding_downtime_in_migrations/ — read 2026-09-27 — "Renaming columns the standard way requires downtime" and "dropping a column is a destructive operation that can’t be rolled back easily."; Andrew Atkinson — CORE Database Schema Design — https://andyatkinson.com/constraint-driven-optimized-responsive-efficient-core-db-design — 2025-06-09 — "When DDL changes are ready, the engineer applies them in a non-blocking way, in multiple steps as needed."
- Confidence: high.
- Conflicts: none.

### C-48: Add constraints NOT VALID and VALIDATE them separately, and set NOT NULL through a validated constraint
- Owner question: 6
- Why: Adding a CHECK in one step scans the table under a lock that blocks writes. Lab 13: during a one-step `ADD CONSTRAINT ... CHECK`, an insert waited 1.7 s; with `NOT VALID` followed by `VALIDATE CONSTRAINT`, the validating transaction held only `ShareUpdateExclusiveLock` and a concurrent insert took 9 ms. A `NOT VALID` constraint is enforced for new writes from the moment it is added; only old rows wait for validation.
- How:
  ```sql
  SET lock_timeout = '1s';
  ALTER TABLE listings ADD CONSTRAINT listings_mileage_km_check CHECK (mileage_km >= 0) NOT VALID; -- brief lock, no scan
  -- find and fix old violations here: SELECT id FROM listings WHERE NOT (mileage_km >= 0);
  ALTER TABLE listings VALIDATE CONSTRAINT listings_mileage_km_check;                            -- scans; writes continue
  ```
  Foreign keys follow the same two steps. NOT NULL on 17: add `CHECK (model_id IS NOT NULL) NOT VALID`, validate it, then `ALTER COLUMN model_id SET NOT NULL`, which skips the scan because the valid CHECK proves it, then drop the CHECK. On 18: `ALTER TABLE listings ADD CONSTRAINT listings_model_id_not_null NOT NULL model_id NOT VALID;` then `VALIDATE CONSTRAINT`.
- Sources: PostgreSQL docs — ALTER TABLE — https://www.postgresql.org/docs/current/sql-altertable.html — 18 — "The main purpose of the NOT VALID constraint option is to reduce the impact of adding a constraint on concurrent updates." and "which is currently only allowed for foreign-key, CHECK, and not-null constraints." and "which proves no NULL can exist, then the table scan is skipped."; Squawk — constraint-missing-not-valid — https://squawkhq.com/docs/constraint-missing-not-valid — read 2026-09-27 — "By default new constraints require a table scan and block writes to the table while that scan occurs."; Nikolay Samokhvalov — Postgres.fm, Constraints — https://postgres.fm/episodes/constraints — 2023-12-08 — "When you create something not valid, it means that it's already being validated for all new writes."; PostgreSQL — Release 18 — https://www.postgresql.org/docs/18/release-18.html — 2025-09-25 — "Allow ALTER TABLE to set the NOT VALID attribute of NOT NULL constraints"
- Confidence: high (documentation and lab).
- Conflicts: Nikolay said on 2026-04-17 that NOT NULL with NOT VALID would arrive "in Postgres 19" ("I think in Postgres 19 it will be possible also if not null constraints"); the PostgreSQL 18 release notes and ALTER TABLE page list it in 18. The documentation wins.

### C-49: Build indexes and unique constraints concurrently, outside any transaction, and clean up invalid leftovers
- Owner question: 6
- Why: A plain `CREATE INDEX` blocks writes for the whole build; `CONCURRENTLY` does not, but it cannot run inside a transaction block (lab 13), and a failed concurrent build leaves an INVALID index that still slows every write. A plain `ADD CONSTRAINT ... UNIQUE` also builds its index under a blocking lock.
- How: The migration tool must support migrations that run outside a transaction (pass b). Unique constraints in two steps: `CREATE UNIQUE INDEX CONCURRENTLY listings_source_listing_idx ON listings (source_id, source_listing_id);` then `ALTER TABLE listings ADD CONSTRAINT listings_source_listing_key UNIQUE USING INDEX listings_source_listing_idx;`. After a failure: `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;`, then `DROP INDEX CONCURRENTLY` and retry. `CREATE INDEX CONCURRENTLY IF NOT EXISTS` matches by name only, so a retried migration can silently keep an invalid index: check validity instead.
- Sources: PostgreSQL docs — CREATE INDEX — https://www.postgresql.org/docs/current/sql-createindex.html — 18 — "a regular CREATE INDEX command can be performed within a transaction block, but CREATE INDEX CONCURRENTLY cannot." and "the CREATE INDEX command will fail but leave behind an “invalid” index." and, of IF NOT EXISTS, "Note that there is no guarantee that the existing index is anything like the one that would have been created."; Squawk — disallowed-unique-constraint — https://squawkhq.com/docs/disallowed-unique-constraint — read 2026-09-27 — "Instead create an index CONCURRENTLY and create the CONSTRAINT USING the index."
- Confidence: high (documentation and lab).
- Conflicts: none.

### C-50: Know which schema changes rewrite the table, and which defaults are computed only once
- Owner question: 6
- Why: A rewrite copies the table and its indexes under ACCESS EXCLUSIVE and needs up to twice the disk. Triggers: a volatile default, a stored generated column, an identity column, a column whose domain has constraints, most type changes. A non-volatile default or a virtual generated column is a catalog change only.
- How: Lab 18: `ALTER TABLE ... ADD COLUMN first_seen_at timestamptz NOT NULL DEFAULT now()` kept the same data file (no rewrite) and gave all 1,002 existing rows the same value, the migration's own time, because `now()` is stable and is evaluated once; "first seen" for old listings must therefore be backfilled from their earliest snapshot, not defaulted. `DEFAULT clock_timestamp()` rewrote the table (a new data file); `gen_random_uuid()` is volatile too, so adding a `uuid` column with that default rewrites. Changing `varchar` to `text` does not rewrite.
- Sources: PostgreSQL docs — ALTER TABLE, Notes — (URL as C-48) — 18 — "will cause the entire table and its indexes to be rewritten" and "Adding a virtual generated column never requires a rewrite." and "The rewriting forms of ALTER TABLE are not MVCC-safe."; Squawk — adding-field-with-default — https://squawkhq.com/docs/adding-field-with-default — read 2026-09-27 — "Adding a field with a VOLATILE DEFAULT will cause a table rewrite."
- Confidence: high (documentation and lab).
- Conflicts: none.

### C-51: Backfill in small committed batches, outside the DDL transaction, in a restartable loop
- Owner question: 6
- Why: One giant `UPDATE` holds row locks for its whole run, bloats the table and, if it fails at 90 %, starts over.
- How: Run the backfill as a job, not inside the migration: each batch its own transaction over a key range (`WHERE id > $last AND id <= $last + 5000 AND first_seen_at IS NULL`), the predicate making reruns harmless, the last id recorded so a crash resumes, a short pause between batches, then the constraint in two steps (C-48). For `first_seen_at`, each batch sets the value from `min(fetched_at)` over the listing's snapshots (inference).
- Sources: GitLab — Batched background migrations — https://docs.gitlab.com/development/database/batched_background_migrations/ — read 2026-09-27 — "Batched background migrations should be used to perform data migrations whenever a migration exceeds the time limits in our guidelines."; Squawk — adding-field-with-default — (URL as C-50) — "backfill our column (ideally done in batches to limit locking), and finally remove nullability"
- Confidence: high.
- Conflicts: none.

### C-52: Treat applied migrations as immutable history: fix forward, keep non-transactional steps re-runnable, and lint every migration in CI
- Owner question: 6
- Why: A migration already applied somewhere is a fact about that database; editing or deleting it makes environments disagree in ways no tool reports.
- How: A correction is always a new migration; migrations are committed with the task that needs them and reviewed like code (AGENTS.md); steps that cannot run in a transaction guard themselves (`IF NOT EXISTS` plus a validity check, C-49); Squawk (or the linter pass e recommends) runs on every new migration file in CI, with `lock_timeout` and `statement_timeout` required. Write a down-migration only where it is cheap and tested; production problems are fixed forward (inference).
- Sources: Prisma — Migration histories — https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories — read 2026-09-27 — "In general, you should not edit or delete a migration that has already been applied."; GitLab — Delete existing migrations — https://docs.gitlab.com/development/database/deleting_migrations/ — read 2026-09-27 — "it’s not possible to delete existing migrations"; Squawk — Rules — https://squawkhq.com/docs/rules — read 2026-09-27 — "Squawk's rules focus on ensuring safe migrations and warn about statements that could block reads / writes or break existing clients."
- Confidence: high.
- Conflicts: GitLab — Migration Style Guide — (URL as C-46) — "Your migration must be reversible." Many teams run forward-only; for a single-developer project, forward-only with tested down-migrations for risky steps is a reasonable middle (inference).

### Testing

### C-53: Test against the same PostgreSQL major and extensions as production, in Docker, and never mock the database
- Owner question: 6
- Why: The behaviours worth testing (constraints, `ON CONFLICT`, error codes, row-level security, locking, planner-dependent results) exist only in the real engine. A mock or SQLite passes tests that PostgreSQL fails.
- How: CI and local tests run the same image as Docker Compose (after CS-4, a pinned PostgreSQL 18 pgvector image, per the Versions note). Tests call the real query functions against a real database (C-54).
- Sources: IntegreSQL (allaboutapps) — README — https://github.com/allaboutapps/integresql — read 2026-09-27 — "I'm generally not a fan of emulating database behavior through a mocking layer while testing/implementing."; Peter Downs — pgtestdb README — https://github.com/peterldowns/pgtestdb — read 2026-09-27 — "It uses [template databases](https://www.postgresql.org/docs/current/manage-ag-templatedbs.html) to give each test a fully prepared and migrated Postgres database"
- Confidence: high.
- Conflicts: none.

### C-54: Give each test worker its own database cloned from a migrated template; keep rollback-per-test isolation for simple cases only
- Owner question: 6
- Why: Cloning a migrated template is cheap (lab 11: a median of 36 ms per clone of an 8 MB, 14-table template, 38 ms in an earlier run). Rolling each test back instead hides real behaviour: a deferred foreign key is never checked (lab 10), `now()` stays frozen for the whole test (lab 10), code that commits, retries or opens its own transaction cannot run, and nesting falls back to savepoints.
- How (Vitest sketch): a global setup hashes the migrations directory; if `carshenas_template_<hash>` does not exist, it creates it, runs the migrations and marks it `IS_TEMPLATE`; each worker then runs `CREATE DATABASE test_<worker>_<n> TEMPLATE carshenas_template_<hash>` (no session may be connected to the template while it is copied) and drops it afterwards. The test server may run with `fsync = off` and on tmpfs, never production. Factories create rows through the application's own insert functions with unique natural keys per test (`source_listing_id: 'test-' + randomUUID()`) and realistic Persian values that include the zero-width non-joiner (inference).
- Sources: Peter Downs — pgtestdb README — (URL as C-53) — "each test only waits for ~20ms to get its own database" and "This would be a bad idea in production, but in tests it works great."; IntegreSQL — README — (URL as C-53) — "nested transactions are not supported and can only be poorly emulated using save points."; PostgreSQL docs — CREATE DATABASE — https://www.postgresql.org/docs/current/sql-createdatabase.html — 18 — "no other sessions can be connected to the template database while it is being copied."
- Confidence: high (lab and sources).
- Conflicts: none.

### C-55: Test the database's own rules by SQLSTATE: constraints, policies and triggers
- Owner question: 1, 6
- Why: Constraints are code; untested ones get dropped by accident or never existed. Policies fail silently: a USING clause that filters a row out raises nothing.
- How: One failing write per named constraint, asserting `{ code: '23505', constraint: 'listings_source_listing_key' }` in Vitest, or pgTAP's `throws_ok(sql, '23505')` in SQL. For row-level security, prove an allowed write by its `RETURNING` value and a denied one by an empty result plus a read showing the row unchanged (lab 14: another seller's `UPDATE` returned `UPDATE 0`, no error). Add the constraint-message completeness check from C-25.
- Sources: pgTAP — Documentation — https://pgtap.org/documentation.html — 1.3.4 — "pgTAP is a unit testing framework for PostgreSQL written in PL/pgSQL and PL/SQL."; Supabase — Row Level Security — https://supabase.com/docs/guides/database/postgres/row-level-security — read 2026-09-27 — "Never prove an allowed write with lives_ok. It passes when the write matched zero rows."; Supabase — Testing Your Database — https://supabase.com/docs/guides/database/testing — read 2026-09-27 — "All sql files use pgTAP as the test runner."
- Confidence: high.
- Conflicts: none.

### C-56: Test concurrency on purpose: two connections, a barrier, and assertions on the end state
- Owner question: 6
- Why: Races do not show up in single-connection tests; they need a deterministic interleaving.
- How: Two clients from the pool; client A takes a row lock (or `pg_advisory_lock(1)`) as a barrier and holds it while client B's statement starts and blocks; release, then assert the end state: exactly one listing row, a count of 4, one of the two rejected with 40001. The scripts in the research session's lab (`race.sh` with two `psql` sessions; not kept) were this pass's version and can seed the first tests (inference).
- Sources: Martin Kleppmann — Hermitage: Testing the "I" in ACID — https://martin.kleppmann.com/2014/11/25/hermitage-testing-the-i-in-acid.html — 2014-11-25 — "You can’t easily write unit tests for concurrency, either."; Martin Kleppmann — Hermitage README — https://github.com/ept/hermitage — read 2026-09-27 — "an attempt to nail down precisely what different database systems actually mean with their isolation levels"
- Confidence: medium.
- Conflicts: none.

### C-57: Test migrations from empty to head on every CI run, and against a production-sized copy before a risky deploy
- Owner question: 6
- Why: A migration that works on an empty database can lock a large table for minutes; one that has never run from zero can hide an ordering bug.
- How: A CI job creates a fresh database, runs every migration, runs the schema tests (C-55) and diffs a schema dump against the committed one (drift check) (inference). Before a deploy that touches a large table, run it against a restored copy with the production timeouts and record duration and lock waits (inference, in line with Nikolay's "experiment first" advice).
- Sources: Nikolay Samokhvalov — Postgres.fm, Schema design checklist — https://postgres.fm/episodes/schema-design-checklist — 2026-04-17 — "It's so easy these days to make these experiments before we finalize all the decisions"
- Confidence: medium.
- Conflicts: none.

### Security and privacy

### C-58: Separate roles: an owner that migrates, a web role, a worker role and a read-only role; the application never connects as owner or superuser
- Owner question: 6
- Why: Ownership carries the right to alter and drop, owners and superusers bypass row-level security, and a leaked web credential should not be able to change the schema or read raw snapshots (lab 14: the web role got "must be owner of table" on `ALTER TABLE`, while the owner saw every seller's rows).
- How:
  ```sql
  CREATE ROLE carshenas_owner NOLOGIN;                           -- owns every object
  CREATE ROLE carshenas_migrate LOGIN IN ROLE carshenas_owner;   -- migrations log in here and run SET ROLE carshenas_owner
  CREATE ROLE carshenas_web LOGIN;       -- SELECT on public listing data; DML only on tables people own
  CREATE ROLE carshenas_worker LOGIN;    -- INSERT and SELECT on snapshots; DML on derived tables
  CREATE ROLE carshenas_readonly LOGIN;  -- analysis
  ALTER DEFAULT PRIVILEGES FOR ROLE carshenas_owner IN SCHEMA public GRANT SELECT ON TABLES TO carshenas_readonly;
  ```
  Grants are per table: the web role never reads `snapshots` or phone hashes. `SECURITY DEFINER` functions pin `search_path` (trusted schemas, `pg_temp` last) and revoke `EXECUTE` from `PUBLIC`. Passwords live in `.env` files only (AGENTS.md).
- Sources: PostgreSQL docs — 5.8 Privileges — https://www.postgresql.org/docs/current/ddl-priv.html — 18 — "The right to modify or destroy an object is inherent in being the object's owner"; PostgreSQL docs — 5.9 Row Security Policies — https://www.postgresql.org/docs/current/ddl-rowsecurity.html — 18 — "Table owners normally bypass row security as well"; PostgreSQL docs — CREATE FUNCTION — https://www.postgresql.org/docs/current/sql-createfunction.html — 18 — "For security, search_path should be set to exclude any schemas writable by untrusted users."; PostgreSQL docs — 5.10 Schemas — https://www.postgresql.org/docs/current/ddl-schemas.html — 18 — "A secure schema usage pattern prevents untrusted users from changing the behavior of other users' queries."
- Confidence: high.
- Conflicts: none.

### C-59: Parameterize every value, and allowlist or quote every identifier
- Owner question: 6
- Why: Parameters cannot be injected; identifiers cannot be parameters, so dynamic column names are where injection comes back.
- How: Every value is a `$n` parameter (or the driver's tagged template). Sorting from the URL goes through an allowlist: `const sortColumns = { price: 'asking_price_toman', mileage: 'mileage_km', newest: 'first_seen_at' } as const;` with a default for anything else. In PL/pgSQL dynamic SQL, `format('%I', ...)` for identifiers and `USING` for values. Farsi search text is a parameter like any other.
- Sources: node-postgres — Queries — https://node-postgres.com/features/queries — read 2026-09-27 — "you will want to avoid string concatenating parameters into the query text directly. This can (and often does) lead to sql injection vulnerabilities." and "PostgreSQL does not support parameters for identifiers."; PostgreSQL docs — 9.4 String Functions (format) — https://www.postgresql.org/docs/current/functions-string.html — 18 — "The %I and %L format specifiers are particularly useful for safely constructing dynamic SQL statements."
- Confidence: high.
- Conflicts: none.

### C-60: Add row-level security as the second lock on seller-owned rows, and know how it is bypassed
- Owner question: 9
- Why: When native sellers arrive, one missed `WHERE seller_id = ...` in application code would show one seller's drafts to another. Row-level security is default-deny once enabled, but owners and superusers bypass it, views bypass it unless declared otherwise, and its context must survive the connection pooler.
- How: As in lab 14: `ALTER TABLE native_listings ENABLE ROW LEVEL SECURITY; CREATE POLICY native_listings_own ON native_listings TO carshenas_web USING (seller_id = current_setting('app.seller_id', true)::bigint) WITH CHECK (seller_id = current_setting('app.seller_id', true)::bigint);`. Set the context inside the request's transaction with `SELECT set_config('app.seller_id', $1, true)` (transaction-local, so it works under transaction pooling, where session `SET` is unsupported) (inference). Name the role in every policy (`TO carshenas_web`), index `seller_id`, and create views over these tables `WITH (security_invoker = true)`. Crawled listings are public data and need no policy (inference). Test as in C-55.
- Sources: PostgreSQL docs — 5.9 Row Security Policies — (URL as C-58) — 18 — "If no policy exists for the table, a default-deny policy is used, meaning that no rows are visible or can be modified."; Supabase — Row Level Security — (URL as C-55) — "Views bypass RLS by default because they are usually created with the postgres user." and "In Postgres 15 and above, make a view obey the RLS policies of its underlying tables" and "Add an index on every column your policies filter on."; PgBouncer — Features — https://www.pgbouncer.org/features.html — read 2026-09-27 — the feature table lists "SET/RESET" under transaction pooling as "Never".
- Confidence: high for the mechanisms; medium for the Carshenas design.
- Conflicts: row-level security complements the application's authorization, it does not replace it; Supabase's performance section shows policies have a cost, which pass d can measure.

### C-61: Store phone numbers used for duplicate detection as a keyed hash (HMAC) whose key lives outside the database, and amend ADR-0008's wording
- Owner question: 9, new
- Why: ADR-0008 point 7 says phone numbers are "stored only as salted hashes". A random salt per row makes the same phone hash differently each time, so duplicate detection cannot match; a hash without a secret is reversible by enumeration. Lab 15: SHA-256 over all 10,000,000 numbers with the prefix 0912 took 26.4 s on one core and recovered the number; the whole 09xx space (about 10⁹ numbers) is roughly 45 minutes on one core (inference from the measurement). A secret key (an HMAC, or a "salt" that is one secret value kept away from the data) keeps the fingerprint deterministic and useless without the key.
- How:
  ```ts
  import { createHmac } from 'node:crypto';

  // PHONE_HASH_KEY: 32 random bytes, base64, in the worker's environment only (AGENTS.md: secrets live in .env).
  export function phoneFingerprint(rawPhone: string): Buffer {
    const normalized = toIranMobileE164(rawPhone); // Persian and Arabic digits to Latin, strip spaces, 0912… to +98912…
    return createHmac('sha256', Buffer.from(process.env.PHONE_HASH_KEY!, 'base64')).update(normalized).digest();
  }
  ```
  Store `seller_phone_hmac bytea CHECK (octet_length(seller_phone_hmac) = 32)` with a `phone_hash_key_version smallint` for key rotation; only the worker role reads it (C-58); never store the raw number and never expose the fingerprint through the UI or an API. Proposed wording for ADR-0008 (the owner decides): "stored only as a keyed hash (HMAC-SHA-256) whose key is kept outside the database".
- Sources: Moxie Marlinspike (Signal) — The Difficulty Of Private Contact Discovery — https://signal.org/blog/contact-discovery/ — 2014-01-03 — "It’s not possible to “salt” the hashes, either (they always have to match), which makes building rainbow tables possible."; AEPD and EDPS — Introduction to the hash function as a personal data pseudonymisation technique — https://www.edps.europa.eu/sites/default/files/publication/19-10-30_aepd-edps_paper_hash_final_en.pdf — October 2019 — "it is possible to create a directory for all possible hashes for the telephone numbers of a given operator in less than 20 seconds" and "As in the case of using keys, the salt value must be kept secret"; ADR-0008 point 7 (repository).
- Confidence: high (sources and lab).
- Conflicts: with ADR-0008's current wording, as above.

### C-62: Decide a retention period per table, and make deletion cheap before the data piles up
- Owner question: 9, new
- Why: Data held is data that can leak, and deletion requests must reach every copy, archives included. Deleting old rows one by one is slow and leaves dead rows to vacuum; dropping a partition is instant.
- How: Snapshots keep their raw payload long enough to re-extract after a prompt change (CS-8 and CS-9 set the window), after which a retention job removes the payload but keeps the content hash and the extracted facts (inference). Personal fields that no feature needs are dropped at ingestion (ADR-0008 point 7) (inference). Once `snapshots` outgrows memory, range-partition it by month on `fetched_at` so retention is `DETACH PARTITION ... CONCURRENTLY` and `DROP TABLE` (pass d measures when). The `deleted_records` archive (C-20) is purged on a schedule, and a seller's account deletion cascades per C-27 and is logged without personal data.
- Sources: PostgreSQL docs — 5.12 Table Partitioning — https://www.postgresql.org/docs/current/ddl-partitioning.html — 18 — "Dropping an individual partition using DROP TABLE, or doing ALTER TABLE DETACH PARTITION, is far faster than a bulk operation." and "the size of the table should exceed the physical memory of the database server."; Michael Christofides — Postgres.fm, Soft delete — https://postgres.fm/episodes/soft-delete — 2024-06-28 — "people started to think of having data as a liability"; Brandur Leach — Soft Deletion Probably Isn't Worth It — https://brandur.org/soft-deletion — 2022-07-19 — "Hard deleting old records for regulatory requirements gets really, really easy"
- Confidence: medium.
- Conflicts: none.

## Lab

**Environment.** `docker run -d --name carshenas-lab-integrity -e POSTGRES_PASSWORD=lab -p 55433:5432 pgvector/pgvector:pg17` → PostgreSQL 17.11 (Debian 17.11-1.pgdg12+2), pgvector 0.8.6, default configuration, on a laptop (Intel Core i7-10510U, 8 threads) with Node 22.14.0 for the two JavaScript checks. Database `lab`. Every file named below was in the research session's lab (not kept). Single-session transcripts come from `psql -X -e` (statements echoed, errors merged in order). Concurrent transcripts come from `race.sh` (two sessions) or `race3.sh` (four), which run `psql -f` inside the container with a TTY and prefix each output line with the host time since start (`t+…s`) and the session (`A|`, `B|`); lines that only print `pg_sleep` results, table rules and row counts were filtered out of those transcripts, nothing else. Where exact ordering matters, the sessions also print the server's `clock_timestamp()`. The container was removed after the runs.

Schema used by labs 2 to 5 (`02-schema.sql`):

```sql
CREATE TABLE sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL CONSTRAINT sources_slug_key UNIQUE CHECK (slug ~ '^[a-z0-9]+$')
);
INSERT INTO sources (slug) VALUES ('bama'), ('karnameh'), ('khodro45');
-- no natural-key constraint: the "app checks first" design
CREATE TABLE listings_unguarded (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id bigint NOT NULL REFERENCES sources,
  source_listing_id text NOT NULL,
  asking_price_toman bigint
);
-- the natural key (source, id on that source) is declared: the "database guards" design
CREATE TABLE listings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id bigint NOT NULL REFERENCES sources,
  source_listing_id text NOT NULL,
  asking_price_toman bigint CONSTRAINT listings_asking_price_positive CHECK (asking_price_toman > 0),
  version integer NOT NULL DEFAULT 0,
  CONSTRAINT listings_source_listing_key UNIQUE (source_id, source_listing_id)
);
```

### Lab 1: PostgreSQL 17.11 has no uuidv7(); a SQL fallback and its ordering

Findings: `uuidv7()` and `uuidv4()` do not exist in 17.11; `uuid_extract_timestamp()` exists but returns NULL for version 7 (17 reads version 1 only); the SQL fallback's 48-bit millisecond prefix decodes to the current time; in 5,000 consecutive values none went backwards across milliseconds and about half went backwards within a millisecond (2,499 here; 2,477 in an earlier run).

```
SHOW server_version;
         server_version          
---------------------------------
 17.11 (Debian 17.11-1.pgdg12+2)
(1 row)

SELECT to_regproc('uuidv7') AS uuidv7_fn, to_regproc('uuidv4') AS uuidv4_fn,
       to_regproc('gen_random_uuid') AS gen_random_uuid_fn,
       to_regproc('uuid_extract_timestamp') AS extract_fn;
 uuidv7_fn | uuidv4_fn | gen_random_uuid_fn |       extract_fn       
-----------+-----------+--------------------+------------------------
           |           | gen_random_uuid    | uuid_extract_timestamp
(1 row)

SELECT uuidv7();
ERROR:  function uuidv7() does not exist
LINE 1: SELECT uuidv7();
               ^
HINT:  No function matches the given name and argument types. You might need to add explicit type casts.
CREATE OR REPLACE FUNCTION uuid_generate_v7(ts timestamptz DEFAULT NULL) RETURNS uuid AS $$
  SELECT encode(set_bit(set_bit(overlay(uuid_send(gen_random_uuid())
         PLACING substring(int8send(floor(extract(epoch FROM coalesce(ts, clock_timestamp())) * 1000)::bigint) FROM 3)
         FROM 1 FOR 6), 52, 1), 53, 1), 'hex')::uuid;
$$ LANGUAGE sql VOLATILE;
CREATE FUNCTION
SELECT u, uuid_extract_version(u) AS version, uuid_extract_timestamp(u) AS embedded_time
FROM (SELECT uuid_generate_v7() AS u FROM generate_series(1,3)) s;
                  u                   | version | embedded_time 
--------------------------------------+---------+---------------
 01a0dff9-dd15-7b6f-9197-a63cb3966d9d |       7 | 
 01a0dff9-dd15-7306-9b0a-98118ca250ca |       7 | 
 01a0dff9-dd15-7242-86a1-b63ddfc650ca |       7 | 
(3 rows)

SELECT uuid_extract_version(gen_random_uuid()) AS v4_version, uuid_extract_timestamp(gen_random_uuid()) AS v4_time;
 v4_version | v4_time 
------------+---------
          4 | 
(1 row)

SELECT u, to_timestamp(('x' || substr(replace(u::text, '-', ''), 1, 12))::bit(48)::bigint / 1000.0) AS decoded_time,
       clock_timestamp() AS now_
FROM (SELECT uuid_generate_v7() AS u) s;
                  u                   |        decoded_time        |             now_              
--------------------------------------+----------------------------+-------------------------------
 01a0dff9-dd16-79c9-9470-330010501252 | 2026-09-26 23:08:09.366+00 | 2026-09-26 23:08:09.366513+00
(1 row)

WITH g AS (SELECT n, uuid_generate_v7() AS u FROM generate_series(1, 5000) n),
     o AS (SELECT n, u, lag(u) OVER (ORDER BY n) AS prev FROM g)
SELECT count(*) FILTER (WHERE u < prev) AS pairs_out_of_order,
       count(*) FILTER (WHERE substr(u::text,1,13) < substr(prev::text,1,13)) AS ms_prefix_out_of_order,
       count(*) AS pairs
FROM o WHERE prev IS NOT NULL;
 pairs_out_of_order | ms_prefix_out_of_order | pairs 
--------------------+------------------------+-------
               2499 |                      0 |  4999
(1 row)
```

### Lab 2: check-then-insert, the unique constraint and ON CONFLICT, with two sessions

**2a. No natural-key constraint, READ COMMITTED: both sessions check, both insert (two rows for one Bama listing).**

Session A (`03a-A.sql`):
```sql
BEGIN;
SELECT count(*) AS already_there FROM listings_unguarded WHERE source_id = 1 AND source_listing_id = 'bama-7731';
SELECT pg_sleep(2);  -- the app does its work: parse, normalise, call nothing external
INSERT INTO listings_unguarded (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-7731', 1450000000);
COMMIT;
```
Session B (`03a-B.sql`), started 0.5 s later:
```sql
BEGIN;
SELECT count(*) AS already_there FROM listings_unguarded WHERE source_id = 1 AND source_listing_id = 'bama-7731';
SELECT pg_sleep(2);
INSERT INTO listings_unguarded (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-7731', 1450000000);
COMMIT;
SELECT source_listing_id, count(*) AS rows_for_one_listing FROM listings_unguarded GROUP BY 1;
```
```
=== 2a check-then-insert, no unique constraint, READ COMMITTED
t+0.083s A| BEGIN;
t+0.083s A| BEGIN
t+0.083s A| SELECT count(*) AS already_there FROM listings_unguarded WHERE source_id = 1 AND source_listing_id = 'bama-7731';
t+0.084s A|  already_there 
t+0.084s A|              0
t+0.589s B| BEGIN;
t+0.589s B| BEGIN
t+0.589s B| SELECT count(*) AS already_there FROM listings_unguarded WHERE source_id = 1 AND source_listing_id = 'bama-7731';
t+0.589s B|  already_there 
t+0.589s B|              0
t+2.086s A| INSERT INTO listings_unguarded (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-7731', 1450000000);
t+2.087s A| INSERT 0 1
t+2.087s A| COMMIT;
t+2.088s A| COMMIT
t+2.591s B| INSERT INTO listings_unguarded (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-7731', 1450000000);
t+2.591s B| INSERT 0 1
t+2.592s B| COMMIT;
t+2.592s B| COMMIT
t+2.592s B| SELECT source_listing_id, count(*) AS rows_for_one_listing FROM listings_unguarded GROUP BY 1;
t+2.593s B|  source_listing_id | rows_for_one_listing 
t+2.593s B|  bama-7731         |                    2
```

**2b. The same check-then-insert under SERIALIZABLE: the second session fails with 40001 and one row remains.** Files `03b-A.sql` and `03b-B.sql` are 2a's with `BEGIN ISOLATION LEVEL SERIALIZABLE;`.
```
=== 2b check-then-insert, no unique constraint, SERIALIZABLE
t+0.080s A| BEGIN ISOLATION LEVEL SERIALIZABLE;
t+0.080s A| BEGIN
t+0.080s A| SELECT count(*) AS already_there FROM listings_unguarded WHERE source_id = 1 AND source_listing_id = 'bama-7731';
t+0.081s A|  already_there 
t+0.081s A|              0
t+0.581s B| BEGIN ISOLATION LEVEL SERIALIZABLE;
t+0.581s B| BEGIN
t+0.581s B| SELECT count(*) AS already_there FROM listings_unguarded WHERE source_id = 1 AND source_listing_id = 'bama-7731';
t+0.581s B|  already_there 
t+0.581s B|              0
t+2.084s A| INSERT INTO listings_unguarded (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-7731', 1450000000);
t+2.085s A| INSERT 0 1
t+2.085s A| COMMIT;
t+2.092s A| COMMIT
t+2.584s B| INSERT INTO listings_unguarded (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-7731', 1450000000);
t+2.584s B| psql:B.sql:4: ERROR:  40001: could not serialize access due to read/write dependencies among transactions
t+2.584s B| DETAIL:  Reason code: Canceled on identification as a pivot, during write.
t+2.584s B| HINT:  The transaction might succeed if retried.
t+2.584s B| COMMIT;
t+2.584s B| ROLLBACK
t+2.585s B| SELECT source_listing_id, count(*) AS rows_for_one_listing FROM listings_unguarded GROUP BY 1;
t+2.585s B|  source_listing_id | rows_for_one_listing 
t+2.585s B|  bama-7731         |                    1
```

**2c. With `UNIQUE (source_id, source_listing_id)`: the second insert waits for the first transaction (from t+2.585 s to t+4.083 s), then fails with 23505 carrying the constraint name, and the next statement fails with 25P02.**

Session A (`03c-A.sql`):
```sql
BEGIN;
SELECT count(*) AS already_there FROM listings WHERE source_id = 1 AND source_listing_id = 'bama-8120';
SELECT pg_sleep(2);
INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-8120', 980000000);
SELECT pg_sleep(2);  -- A keeps its transaction open a little longer
COMMIT;
```
Session B (`03c-B.sql`):
```sql
BEGIN;
SELECT count(*) AS already_there FROM listings WHERE source_id = 1 AND source_listing_id = 'bama-8120';
SELECT pg_sleep(2);
SELECT clock_timestamp()::time(3) AS b_insert_starts;
INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-8120', 980000000);
SELECT clock_timestamp()::time(3) AS b_after_insert;
ROLLBACK;
SELECT count(*) AS rows_for_one_listing FROM listings WHERE source_listing_id = 'bama-8120';
```
```
=== 2c check-then-insert, unique constraint, READ COMMITTED
t+0.076s A| BEGIN;
t+0.076s A| BEGIN
t+0.076s A| SELECT count(*) AS already_there FROM listings WHERE source_id = 1 AND source_listing_id = 'bama-8120';
t+0.077s A|  already_there 
t+0.077s A|              0
t+0.581s B| BEGIN;
t+0.581s B| BEGIN
t+0.582s B| SELECT count(*) AS already_there FROM listings WHERE source_id = 1 AND source_listing_id = 'bama-8120';
t+0.582s B|  already_there 
t+0.582s B|              0
t+2.079s A| INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-8120', 980000000);
t+2.080s A| INSERT 0 1
t+2.584s B| SELECT clock_timestamp()::time(3) AS b_insert_starts;
t+2.585s B|  b_insert_starts 
t+2.585s B|  22:34:46.075
t+2.585s B| INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-8120', 980000000);
t+4.082s A| COMMIT;
t+4.083s A| COMMIT
t+4.083s B| psql:B.sql:5: ERROR:  23505: duplicate key value violates unique constraint "listings_source_listing_key"
t+4.083s B| DETAIL:  Key (source_id, source_listing_id)=(1, bama-8120) already exists.
t+4.083s B| SCHEMA NAME:  public
t+4.083s B| TABLE NAME:  listings
t+4.083s B| CONSTRAINT NAME:  listings_source_listing_key
t+4.083s B| SELECT clock_timestamp()::time(3) AS b_after_insert;
t+4.083s B| psql:B.sql:6: ERROR:  25P02: current transaction is aborted, commands ignored until end of transaction block
t+4.083s B| ROLLBACK;
t+4.083s B| ROLLBACK
t+4.083s B| SELECT count(*) AS rows_for_one_listing FROM listings WHERE source_listing_id = 'bama-8120';
t+4.083s B|  rows_for_one_listing 
t+4.084s B|                     1
```

**2d. `ON CONFLICT DO NOTHING` as get-or-create: session B waits, gets no error and no row (0 rows, even with the `UNION ALL SELECT`), and a second statement sees the row.**

Session A (`03d-A.sql`):
```sql
BEGIN;
INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-9004', 1210000000)
ON CONFLICT (source_id, source_listing_id) DO NOTHING
RETURNING id;
SELECT pg_sleep(2);
COMMIT;
```
Session B (`03d-B.sql`):
```sql
BEGIN;
SELECT clock_timestamp()::time(3) AS b_insert_starts;
-- the naive "get or create": insert, or return the row that is already there
WITH ins AS (
  INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-9004', 1210000000)
  ON CONFLICT (source_id, source_listing_id) DO NOTHING
  RETURNING id
)
SELECT id, 'inserted' AS how FROM ins
UNION ALL
SELECT id, 'existing' FROM listings WHERE source_id = 1 AND source_listing_id = 'bama-9004';
SELECT clock_timestamp()::time(3) AS b_statement_done;
-- a new statement takes a new snapshot under READ COMMITTED and sees A's committed row
SELECT id, 'existing (second statement)' AS how FROM listings WHERE source_id = 1 AND source_listing_id = 'bama-9004';
COMMIT;
```
```
=== 2d ON CONFLICT DO NOTHING get-or-create, READ COMMITTED
t+0.092s A| BEGIN;
t+0.093s A| BEGIN
t+0.093s A| INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-9004', 1210000000)
t+0.093s A| ON CONFLICT (source_id, source_listing_id) DO NOTHING
t+0.093s A| RETURNING id;
t+0.094s A|  id 
t+0.095s A| ----
t+0.095s A|  23
t+0.095s A| INSERT 0 1
t+0.579s B| BEGIN;
t+0.579s B| BEGIN
t+0.580s B| SELECT clock_timestamp()::time(3) AS b_insert_starts;
t+0.580s B|  b_insert_starts 
t+0.580s B|  22:34:48.244
t+0.580s B| WITH ins AS (
t+0.580s B|   INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-9004', 1210000000)
t+0.580s B|   ON CONFLICT (source_id, source_listing_id) DO NOTHING
t+0.580s B|   RETURNING id
t+0.580s B| )
t+0.580s B| SELECT id, 'inserted' AS how FROM ins
t+0.580s B| UNION ALL
t+0.580s B| SELECT id, 'existing' FROM listings WHERE source_id = 1 AND source_listing_id = 'bama-9004';
t+2.097s A| COMMIT;
t+2.097s A| COMMIT
t+2.098s B|  id | how 
t+2.098s B| ----+-----
t+2.098s B| (0 rows)
t+2.098s B| SELECT clock_timestamp()::time(3) AS b_statement_done;
t+2.098s B|  b_statement_done 
t+2.098s B|  22:34:49.762
t+2.098s B| SELECT id, 'existing (second statement)' AS how FROM listings WHERE source_id = 1 AND source_listing_id = 'bama-9004';
t+2.098s B|  id |             how             
t+2.098s B|  23 | existing (second statement)
t+2.098s B| COMMIT;
t+2.098s B| COMMIT
```

### Lab 3: what failed inserts and no-op updates leave behind

Setup (`04-setup.sql`), autovacuum off for this table so dead tuples stay countable:
```sql
DROP TABLE IF EXISTS listings_probe;
CREATE TABLE listings_probe (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id bigint NOT NULL,
  source_listing_id text NOT NULL,
  asking_price_toman bigint NOT NULL,
  CONSTRAINT listings_probe_source_listing_key UNIQUE (source_id, source_listing_id)
) WITH (autovacuum_enabled = false);
INSERT INTO listings_probe (source_id, source_listing_id, asking_price_toman)
SELECT 1, 'bama-' || n, 900000000 + n * 1000000 FROM generate_series(1, 1000) n;
```
Insert-and-catch (`04-catch.sql`, 1,000 separate statements, each a 23505):
```sql
INSERT INTO listings_probe (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-1', 901000000);
INSERT INTO listings_probe (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-2', 902000000);
-- ... 998 more lines of the same form
```
`ON CONFLICT DO NOTHING` (`04-donothing.sql`), a no-op `DO UPDATE` (`04-doupdate-noop.sql`) and a guarded `DO UPDATE` (`04-doupdate-guarded.sql`):
```sql
INSERT INTO listings_probe (source_id, source_listing_id, asking_price_toman)
SELECT 1, 'bama-' || n, 900000000 + n * 1000000 FROM generate_series(1, 1000) n
ON CONFLICT (source_id, source_listing_id) DO NOTHING;
```
```sql
INSERT INTO listings_probe (source_id, source_listing_id, asking_price_toman)
SELECT 1, 'bama-' || n, 900000000 + n * 1000000 FROM generate_series(1, 1000) n
ON CONFLICT (source_id, source_listing_id) DO UPDATE SET asking_price_toman = EXCLUDED.asking_price_toman;
```
```sql
INSERT INTO listings_probe (source_id, source_listing_id, asking_price_toman)
SELECT 1, 'bama-' || n, 900000000 + n * 1000000 FROM generate_series(1, 1000) n
ON CONFLICT (source_id, source_listing_id) DO UPDATE SET asking_price_toman = EXCLUDED.asking_price_toman
WHERE listings_probe.asking_price_toman IS DISTINCT FROM EXCLUDED.asking_price_toman;
```
Statistics after each step (`04-stats-line.sql`, after `pg_stat_force_next_flush()` and a 1.2 s pause):
```sql
SELECT pg_stat_force_next_flush();
SELECT pg_sleep(1.2);
\pset tuples_only on
\pset format unaligned
\pset fieldsep ' | '
SELECT n_tup_ins, n_tup_upd, n_dead_tup, n_live_tup, (SELECT last_value FROM listings_probe_id_seq) AS identity_last_value,
       pg_size_pretty(pg_relation_size('listings_probe')) AS heap_size
FROM pg_stat_user_tables WHERE relname = 'listings_probe';
```
Results (`04-summary.out`; the counters are cumulative):
```
step | n_tup_ins | n_tup_upd | n_dead_tup | n_live_tup | identity_last_value | heap_size
initial load of 1000 listings | 1000 | 0 | 0 | 1000 | 1000 | 72 kB
1000 single-row INSERTs, each failing with 23505 (1000 errors) | 2000 | 0 | 1000 | 1000 | 2000 | 136 kB
same 1000 rows, ON CONFLICT DO NOTHING | 2000 | 0 | 1000 | 1000 | 3000 | 136 kB
same 1000 rows, DO UPDATE SET price = EXCLUDED.price (unchanged) | 2000 | 1000 | 2000 | 1000 | 4000 | 200 kB
same 1000 rows, DO UPDATE ... WHERE price IS DISTINCT FROM EXCLUDED.price | 2000 | 1000 | 2000 | 1000 | 5000 | 200 kB
```

### Lab 4: telling inserted from updated rows with xmax

```
INSERT INTO listings_probe AS l (source_id, source_listing_id, asking_price_toman)
VALUES (1, 'bama-1', 880000000), (1, 'bama-2', 902000000), (1, 'bama-5001', 1330000000)
ON CONFLICT (source_id, source_listing_id) DO UPDATE
   SET asking_price_toman = EXCLUDED.asking_price_toman
 WHERE l.asking_price_toman IS DISTINCT FROM EXCLUDED.asking_price_toman
RETURNING l.id, l.source_listing_id, l.asking_price_toman, l.xmax, (l.xmax = 0) AS inserted, txid_current() AS my_xid;
  id  | source_listing_id | asking_price_toman | xmax | inserted | my_xid 
------+-------------------+--------------------+------+----------+--------
    1 | bama-1            |          880000000 | 2994 | f        |   2994
 5003 | bama-5001         |         1330000000 |    0 | t        |   2994
(2 rows)

INSERT 0 2
```

### Lab 5: a failed statement aborts the transaction (25P02); a savepoint recovers; ON CONFLICT needs neither

```
BEGIN;
BEGIN
INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (2, 'karnameh-501', 1100000000);
INSERT 0 1
INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-8120', 980000000);
ERROR:  23505: duplicate key value violates unique constraint "listings_source_listing_key"
DETAIL:  Key (source_id, source_listing_id)=(1, bama-8120) already exists.
SCHEMA NAME:  public
TABLE NAME:  listings
CONSTRAINT NAME:  listings_source_listing_key
INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (2, 'karnameh-502', 1500000000);
ERROR:  25P02: current transaction is aborted, commands ignored until end of transaction block
COMMIT;
ROLLBACK
SELECT count(*) AS karnameh_rows FROM listings WHERE source_id = 2;
 karnameh_rows 
---------------
             0
(1 row)

BEGIN;
BEGIN
INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (2, 'karnameh-501', 1100000000);
INSERT 0 1
SAVEPOINT before_listing;
SAVEPOINT
INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-8120', 980000000);
ERROR:  23505: duplicate key value violates unique constraint "listings_source_listing_key"
DETAIL:  Key (source_id, source_listing_id)=(1, bama-8120) already exists.
SCHEMA NAME:  public
TABLE NAME:  listings
CONSTRAINT NAME:  listings_source_listing_key
ROLLBACK TO SAVEPOINT before_listing;
ROLLBACK
INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (2, 'karnameh-502', 1500000000);
INSERT 0 1
COMMIT;
COMMIT
SELECT count(*) AS karnameh_rows FROM listings WHERE source_id = 2;
 karnameh_rows 
---------------
             2
(1 row)

BEGIN;
BEGIN
INSERT INTO listings (source_id, source_listing_id, asking_price_toman)
VALUES (2, 'karnameh-503', 990000000), (1, 'bama-8120', 980000000), (2, 'karnameh-504', 1250000000)
ON CONFLICT (source_id, source_listing_id) DO NOTHING;
INSERT 0 2
COMMIT;
COMMIT
SELECT count(*) AS karnameh_rows FROM listings WHERE source_id = 2;
 karnameh_rows 
---------------
             4
(1 row)
```

### Lab 6: NULLS NOT DISTINCT for one market value per segment and day, and three-valued logic

```
CREATE TABLE valuations_default (
  model_id bigint NOT NULL, trim_id bigint, model_year_solar smallint NOT NULL, valued_on date NOT NULL,
  market_value_toman bigint NOT NULL,
  CONSTRAINT valuations_default_segment_day_key UNIQUE (model_id, trim_id, model_year_solar, valued_on)
);
CREATE TABLE
INSERT INTO valuations_default VALUES (206, NULL, 1400, '2026-09-27', 780000000);
INSERT 0 1
INSERT INTO valuations_default VALUES (206, NULL, 1400, '2026-09-27', 795000000);
INSERT 0 1
SELECT count(*) AS market_values_for_one_segment_day FROM valuations_default;
 market_values_for_one_segment_day 
-----------------------------------
                                 2
(1 row)

CREATE TABLE valuations (
  model_id bigint NOT NULL, trim_id bigint, model_year_solar smallint NOT NULL, valued_on date NOT NULL,
  market_value_toman bigint NOT NULL,
  CONSTRAINT valuations_segment_day_key UNIQUE NULLS NOT DISTINCT (model_id, trim_id, model_year_solar, valued_on)
);
CREATE TABLE
INSERT INTO valuations VALUES (206, NULL, 1400, '2026-09-27', 780000000);
INSERT 0 1
INSERT INTO valuations VALUES (206, NULL, 1400, '2026-09-27', 795000000);
ERROR:  duplicate key value violates unique constraint "valuations_segment_day_key"
DETAIL:  Key (model_id, trim_id, model_year_solar, valued_on)=(206, null, 1400, 2026-09-27) already exists.
INSERT INTO valuations VALUES (206, NULL, 1400, '2026-09-27', 795000000)
ON CONFLICT ON CONSTRAINT valuations_segment_day_key DO UPDATE SET market_value_toman = EXCLUDED.market_value_toman
RETURNING *;
 model_id | trim_id | model_year_solar | valued_on  | market_value_toman 
----------+---------+------------------+------------+--------------------
      206 |         |             1400 | 2026-09-27 |          795000000
(1 row)

INSERT 0 1
CREATE TABLE price_probe (asking_price_toman bigint CHECK (asking_price_toman > 0));
CREATE TABLE
INSERT INTO price_probe VALUES (NULL);
INSERT 0 1
INSERT INTO price_probe VALUES (0);
ERROR:  new row for relation "price_probe" violates check constraint "price_probe_asking_price_toman_check"
DETAIL:  Failing row contains (0).
SELECT count(*) AS rows_not_in_list FROM (VALUES (1), (2), (3)) v(x) WHERE x NOT IN (2, NULL);
 rows_not_in_list 
------------------
                0
(1 row)

SELECT count(*) AS rows_not_exists FROM (VALUES (1), (2), (3)) v(x)
WHERE NOT EXISTS (SELECT 1 FROM (VALUES (2), (NULL::int)) e(y) WHERE e.y = v.x);
 rows_not_exists 
-----------------
               2
(1 row)
```

And whether `NULLS NOT DISTINCT` counts an all-NULL key once in PostgreSQL (`21-nnd.sql`; it does):

```
CREATE TEMP TABLE nnd (a int, b int, CONSTRAINT nnd_key UNIQUE NULLS NOT DISTINCT (a, b));
CREATE TABLE
INSERT INTO nnd VALUES (NULL, NULL);
INSERT 0 1
INSERT INTO nnd VALUES (NULL, NULL);
ERROR:  duplicate key value violates unique constraint "nnd_key"
DETAIL:  Key (a, b)=(null, null) already exists.
INSERT INTO nnd VALUES (1, NULL);
INSERT 0 1
INSERT INTO nnd VALUES (1, NULL);
ERROR:  duplicate key value violates unique constraint "nnd_key"
DETAIL:  Key (a, b)=(1, null) already exists.
SELECT * FROM nnd;
 a | b 
---+---
   |  
 1 |  
(2 rows)
```

### Lab 7: a lost update under READ COMMITTED and four fixes

Setup (`08-setup.sql`): a duplicate group with 2 listings; each session adds one matched listing, so the right answer is 4.
```sql
DROP TABLE IF EXISTS duplicate_groups;
CREATE TABLE duplicate_groups (
  id bigint PRIMARY KEY,
  listing_count integer NOT NULL CHECK (listing_count >= 1),
  version integer NOT NULL DEFAULT 0
);
INSERT INTO duplicate_groups (id, listing_count) VALUES (1, 2);
```

**7a. Read in the app, write back (READ COMMITTED): final 3, one update lost.** `08a-A.sql`, `08a-B.sql`:
```sql
BEGIN;
SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 \gset
\echo A read listing_count = :c
SELECT pg_sleep(1);
UPDATE duplicate_groups SET listing_count = :c + 1 WHERE id = 1;
COMMIT;
```
```sql
BEGIN;
SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 \gset
\echo B read listing_count = :c
SELECT pg_sleep(1);
UPDATE duplicate_groups SET listing_count = :c + 1 WHERE id = 1;
COMMIT;
SELECT pg_sleep(0.5);
SELECT listing_count AS final_listing_count FROM duplicate_groups WHERE id = 1;
```
```
=== 7a read-modify-write in the app, READ COMMITTED
t+0.085s A| BEGIN;
t+0.085s A| BEGIN
t+0.085s A| SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 
t+0.086s A| A read listing_count = 2
t+0.424s B| BEGIN;
t+0.424s B| BEGIN
t+0.424s B| SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 
t+0.425s B| B read listing_count = 2
t+1.090s A| UPDATE duplicate_groups SET listing_count = 2 + 1 WHERE id = 1;
t+1.090s A| UPDATE 1
t+1.090s A| COMMIT;
t+1.091s A| COMMIT
t+1.430s B| UPDATE duplicate_groups SET listing_count = 2 + 1 WHERE id = 1;
t+1.430s B| UPDATE 1
t+1.430s B| COMMIT;
t+1.430s B| COMMIT
t+1.931s B| SELECT listing_count AS final_listing_count FROM duplicate_groups WHERE id = 1;
t+1.931s B|  final_listing_count 
t+1.931s B|                    3
```

**7b. One atomic UPDATE: final 4; B's update waits for A's commit.** `08b-A.sql`, `08b-B.sql`:
```sql
BEGIN;
UPDATE duplicate_groups SET listing_count = listing_count + 1 WHERE id = 1 RETURNING listing_count;
SELECT pg_sleep(1);
COMMIT;
```
```sql
BEGIN;
UPDATE duplicate_groups SET listing_count = listing_count + 1 WHERE id = 1 RETURNING listing_count;
COMMIT;
SELECT listing_count AS final_listing_count FROM duplicate_groups WHERE id = 1;
```
```
=== 7b atomic increment in SQL
t+0.109s A| BEGIN;
t+0.109s A| BEGIN
t+0.109s A| UPDATE duplicate_groups SET listing_count = listing_count + 1 WHERE id = 1 RETURNING listing_count;
t+0.110s A|  listing_count 
t+0.110s A|              3
t+0.110s A| UPDATE 1
t+0.397s B| BEGIN;
t+0.398s B| BEGIN
t+0.398s B| UPDATE duplicate_groups SET listing_count = listing_count + 1 WHERE id = 1 RETURNING listing_count;
t+1.111s A| COMMIT;
t+1.113s A| COMMIT
t+1.114s B|  listing_count 
t+1.114s B|              4
t+1.114s B| UPDATE 1
t+1.114s B| COMMIT;
t+1.114s B| COMMIT
t+1.114s B| SELECT listing_count AS final_listing_count FROM duplicate_groups WHERE id = 1;
t+1.114s B|  final_listing_count 
t+1.114s B|                    4
```

**7c. `SELECT ... FOR NO KEY UPDATE`: B waits from t+0.395 s until A commits (t+1.085 s), reads 3, writes 4.** `08c-A.sql`, `08c-B.sql`:
```sql
BEGIN;
SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 FOR NO KEY UPDATE \gset
\echo A read listing_count = :c (row locked)
SELECT pg_sleep(1);
UPDATE duplicate_groups SET listing_count = :c + 1 WHERE id = 1;
COMMIT;
```
```sql
BEGIN;
SELECT clock_timestamp()::time(3) AS b_asks_for_lock;
SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 FOR NO KEY UPDATE \gset
\echo B read listing_count = :c
UPDATE duplicate_groups SET listing_count = :c + 1 WHERE id = 1;
COMMIT;
SELECT listing_count AS final_listing_count FROM duplicate_groups WHERE id = 1;
```
```
=== 8c SELECT ... FOR NO KEY UPDATE
t+0.084s A| BEGIN;
t+0.084s A| BEGIN
t+0.084s A| SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 FOR NO KEY UPDATE 
t+0.084s A| A read listing_count = 2 (row locked)
t+0.394s B| BEGIN;
t+0.394s B| BEGIN
t+0.394s B| SELECT clock_timestamp()::time(3) AS b_asks_for_lock;
t+0.394s B|  b_asks_for_lock 
t+0.395s B|  22:33:56.43
t+0.395s B| SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 FOR NO KEY UPDATE 
t+1.085s A| UPDATE duplicate_groups SET listing_count = 2 + 1 WHERE id = 1;
t+1.085s A| UPDATE 1
t+1.085s A| COMMIT;
t+1.086s A| COMMIT
t+1.086s B| B read listing_count = 3
t+1.087s B| UPDATE duplicate_groups SET listing_count = 3 + 1 WHERE id = 1;
t+1.087s B| UPDATE 1
t+1.087s B| COMMIT;
t+1.088s B| COMMIT
t+1.088s B| SELECT listing_count AS final_listing_count FROM duplicate_groups WHERE id = 1;
t+1.088s B|  final_listing_count 
t+1.088s B|                    4
```

**7d. Optimistic version column: B's update matches 0 rows, B re-reads and retries: final 4, version 2.** `08d-A.sql`, `08d-B.sql`:
```sql
BEGIN;
SELECT listing_count AS c, version AS v FROM duplicate_groups WHERE id = 1 \gset
\echo A read listing_count = :c, version = :v
SELECT pg_sleep(1);
UPDATE duplicate_groups SET listing_count = :c + 1, version = version + 1 WHERE id = 1 AND version = :v;
COMMIT;
```
```sql
SELECT listing_count AS c, version AS v FROM duplicate_groups WHERE id = 1 \gset
\echo B read listing_count = :c, version = :v
SELECT pg_sleep(1);
UPDATE duplicate_groups SET listing_count = :c + 1, version = version + 1 WHERE id = 1 AND version = :v;
\echo B: zero rows updated means someone changed the group; re-read and retry
SELECT listing_count AS c, version AS v FROM duplicate_groups WHERE id = 1 \gset
\echo B re-read listing_count = :c, version = :v
UPDATE duplicate_groups SET listing_count = :c + 1, version = version + 1 WHERE id = 1 AND version = :v;
SELECT listing_count AS final_listing_count, version FROM duplicate_groups WHERE id = 1;
```
```
=== 7d optimistic version column
t+0.086s A| BEGIN;
t+0.086s A| BEGIN
t+0.086s A| SELECT listing_count AS c, version AS v FROM duplicate_groups WHERE id = 1 
t+0.087s A| A read listing_count = 2, version = 0
t+0.408s B| SELECT listing_count AS c, version AS v FROM duplicate_groups WHERE id = 1 
t+0.409s B| B read listing_count = 2, version = 0
t+1.088s A| UPDATE duplicate_groups SET listing_count = 2 + 1, version = version + 1 WHERE id = 1 AND version = 0;
t+1.088s A| UPDATE 1
t+1.088s A| COMMIT;
t+1.089s A| COMMIT
t+1.411s B| UPDATE duplicate_groups SET listing_count = 2 + 1, version = version + 1 WHERE id = 1 AND version = 0;
t+1.411s B| UPDATE 0
t+1.411s B| B: zero rows updated means someone changed the group; re-read and retry
t+1.411s B| SELECT listing_count AS c, version AS v FROM duplicate_groups WHERE id = 1 
t+1.411s B| B re-read listing_count = 3, version = 1
t+1.411s B| UPDATE duplicate_groups SET listing_count = 3 + 1, version = version + 1 WHERE id = 1 AND version = 1;
t+1.412s B| UPDATE 1
t+1.412s B| SELECT listing_count AS final_listing_count, version FROM duplicate_groups WHERE id = 1;
t+1.412s B|  final_listing_count | version 
t+1.412s B|                    4 |       2
```

**7e. SERIALIZABLE: B fails with 40001, retries the whole transaction: final 4.** `08e-A.sql`, `08e-B.sql`:
```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 \gset
\echo A read listing_count = :c
SELECT pg_sleep(1);
UPDATE duplicate_groups SET listing_count = :c + 1 WHERE id = 1;
COMMIT;
```
```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 \gset
\echo B read listing_count = :c
SELECT pg_sleep(1);
UPDATE duplicate_groups SET listing_count = :c + 1 WHERE id = 1;
ROLLBACK;
\echo B retries the whole transaction after SQLSTATE 40001
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 \gset
\echo B read listing_count = :c
UPDATE duplicate_groups SET listing_count = :c + 1 WHERE id = 1;
COMMIT;
SELECT listing_count AS final_listing_count FROM duplicate_groups WHERE id = 1;
```
```
=== 7e SERIALIZABLE, retry on 40001
t+0.084s A| BEGIN ISOLATION LEVEL SERIALIZABLE;
t+0.084s A| BEGIN
t+0.084s A| SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 
t+0.085s A| A read listing_count = 2
t+0.385s B| BEGIN ISOLATION LEVEL SERIALIZABLE;
t+0.385s B| BEGIN
t+0.385s B| SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 
t+0.385s B| B read listing_count = 2
t+1.087s A| UPDATE duplicate_groups SET listing_count = 2 + 1 WHERE id = 1;
t+1.087s A| UPDATE 1
t+1.087s A| COMMIT;
t+1.087s A| COMMIT
t+1.386s B| UPDATE duplicate_groups SET listing_count = 2 + 1 WHERE id = 1;
t+1.387s B| psql:B.sql:5: ERROR:  40001: could not serialize access due to concurrent update
t+1.387s B| ROLLBACK;
t+1.387s B| ROLLBACK
t+1.387s B| B retries the whole transaction after SQLSTATE 40001
t+1.387s B| BEGIN ISOLATION LEVEL SERIALIZABLE;
t+1.387s B| BEGIN
t+1.387s B| SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 
t+1.387s B| B read listing_count = 3
t+1.387s B| UPDATE duplicate_groups SET listing_count = 3 + 1 WHERE id = 1;
t+1.387s B| UPDATE 1
t+1.387s B| COMMIT;
t+1.388s B| COMMIT
t+1.388s B| SELECT listing_count AS final_listing_count FROM duplicate_groups WHERE id = 1;
t+1.388s B|  final_listing_count 
t+1.388s B|                    4
```

**7f. REPEATABLE READ behaves the same for this write-write conflict** (`08f-*.sql` are 7e's files with `REPEATABLE READ`):
```
=== 7f REPEATABLE READ, retry on 40001
t+0.091s A| BEGIN ISOLATION LEVEL REPEATABLE READ;
t+0.091s A| BEGIN
t+0.091s A| SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 
t+0.092s A| A read listing_count = 2
t+0.399s B| BEGIN ISOLATION LEVEL REPEATABLE READ;
t+0.400s B| BEGIN
t+0.400s B| SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 
t+0.401s B| B read listing_count = 2
t+1.093s A| UPDATE duplicate_groups SET listing_count = 2 + 1 WHERE id = 1;
t+1.093s A| UPDATE 1
t+1.093s A| COMMIT;
t+1.094s A| COMMIT
t+1.402s B| UPDATE duplicate_groups SET listing_count = 2 + 1 WHERE id = 1;
t+1.402s B| psql:B.sql:5: ERROR:  40001: could not serialize access due to concurrent update
t+1.402s B| ROLLBACK;
t+1.402s B| ROLLBACK
t+1.402s B| B retries the whole transaction after SQLSTATE 40001
t+1.402s B| BEGIN ISOLATION LEVEL REPEATABLE READ;
t+1.403s B| BEGIN
t+1.403s B| SELECT listing_count AS c FROM duplicate_groups WHERE id = 1 
t+1.403s B| B read listing_count = 3
t+1.403s B| UPDATE duplicate_groups SET listing_count = 3 + 1 WHERE id = 1;
t+1.403s B| UPDATE 1
t+1.403s B| COMMIT;
t+1.403s B| COMMIT
t+1.403s B| SELECT listing_count AS final_listing_count FROM duplicate_groups WHERE id = 1;
t+1.403s B|  final_listing_count 
t+1.403s B|                    4
```

### Lab 8: write skew on a per-seller listing limit

Setup (`09-setup.sql`): seller 42 has 2 active listings; the rule is at most 3; two submissions arrive together.
```sql
DROP TABLE IF EXISTS seller_listings; DROP TABLE IF EXISTS sellers;
CREATE TABLE sellers (id bigint PRIMARY KEY, display_name text NOT NULL);
CREATE TABLE seller_listings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seller_id bigint NOT NULL REFERENCES sellers,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'sold', 'withdrawn'))
);
CREATE INDEX seller_listings_seller_id_idx ON seller_listings (seller_id);
INSERT INTO sellers VALUES (42, 'فروشنده‌ی نمونه');
INSERT INTO seller_listings (seller_id, status) VALUES (42, 'active'), (42, 'active');
```
Session files for 8a (REPEATABLE READ); 8b is the same with SERIALIZABLE; 8c uses plain `BEGIN;` plus `SELECT id FROM sellers WHERE id = 42 FOR NO KEY UPDATE;` before counting:
```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;

SELECT count(*) AS active_now FROM seller_listings WHERE seller_id = 42 AND status = 'active' \gset
\echo A sees :active_now active listings (limit 3)
SELECT pg_sleep(1);
INSERT INTO seller_listings (seller_id, status) SELECT 42, 'active' WHERE :active_now < 3;
COMMIT;
```
```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;

SELECT count(*) AS active_now FROM seller_listings WHERE seller_id = 42 AND status = 'active' \gset
\echo B sees :active_now active listings (limit 3)
SELECT pg_sleep(1);
INSERT INTO seller_listings (seller_id, status) SELECT 42, 'active' WHERE :active_now < 3;
COMMIT;
SELECT pg_sleep(0.3);
SELECT count(*) AS active_after_both FROM seller_listings WHERE seller_id = 42 AND status = 'active';
```
```
=== 8a write skew, REPEATABLE READ
t+0.080s A| BEGIN ISOLATION LEVEL REPEATABLE READ;
t+0.080s A| BEGIN
t+0.080s A| SELECT count(*) AS active_now FROM seller_listings WHERE seller_id = 42 AND status = 'active' 
t+0.081s A| A sees 2 active listings (limit 3)
t+0.378s B| BEGIN ISOLATION LEVEL REPEATABLE READ;
t+0.378s B| BEGIN
t+0.378s B| SELECT count(*) AS active_now FROM seller_listings WHERE seller_id = 42 AND status = 'active' 
t+0.379s B| B sees 2 active listings (limit 3)
t+1.082s A| INSERT INTO seller_listings (seller_id, status) SELECT 42, 'active' WHERE 2 < 3;
t+1.082s A| INSERT 0 1
t+1.082s A| COMMIT;
t+1.083s A| COMMIT
t+1.381s B| INSERT INTO seller_listings (seller_id, status) SELECT 42, 'active' WHERE 2 < 3;
t+1.381s B| INSERT 0 1
t+1.382s B| COMMIT;
t+1.382s B| COMMIT
t+1.683s B| SELECT count(*) AS active_after_both FROM seller_listings WHERE seller_id = 42 AND status = 'active';
t+1.683s B|  active_after_both 
t+1.683s B|                  4
```
```
=== 8b write skew, SERIALIZABLE
t+0.086s A| BEGIN ISOLATION LEVEL SERIALIZABLE;
t+0.086s A| BEGIN
t+0.086s A| SELECT count(*) AS active_now FROM seller_listings WHERE seller_id = 42 AND status = 'active' 
t+0.087s A| A sees 2 active listings (limit 3)
t+0.387s B| BEGIN ISOLATION LEVEL SERIALIZABLE;
t+0.387s B| BEGIN
t+0.387s B| SELECT count(*) AS active_now FROM seller_listings WHERE seller_id = 42 AND status = 'active' 
t+0.388s B| B sees 2 active listings (limit 3)
t+1.088s A| INSERT INTO seller_listings (seller_id, status) SELECT 42, 'active' WHERE 2 < 3;
t+1.088s A| INSERT 0 1
t+1.088s A| COMMIT;
t+1.089s A| COMMIT
t+1.389s B| INSERT INTO seller_listings (seller_id, status) SELECT 42, 'active' WHERE 2 < 3;
t+1.389s B| psql:B.sql:6: ERROR:  40001: could not serialize access due to read/write dependencies among transactions
t+1.389s B| DETAIL:  Reason code: Canceled on identification as a pivot, during write.
t+1.389s B| HINT:  The transaction might succeed if retried.
t+1.390s B| COMMIT;
t+1.390s B| ROLLBACK
t+1.691s B| SELECT count(*) AS active_after_both FROM seller_listings WHERE seller_id = 42 AND status = 'active';
t+1.691s B|  active_after_both 
t+1.691s B|                  3
```
```
=== 8c READ COMMITTED, lock the seller row first
t+0.074s A| BEGIN;
t+0.075s A| BEGIN
t+0.075s A| SELECT id FROM sellers WHERE id = 42 FOR NO KEY UPDATE;
t+0.075s A| ----
t+0.075s A| SELECT count(*) AS active_now FROM seller_listings WHERE seller_id = 42 AND status = 'active' 
t+0.075s A| A sees 2 active listings (limit 3)
t+0.388s B| BEGIN;
t+0.388s B| BEGIN
t+0.389s B| SELECT id FROM sellers WHERE id = 42 FOR NO KEY UPDATE;
t+1.077s A| INSERT INTO seller_listings (seller_id, status) SELECT 42, 'active' WHERE 2 < 3;
t+1.077s A| INSERT 0 1
t+1.077s A| COMMIT;
t+1.086s A| COMMIT
t+1.088s B| ----
t+1.088s B| SELECT count(*) AS active_now FROM seller_listings WHERE seller_id = 42 AND status = 'active' 
t+1.089s B| B sees 3 active listings (limit 3)
t+2.089s B| INSERT INTO seller_listings (seller_id, status) SELECT 42, 'active' WHERE 3 < 3;
t+2.089s B| INSERT 0 0
t+2.089s B| COMMIT;
t+2.090s B| COMMIT
t+2.391s B| SELECT count(*) AS active_after_both FROM seller_listings WHERE seller_id = 42 AND status = 'active';
t+2.391s B|  active_after_both 
t+2.392s B|                  3
```

### Lab 9: a waiting ALTER TABLE blocks plain reads; lock_timeout prevents it

Session A (`10-A.sql`) is a worker's open transaction; B (`10-B.sql`) is the migration; C (`10-C.sql`) is a buyer's page read; D (`10-D.sql`) observes. In 9b, B is `10-B2.sql`.
```sql
-- a worker's long transaction that has read listings (holds ACCESS SHARE until it ends)
BEGIN;
SELECT count(*) AS listings_seen FROM listings;
SELECT pg_sleep(4);
COMMIT;
```
```sql
-- the migration: a metadata-only ALTER that needs ACCESS EXCLUSIVE for a moment
ALTER TABLE listings ADD COLUMN delisted_at timestamptz;
```
```sql
-- a buyer's page load: a plain read
SELECT clock_timestamp()::time(3) AS read_starts;
SELECT count(*) AS listings_for_page FROM listings;
SELECT clock_timestamp()::time(3) AS read_done;
```
```sql
SELECT pid, left(query, 45) AS query, wait_event_type, wait_event, pg_blocking_pids(pid) AS blocked_by
FROM pg_stat_activity
WHERE datname = 'lab' AND pid <> pg_backend_pid() AND state <> 'idle'
ORDER BY backend_start;
```
```sql
SET lock_timeout = '200ms';
ALTER TABLE listings ADD COLUMN delisted_at timestamptz;
```
```
=== 9a DDL without lock_timeout
t+0.083s A| BEGIN;
t+0.083s A| BEGIN
t+0.083s A| SELECT count(*) AS listings_seen FROM listings;
t+0.084s A|  listings_seen 
t+0.084s A|              6
t+0.587s B| ALTER TABLE listings ADD COLUMN delisted_at timestamptz;
t+1.085s C| SELECT clock_timestamp()::time(3) AS read_starts;
t+1.086s C|  read_starts  
t+1.086s C|  22:36:09.997
t+1.086s C| SELECT count(*) AS listings_for_page FROM listings;
t+2.091s D| SELECT pid, left(query, 45) AS query, wait_event_type, wait_event, pg_blocking_pids(pid) AS blocked_by
t+2.091s D| FROM pg_stat_activity
t+2.091s D| WHERE datname = 'lab' AND pid <> pg_backend_pid() AND state <> 'idle'
t+2.091s D| ORDER BY backend_start;
t+2.092s D|  pid |                     query                     | wait_event_type | wait_event | blocked_by 
t+2.093s D|  900 | ALTER TABLE listings ADD COLUMN delisted_at t | Lock            | relation   | {893}
t+2.093s D|  907 | SELECT count(*) AS listings_for_page FROM lis | Lock            | relation   | {900}
t+2.093s D| (3 rows)
t+4.089s A| COMMIT;
t+4.089s A| COMMIT
t+4.090s B| ALTER TABLE
t+4.092s C|  listings_for_page 
t+4.092s C|                  6
t+4.092s C| SELECT clock_timestamp()::time(3) AS read_done;
t+4.092s C|   read_done   
t+4.092s C|  22:36:13.002
```
```
=== 9b DDL with lock_timeout = 200ms (to be retried later)
t+0.091s A| BEGIN;
t+0.091s A| BEGIN
t+0.092s A| SELECT count(*) AS listings_seen FROM listings;
t+0.092s A|  listings_seen 
t+0.092s A|              6
t+0.579s B| SET lock_timeout = '200ms';
t+0.580s B| SET
t+0.580s B| ALTER TABLE listings ADD COLUMN delisted_at timestamptz;
t+0.780s B| psql:B.sql:2: ERROR:  55P03: canceling statement due to lock timeout
t+1.096s C| SELECT clock_timestamp()::time(3) AS read_starts;
t+1.096s C|  read_starts  
t+1.096s C|  22:36:14.309
t+1.096s C| SELECT count(*) AS listings_for_page FROM listings;
t+1.097s C|  listings_for_page 
t+1.097s C|                  6
t+1.097s C| SELECT clock_timestamp()::time(3) AS read_done;
t+1.097s C|   read_done   
t+1.097s C|  22:36:14.309
t+2.095s D| SELECT pid, left(query, 45) AS query, wait_event_type, wait_event, pg_blocking_pids(pid) AS blocked_by
t+2.095s D| FROM pg_stat_activity
t+2.095s D| WHERE datname = 'lab' AND pid <> pg_backend_pid() AND state <> 'idle'
t+2.095s D| ORDER BY backend_start;
t+2.097s D|  pid |        query        | wait_event_type | wait_event | blocked_by 
t+4.097s A| COMMIT;
t+4.097s A| COMMIT
```

(In 9a the buyer's read started at 22:36:09.997 and finished at 22:36:13.002 by the server clock: 3.0 s spent waiting behind the ALTER. In 9b it finished in the same millisecond it started.)

### Lab 10: what a rolled-back test transaction hides

```
CREATE TABLE group_members (
  listing_id bigint PRIMARY KEY,
  duplicate_group_id bigint NOT NULL
    CONSTRAINT group_members_group_fk REFERENCES duplicate_groups DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE
BEGIN;
BEGIN
INSERT INTO group_members VALUES (1, 999);
INSERT 0 1
SELECT 'test body finished without error' AS outcome;
             outcome              
----------------------------------
 test body finished without error
(1 row)

ROLLBACK;
ROLLBACK
BEGIN;
BEGIN
INSERT INTO group_members VALUES (1, 999);
INSERT 0 1
SET CONSTRAINTS ALL IMMEDIATE;
ERROR:  insert or update on table "group_members" violates foreign key constraint "group_members_group_fk"
DETAIL:  Key (duplicate_group_id)=(999) is not present in table "duplicate_groups".
ROLLBACK;
ROLLBACK
BEGIN;
BEGIN
SELECT now() AS now_1, clock_timestamp() AS clock_1;
             now_1             |            clock_1            
-------------------------------+-------------------------------
 2026-09-26 22:36:31.062036+00 | 2026-09-26 22:36:31.062144+00
(1 row)

----------
 
(1 row)

SELECT now() AS now_2, clock_timestamp() AS clock_2, now() = transaction_timestamp() AS now_is_tx_start;
             now_2             |           clock_2            | now_is_tx_start 
-------------------------------+------------------------------+-----------------
 2026-09-26 22:36:31.062036+00 | 2026-09-26 22:36:31.26377+00 | t
(1 row)

ROLLBACK;
ROLLBACK
```

### Lab 11: cloning a migrated template database per test

`12-template.sql` (the FILE_COPY strategy forces a checkpoint before and after each copy, which is why it is slower here; the default WAL_LOG strategy suits small templates):
```sql
\timing on
ALTER DATABASE carshenas_template WITH IS_TEMPLATE false;   -- only needed when re-running this file
DROP DATABASE IF EXISTS carshenas_template;
CREATE DATABASE carshenas_template TEMPLATE lab;           -- stands in for "migrated once"
ALTER DATABASE carshenas_template WITH IS_TEMPLATE true;
CREATE DATABASE test_1 TEMPLATE carshenas_template;        -- default strategy WAL_LOG
CREATE DATABASE test_2 TEMPLATE carshenas_template;
CREATE DATABASE test_3 TEMPLATE carshenas_template STRATEGY FILE_COPY;
CREATE DATABASE test_4 TEMPLATE carshenas_template STRATEGY FILE_COPY;
DROP DATABASE test_1; DROP DATABASE test_2; DROP DATABASE test_3; DROP DATABASE test_4;
\timing off
SELECT pg_size_pretty(pg_database_size('carshenas_template')) AS template_size;
\c carshenas_template
SELECT count(*) AS tables_in_template FROM pg_tables WHERE schemaname = 'public';
```
```
Timing is on.
ALTER DATABASE carshenas_template WITH IS_TEMPLATE false;
ALTER DATABASE
Time: 1.058 ms
DROP DATABASE IF EXISTS carshenas_template;
DROP DATABASE
Time: 24.094 ms
CREATE DATABASE carshenas_template TEMPLATE lab;
CREATE DATABASE
Time: 35.294 ms
ALTER DATABASE carshenas_template WITH IS_TEMPLATE true;
ALTER DATABASE
Time: 0.656 ms
CREATE DATABASE test_1 TEMPLATE carshenas_template;
CREATE DATABASE
Time: 47.003 ms
CREATE DATABASE test_2 TEMPLATE carshenas_template;
CREATE DATABASE
Time: 34.218 ms
CREATE DATABASE test_3 TEMPLATE carshenas_template STRATEGY FILE_COPY;
CREATE DATABASE
Time: 133.812 ms
CREATE DATABASE test_4 TEMPLATE carshenas_template STRATEGY FILE_COPY;
CREATE DATABASE
Time: 61.592 ms
DROP DATABASE test_1;
DROP DATABASE
Time: 18.797 ms
DROP DATABASE test_2;
DROP DATABASE
Time: 16.508 ms
DROP DATABASE test_3;
DROP DATABASE
Time: 15.570 ms
DROP DATABASE test_4;
DROP DATABASE
Time: 14.905 ms
Timing is off.
SELECT pg_size_pretty(pg_database_size('carshenas_template')) AS template_size;
 template_size 
---------------
 8321 kB
(1 row)

You are now connected to database "carshenas_template" as user "postgres".
SELECT count(*) AS tables_in_template FROM pg_tables WHERE schemaname = 'public';
 tables_in_template 
--------------------
                 14
(1 row)
```
Ten further clones with the default strategy (`12b.sql`), times in ms sorted, and the template's size (`12b.out`):
```
33.715 34.741 35.153 35.230 35.496 35.738 36.488 36.971 39.725 44.398 
tables in template: 14
```

### Lab 12: a JavaScript Date drops microseconds; Tehran's offset changed; a Tehran day is not a UTC day

`13-js.cjs` and its output (`13-js.out`, whose first lines show a live `now()` from the server):
```js
// Lab 12: what a JavaScript Date keeps of a PostgreSQL timestamptz, and the safe-integer range
const fromDb = "2026-09-26 22:40:05.123456+00";          // what PostgreSQL returns for a timestamptz (microseconds)
const d = new Date(fromDb.replace(" ", "T").replace("+00", "Z"));
console.log("JS Date keeps:", d.toISOString());
console.log("sent back and compared as text:", d.toISOString() === "2026-09-26T22:40:05.123456Z");
console.log("Number.MAX_SAFE_INTEGER =", Number.MAX_SAFE_INTEGER);
console.log("a 1.2 billion toman price in rial fits in a Number:", Number.isSafeInteger(12_000_000_000));
```
```
SET
2026-09-26 22:37:25.592725+00
JS Date keeps: 2026-09-26T22:40:05.123Z
sent back and compared as text: false
Number.MAX_SAFE_INTEGER = 9007199254740991
a 1.2 billion toman price in rial fits in a Number: true
```
```
SELECT timestamptz '2026-09-26 22:40:05.123456+00' = timestamptz '2026-09-26 22:40:05.123+00' AS still_matches;
 still_matches 
---------------
 f
(1 row)

SELECT timestamptz '2021-06-01 12:00+00' AT TIME ZONE 'Asia/Tehran' AS tehran_2021,
       timestamptz '2026-06-01 12:00+00' AT TIME ZONE 'Asia/Tehran' AS tehran_2026;
     tehran_2021     |     tehran_2026     
---------------------+---------------------
 2021-06-01 16:30:00 | 2026-06-01 15:30:00
(1 row)

SELECT (timestamptz '2026-09-26 21:00+00' AT TIME ZONE 'Asia/Tehran')::date AS tehran_day,
       (timestamptz '2026-09-26 21:00+00' AT TIME ZONE 'UTC')::date AS utc_day;
 tehran_day |  utc_day   
------------+------------
 2026-09-27 | 2026-09-26
(1 row)
```

### Lab 13: a one-step CHECK blocks writes; NOT VALID then VALIDATE does not; CONCURRENTLY refuses a transaction block

Session A for 10a (`14a-A.sql`) and 10b (`14b-A.sql`); session B for both (`14-B.sql`):
```sql
-- one step: add a CHECK and validate it in the same statement (ACCESS EXCLUSIVE until commit)
BEGIN;
ALTER TABLE listings ADD CONSTRAINT listings_source_listing_id_not_blank CHECK (btrim(source_listing_id) <> '');
SELECT pg_sleep(2);   -- stands in for the scan of a large table
COMMIT;
```
```sql
-- two steps: NOT VALID (brief lock, no scan), then VALIDATE (SHARE UPDATE EXCLUSIVE, writes continue)
SET lock_timeout = '1s';
ALTER TABLE listings ADD CONSTRAINT listings_source_listing_id_not_blank CHECK (btrim(source_listing_id) <> '') NOT VALID;
BEGIN;
ALTER TABLE listings VALIDATE CONSTRAINT listings_source_listing_id_not_blank;
SELECT mode FROM pg_locks WHERE relation = 'listings'::regclass AND pid = pg_backend_pid();
SELECT pg_sleep(2);
COMMIT;
```
```sql
SELECT clock_timestamp()::time(3) AS insert_starts;
INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (3, 'khodro45-' || floor(random()*1e6)::int, 1600000000);
SELECT clock_timestamp()::time(3) AS insert_done;
```
```
=== 10a ADD CONSTRAINT CHECK in one step
t+0.124s A| BEGIN;
t+0.125s A| BEGIN
t+0.125s A| ALTER TABLE listings ADD CONSTRAINT listings_source_listing_id_not_blank CHECK (btrim(source_listing_id) <> '');
t+0.125s A| ALTER TABLE
t+0.433s B| SELECT clock_timestamp()::time(3) AS insert_starts;
t+0.436s B|  insert_starts 
t+0.437s B|  22:37:57.095
t+0.437s B| INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (3, 'khodro45-' || floor(random()*1e6)::int, 1600000000);
t+2.130s A| COMMIT;
t+2.130s A| COMMIT
t+2.135s B| INSERT 0 1
t+2.135s B| SELECT clock_timestamp()::time(3) AS insert_done;
t+2.135s B|  insert_done  
t+2.137s B|  22:37:58.796
```
```
=== 10b NOT VALID, then VALIDATE CONSTRAINT
t+0.129s A| SET lock_timeout = '1s';
t+0.129s A| SET
t+0.129s A| ALTER TABLE listings ADD CONSTRAINT listings_source_listing_id_not_blank CHECK (btrim(source_listing_id) <> '') NOT VALID;
t+0.133s A| ALTER TABLE
t+0.133s A| BEGIN;
t+0.133s A| BEGIN
t+0.133s A| ALTER TABLE listings VALIDATE CONSTRAINT listings_source_listing_id_not_blank;
t+0.133s A| ALTER TABLE
t+0.133s A| SELECT mode FROM pg_locks WHERE relation = 'listings'::regclass AND pid = pg_backend_pid();
t+0.134s A|            mode           
t+0.135s A|  ShareUpdateExclusiveLock
t+0.433s B| SELECT clock_timestamp()::time(3) AS insert_starts;
t+0.433s B|  insert_starts 
t+0.434s B|  22:37:59.532
t+0.434s B| INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (3, 'khodro45-' || floor(random()*1e6)::int, 1600000000);
t+0.441s B| INSERT 0 1
t+0.442s B| SELECT clock_timestamp()::time(3) AS insert_done;
t+0.443s B|  insert_done  
t+0.443s B|  22:37:59.541
t+2.137s A| COMMIT;
t+2.139s A| COMMIT
```
```
BEGIN;
BEGIN
CREATE INDEX CONCURRENTLY listings_asking_price_idx ON listings (asking_price_toman);
ERROR:  CREATE INDEX CONCURRENTLY cannot run inside a transaction block
ROLLBACK;
ROLLBACK
CREATE INDEX CONCURRENTLY listings_asking_price_idx ON listings (asking_price_toman);
CREATE INDEX
```

### Lab 14: row-level security on seller-owned rows, and a role without DDL rights

```
DROP ROLE IF EXISTS carshenas_web;
NOTICE:  role "carshenas_web" does not exist, skipping
DROP ROLE
CREATE ROLE carshenas_web LOGIN PASSWORD 'lab' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE
INSERT INTO sellers VALUES (7, 'فروشنده‌ی دیگر') ON CONFLICT DO NOTHING;
INSERT 0 1
INSERT INTO seller_listings (seller_id, status) VALUES (7, 'draft');
INSERT 0 1
GRANT USAGE ON SCHEMA public TO carshenas_web;
GRANT
GRANT SELECT, INSERT, UPDATE ON seller_listings TO carshenas_web;
GRANT
ALTER TABLE seller_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE
CREATE POLICY seller_listings_own ON seller_listings TO carshenas_web
  USING (seller_id = current_setting('app.seller_id', true)::bigint)
  WITH CHECK (seller_id = current_setting('app.seller_id', true)::bigint);
CREATE POLICY
SELECT seller_id, count(*) FROM seller_listings GROUP BY 1 ORDER BY 1;
 seller_id | count 
-----------+-------
         7 |     1
        42 |     3
(2 rows)

BEGIN;
BEGIN
SET LOCAL ROLE carshenas_web;
SET
SET LOCAL app.seller_id = '7';
SET
SELECT seller_id, count(*) FROM seller_listings GROUP BY 1 ORDER BY 1;
 seller_id | count 
-----------+-------
         7 |     1
(1 row)

UPDATE seller_listings SET status = 'withdrawn' WHERE seller_id = 42;
UPDATE 0
INSERT INTO seller_listings (seller_id, status) VALUES (42, 'draft');
ERROR:  new row violates row-level security policy for table "seller_listings"
ROLLBACK;
ROLLBACK
BEGIN;
BEGIN
SET LOCAL ROLE carshenas_web;
SET
ALTER TABLE seller_listings ADD COLUMN x int;
ERROR:  must be owner of table seller_listings
ROLLBACK;
ROLLBACK
```

### Lab 15: an unkeyed phone hash is reversible; an HMAC is not without its key

```js
// Lab 15: an unkeyed SHA-256 of an Iranian mobile number is reversible by enumeration; an HMAC is not without the key
const crypto = require("crypto");
const target = crypto.createHash("sha256").update("09121234567").digest("hex");   // an unkeyed hash stored "anonymously"
let t0 = process.hrtime.bigint(), found = null;
for (let n = 0; n < 10_000_000; n++) {                     // every number with prefix 0912
  const phone = "0912" + String(n).padStart(7, "0");
  if (crypto.createHash("sha256").update(phone).digest("hex") === target) { found = phone; }
}
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
console.log(`searched 10,000,000 numbers with prefix 0912 in ${(ms/1000).toFixed(1)} s on one core; recovered: ${found}`);
const key = crypto.randomBytes(32);                         // the fix: a secret key kept outside the database
const pseudonym = crypto.createHmac("sha256", key).update("09121234567").digest("hex");
console.log("HMAC-SHA256 pseudonym (deterministic for matching, useless without the key):", pseudonym.slice(0, 16) + "...");
```
```
searched 10,000,000 numbers with prefix 0912 in 26.4 s on one core; recovered: 09121234567
HMAC-SHA256 pseudonym (deterministic for matching, useless without the key): 9d7c27d502f60478...
```

### Lab 16: PostgreSQL 17 checks: transaction_timeout, MERGE ... RETURNING merge_action(), identifier truncation

```
SHOW transaction_timeout;
 transaction_timeout 
---------------------
 0
(1 row)

SHOW idle_in_transaction_session_timeout;
 idle_in_transaction_session_timeout 
-------------------------------------
 0
(1 row)

MERGE INTO listings_probe AS l
USING (VALUES (1::bigint, 'bama-3'::text, 870000000::bigint), (1, 'bama-6001', 1999000000)) AS s(source_id, source_listing_id, asking_price_toman)
ON l.source_id = s.source_id AND l.source_listing_id = s.source_listing_id
WHEN MATCHED AND l.asking_price_toman IS DISTINCT FROM s.asking_price_toman THEN UPDATE SET asking_price_toman = s.asking_price_toman
WHEN NOT MATCHED THEN INSERT (source_id, source_listing_id, asking_price_toman) VALUES (s.source_id, s.source_listing_id, s.asking_price_toman)
RETURNING merge_action(), l.source_listing_id, l.asking_price_toman;
 merge_action | source_listing_id | asking_price_toman 
--------------+-------------------+--------------------
 UPDATE       | bama-3            |          870000000
 INSERT       | bama-6001         |         1999000000
(2 rows)

MERGE 2
CREATE TABLE naming_probe (x int CONSTRAINT listings_asking_price_toman_must_be_positive_and_below_one_hundred_billion CHECK (x > 0));
NOTICE:  identifier "listings_asking_price_toman_must_be_positive_and_below_one_hundred_billion" will be truncated to "listings_asking_price_toman_must_be_positive_and_below_one_hund"
CREATE TABLE
SELECT conname, length(conname) FROM pg_constraint WHERE conrelid = 'naming_probe'::regclass;
                             conname                             | length 
-----------------------------------------------------------------+--------
 listings_asking_price_toman_must_be_positive_and_below_one_hund |     63
(1 row)
```

### Lab 17: MERGE racing a concurrent insert raises 23505

```sql
BEGIN;
INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-7000', 1050000000);
SELECT pg_sleep(1.5);
COMMIT;
```
```sql
MERGE INTO listings AS l
USING (VALUES (1::bigint, 'bama-7000'::text, 1050000000::bigint)) AS s(source_id, source_listing_id, asking_price_toman)
ON l.source_id = s.source_id AND l.source_listing_id = s.source_listing_id
WHEN MATCHED THEN DO NOTHING
WHEN NOT MATCHED THEN INSERT (source_id, source_listing_id, asking_price_toman) VALUES (s.source_id, s.source_listing_id, s.asking_price_toman);
```
```
=== MERGE racing a concurrent insert of the same listing
t+0.123s A| BEGIN;
t+0.123s A| BEGIN
t+0.123s A| INSERT INTO listings (source_id, source_listing_id, asking_price_toman) VALUES (1, 'bama-7000', 1050000000);
t+0.124s A| INSERT 0 1
t+0.545s B| MERGE INTO listings AS l
t+0.545s B| USING (VALUES (1::bigint, 'bama-7000'::text, 1050000000::bigint)) AS s(source_id, source_listing_id, asking_price_toman)
t+0.545s B| ON l.source_id = s.source_id AND l.source_listing_id = s.source_listing_id
t+0.545s B| WHEN MATCHED THEN DO NOTHING
t+0.545s B| WHEN NOT MATCHED THEN INSERT (source_id, source_listing_id, asking_price_toman) VALUES (s.source_id, s.source_listing_id, s.asking_price_toman);
t+1.626s A| COMMIT;
t+1.627s A| COMMIT
t+1.627s B| psql:B.sql:5: ERROR:  23505: duplicate key value violates unique constraint "listings_source_listing_key"
t+1.627s B| DETAIL:  Key (source_id, source_listing_id)=(1, bama-7000) already exists.
t+1.628s B| SCHEMA NAME:  public
t+1.628s B| TABLE NAME:  listings
t+1.628s B| CONSTRAINT NAME:  listings_source_listing_key
```

### Lab 18: DEFAULT now() is evaluated once and does not rewrite; DEFAULT clock_timestamp() rewrites

```
SELECT proname, provolatile FROM pg_proc WHERE proname IN ('now', 'clock_timestamp', 'gen_random_uuid') ORDER BY 1;
     proname     | provolatile 
-----------------+-------------
 clock_timestamp | v
 gen_random_uuid | v
 now             | s
(3 rows)

SELECT relfilenode AS before_file FROM pg_class WHERE relname = 'listings_probe';
 before_file 
-------------
       16685
(1 row)

ALTER TABLE listings_probe ADD COLUMN first_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE
SELECT relfilenode AS after_now_default FROM pg_class WHERE relname = 'listings_probe';
 after_now_default 
-------------------
             16685
(1 row)

SELECT count(DISTINCT first_seen_at) AS distinct_first_seen_values, count(*) AS rows FROM listings_probe;
 distinct_first_seen_values | rows 
----------------------------+------
                          1 | 1002
(1 row)

ALTER TABLE listings_probe ADD COLUMN fetched_marker timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE
SELECT relfilenode AS after_volatile_default FROM pg_class WHERE relname = 'listings_probe';
 after_volatile_default 
------------------------
                  16700
(1 row)
```

### Lab 19: swapping photo positions needs a deferrable unique constraint, which then cannot arbitrate ON CONFLICT

```
CREATE TABLE photos_immediate (listing_id bigint, position smallint, object_key text,
  CONSTRAINT photos_immediate_position_key UNIQUE (listing_id, position));
CREATE TABLE
CREATE TABLE photos_deferrable (listing_id bigint, position smallint, object_key text,
  CONSTRAINT photos_deferrable_position_key UNIQUE (listing_id, position) DEFERRABLE INITIALLY IMMEDIATE);
CREATE TABLE
INSERT INTO photos_immediate VALUES (1, 1, 'a.jpg'), (1, 2, 'b.jpg');
INSERT 0 2
INSERT INTO photos_deferrable VALUES (1, 1, 'a.jpg'), (1, 2, 'b.jpg');
INSERT 0 2
UPDATE photos_immediate SET position = 3 - position WHERE listing_id = 1;
ERROR:  duplicate key value violates unique constraint "photos_immediate_position_key"
DETAIL:  Key (listing_id, "position")=(1, 2) already exists.
UPDATE photos_deferrable SET position = 3 - position WHERE listing_id = 1;
UPDATE 2
SELECT * FROM photos_deferrable ORDER BY position;
 listing_id | position | object_key 
------------+----------+------------
          1 |        1 | b.jpg
          1 |        2 | a.jpg
(2 rows)

INSERT INTO photos_deferrable VALUES (1, 1, 'c.jpg') ON CONFLICT (listing_id, position) DO NOTHING;
ERROR:  ON CONFLICT does not support deferrable unique constraints/exclusion constraints as arbiters
```

## Sources consulted

All fetched on 2026-09-26 or 2026-09-27 and read as text (saved in the research session's lab, not kept); every quote above was checked against these saved texts. "Used in" lists the tips that quote or rely on the source; "consulted" means read but not quoted.

### Official documentation and standards

| # | Source (why credible) | URL | Date | Used in |
|---|---|---|---|---|
| S1 | PostgreSQL Global Development Group, Versioning policy and front page (release status) | https://www.postgresql.org/support/versioning/ ; https://www.postgresql.org/ | read 2026-09-27 (18.6 on 2026-08-13; 19 Beta 4 on 2026-09-24) | Versions note |
| S2 | PostgreSQL 18 docs: 5.4 Generated Columns; 5.5 Constraints; 5.8 Privileges; 5.9 Row Security Policies; 5.10 Schemas; 5.12 Table Partitioning | https://www.postgresql.org/docs/current/ddl-generated-columns.html ; …/ddl-constraints.html ; …/ddl-priv.html ; …/ddl-rowsecurity.html ; …/ddl-schemas.html ; …/ddl-partitioning.html | 18 (current) | C-2, C-3, C-4, C-6, C-7, C-12, C-18, C-22, C-24, C-26, C-27, C-30, C-58, C-60, C-62 |
| S3 | PostgreSQL 18 docs: data types (8.1 Numeric, 8.2 Money, 8.3 Character, 8.5 Date/Time, 8.7 Enum, 8.12 UUID, 8.14 JSON, 8.15 Arrays, 8.17 Ranges), F.9 citext | https://www.postgresql.org/docs/current/datatype-numeric.html and siblings; …/citext.html | 18 | C-8 to C-14, C-16, C-19 |
| S4 | PostgreSQL 18 docs: 9.4 String Functions (format), 9.9 Date/Time Functions, 9.14 UUID Functions, 9.2/9.25 comparisons | https://www.postgresql.org/docs/current/functions-string.html ; …/functions-datetime.html ; …/functions-uuid.html ; …/functions-comparison.html ; …/functions-comparisons.html | 18 | C-5, C-7, C-17, C-59 |
| S5 | PostgreSQL 18 docs: 13.2 Transaction Isolation; 13.3 Explicit Locking; 13.5 Serialization Failure Handling; 3.4 Transactions tutorial | https://www.postgresql.org/docs/current/transaction-iso.html ; …/explicit-locking.html ; …/mvcc-serialization-failure-handling.html ; …/tutorial-transactions.html | 18 | C-32, C-34, C-35, C-37 to C-45 |
| S6 | PostgreSQL 18 docs: INSERT, MERGE, SELECT (locking clause), CREATE TABLE, ALTER TABLE, CREATE INDEX, CREATE DOMAIN, CREATE FUNCTION, CREATE DATABASE, REFRESH MATERIALIZED VIEW, COMMENT, SAVEPOINT, SET CONSTRAINTS | https://www.postgresql.org/docs/current/sql-insert.html and siblings | 18 | C-3, C-11, C-23, C-24, C-26, C-28, C-29, C-31 to C-35, C-41, C-46 to C-50, C-54, C-58 |
| S7 | PostgreSQL 18 docs: 19.8 Error Reporting and Logging (application_name); 19.11 Client Connection Defaults (timeouts); Appendix A Error Codes; 54.8 Error and Notice Message Fields; 22.3 Template Databases | https://www.postgresql.org/docs/current/runtime-config-logging.html ; …/runtime-config-client.html ; …/errcodes-appendix.html ; …/protocol-error-fields.html ; …/manage-ag-templatedbs.html | 18 | C-25, C-41, C-45, C-54 |
| S8 | PostgreSQL Release 18 notes | https://www.postgresql.org/docs/18/release-18.html | 2025-09-25 | Versions note, C-3, C-12, C-33, C-48 |
| S9 | PostgreSQL 17 docs, 9.14 UUID Functions (uuid_extract_timestamp is version 1 only) | https://www.postgresql.org/docs/17/functions-uuid.html | 17 | C-5, lab 1 |
| S10 | PostgreSQL 19 (Beta) docs: Release 19 notes; INSERT (ON CONFLICT DO SELECT); 5.7 Temporal Tables | https://www.postgresql.org/docs/19/release-19.html ; …/19/sql-insert.html ; …/19/ddl-temporal-tables.html | Beta 4, notes "as of 2026-09-14" | Versions note, C-19, C-21, C-32 |
| S11 | PostgreSQL wiki, Don't Do This (community-maintained list) | https://wiki.postgresql.org/wiki/Don%27t_Do_This | edited 2024-11-21 | C-4, C-7, C-8, C-9, C-16, C-22 |
| S12 | K. Davis, B. Peabody, P. Leach, RFC 9562: Universally Unique IDentifiers (IETF Standards Track) | https://www.rfc-editor.org/rfc/rfc9562 | May 2024 | C-5 |
| S13 | IANA tz database 2022b NEWS | https://data.iana.org/time-zones/tzdb-2022b/NEWS | 2022-08-10 | C-16 |
| S14 | AEPD and EDPS (EU data protection authorities), Introduction to the hash function as a personal data pseudonymisation technique | https://www.edps.europa.eu/sites/default/files/publication/19-10-30_aepd-edps_paper_hash_final_en.pdf | October 2019 | C-61 |
| S15 | node-postgres docs (Data Types, Queries, Transactions) and pg-protocol source (DatabaseError) | https://node-postgres.com/features/types ; …/queries ; …/transactions ; https://github.com/brianc/node-postgres/blob/master/packages/pg-protocol/src/messages.ts | read 2026-09-27 | C-9, C-17, C-25, C-59 |
| S16 | Porsager, postgres.js README | https://github.com/porsager/postgres | read 2026-09-27 | C-7, C-9 |
| S17 | MDN, Date | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date | read 2026-09-27 | C-17 |
| S18 | PgBouncer, Features (pooling modes table) | https://www.pgbouncer.org/features.html | read 2026-09-27 | C-42, C-60 |
| S19 | Docker Hub API, pgvector/pgvector tags (pg18) | https://hub.docker.com/v2/repositories/pgvector/pgvector/tags?name=pg18 | 0.8.6-pg18 pushed 2026-08-13 | Versions note |

### University courses and papers

| # | Source (why credible) | URL | Date | Used in |
|---|---|---|---|---|
| S20 | Andy Pavlo, CMU 15-445/645 Database Systems lecture notes #01, #17, #18, #20 (the standard database systems course) | https://15445.courses.cs.cmu.edu/fall2025/notes/01-relationalmodel.pdf ; …/17-concurrencycontrol.pdf ; …/18-twophaselocking.pdf ; …/20-multiversioning.pdf | Fall 2025 | C-1, C-37, C-38, C-44 |
| S21 | Jennifer Widom, Stanford CS145 Lecture Notes (6): Relational Database Design | http://infolab.stanford.edu/~ullman/fcdb/jw-notes06/reldesign.html (also the 2006 normalization notes, consulted) | Spring 2006 | C-1, C-2 |
| S22 | Jun Yang, Stanford CS145 Lecture Notes #14: Lossless Decomposition, 3NF, 4NF (Ullman and Widom's course) | http://infolab.stanford.edu/~ullman/fcdb/spr99/lec14.pdf (and #5, consulted) | Spring 1999 | C-2 |
| S23 | Peter Bailis, Alan Fekete, Michael J. Franklin, Ali Ghodsi, Joseph M. Hellerstein, Ion Stoica, Feral Concurrency Control: An Empirical Investigation of Modern Application Integrity (SIGMOD) | http://www.bailis.org/papers/feral-sigmod2015.pdf | 2015 | C-24, C-31 |
| S24 | Todd Warszawski, Peter Bailis (Stanford InfoLab), ACIDRain: Concurrency-Related Attacks on Database-Backed Web Applications (SIGMOD) | http://www.bailis.org/papers/acidrain-sigmod2017.pdf | 2017 | C-37 |

### Practitioners

| # | Source (why credible) | URL | Date | Used in |
|---|---|---|---|---|
| S25 | Martin Kleppmann (author of Designing Data-Intensive Applications), Hermitage: Testing the "I" in ACID; Hermitage README (the test suite built for the book) | https://martin.kleppmann.com/2014/11/25/hermitage-testing-the-i-in-acid.html ; https://github.com/ept/hermitage | 2014-11-25; read 2026-09-27 | C-37, C-56 |
| S26 | Martin Kleppmann, Transactions: myths, surprises and opportunities (Strange Loop); Turning the database inside-out | https://martin.kleppmann.com/2015/09/26/transactions-at-strange-loop.html ; https://martin.kleppmann.com/2015/03/04/turning-the-database-inside-out.html | 2015-09-26; 2015-03-04 | C-3, C-18, C-39 |
| S27 | dataintensive.net (the book's site; its text is not online, so no book quotes are used) | https://dataintensive.net/ | read 2026-09-27 | consulted |
| S28 | Markus Winand (modern-sql.com; use-the-index-luke.com): NULL; The Three-Valued Logic of SQL; Partial Indexes | https://modern-sql.com/concept/null ; https://modern-sql.com/concept/three-valued-logic ; https://use-the-index-luke.com/sql/where-clause/partial-and-filtered-indexes | read 2026-09-27 | C-7, C-26 |
| S29 | Haki Benita: How to Get or Create in PostgreSQL; Unconventional PostgreSQL Optimizations; How to Manage Concurrency in Django Models | https://hakibenita.com/postgresql-get-or-create ; https://hakibenita.com/postgresql-unconventional-optimizations ; https://hakibenita.com/how-to-manage-concurrency-in-django-models | 2024-08-05; 2026-01-20; 2017-07-07 | C-3, C-28, C-32, C-33, C-35, C-38 |
| S30 | Laurenz Albe (Cybertec; PostgreSQL contributor): UUID, serial or identity columns; SELECT FOR UPDATE considered harmful; Triggers to enforce constraints; Subtransactions and performance; Time zone management; Foreign Key Indexing and Performance | https://www.cybertec-postgresql.com/en/uuid-serial-or-identity-columns-for-postgresql-auto-generated-primary-keys/ ; …/select-for-update-considered-harmful-postgresql/ ; …/triggers-to-enforce-constraints/ ; …/subtransactions-and-performance-in-postgresql/ ; …/time-zone-management-in-postgresql/ ; …/index-your-foreign-key/ | 2021-05 (upd. 2022-05-14); 2025-06; 2019-04; 2020-03; 2022-05; 2018-10 | C-4, C-5, C-16, C-27, C-30, C-34, C-40 |
| S31 | Laurenz Albe: Transaction anomalies with SELECT FOR UPDATE; Case-insensitive pattern matching; Abusing SECURITY DEFINER functions | https://www.cybertec-postgresql.com/en/transaction-anomalies-with-select-for-update/ ; …/case-insensitive-pattern-matching-in-postgresql/ ; …/abusing-security-definer-functions/ | 2022-06; 2022-06; 2019-06 | consulted |
| S32 | Brandur Leach (Stripe, Heroku, Crunchy Data): Implementing Stripe-like Idempotency Keys in Postgres; Soft Deletion Probably Isn't Worth It; Feature Casualties of Large Databases; Transactionally Staged Job Drains in Postgres; Postgres Job Queues & Failure By MVCC; Using Atomic Transactions to Power an Idempotent API (consulted) | https://brandur.org/idempotency-keys ; https://brandur.org/soft-deletion ; https://brandur.org/large-database-casualties ; https://brandur.org/job-drain ; https://brandur.org/postgres-queues ; https://brandur.org/http-transactions | 2017-10-27; 2022-07-19; 2020-12-01; 2017-09-20; 2015-05-18; 2017-09-06 | C-20, C-27, C-36, C-41, C-43, C-62 |
| S33 | Craig Kerstiens (Crunchy Data): Enums vs Check Constraints in Postgres; Control Runaway Postgres Queries With Statement Timeout | https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres ; https://www.crunchydata.com/blog/control-runaway-postgres-queries-with-statement-timeout | 2022-12-08; 2020-06-10 | C-10, C-45 |
| S34 | Elizabeth Christensen (Crunchy Data), Working with Money in Postgres | https://www.crunchydata.com/blog/working-with-money-in-postgres | 2023-10-11 | C-9 |
| S35 | Andrew Atkinson (author, High Performance PostgreSQL for Rails): CORE Database Schema Design; Avoid UUID Version 4 Primary Keys (consulted); PostgreSQL 18: 23x Faster Inserts With UUID v7 | https://andyatkinson.com/constraint-driven-optimized-responsive-efficient-core-db-design ; https://andyatkinson.com/avoid-uuid-version-4-primary-keys ; https://andyatkinson.com/postgresql-18-uuidv7 | 2025-06-09; 2025-07-02; 2026-08-26 | C-3, C-4, C-5, C-7, C-46, C-47 |
| S36 | GitLab database development guidelines (a very large PostgreSQL deployment's rules): Avoiding downtime in migrations; Migration Style Guide; Strings and the Text data type; Constraints naming conventions; Polymorphic associations; Single Table Inheritance; Serializing data; Foreign keys; Transaction guidelines; SQL Query Guidelines; Batched background migrations; Delete existing migrations; Ordering table columns | https://docs.gitlab.com/development/database/ (and the pages named) ; https://docs.gitlab.com/development/migration_style_guide/ ; https://docs.gitlab.com/development/sql/ | read 2026-09-27 | C-4, C-6, C-8, C-13, C-15, C-22, C-27, C-31, C-34, C-43, C-46, C-47, C-51, C-52 |
| S37 | Grzegorz Bizon, Stan Hu (GitLab), Why we spent the last month eliminating PostgreSQL subtransactions | https://about.gitlab.com/blog/2021/09/29/why-we-spent-the-last-month-eliminating-postgresql-subtransactions/ | 2021-09-29 | C-34 |
| S38 | Jacqueline Xu (Stripe), Online migrations at scale | https://stripe.com/blog/online-migrations | 2017-02-02 | C-47 |
| S39 | Squawk (PostgreSQL migration linter) docs: Rules; Applying migrations safely; constraint-missing-not-valid; disallowed-unique-constraint; adding-field-with-default; ban-create-domain-with-constraint; and further rule pages consulted | https://squawkhq.com/docs/rules and https://squawkhq.com/docs/<rule> | read 2026-09-27 | C-11, C-46, C-48 to C-52 |
| S40 | Nikolay Samokhvalov and Michael Christofides, Postgres.fm (transcripts): Schema design checklist; Constraints; Soft delete; UUID and Zero-downtime migrations (show notes, consulted) | https://postgres.fm/episodes/schema-design-checklist ; https://postgres.fm/episodes/constraints ; https://postgres.fm/episodes/soft-delete ; https://postgres.fm/episodes/uuid ; https://postgres.fm/episodes/zero-downtime-migrations | 2026-04-17; 2023-12-08; 2024-06-28; 2023-06-23; 2023-06-02 | C-4, C-5, C-7, C-10, C-15, C-20, C-24, C-25, C-27, C-48, C-57, C-62 |
| S41 | Nikolay Samokhvalov (postgres.ai): Zero-downtime Postgres schema migrations need this: lock_timeout and retries; How to use UUID (the SQL uuidv7 fallback used in lab 1) | https://postgres.ai/blog/20210923-zero-downtime-postgres-schema-migrations-lock-timeout-and-retries ; https://postgres.ai/docs/postgres-howtos/schema-design/data-types/how-to-use-uuid | 2021-09-23; read 2026-09-27 | C-5, C-46 |
| S42 | Hubert "depesz" Lubaczewski: How to run short ALTER TABLE without long locking concurrent queries; Waiting for PostgreSQL 18 posts (temporal PRIMARY KEY; temporal FOREIGN KEY, UUID v7 and OLD/NEW RETURNING consulted) | https://www.depesz.com/2019/09/26/how-to-run-short-alter-table-without-long-locking-concurrent-queries/ ; https://www.depesz.com/2024/09/30/waiting-for-postgresql-18-add-temporal-primary-key-and-unique-constraints/ | 2019-09-26; 2024-09-30 (others 2024-10-03, 2024-12-31, 2025-01-30) | C-19, C-46 |
| S43 | Supabase docs and blog: Row Level Security; Testing Your Database; Managing Enums; Oliver Rice, Postgres Auditing in 150 lines of SQL | https://supabase.com/docs/guides/database/postgres/row-level-security ; https://supabase.com/docs/guides/database/testing ; https://supabase.com/docs/guides/database/postgres/enums ; https://supabase.com/blog/postgres-audit | read 2026-09-27; 2022-03-08 | C-10, C-21, C-55, C-60 |
| S44 | Jeremy Evans (author of Sequel and Roda): Sequel Model Validations; pg_auto_constraint_validations plugin | https://sequel.jeremyevans.net/rdoc/files/doc/validations_rdoc.html ; https://sequel.jeremyevans.net/rdoc-plugins/classes/Sequel/Plugins/PgAutoConstraintValidations.html | read 2026-09-27 | C-24, C-25 |
| S45 | Joe Celko, Avoiding the EAV of Destruction (Simple Talk) | https://www.red-gate.com/simple-talk/databases/sql-server/t-sql-programming-sql-server/avoiding-the-eav-of-destruction/ | 2009-06-18 | C-13 |
| S46 | David Portas, Exclusive Subtyping in SQL (credits Joe Celko's Trees and Hierarchies in SQL and SQL for Smarties) | http://web.archive.org/web/20160102183531/http://www.dpxo.net/articles/exclusivesubtypes.htm | 2007, archived 2016-01-02 | C-6 |
| S47 | Martin Fowler, Class Table Inheritance; Single Table Inheritance (Patterns of Enterprise Application Architecture) | https://martinfowler.com/eaaCatalog/classTableInheritance.html ; https://martinfowler.com/eaaCatalog/singleTableInheritance.html | 2003-03-05 | C-6 |
| S48 | Kimball Group, Type 2: Add New Row | https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/type-2/ | read 2026-09-27 | C-19 |
| S49 | Dan Robinson (Heap), When To Avoid JSONB In A PostgreSQL Schema | https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema | 2016-09-01 | C-13 |
| S50 | Moxie Marlinspike (Signal), The Difficulty Of Private Contact Discovery | https://signal.org/blog/contact-discovery/ | 2014-01-03 | C-61 |
| S51 | Prisma docs, Migration histories | https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories | read 2026-09-27 | C-52 |
| S52 | pgTAP documentation (David E. Wheeler's PostgreSQL unit-testing framework) | https://pgtap.org/documentation.html | 1.3.4 | C-55 |
| S53 | IntegreSQL README (allaboutapps); Peter Downs, pgtestdb README | https://github.com/allaboutapps/integresql ; https://github.com/peterldowns/pgtestdb | read 2026-09-27 | C-53, C-54 |
| S54 | Graphile Migrate README (committed migrations and idempotent current migration) | https://github.com/graphile/migrate | read 2026-09-27 | consulted |

Not verifiable online and therefore not quoted: C. J. Date's *Database Design and Relational Theory* (O'Reilly returned 403) and the text of *Designing Data-Intensive Applications*; Joe Celko's subtype technique is cited through Portas's account of it.

### Repository documents read for context

`AGENTS.md`; `docs/decisions/0007-data-search-and-ingestion-stack.md`; `docs/decisions/0008-crawl-only-what-sources-allow.md`; `docs/product/glossary.md`; `backlog` tasks CS-2 and CS-4; `.claude/skills/ui-design/references/craft.md` (format, and the L-31 and L-33 rules this pass connects to).
