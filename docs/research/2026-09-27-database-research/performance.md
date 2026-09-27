# Database craft, part 2: indexing, measurement, query patterns, connections, configuration and pgvector

Research pass D for CS-4. Date: 2026-09-27.

- **Scope**: when and how to index, how to measure, the query patterns that decide performance, connection management from Node.js, configuration for a 2 to 8 GB VPS, and pgvector (plus perceptual hashes for duplicate photos). Owner questions answered: (3) when to index and how a senior knows, (4) how they measure, (5) how to configure vectors, (6) how a senior works with the database and its code.
- **Method**: every cited page was fetched on 2026-09-26 or 2026-09-27 with `curl` (raw HTML, README or JSON from the GitHub API) and read as text; Context7 was used as a cross-check for pgvector, pgvector-node and the PostgreSQL 19 documentation. Quotes are verbatim and at most 25 words; "…" marks a cut. Anything without a source is marked *inference*. All examples are Carshenas's own: listings filtered by make, model, city, price and year and sorted by deal score; price history; valuations; duplicate detection; saved searches.
- **Hands-on**: one lab on PostgreSQL 17.11 with pgvector 0.8.6 in Docker, limited to 2 CPUs and 4 GB (a small-VPS stand-in), with 500,000 synthetic listings, 2.25 million price-history rows, 500,000 photo hashes and 2 × 50,000 embeddings of 512 dimensions. Everything is in the **Lab** section; scripts and raw outputs were in the research session's lab (not kept), except the workload report query, kept as `lab/performance/07-report.sql`. Nothing in the repository was changed.
- **Versions checked**: PostgreSQL 18 is the current release (docs "Current (18)"); PostgreSQL 19 is at Beta 4 (2026-09-24). pgvector 0.8.6 (2026-07-29) is the latest release; 0.8.7 is unreleased. Node.js 22.14, `pg` (node-postgres) 8.23.0, `postgres` (postgres.js) 3.4.9.
- **Relation to other passes**: search (pass A), the access layer and queue (pass B) and modelling and integrity (pass C) are covered elsewhere; where a tip touches them it says so.

## Short answers to the owner's questions 3, 4, 5 and 6

### (3) When to index, and how does a senior engineer know an index is needed?

They index **a query, not a column**, and only when evidence says the query matters: it is near the top of `pg_stat_statements` by total time, its plan reads far more buffers than it returns rows (a `Seq Scan` or an index scan with a large `Rows Removed by Filter`, a `Sort` feeding a `LIMIT`, `Heap Fetches` on an index-only scan), or it is a structural certainty (a foreign key that parent deletes and joins walk; a unique identity). They then design the index from the query (equality columns first, then either the one range column or the `ORDER BY` columns, a partial predicate for the rows actually searched, `INCLUDE` for an index-only scan), try it (HypoPG, or build it concurrently on the lab copy), prove it with `EXPLAIN (ANALYZE, BUFFERS)` before and after, and **price its cost**: every index is paid on every insert and every non-HOT update, in WAL, memory and vacuum time. A week later they check `pg_stat_user_indexes` and drop what nobody scans (except indexes behind constraints and foreign keys). In the lab the right column order read 5 index pages where the wrong one read 758; a partial index was 1.6 MB instead of 11 MB; a missing foreign-key index made deleting 20 listings take 4.5 s instead of 1.3 ms; and one index on `last_seen_at` turned 70 % HOT updates into none and nearly tripled WAL for each crawl pass. Tips P-1 to P-14.

### (4) How do they measure performance?

In three layers. **Workload**: `pg_stat_statements` (with `track_io_timing`) ranked by `total_exec_time`, then by `calls` and by mean time; a statement taking over about 20 % of total time is the next job. In the lab one count query was 60 % of all database time. **Single query**: `EXPLAIN (ANALYZE, BUFFERS)` on production-shaped data, read for estimated versus actual rows, `loops`, rows removed by filters, buffers per returned row, sorts that spill, and trigger time; buffers are compared rather than milliseconds, because timing is volatile and page counts are not. **Continuous**: `log_min_duration_statement` and `auto_explain` (with timing off) catch the slow plans nobody ran by hand; `pg_stat_user_tables` and `pg_stat_user_indexes` show sequential scans, HOT ratios and unused indexes. They benchmark with `pgbench` scripts that imitate the real mix and a realistic network round trip, and they record before-and-after numbers on the task. Tips P-15 to P-19.

### (5) If we need vectors, how do we configure them?

Start without an approximate index. Store embeddings in a narrow side table as `halfvec` (half the size and still inline; a `vector(512)` is 2 KB and gets moved to TOAST, which made exact scans 4.9 times slower in the lab), keep the model name and version on each row, and search **exact within a block**: duplicates share make, model and roughly the year, so a B-tree filter followed by an exact distance sort is perfect recall in about 5 ms. Add HNSW (`halfvec_cosine_ops`, defaults `m = 16`, `ef_construction = 64`) only when a user-facing query needs similarity across the whole table; set `hnsw.ef_search` per query with `SET LOCAL` (100 gave 0.98 recall at 2 ms on structured data), turn on `hnsw.iterative_scan = relaxed_order` for filtered queries, build with `maintenance_work_mem` at least the index size and a matching Docker `shm_size`, and measure recall on our own labelled data, because on random vectors the same index returned 8 % of the true neighbours. Pin pgvector 0.8.6 (0.8.3 and 0.8.4 fixed HNSW vacuum bugs, including possible index corruption). For duplicate **photos**, a 64-bit perceptual hash in a `bigint` with an exact Hamming search beats embeddings at our scale: a plain sequential scan of 500,000 hashes took 44 ms and an exact B-tree multi-index search 0.8 ms, both finding 100 of 100 planted copies, while an HNSW index on the hashes was approximate, 148 MB and took three minutes to build. Tips P-35 to P-45 and the section **Recommended pgvector setup for Carshenas**.

### (6) How does a senior engineer interact with the database and its code?

As a colleague, not a storage box. They write or read the actual SQL of every query (including what an ORM or query builder generates), keep it in server-only, named query functions, and run `EXPLAIN` on it before review. They make the database do set work: one query per screen region instead of a loop of queries (N+1 cost 10 to 17 times the time in the lab), keyset pagination instead of deep `OFFSET` (66 ms against 0.06 ms at page 3,000), capped counts instead of exact totals, only the columns the screen needs. They keep transactions short, never across an HTTP fetch or an LLM call, give every role a statement timeout, and hold one small connection pool per process, sized by CPU cores (the lab's 2-core server peaked at 2 to 4 busy connections; 64 clients only multiplied latency by 40). They change the schema online (`CREATE INDEX CONCURRENTLY`, `lock_timeout`), watch the statistics views after each release, and write down what they measured. Tips P-20 to P-31 and P-46.

## Tips

### A. Deciding and designing indexes

**P-1. Index a measured query, not a column.**
- Owner question: 3 (and 4).
- Why: "index every column in a WHERE" is how tables end up slow to write and still slow to read. Every index is paid on every write (P-11), and the planner can only use the one that matches the whole query shape.
- How: (1) Find the query: top of `pg_stat_statements` by `total_exec_time` or a user-facing path over budget (GitLab uses 100 ms for general queries). (2) Read its plan with `EXPLAIN (ANALYZE, BUFFERS)` on the lab dataset, not on a 50-row development table. (3) Design one index for the query family (for the results page: `WHERE status = 'active' AND model_id = $1 AND price_toman BETWEEN $2 AND $3 ORDER BY deal_score DESC LIMIT 20`), preferring to extend an existing index over adding a new one. (4) Try it with HypoPG or build it `CONCURRENTLY` on the lab copy (P-13, P-18). (5) Compare buffers before and after, and write both plans into the task. (6) Price the write cost: does the table get updated on every crawl pass? (7) Recheck `pg_stat_user_indexes` after a week (P-12).
- Sources:
  - GitLab — Adding Database Indexes — https://docs.gitlab.com/development/database/adding_database_indexes/ — current docs, fetched 2026-09-27 — "Whenever you write data to a table, any existing indexes must also be updated."
  - PostgreSQL Global Development Group — 11.12 Examining Index Usage (PostgreSQL 18) — https://www.postgresql.org/docs/current/indexes-examine.html — fetched 2026-09-27 — "Using test data for setting up indexes will tell you what indexes you need for the test data, but that is all."
  - Nikolay Samokhvalov (Postgres.ai) — How to work with pg_stat_statements, part 3 — https://github.com/postgres-ai/postgres-howtos/blob/main/0007_pg_stat_statements_part_3.md — 2023-10 (last edit 2023-12-31) — "If particular query group turns out to be a major contributor – say, >20% — on certain metrics, consider this query as a candidate…"
  - GitLab — Query performance guidelines — https://docs.gitlab.com/development/database/query_performance/ — current, fetched 2026-09-27 — "if a query is getting above it, it is important to spend time understanding why it can or cannot be optimized" (about the 100 ms guideline).
- Confidence: high (four independent practitioners, and the lab shows both the benefit and the write cost).
- Conflicts: none. GitLab caps tables at 15 indexes; that is a policy for a huge schema, not a rule we need, but the reasoning (prefer adapting existing indexes) applies.

**P-2. Know what a B-tree can serve, and what it silently cannot.**
- Owner question: 3.
- Why: most "the index is not used" surprises are queries a B-tree cannot answer, not planner bugs.
- How: A B-tree serves `=`, `<`, `<=`, `>`, `>=`, `BETWEEN`, `IN` / `= ANY(...)`, `IS NULL`, sort order (`ORDER BY` with `LIMIT`, P-4) and prefix `LIKE 'پژو%'` only with a pattern operator class or the `C` collation. It does **not** serve: a function or cast on the column (`first_seen_at::date = …`, `price_toman / 1000000 > …`; P-7), a leading wildcard (`title LIKE '%۲۰۶%'`, which needs pg_trgm, P-8), `<>`, or a condition only on a non-leading column. The last one is subtle: PostgreSQL can still **use** such an index, by reading all of it. In the lab, `WHERE price_toman BETWEEN …` on an index `(model_id, price_toman)` became an "Index Scan" that read the whole 10 MB index (1,469 buffers, 20.7 ms) for 171 rows, and the plan looks healthy unless you read the buffers. PostgreSQL 18 adds skip scan, which makes non-leading use cheap when the leading column has few distinct values (P-3).
- Sources:
  - PostgreSQL Global Development Group — 11.2 Index Types — https://www.postgresql.org/docs/current/indexes-types.html — fetched 2026-09-27 — "B-trees can handle equality and range queries on data that can be sorted into some ordering."
  - Markus Winand — Use The Index, Luke: Case-Insensitive Search — https://use-the-index-luke.com/sql/where-clause/functions/case-insensitive-search — undated book chapter, fetched 2026-09-27 — "Tip Replace the function name with BLACKBOX to understand the optimizer’s point of view."
  - PostgreSQL Global Development Group — PostgreSQL 18 release notes — https://www.postgresql.org/docs/release/18.0/ — 2025-09 — "Support for "skip scan" lookups that allow using multicolumn B-tree indexes in more cases."
- Confidence: high (documented and measured).
- Conflicts: none.

**P-3. Put equality columns first, then one range column (Winand's rule).**
- Owner question: 3.
- Why: a B-tree is sorted by its first column, then the second. With equality on the leading columns the matching entries are contiguous and the range on the next column cuts a narrow slice; with the range first, the scan walks the whole range and filters the equality inside it.
- How: For "model 150, price between 500 million and 3 billion toman" the lab measured, warm cache, 412 result rows: `(model_id, price_toman)` read **5 index pages, 0.99 ms**; `(price_toman, model_id)` read **758 index pages, 13.6 ms** (the plan still says `Index Cond: … AND (model_id = 150)`, but that condition does not narrow the scan). On a narrower band (model 7, 1.0 to 1.1 billion, 360 rows) the gap shrank to 4 against about 40 index pages, and two single-column indexes combined with `BitmapAnd` read 27 index pages and took 3.5 ms against 0.43 ms for the composite. Rules: equality columns (`status` via a partial predicate, `model_id`, `city_id`) first; then **either** the one column with a range (`price_toman` **or** `model_year`, not both, because only the first range narrows the scan; the matches then need a sort) **or** the sort columns (P-4: rows come out already sorted, and the range is checked inside the index as a filter). Which of the two wins depends on how many rows the range leaves; measure both with `EXPLAIN (ANALYZE, BUFFERS)`. If queries filter by model alone and by model plus price, `(model_id, price_toman)` serves both; queries by price alone need their own index (or, on PostgreSQL 18, may use skip scan when the leading column has few values). One composite index per hot query family, not one per column combination.
- Sources:
  - Markus Winand — Use The Index, Luke: Greater, Less and BETWEEN — https://use-the-index-luke.com/sql/where-clause/searching-for-ranges/greater-less-between-tuning-sql-access-filter-predicates — undated, fetched 2026-09-27 — "Rule of thumb: index for equality first—then for ranges."
  - Markus Winand — Use The Index, Luke: Concatenated Indexes — https://use-the-index-luke.com/sql/where-clause/the-equals-operator/concatenated-keys — undated, fetched 2026-09-27 — "The most important consideration when defining a concatenated index is how to choose the column order so it can be used as often as possible."
  - PostgreSQL Global Development Group — 11.3 Multicolumn Indexes — https://www.postgresql.org/docs/current/indexes-multicolumn.html — fetched 2026-09-27 — "The exact rule is that equality constraints on leading columns, plus any inequality constraints on the first column that does not have an equality constraint…"
  - Lukas Fittl (pganalyze) — Benchmarking multi-column, covering and hash indexes in Postgres — https://pganalyze.com/blog/5mins-postgres-benchmarking-indexes — 2022-12-15 — "Clearly, composite indexes, when you can design them right and they match your workload, are the best choice."
  - Christopher Winslett (Crunchy Data) — Postgres 19: How Our Advice Has Changed Since We Wrote It — https://www.crunchydata.com/blog/postgres-19-how-our-advice-has-changed-since-we-wrote-it — 2026-08-18 — "An index on (visitor, visited_at) can now help more queries that filter on later columns when the leading column has low cardinality."
- Confidence: high (measured; consistent across sources).
- Conflicts: the PostgreSQL manual says "Multicolumn indexes should be used sparingly. In most situations, an index on a single column is sufficient and saves space and time." Lukas Fittl's benchmark and our lab favour composites for the hot queries. Resolution: few indexes, each composite for a measured query family; single-column indexes for everything else.

**P-4. Let the index deliver "best deals first" already sorted.**
- Owner question: 3.
- Why: a results page is a top-N query. With an index that matches both the filter and the `ORDER BY`, PostgreSQL reads the first 20 entries and stops; without it, it must find every match, sort them all and discard all but 20.
- How: `CREATE INDEX … ON listings (model_id, deal_score DESC, id DESC) WHERE status = 'active'` serves `WHERE status = 'active' AND model_id = $1 ORDER BY deal_score DESC, id DESC LIMIT 20` as a plain `Index Scan` under `Limit` with no `Sort` node (lab: 22 buffers, 0.05 ms). The index direction must match the `ORDER BY` (or be its exact reverse), and a unique tiebreaker (`id`) must be in both, so keyset pagination works (P-20). A range filter placed before the sort column breaks the pipeline (the price band then needs a sort); for "model + price band + best deals" choose which one the index serves by measuring which is more selective. In `EXPLAIN`, `Sort Method: top-N heapsort` means the index did not provide the order.
- Sources:
  - PostgreSQL Global Development Group — 11.4 Indexes and ORDER BY — https://www.postgresql.org/docs/current/indexes-ordering.html — fetched 2026-09-27 — "if there is an index matching the ORDER BY, the first n rows can be retrieved directly, without scanning the remainder at all."
  - Markus Winand — Use The Index, Luke: Top-N Queries — https://use-the-index-luke.com/sql/partial-results/top-n-queries — undated, fetched 2026-09-27 — "For efficient execution, the ranking must be done with a pipelined order by."
- Confidence: high (measured).
- Conflicts: none.

**P-5. Index only the rows people search: a partial index on active listings.**
- Owner question: 3 and 6.
- Why: most crawled listings will be sold or expired (85 % in the lab). Searches only ever look at active ones, so indexing the rest costs size, cache and write time for nothing.
- How: `CREATE INDEX CONCURRENTLY listings_active_model_score_idx ON listings (model_id, deal_score DESC, id DESC) WHERE status = 'active'`. Lab (500,000 rows, 74,572 active): partial index **1.6 MB**; the same key on all rows 11 MB; with `status` as the leading column 15 MB. Buffers for the model-7 results page: partial 22, status-first 23, full index without status 127 (with `Rows Removed by Filter: 104`). Two traps, both measured: (1) the query must contain the predicate itself; `WHERE model_id = 7 ORDER BY deal_score DESC` without `status = 'active'` falls back to a parallel sequential scan and a sort. (2) The predicate must be a **literal in the SQL text**, not a bound parameter: `status = $1` cannot prove `status = 'active'` in a generic plan (with `plan_cache_mode = force_generic_plan` the lab plan fell back to a sequential scan). Query builders parameterise every value, so write the status as a SQL literal in the query function (`sql\`status = 'active'\`` in Drizzle, a constant in raw SQL) and keep a lint or review rule for it. Other Carshenas uses: `WHERE duplicate_of IS NULL` for canonical listings, `WHERE alert_enabled` for saved searches with alerts, `WHERE review_status = 'pending'` for the extraction review queue.
- Sources:
  - PostgreSQL Global Development Group — 11.8 Partial Indexes — https://www.postgresql.org/docs/current/indexes-partial.html — fetched 2026-09-27 — "Matching takes place at query planning time, not at run time. As a result, parameterized query clauses do not work with a partial index."
  - PostgreSQL Global Development Group — 11.8 Partial Indexes — same URL — "One major reason for using a partial index is to avoid indexing common values."
  - Haki Benita — The Unexpected Find That Freed 20GB of Unused Index Space — https://hakibenita.com/postgresql-unused-index-size — 2021-02-01 — "The partial index that excluded null values was less than 5MB" (the full index was 769 MB).
- Confidence: high (documented and measured, including the parameter trap).
- Conflicts: none. In our lab the default `plan_cache_mode = auto` kept choosing custom plans (P-26), so the parameter trap bites only when a generic plan is chosen; literals avoid the question.

**P-6. Cover hot read paths with `INCLUDE`, and keep the visibility map fresh.**
- Owner question: 3.
- Why: an index-only scan answers from the index alone, but only for heap pages the visibility map marks all-visible; every recently changed page costs a heap visit anyway.
- How: The valuation reads comparables' prices: `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_toman) FROM listings WHERE model_id = $1 AND model_year = $2`. Lab: key-only index `(model_id, model_year)` 334 buffers; `(model_id, model_year) INCLUDE (price_toman)` **5 buffers**, `Heap Fetches: 0`. After the crawler updated `last_seen_at` on 20 % of rows with autovacuum held off, the same scan did `Heap Fetches: 409` and 405 buffers (worse than a plain index scan); after `VACUUM`, 6 buffers again. So: (1) include only columns that rarely change; an included column counts as indexed, so updating it is never a HOT update (P-11); (2) tune autovacuum on tables whose index-only scans matter (P-33); (3) read `Heap Fetches` in every index-only plan.
- Sources:
  - PostgreSQL Global Development Group — 11.9 Index-Only Scans and Covering Indexes — https://www.postgresql.org/docs/current/indexes-index-only-scans.html — fetched 2026-09-27 — "If it's set, the row is known visible and so the data can be returned with no further work."
  - pgMustard (Michael Christofides) — Heap Fetches (EXPLAIN glossary) — https://www.pgmustard.com/docs/explain/heap-fetches — undated, fetched 2026-09-27 — "Heap fetches can often be reduced by vacuum, or adjusting autovacuum settings, to keep the visibility map more up to date."
  - Christopher Winslett (Crunchy Data) — Postgres 19: How Our Advice Has Changed — https://www.crunchydata.com/blog/postgres-19-how-our-advice-has-changed-since-we-wrote-it — 2026-08-18 — "Be conservative: every included column costs write amplification and disk."
- Confidence: high (measured both states).
- Conflicts: none.

**P-7. Keep predicates sargable: never wrap the indexed column.**
- Owner question: 3 and 6.
- Why: a function, cast or arithmetic on the column hides it from the index (Winand's "black box"), so the planner reads everything and filters.
- How: Lab with an index on `first_seen_at`: `WHERE first_seen_at::date = '2026-03-01'` read the whole index, **1,370 buffers and 66 ms**; `WHERE first_seen_at >= '2026-03-01' AND first_seen_at < '2026-03-02'` read **7 buffers, 0.14 ms** (470 times faster). `WHERE price_toman / 1000000 BETWEEN 990 AND 1000` took 49.7 ms; move the arithmetic to the constant (`price_toman BETWEEN 990000000 AND 1000999999`). Use half-open ranges for time (`>= start AND < next`), never `BETWEEN` on timestamps. Convert Jalali dates to UTC instants in TypeScript before the query, not in SQL on the column. If a derived value really is the filter (a normalised Persian title, `lower(vin)`), create an **expression index** that matches the query's expression exactly, knowing it costs a function call on every insert and non-HOT update.
- Sources:
  - Markus Winand — Use The Index, Luke: Date and time conditions — https://use-the-index-luke.com/sql/where-clause/obfuscation/dates — undated, fetched 2026-09-27 — "The alternative is to use an explicit range condition."
  - PostgreSQL wiki — Don't Do This — https://wiki.postgresql.org/wiki/Don%27t_Do_This — last edited 2024-11-21 — "BETWEEN uses a closed-interval comparison: the values of both ends of the specified range are included in the result."
  - PostgreSQL Global Development Group — 11.7 Indexes on Expressions — https://www.postgresql.org/docs/current/indexes-expressional.html — fetched 2026-09-27 — "Index expressions are relatively expensive to maintain, because the derived expression(s) must be computed for each row insertion and non-HOT update."
- Confidence: high (measured).
- Conflicts: none.

**P-8. Choose the index type by the operator, not by habit.**
- Owner question: 3.
- Why: each access method answers different operators; a B-tree on a `jsonb` column or on a text column searched with `%…%` is dead weight.
- How: **B-tree** for scalars and sorting (the default). **GIN** for "contains": `jsonb` with `@>` (raw extracted attributes), arrays (`tags @> ARRAY[…]`), full-text `tsvector`, and `pg_trgm` for `LIKE '%…%'` or similarity on Persian titles (pass A decides search). **GiST** for ranges, exclusion constraints and geometry (a future "within 50 km of Karaj"). **BRIN** for huge append-only tables whose rows arrive in time order: `price_history.observed_at`, raw `snapshots.fetched_at`. Lab: BRIN **24 kB** versus B-tree **48 MB** on 2.25 million price rows, with a one-week range query at 6.4 ms versus 6.2 ms; check `pg_stats.correlation` (it was 1.0) before choosing BRIN, and prefer the `minmax_multi` operator class when late-arriving rows break the order. **Hash** only for equality on long values (a snapshot URL or content hash), knowing it cannot back a unique constraint and has no deduplication. Every non-B-tree type is slower to update; GIN especially.
- Sources:
  - PostgreSQL Global Development Group — 11.2 Index Types — https://www.postgresql.org/docs/current/indexes-types.html — fetched 2026-09-27 — "GIN indexes are “inverted indexes” which are appropriate for data values that contain multiple component values, such as arrays."
  - PostgreSQL Global Development Group — 65.5 BRIN Indexes — https://www.postgresql.org/docs/current/brin.html — fetched 2026-09-27 — "BRIN is designed for handling very large tables in which certain columns have some natural correlation with their physical location within the table."
  - PostgreSQL Global Development Group — F.35 pg_trgm — https://www.postgresql.org/docs/current/pgtrgm.html — fetched 2026-09-27 — "additionally support trigram-based index searches for LIKE, ILIKE, ~, ~* and = queries."
  - Haki Benita — Re-Introducing Hash Indexes in PostgreSQL — https://hakibenita.com/postgresql-hash-index — 2021-01-11 — "Hash indexes currently cannot be used to enforce unique constraints."
  - Lukas Fittl (pganalyze) — 5mins of Postgres E38: When to use BRIN indexes — https://pganalyze.com/blog/5mins-postgres-BRIN-index — 2022-10-06 — "You can use the pg_stats table to make decisions on whether a column is a good fit for a BRIN index or not."
- Confidence: high for the mapping; medium for BRIN on our real `price_history` (depends on whether rows stay in time order; measure `correlation`).
- Conflicts: GitLab notes GIN indexes "generally take up more data and are slower to update compared to B-tree indexes", which is a reason to keep GIN off the hottest write paths, not a contradiction.

**P-9. Index every foreign key that parent deletes or joins walk.**
- Owner question: 3.
- Why: PostgreSQL indexes the referenced side (a primary key) but not the referencing column. Deleting or re-keying a parent then scans the child table once per deleted row, inside a trigger whose time appears only below the plan tree.
- How: Lab, deleting 20 expired listings with `ON DELETE CASCADE` children `price_history` (2.25 million rows) and `listing_photos` (500,000): **4,481 ms** without child indexes, **1.25 ms** with them. The plan itself said 0.24 ms; the cost sat in two lines at the bottom, `Trigger for constraint price_history_listing_id_fkey: time=3690.478 calls=20`. Index `price_history (listing_id, observed_at DESC)` (which also serves "latest price", P-22), `listing_photos (listing_id)`, `saved_search_matches (listing_id)` and every future child of `listings`. A composite primary key or unique index whose **first** column is the foreign key already counts. Catalogue check for the database reviewer: foreign keys whose `conkey[1]` has no index with that column first (the query was in `02-fk-delete.sql`, in the research session's lab, not kept). Create the index before adding the constraint, concurrently (P-13).
- Sources:
  - PostgreSQL Global Development Group — 5.5 Constraints — https://www.postgresql.org/docs/current/ddl-constraints.html — fetched 2026-09-27 — "the declaration of a foreign key constraint does not automatically create an index on the referencing columns"
  - Laurenz Albe (Cybertec) — Foreign key indexing and performance in PostgreSQL — https://www.cybertec-postgresql.com/en/index-your-foreign-key/ — 2018-10-10, updated 2026-05-07 — "Without an index, this requires a sequential scan of the source table."
  - GitLab — Foreign keys and associations — https://docs.gitlab.com/development/database/foreign_keys/ — current, fetched 2026-09-27 — "When adding a foreign key in PostgreSQL, the column is not indexed automatically. Thus, you must also add a concurrent index."
  - PostgreSQL Global Development Group — 14.1 Using EXPLAIN — https://www.postgresql.org/docs/current/using-explain.html — fetched 2026-09-27 — "The total time spent in each trigger (either BEFORE or AFTER) is also shown separately."
- Confidence: high (measured, three sources).
- Conflicts: none. (Pass C decides which children cascade.)

**P-10. Let unique constraints be your identity indexes, and do not duplicate them.**
- Owner question: 3.
- Why: a unique constraint creates its B-tree; a second plain index on the same columns doubles the write cost and gains nothing.
- How: `UNIQUE (source_id, source_listing_id)` on listings is both the crawler's upsert target (`ON CONFLICT … DO UPDATE`) and its lookup index; do not add `CREATE INDEX … (source_id, source_listing_id)` beside it. Put the most selective or most-queried column first only when both orders are otherwise equal, since the unique index also serves prefix lookups. Use `NULLS NOT DISTINCT` where "no value" must also be unique. The integrity side (constraints versus application checks) is pass C.
- Sources:
  - PostgreSQL Global Development Group — 11.6 Unique Indexes — https://www.postgresql.org/docs/current/indexes-unique.html — fetched 2026-09-27 — "There's no need to manually create indexes on unique columns; doing so would just duplicate the automatically-created index."
- Confidence: high.
- Conflicts: none.

**P-11. Count the write bill: never index what the crawler rewrites on every pass.**
- Owner question: 3.
- Why: an `UPDATE` that changes no indexed column and fits on the same page is a HOT update: no new index entries at all. Change one indexed column, or run out of room on the page, and every index on the table gets a new entry, more WAL, more vacuum and index bloat.
- How: The crawler bumps `last_seen_at` on every active listing on each pass. Lab, 74,572 updates per pass, table with a primary key and four secondary indexes: **fillfactor 100, no index on `last_seen_at`: 0 % HOT, 48 MB WAL, 3.4 s per pass**; **fillfactor 90, no index: 67 to 74 % HOT, 17 to 18 MB WAL, 1.0 to 1.1 s**; **fillfactor 90 plus an index on `last_seen_at`: 0 % HOT, 41 to 49 MB WAL, 3.4 to 4.7 s**, and the indexes grew from 71 to 87 MB in three passes. So: (1) do not index `last_seen_at`, `crawl_attempts` or other per-pass bookkeeping; if "stale listings" must be found, index a coarse, rarely changing column instead (a status the expiry job flips) or keep bookkeeping in a narrow side table; (2) set `fillfactor = 90` on `listings` (and lower for tables updated heavily); (3) update only changed columns (the crawler should compare before writing, P-46); (4) watch `n_tup_hot_upd / n_tup_upd` and `n_tup_newpage_upd` in `pg_stat_user_tables`. Covering and expression indexes count as indexed columns (P-6, P-7).
- Sources:
  - PostgreSQL Global Development Group — 66.7 Heap-Only Tuples (HOT) — https://www.postgresql.org/docs/current/storage-hot.html — fetched 2026-09-27 — "The update does not modify any columns referenced by the table's indexes, not including summarizing indexes."
  - Laurenz Albe (Cybertec) — HOT updates in PostgreSQL for better performance — https://www.cybertec-postgresql.com/en/hot-updates-in-postgresql-for-better-performance/ — 2020-09-16, updated 2025-02-12 — "If you choose a value less than the default 100, you can make sure that there is enough room for HOT updates…"
  - Markus Winand — Use The Index, Luke: Insert — https://use-the-index-luke.com/sql/dml/insert — undated, fetched 2026-09-27 — "The number of indexes on a table is the most dominant factor for insert performance."
  - Markus Winand — Use The Index, Luke: Update — https://use-the-index-luke.com/sql/dml/update — undated, fetched 2026-09-27 — "To optimize update performance, you must take care to only update those columns that were changed."
  - PostgreSQL Global Development Group — PostgreSQL 16 release notes — https://www.postgresql.org/docs/release/16.0/ — 2023-09 — "Record statistics on the occurrence of updated rows moving to new pages"
- Confidence: high (measured three configurations).
- Conflicts: none. The best fillfactor depends on row size; 90 left about 30 % of our updates non-HOT on the first pass, so measure the HOT ratio on real rows.

**P-12. Retire unused and duplicate indexes on a schedule, carefully.**
- Owner question: 3 and 4.
- Why: indexes nobody reads still cost every write and occupy cache. They accumulate silently: an early experiment, a column that moved, a copy created by a migration tool.
- How: Monthly, list non-unique indexes with `idx_scan = 0` (or an old `last_idx_scan`) in `pg_stat_user_indexes`, over a window that covers a full cycle (a monthly valuation job, the nightly purge), on every server that runs queries. Never drop: indexes backing primary keys, unique or exclusion constraints; indexes that support foreign keys (they show `idx_scan = 0` until the day a parent is deleted, P-9); indexes a rare but critical job needs. Also run the wiki's duplicate-index query: in the lab it found an exact duplicate pair (42 MB), and the planner had quietly switched to the fresh 15 MB copy because the original had bloated to 27 MB after the crawler's non-HOT updates. Prefix-redundant indexes (`(model_id)` when `(model_id, model_year)` exists) need judgement: the longer index is bigger per lookup. To test a drop, `BEGIN; DROP INDEX …; EXPLAIN …; ROLLBACK;` shows the plan without the index, but takes an exclusive lock on the table while open, so only on the lab copy. Drop with `DROP INDEX CONCURRENTLY`.
- Sources:
  - PostgreSQL wiki — Index Maintenance — https://wiki.postgresql.org/wiki/Index_Maintenance — last edited 2021-06-09 — "Finds multiple indexes that have the same set of columns, same opclass, expression and predicate -- which make them equivalent."
  - Laurenz Albe (Cybertec) — Get rid of your unused indexes! — https://www.cybertec-postgresql.com/en/get-rid-of-your-unused-indexes/ — 2018-04-12, updated 2024-03-05 — "WHERE s.idx_scan = 0 -- has never been scanned AND 0 <>ALL (i.indkey) -- no index column is an expression AND NOT i.indisunique"
  - GitLab — Adding Database Indexes — https://docs.gitlab.com/development/database/adding_database_indexes/ — current, fetched 2026-09-27 — "Skip indexes that support a foreign key and indexes on the keep list." (their automated clean-up rule)
  - PostgreSQL Global Development Group — 27.2 The Cumulative Statistics System — https://www.postgresql.org/docs/current/monitoring-stats.html — fetched 2026-09-27 — "The time of the last scan on this index, based on the most recent transaction stop time" (`last_idx_scan`, since PostgreSQL 16).
  - Haki Benita — Some SQL Tricks of an Application DBA — https://hakibenita.com/sql-tricks-application-dba — 2020-07-27 — "using transactional DDL you can make indexes invisible!"
- Confidence: high.
- Conflicts: none.

**P-13. Build and drop indexes concurrently, and clean up invalid leftovers.**
- Owner question: 3 and 6.
- Why: a plain `CREATE INDEX` blocks writes to the table for the whole build; on `listings` that stalls the crawler and saves. A failed concurrent build leaves an `INVALID` index that is never used but still costs every write.
- How: In migrations: `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` and `DROP INDEX CONCURRENTLY …`, each in its own migration step outside a transaction (the migration tool chosen by pass B must support non-transactional steps). A concurrent build does not block reads or writes, but it waits for every transaction that was open when it started, so run it when no long transaction (a backfill, a stuck worker) is open; give the DDL that does take strong locks (a plain `ALTER TABLE`, a non-concurrent `DROP INDEX`) `SET lock_timeout = '5s'` with a retry, so a waiting migration never queues every query behind it. After a failure: `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;` then `REINDEX INDEX CONCURRENTLY` or drop and retry. Vector indexes follow the same rule. Watch long builds in `pg_stat_progress_create_index`. On an empty or tiny table (a fresh migration), a plain `CREATE INDEX` is fine.
- Sources:
  - PostgreSQL Global Development Group — CREATE INDEX — https://www.postgresql.org/docs/current/sql-createindex.html — fetched 2026-09-27 — "In a concurrent index build, the index is actually entered as an “invalid” index into the system catalogs in one transaction"
  - PostgreSQL Global Development Group — CREATE INDEX — same URL — "the CREATE INDEX command will fail but leave behind an “invalid” index."
  - Andrew Kane — pgvector README, Performance: Indexing — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "In production environments, create indexes concurrently to avoid blocking writes."
- Confidence: high.
- Conflicts: none.

**P-14. Keep the planner's statistics honest, and know their limits.**
- Owner question: 3 and 4.
- Why: the planner chooses by estimated row counts. It assumes columns are independent, so dependent columns (a model implies its make) make it underestimate, and bad estimates pick bad join methods.
- How: (1) Run `ANALYZE` after bulk loads (the first import of a source), since autovacuum's analyze may lag. (2) For skewed columns raise the per-column target: with the default 100, `model_id` (199 distinct, very skewed) kept only 98 most-common values; `ALTER TABLE listings ALTER COLUMN model_id SET STATISTICS 500`. (3) Declare dependencies: lab `WHERE make_id = 2 AND model_id = 7` estimated **646 rows, actual 8,182**; after `CREATE STATISTICS listings_make_model (dependencies, ndistinct, mcv) ON make_id, model_id FROM listings; ANALYZE listings;` it estimated **7,783**. In a join with `price_history` the plan switched aggregation strategy and ran 85 → 67 ms. Better still, do not store `make_id` next to `model_id` unless needed (pass C). (4) Know the limit: `model_year <= 1390 AND mileage_km < 60000` (old cars have high mileage) was estimated at **51,120 rows with 0 actual**, before and after extended statistics, because dependencies apply only to equality and MCV lists cannot cover a high-cardinality column. For such queries, index a derived bucket or accept and verify the plan.
- Sources:
  - PostgreSQL Global Development Group — 14.2 Statistics Used by the Planner — https://www.postgresql.org/docs/current/planner-stats.html — fetched 2026-09-27 — "They are not used to improve estimates for equality conditions comparing two columns or comparing a column to an expression, nor for range clauses"
  - PostgreSQL Global Development Group — 14.2 Statistics Used by the Planner — same URL — "Raising the limit might allow more accurate planner estimates to be made, particularly for columns with irregular data distributions"
  - PostgreSQL Global Development Group — 11.12 Examining Index Usage — https://www.postgresql.org/docs/current/indexes-examine.html — fetched 2026-09-27 — "Examining an application's index usage without having run ANALYZE is therefore a lost cause."
- Confidence: high (measured both the fix and the limit).
- Conflicts: none.

### B. Measuring performance

**P-15. Turn on `pg_stat_statements` and I/O timing on day one, and rank by total time.**
- Owner question: 4.
- Why: it is the only view of the whole workload: every normalised statement with its calls, total and mean time, rows and buffers. The query to fix first is the one that consumes the most total time, which is often not the slowest one.
- How: `shared_preload_libraries = 'pg_stat_statements'` (needs a restart, so it goes into CS-4's Docker service now), `CREATE EXTENSION pg_stat_statements;`, `track_io_timing = on` (the lab's `pg_test_timing` showed 23 ns per clock read, cheap; run it on the real VPS too). Weekly, or after each release, run the top-10 query from `lab/performance/07-report.sql` (total ms, share of total, mean, rows per call, buffers per call, temp blocks) and reset with `pg_stat_statements_reset()` after recording. Lab, a one-minute mixed workload: `SELECT count(*) … WHERE status = $1 AND city_id = $2` took **59.9 % of all execution time** (mean 82 ms), deep-`OFFSET` pagination 32.2 % (mean 65 ms); the N+1 price lookup was 21,020 calls at 0.04 ms each, invisible by time and obvious by `calls` (P-22). Know the blind spots: failed statements (including those killed by `statement_timeout`) are not recorded, and time spent in the network and the driver is not either. PostgreSQL 18 groups `IN` lists of different lengths into one entry; `= ANY($1)` has always been one entry.
- Sources:
  - PostgreSQL Global Development Group — F.32 pg_stat_statements — https://www.postgresql.org/docs/current/pgstatstatements.html — fetched 2026-09-27 — "The module must be loaded by adding pg_stat_statements to shared_preload_libraries in postgresql.conf, because it requires additional shared memory."
  - Nikolay Samokhvalov (Postgres.ai) — How to work with pg_stat_statements, part 1 — https://github.com/postgres-ai/postgres-howtos/blob/main/0005_pg_stat_statements_part_1.md — 2023-10 (last edit 2023-12-31) — "failed queries are not tracked, including those that failed on `statement_timeout`"
  - PostgreSQL Global Development Group — 19.9 Run-time Statistics — https://www.postgresql.org/docs/current/runtime-config-statistics.html — fetched 2026-09-27 — "it will repeatedly query the operating system for the current time, which may cause significant overhead on some platforms" (about `track_io_timing`)
  - PostgreSQL Global Development Group — PostgreSQL 18 release notes — https://www.postgresql.org/docs/release/18.0/ — 2025-09 — "Have query id computation of constant lists consider only the first and last constants"
- Confidence: high (measured).
- Conflicts: none.

**P-16. Read `EXPLAIN (ANALYZE, BUFFERS)` for pages, estimates and loops, not only milliseconds.**
- Owner question: 4.
- Why: timings change with cache state, load and hardware (the lab machine ran five other research containers at once); page counts and row estimates do not. A plan read for pages shows the cause, not only the symptom.
- How: Always `EXPLAIN (ANALYZE, BUFFERS)` (PostgreSQL 18 adds `BUFFERS` automatically) on the lab dataset, twice (cold then warm). Read bottom-up and check, in order: (1) **estimate versus actual rows** per node; a factor of 10 or more (646 against 8,182 in P-14) explains most bad plans; (2) **`loops`**: actual time and rows are per loop, so multiply (the lab's inner `price_history` scan ran 8,182 times); (3) **`Rows Removed by Filter`** relative to rows returned: an index that finds too much (P-3, P-5); (4) **buffers per returned row**: 60,227 buffers for 20 rows at `OFFSET 59980` (P-20); (5) **`Heap Fetches`** in index-only scans (P-6); (6) **`Sort Method: external merge Disk`**: `work_mem` too small or a missing ordered index; (7) **`Trigger for constraint … time=…`** lines under the plan, where foreign-key cost hides (P-9); (8) for `SELECT *` on wide or TOASTed rows, add `SERIALIZE` (PostgreSQL 17+): the lab's `SELECT *` on embeddings showed 2.6 ms without it and **29 ms and 4.7 MB** with it (P-23). Run data-changing statements inside `BEGIN; … ROLLBACK;`. Paste long plans into explain.dalibo.com or explain.depesz.com (P-18).
- Sources:
  - PostgreSQL Global Development Group — 14.1 Using EXPLAIN — https://www.postgresql.org/docs/current/using-explain.html — fetched 2026-09-27 — "the loops value reports the total number of executions of the node, and the actual time and rows values shown are averages per-execution."
  - Hubert "depesz" Lubaczewski — Explaining the unexplainable — https://www.depesz.com/2013/04/16/explaining-the-unexplainable/ — 2013-04-16 — "Very often poor performance of a query comes from the fact that it had to loop many times over something."
  - Nikolay Samokhvalov (Postgres.ai) — EXPLAIN (ANALYZE) needs BUFFERS to improve the Postgres query optimization process — https://postgres.ai/blog/20220106-explain-analyze-needs-buffers-to-improve-the-postgres-query-optimization-process — 2022-01-06 — "Timing is volatile. Data volumes are stable."
  - pgMustard (Michael Christofides) — Rows Removed by Filter — https://www.pgmustard.com/docs/explain/rows-removed-by-filter — undated, fetched 2026-09-27 — "If a high proportion of rows are being removed, you may want to investigate whether a (more) selective index could help."
  - pgMustard (Michael Christofides) — Sort Method — https://www.pgmustard.com/docs/explain/sort-method — undated — "Otherwise, it will do an external sort on-disk, which is slow but may be necessary for a large sort."
  - pgMustard (Michael Christofides) — Buffers: Shared Hit — https://www.pgmustard.com/docs/explain/buffers-shared-hit — undated — "a high ratio means Postgres is reading a lot of data for what it is doing, which can be a sign of bloat."
  - PostgreSQL Global Development Group — PostgreSQL 18 release notes — https://www.postgresql.org/docs/release/18.0/ — 2025-09 — "Automatically include BUFFERS output in EXPLAIN ANALYZE"
  - PostgreSQL Global Development Group — PostgreSQL 17 release notes — https://www.postgresql.org/docs/release/17.0/ — 2024-09 — "Add EXPLAIN option SERIALIZE to report the cost of converting data for network transmission"
  - GitLab — Understanding EXPLAIN plans — https://docs.gitlab.com/development/database/understanding_explain_plans/ — current, fetched 2026-09-27 — "If the query modifies data, consider wrapping it in a transaction that rolls back automatically"
- Confidence: high.
- Conflicts: none.

**P-17. Log slow statements, their plans, lock waits and spills automatically.**
- Owner question: 4.
- Why: the slow plan that matters is usually one nobody ran by hand: a rare filter combination, a generic plan, a parameter value in the long tail.
- How: `log_min_duration_statement = '250ms'` on the web role (the worker's batch statements may run longer: set it per role, `ALTER ROLE carshenas_worker SET log_min_duration_statement = '2s'`). `session_preload_libraries = 'auto_explain'` (or shared) with `auto_explain.log_min_duration = '500ms'`, `auto_explain.log_analyze = on`, `auto_explain.log_buffers = on`, **`auto_explain.log_timing = off`** (per-node timing on every statement is the expensive part) and, if overhead still shows, `auto_explain.sample_rate`. Also `log_lock_waits = on`, `log_temp_files = 0` (every spill to disk) and `log_autovacuum_min_duration = '1s'`. The lab captured an `auto_explain` entry with buffers for a 25 ms query in one session (`19b-autoexplain.txt`, in the research session's lab, not kept).
- Sources:
  - PostgreSQL Global Development Group — F.3 auto_explain — https://www.postgresql.org/docs/current/auto-explain.html — fetched 2026-09-27 — "When this parameter is on, per-plan-node timing occurs for all statements executed, whether or not they run long enough to actually get logged."
  - PostgreSQL Global Development Group — 19.8 Error Reporting and Logging — https://www.postgresql.org/docs/current/runtime-config-logging.html — fetched 2026-09-27 — "if you set it to 250ms then all SQL statements that run 250ms or longer will be logged"
  - PostgreSQL Global Development Group — 19.8 Error Reporting and Logging — same URL — "This is useful in determining if lock waits are causing poor performance." (`log_lock_waits`)
- Confidence: high (documented; overhead of `log_analyze` with timing off not measured here).
- Conflicts: none.

**P-18. Try an index before building it, and let a tool read long plans.**
- Owner question: 4.
- Why: building an index on a large table to find out it is not used wastes minutes of locks and I/O; long plans hide the expensive node.
- How: **HypoPG** creates hypothetical indexes visible only to plain `EXPLAIN` in the current session (`SELECT hypopg_create_index('CREATE INDEX ON listings (model_id, price_toman)'); EXPLAIN …`); it is not in the `pgvector/pgvector` image, so add it only to the lab or development image. **Dexter** (Andrew Kane) automates this over `pg_stat_statements`; read its suggestions, never let it create indexes in production unattended. For reading plans, **explain.dalibo.com** (open source, can be self-hosted) and **explain.depesz.com** are free; **pgMustard** gives advice per node (paid). **pganalyze** is a SaaS monitor; treat any foreign SaaS as unavailable from Iran until checked (AGENTS.md market rule) and prefer self-hostable tools (PgHero from Andrew Kane is another). Never paste plans with real sellers' data into a public site (*inference*).
- Sources:
  - HypoPG project — Usage — https://hypopg.readthedocs.io/en/rel1_stable/usage.html — fetched 2026-09-27 — "HypoPG is useful if you want to check if some index would help one or multiple queries."
  - Andrew Kane — Introducing Dexter, the Automatic Indexer for Postgres — https://ankane.org/introducing-dexter — 2017-06-26 — "Hypothetical indexes show how a query’s execution plan would change if an actual index existed."
  - Andrew Kane — Dexter README — https://github.com/ankane/dexter — master, fetched 2026-09-27 — "The automatic indexer for Postgres"
  - pgMustard — home page — https://www.pgmustard.com/ — fetched 2026-09-27 — "pgMustard - review Postgres query plans quickly" (page title)
  - Dalibo — explain.dalibo.com — https://explain.dalibo.com/ — fetched 2026-09-27 — (tool page; no quotable text beyond the title)
- Confidence: medium (tools not exercised in the lab; availability from Iran not checked).
- Conflicts: none.

**P-19. Benchmark on production-shaped data, with the real mix and the real network.**
- Owner question: 4.
- Why: indexes and plans depend on data size and skew; a 100-row table uses sequential scans for everything, and a uniform distribution hides the popular models that dominate Iranian listings.
- How: Keep a seeded generator like the lab's `01-schema-data.sql` (not kept) (skewed model popularity: model 1 is 17 % of rows; Tehran 40 %; 15 % active), grow it with the product, and use it for every performance claim. Drive it with `pgbench` custom scripts that mix the real queries by weight (`random_zipfian` for popular models; the lab's `bench/*.sql`, not kept), so `pg_stat_statements` shows a realistic ranking. Report cold and warm runs and buffers, not a single timing. Measure end-to-end from Node with the production round trip: the lab's 1 ms each-way delay turned 21 statements from 11 ms into 60 ms (P-22). For vector indexes, warm them first (`pg_prewarm`) before measuring.
- Sources:
  - PostgreSQL Global Development Group — 11.12 Examining Index Usage — https://www.postgresql.org/docs/current/indexes-examine.html — fetched 2026-09-27 — "It is especially fatal to use very small test data sets."
  - GitLab — Query performance guidelines — https://docs.gitlab.com/development/database/query_performance/ — current, fetched 2026-09-27 — "The first time a query is made, it is made on a “cold cache”."
  - Supabase — Going to Production (AI & Vectors) — https://supabase.com/docs/guides/ai/going-to-prod — fetched 2026-09-27 — "Use pg_prewarm to load the index into RAM"
- Confidence: high.
- Conflicts: none.

### C. Query patterns

**P-20. Paginate by keyset («نمایش بیشتر»), never by deep `OFFSET`.**
- Owner question: 6.
- Why: `OFFSET n` still produces and throws away the first `n` rows, so each page is slower than the last, and rows shift between pages when listings change.
- How: Lab, "best deals" over all 74,572 active listings, index `(deal_score DESC, id DESC) WHERE status = 'active'`, warm cache: `OFFSET 0` 0.08 ms / 23 buffers; `OFFSET 1980` (page 100) 1.95 ms / 2,010; `OFFSET 19980` 18.9 ms / 20,077; `OFFSET 59980` **66 ms / 60,227 buffers**. Keyset from the last row seen: `WHERE status = 'active' AND (deal_score, id) < ($1, $2) ORDER BY deal_score DESC, id DESC LIMIT 20` took **0.06 ms / 23 buffers at any depth**. Rules: (1) a unique tiebreaker (`id`) in the sort, the row comparison and the index; (2) all sort columns in the same direction for the row comparison; mixed directions need an expanded `a < $1 OR (a = $1 AND b > $2)` predicate, which the lab showed cannot use the index as a range (it filtered and re-sorted); (3) **the cursor must be exact in the column's type**. The lab's `deal_score real` cursor, passed as a literal, compared as `double precision`, and the last row of the previous page came back again (a duplicate on every page). With a parameter typed from the column (`$1` inferred as `real`) the pages matched `OFFSET` exactly. Store sort keys as integers where possible (deal score in basis points, `integer`), or cast in SQL (`($1::real, $2::bigint)`), and encode the cursor opaquely (base64 JSON of the key) in the URL; (4) no page numbers or "page 57 of 400"; «نمایش بیشتر» and back/forward only. Saved-search alerts also iterate by keyset (`(first_seen_at, id) > cursor`).
- Sources:
  - Markus Winand — We need tool support for keyset pagination — https://use-the-index-luke.com/no-offset — 2014-08-06, updated 2023-09-08 — "This approach—called seek method or keyset pagination —solves the problem of drifting results as illustrated above and is even faster than offset."
  - Markus Winand — Use The Index, Luke: Fetch Next Page — https://use-the-index-luke.com/sql/partial-results/fetch-next-page — undated, fetched 2026-09-27 — "The problem is that the order by clause does not establish a deterministic row sequence."
  - PostgreSQL Global Development Group — 7.6 LIMIT and OFFSET — https://www.postgresql.org/docs/current/queries-limit.html — fetched 2026-09-27 — "The rows skipped by an OFFSET clause still have to be computed inside the server; therefore a large OFFSET might be inefficient."
  - GitLab — Pagination guidelines — https://docs.gitlab.com/development/database/pagination_guidelines/ — current, fetched 2026-09-27 — "Avoid using page numbers, use next and previous page buttons."
- Confidence: high (measured, including the float cursor bug).
- Conflicts: none.

**P-21. Show capped or estimated counts, never an exact total by default.**
- Owner question: 6.
- Why: an exact `count(*)` must visit every matching row (PostgreSQL keeps no row count), and the filter sheet's «نمایش ۱۲۸ آگهی» runs on every chip tap.
- How: Lab, active listings in Tehran (29,863 rows): the naive count **50 ms** (8,288 buffers, and it was 60 % of all database time in P-15); with a partial index `(city_id) WHERE status = 'active'` an index-only count **9.4 ms** (28 buffers); a capped count `SELECT count(*) FROM (SELECT 1 FROM listings WHERE … LIMIT 1001) s` **0.57 ms** (3 buffers), shown as «بیش از ۱۰۰۰ آگهی» when it returns 1,001; and the planner's estimate from `EXPLAIN (FORMAT JSON)` said 29,064 (3 % off) at no cost. So: exact counts only below the cap, «بیش از …» above it, estimates where a rounded number is honest («حدود ۳۰ هزار آگهی»), and index-only partial indexes for the facet counts the filter sheet needs (pass A may move facets elsewhere). The whole-table estimate is `pg_class.reltuples`. Craft rule L-11 (tabular numbers in a fixed box) applies to whichever number is shown.
- Sources:
  - Laurenz Albe (Cybertec) — PostgreSQL count(*) made fast — https://www.cybertec-postgresql.com/en/postgresql-count-made-fast/ — 2019-04-03, updated 2024-03-05 — "So count(*) will normally perform a sequential scan of the table, which can be quite expensive."
  - Laurenz Albe (Cybertec) — Pagination and the problem of the total result count — https://www.cybertec-postgresql.com/en/pagination-problem-total-result-count/ — 2023-01-10 — "Remember that Google doesn't display exact counts either!"
  - GitLab — Pagination guidelines — https://docs.gitlab.com/development/database/pagination_guidelines/ — current, fetched 2026-09-27 — "Avoid presenting total counts, prefer limit counts. Example: count maximum 1001 records, and then on the UI show 1000+ if the count is 1001"
  - PostgreSQL wiki — Count estimate — https://wiki.postgresql.org/wiki/Count_estimate — last edited 2024-11-17 — "As you can see, it's an estimate - actual count would be 99."
- Confidence: high (measured).
- Conflicts: none.

**P-22. Fetch a page's related rows in one round trip (no N+1).**
- Owner question: 6.
- Why: each query costs a network round trip plus parse, plan and execute; twenty tiny queries cost twenty round trips, and nothing in the database looks slow.
- How: The results page shows 20 listings, each with its last three prices. Lab medians over 300 pages (Node 22, `pg` 8.23): **N+1 loop 11.5 ms** (21 statements); `Promise.all` over a pool of 10: 2.6 ms, but it takes up to 10 connections per page and still sends 21 statements; **`= ANY($1::bigint[])` second query 1.6 ms** (2 statements); **one `JOIN LATERAL` query 1.1 ms** (1 statement). With 1 ms added each way (a database on another host): **59.6 ms, 10.7, 6.2 and 3.6 ms**. The server's own execution time was under 1.1 ms per page in every pattern, so only round trips differed. Write the batch form: `WHERE listing_id = ANY($1::bigint[])` with one array parameter (not an `IN ($1, $2, …)` list, which changes the statement text with every page size), or a `CROSS JOIN LATERAL (SELECT … WHERE listing_id = l.id ORDER BY observed_at DESC LIMIT 3)` with an index on `(listing_id, observed_at DESC)`, aggregating with `json_agg` if one row per listing is wanted. In an ORM, check the generated SQL and the number of statements per request (the `pg_stat_statements` `calls` ratio in P-15 is the tell).
- Sources:
  - Markus Winand — Use The Index, Luke: Nested Loops, ORMs and the N+1 Problem — https://use-the-index-luke.com/sql/join/nested-loops-join-n1-problem — undated, fetched 2026-09-27 — "the number of database round trips is more important for the response time than the amount of data transferred."
  - PostgreSQL Global Development Group — 9.25 Row and Array Comparisons — https://www.postgresql.org/docs/current/functions-comparisons.html — fetched 2026-09-27 — "The forms involving array subexpressions are PostgreSQL extensions" (`= ANY (array)`)
- Confidence: high (measured).
- Conflicts: none.

**P-23. Select only the columns the screen needs.**
- Owner question: 6.
- Why: every extra column is read, detoasted, converted and sent; it also rules out index-only scans. In Carshenas, raw snapshot payloads, descriptions and embeddings are the wide columns.
- How: Lab: listing ids and cities for 1,003 rows: 3.3 ms, 16 kB sent; `SELECT *` on the same rows of the embeddings table: **29 ms and 4.7 MB**, of which plain `EXPLAIN ANALYZE` showed only 2.6 ms, because detoasting happens when rows are output; only `EXPLAIN (ANALYZE, SERIALIZE)` revealed it. Query functions name their columns; list pages never read `raw_payload`, `description` or `embedding`; keep wide, rarely read data in side tables (snapshots already are).
- Sources:
  - Markus Winand — Use The Index, Luke: Index-Only Scan — https://use-the-index-luke.com/sql/clustering/index-only-scan-covering-index — undated, fetched 2026-09-27 — "Avoid select * and fetch only the columns you need."
  - PostgreSQL Global Development Group — 66.2 TOAST — https://www.postgresql.org/docs/current/storage-toast.html — fetched 2026-09-27 — "The TOAST management code is triggered only when a row value to be stored in a table is wider than TOAST_TUPLE_THRESHOLD bytes (normally 2 kB)."
- Confidence: high (measured).
- Conflicts: none.

**P-24. Write `OR` and list filters in forms the planner can index.**
- Owner question: 6.
- Why: an `OR` across different columns can only use indexes if every branch has one (a `BitmapOr`); otherwise it scans. Long `IN` lists built in JavaScript change the statement text with every length.
- How: "Peugeot 206 **or** anything under 500 million toman" needs an index usable by each branch, or rewrite as `UNION ALL` of two indexed queries (dedupe by `id` if both can match). Multi-select chips (three models, two cities) become `model_id = ANY($1::int[]) AND city_id = ANY($2::smallint[])`, which B-trees serve directly and which keeps one `pg_stat_statements` entry. PostgreSQL 17 made such lookups cheaper, and 18 groups literal `IN` lists in statistics. When a query mixes several optional filters, generate SQL with only the filters present rather than `($1 IS NULL OR model_id = $1)` catch-alls, which plan badly (*inference*, standard advice; not measured here).
- Sources:
  - PostgreSQL Global Development Group — 11.5 Combining Multiple Indexes — https://www.postgresql.org/docs/current/indexes-bitmap-scans.html — fetched 2026-09-27 — "Sometimes multicolumn indexes are best, but sometimes it's better to create separate indexes and rely on the index-combination feature."
  - Christopher Winslett (Crunchy Data) — Postgres 19: How Our Advice Has Changed — https://www.crunchydata.com/blog/postgres-19-how-our-advice-has-changed-since-we-wrote-it — 2026-08-18 — "WHERE id IN (...) style lookups on B-trees got cheaper without any schema change."
- Confidence: medium (documented; the catch-all pattern was not measured).
- Conflicts: none.

**P-25. Remember that CTEs are inlined, and use `MATERIALIZED` only on purpose.**
- Owner question: 6.
- Why: since PostgreSQL 12 a side-effect-free `WITH` query used once is folded into the main query and optimised with it; older advice about CTEs as "optimisation fences" is now wrong by default, but the fence is still available when wanted.
- How: Write CTEs for readability without fear. Add `MATERIALIZED` when a subresult must be computed once and then re-sorted or filtered as a fixed set, for example pgvector's relaxed-order results re-sorted by exact distance (P-40), or a candidate set of comparables reused by several aggregates. Add `NOT MATERIALIZED` when a CTE referenced twice should still be inlined.
- Sources:
  - PostgreSQL Global Development Group — 7.8 WITH Queries — https://www.postgresql.org/docs/current/queries-with.html — fetched 2026-09-27 — "if a WITH query is non-recursive and side-effect-free … then it can be folded into the parent query, allowing joint optimization of the two query levels."
  - PostgreSQL Global Development Group — PostgreSQL 12 release notes — https://www.postgresql.org/docs/release/12.0/ — 2019-10 — "Automatic (but overridable) inlining of common table expressions (CTEs)"
- Confidence: high.
- Conflicts: none.

**P-26. Know when a prepared statement switches to a generic plan.**
- Owner question: 6.
- Why: a prepared statement is planned with its parameter values for the first five executions; after that PostgreSQL may reuse one generic plan that ignores the values. On skewed data (model 1 is 17 % of listings, a rare model 0.2 %) the best plan differs by value, and a generic plan cannot use a partial index whose predicate is a parameter (P-5).
- How: Know your driver. **node-postgres** sends an unnamed statement unless you pass `name`, so every execution is planned afresh with its values; `name: 'listing-page'` caches a plan per connection. **postgres.js** prepares every static query by default (`prepare: true`), so its statements can go generic after five runs. In the lab, `plan_cache_mode = auto` kept custom plans for the skewed `model_id` query (the generic cost was not competitive), and `force_generic_plan` lost the partial index. Rules: literals for fixed predicates (`status = 'active'`), parameters for user values; if a hot, skewed query goes generic in `EXPLAIN (GENERIC_PLAN)` or auto_explain logs, set `plan_cache_mode = force_custom_plan` for that role or statement; keep `prepare: false` in postgres.js if PgBouncer runs in transaction mode without `max_prepared_statements` (P-31).
- Sources:
  - PostgreSQL Global Development Group — PREPARE — https://www.postgresql.org/docs/current/sql-prepare.html — fetched 2026-09-27 — "the first five executions are done with custom plans and the average estimated cost of those plans is calculated."
  - PostgreSQL Global Development Group — 19.7 Query Planning (plan_cache_mode) — https://www.postgresql.org/docs/current/runtime-config-query.html — fetched 2026-09-27 — "if the ideal plan depends strongly on the parameter values then a generic plan may be inefficient."
  - PostgreSQL Global Development Group — 54.2 Message Flow — https://www.postgresql.org/docs/current/protocol-flow.html — fetched 2026-09-27 — "An unnamed prepared statement lasts only until the next Parse statement specifying the unnamed statement as destination is issued."
  - Brian Carlson — node-postgres: Queries — https://node-postgres.com/features/queries — fetched 2026-09-27 — "If you supply a name parameter the query execution plan will be cached on the PostgreSQL server on a per connection basis."
  - Rasmus Porsager — postgres.js README — https://github.com/porsager/postgres — master, fetched 2026-09-27 — "Prepared statements will automatically be created for any queries where it can be inferred that the query is static."
- Confidence: high for the mechanism; medium for how often it bites (not observed under `auto` in the lab).
- Conflicts: none.

**P-27. Give every role a statement, lock and idle-in-transaction timeout.**
- Owner question: 6.
- Why: a runaway query or a forgotten open transaction holds a pooled connection, blocks vacuum (P-6, P-33) and, with locks, queues everyone behind it. Timeouts turn a hang into an error you can see.
- How: Per role: web `statement_timeout = '3s'`, `idle_in_transaction_session_timeout = '10s'`; worker `statement_timeout = '60s'` (longer for known batch jobs, set per session); migrations `lock_timeout = '5s'` with retry. node-postgres accepts `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`, `query_timeout` and `application_name` in the pool config. Values are *inference* to be tuned with measurements; the rule is that none is zero in production. A timed-out statement is not in `pg_stat_statements` (P-15), so log them (`log_min_error_statement` default logs errors).
- Sources:
  - PostgreSQL Global Development Group — 19.11 Client Connection Defaults — https://www.postgresql.org/docs/current/runtime-config-client.html — fetched 2026-09-27 — "Abort any statement that takes more than the specified amount of time."
  - PostgreSQL Global Development Group — same page — "an open transaction prevents vacuuming away recently-dead tuples that may be visible only to this transaction"
  - Brian Carlson — node-postgres: pg.Client — https://node-postgres.com/apis/client — fetched 2026-09-27 — "idle_in_transaction_session_timeout ?: number , // number of milliseconds before terminating any session with an open idle transaction"
- Confidence: high for the practice; values are inference.
- Conflicts: none.

**P-28. Keep transactions short: never hold one open across a fetch or an LLM call.**
- Owner question: 6.
- Why: a transaction left open for seconds pins old row versions (vacuum cannot clean them, index-only scans get heap fetches, tables bloat) and holds its locks and its pooled connection.
- How: The worker's shape is: read what to do (short transaction or single statement), fetch the page or call the model **outside** any transaction, then write the result in one short transaction (with an idempotency key, pass B/C). Never `BEGIN` before `fetch()`. In Server Actions, no transaction spans an `await` on anything but the database. `idle_in_transaction_session_timeout` (P-27) is the safety net. Watch `pg_stat_activity` for `state = 'idle in transaction'` and `xact_start` older than a few seconds.
- Sources:
  - PostgreSQL Global Development Group — 19.11 Client Connection Defaults — https://www.postgresql.org/docs/current/runtime-config-client.html — fetched 2026-09-27 — "an open transaction prevents vacuuming away recently-dead tuples that may be visible only to this transaction"
  - PostgreSQL Global Development Group — 24.1 Routine Vacuuming — https://www.postgresql.org/docs/current/routine-vacuuming.html — fetched 2026-09-27 — "To update the visibility map, which speeds up index-only scans."
- Confidence: high (the mechanism is documented; the worker design overlaps pass B and C).
- Conflicts: none.

### D. Connections

**P-29. Size the pool by CPU cores, not by users.**
- Owner question: 6.
- Why: PostgreSQL runs one process per connection and each connection executes one statement at a time. Beyond a few busy connections per core, more connections add queueing inside the server, memory (`work_mem` per sort, per connection) and context switches, not throughput.
- How: Lab, 2-CPU container, short read queries (results page plus listing detail), pgbench from outside the container, two runs: throughput peaked at **2 to 4 clients (about 2,400 to 2,800 transactions per second)** and stayed flat; average latency grew with every client beyond that: 0.7 ms at 1, 1.4 to 1.8 at 4, 3.8 at 8, 8 at 16, 13 to 16 at 32, **29 ms at 64**; at 128 clients connections failed with `FATAL: sorry, too many clients already` (the default `max_connections` is 100). For a 2 to 4 vCPU VPS: web pool `max: 5`, worker pool `max: 3` to `5`, plus a few for migrations and `psql`, and `max_connections = 50` (lower memory reservation). Measure pool wait time in the app (node-postgres `pool.waitingCount`) before raising `max`; a starved pool usually means slow queries, not too few connections.
- Sources:
  - PostgreSQL wiki — Number Of Database Connections — https://wiki.postgresql.org/wiki/Number_Of_Database_Connections — last edited 2014-03-14 — "for optimal throughput the number of active connections should be somewhere near ((core_count * 2) + effective_spindle_count)."
  - Brian Carlson — node-postgres: Pooling — https://node-postgres.com/features/pooling — fetched 2026-09-27 — "PostgreSQL can only process one query at a time on a single connected client in a first-in first-out manner."
  - Brian Carlson — node-postgres: Pool Sizing — https://node-postgres.com/guides/pool-sizing — fetched 2026-09-27 — "Typically, though, I don’t bother setting it to anything other than the default of 10 as that’s usually fine."
  - PostgreSQL Global Development Group — 19.3 Connections and Authentication — https://www.postgresql.org/docs/current/runtime-config-connection.html — fetched 2026-09-27 — "The default is typically 100 connections"
- Confidence: high (measured; the wiki formula is old but matched the lab: 2 cores gave a peak at 2 to 4).
- Conflicts: node-postgres's default of 10 is fine for one process on a bigger server; on a 2-core VPS shared by web and worker, two pools of 10 already exceed the useful concurrency. We follow the measurement.

**P-30. One pool per Node process, created once, cached on `globalThis` in development.**
- Owner question: 6.
- Why: every `new Pool()` opens its own connections. In Next.js development, hot reloading re-evaluates modules, so a pool created at module scope is recreated on every edit and the old connections linger until the server hits `max_connections`. A pool per request is worse.
- How: One server-only module per process (sketch; pass B picks the driver):

  ```ts
  // apps/web/src/server/db/pool.ts
  import 'server-only';
  import { Pool } from 'pg';

  const globalForDb = globalThis as unknown as { carshenasPool?: Pool };

  export const pool =
    globalForDb.carshenasPool ??
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: 'carshenas-web',
      statement_timeout: 3_000,
      idle_in_transaction_session_timeout: 10_000,
    });

  if (process.env.NODE_ENV !== 'production') globalForDb.carshenasPool = pool;
  ```

  The worker has its own module with `application_name: 'carshenas-worker'`, calls `await pool.end()` on `SIGTERM`, and never imports the web module. `application_name` shows up in `pg_stat_activity` and the logs, so a slow query names its process. The pool's `onConnect` option (awaited before a client is handed out) is where pgvector's type registration goes (P-42).
- Sources:
  - Prisma — Comprehensive Guide to Using Prisma ORM with Next.js — https://www.prisma.io/docs/orm/more/help-and-troubleshooting/nextjs-help — fetched 2026-09-27 — "This often occurs due to Next.js's hot-reloading feature in development." (multiple client instances; the fix is a global singleton)
  - Brian Carlson — node-postgres: pg.Pool — https://node-postgres.com/apis/pool — fetched 2026-09-27 — "Default is 10000 (10 seconds) - set to 0 to disable auto-disconnection of idle clients." (`idleTimeoutMillis`)
  - PostgreSQL Global Development Group — 19.8 Error Reporting and Logging — https://www.postgresql.org/docs/current/runtime-config-logging.html — fetched 2026-09-27 — "The name will be displayed in the pg_stat_activity view and included in CSV log entries."
- Confidence: high.
- Conflicts: none.

**P-31. Add PgBouncer only when processes outgrow one pool, and then respect transaction mode.**
- Owner question: 6.
- Why: with one web process and one worker on one VPS, driver pools are enough (*inference* from P-29). A pooler earns its place when many processes (several web instances, cron jobs) each hold idle connections. In transaction mode a server connection belongs to a client only for one transaction, which breaks session state.
- How: If PgBouncer is added: transaction pooling; no session `SET` (use `SET LOCAL` inside the transaction, which is safe), no `LISTEN`, no session-level advisory locks (use `pg_advisory_xact_lock`), no `PREPARE`/`DEALLOCATE`, no `WITH HOLD` cursors; enable `max_prepared_statements` (PgBouncer 1.21+) for protocol-level prepared statements, or run postgres.js with `prepare: false`. Check the job queue library chosen by pass B against this list (queues that `LISTEN` for new jobs need a direct connection). Pool sizes then apply to PgBouncer's server side (`default_pool_size`), sized as in P-29.
- Sources:
  - PgBouncer — Features — https://www.pgbouncer.org/features.html — fetched 2026-09-27 — "This mode breaks a few session-based features of PostgreSQL."
  - PgBouncer — Configuration (max_prepared_statements) — https://www.pgbouncer.org/config.html — fetched 2026-09-27 — "PgBouncer tracks protocol-level named prepared statements related commands sent by the client in transaction and statement pooling mode."
  - Rasmus Porsager — postgres.js README — https://github.com/porsager/postgres — master, fetched 2026-09-27 — "This can be disabled by using the `prepare: false` option."
- Confidence: high for the caveats; medium for "not needed at first" (inference from our process count).
- Conflicts: none.

### E. Configuration for a 2 to 8 GB VPS

**P-32. Start from a small, explained configuration, then tune by measurement.**
- Owner question: new (configuration).
- Why: PostgreSQL's defaults target a tiny machine (`shared_buffers` 128 MB, `work_mem` 4 MB, `maintenance_work_mem` 64 MB, `random_page_cost` 4.0 for spinning disks), and a few values decide most of the behaviour.
- How: Proposed starting points, assuming PostgreSQL shares the VPS with the Next.js app and the worker (values are *inference* from the sources, to be checked with P-15 and P-17):

  | Setting | 2 GB | 4 GB | 8 GB | Why |
  |---|---|---|---|---|
  | `shared_buffers` | 512MB | 1GB | 2GB | 25 % of RAM (manual); less if the app shares the box |
  | `effective_cache_size` | 1GB | 2GB | 5GB | 50 to 60 % when shared, up to 75 % when dedicated; a planner hint, not an allocation |
  | `work_mem` | 8MB | 16MB | 32MB | per sort or hash node, per connection; raise per role or session for the valuation batch |
  | `maintenance_work_mem` | 128MB | 256MB | 512MB | vacuum and index builds; raise per session for HNSW builds (P-38) |
  | `autovacuum_work_mem` | 64MB | 128MB | 256MB | caps what several autovacuum workers take |
  | `max_connections` | 40 | 50 | 80 | pools from P-29 plus headroom |
  | `random_page_cost` | 1.1 | 1.1 | 1.1 | SSD or NVMe; data mostly cached |
  | `effective_io_concurrency` | 16 | 16 | 16 (up to 200 on NVMe) | PostgreSQL 18's default is 16; affects prefetching and async I/O |
  | `jit` | off | off | off | OLTP queries; PostgreSQL 19 turns it off by default |
  | `max_wal_size` | 1GB | 2GB | 4GB | fewer forced checkpoints during crawls |
  | `track_io_timing` | on | on | on | P-15 |
  | `shared_preload_libraries` | `pg_stat_statements` | same | same | P-15; add `auto_explain` per P-17 |

  Apply them in a checked-in `postgresql.conf` fragment mounted into the container (CS-4), restart for `shared_buffers` and preload libraries, and verify with `SHOW`. PgTune, which pgvector's README recommends, is a fine cross-check.
- Sources:
  - PostgreSQL Global Development Group — 19.4 Resource Consumption — https://www.postgresql.org/docs/current/runtime-config-resource.html — fetched 2026-09-27 — "a reasonable starting value for shared_buffers is 25% of the memory in your system"
  - PostgreSQL Global Development Group — 19.4 Resource Consumption — same URL — "the total memory used could be many times the value of work_mem"
  - PostgreSQL Global Development Group — 19.7 Query Planning — https://www.postgresql.org/docs/current/runtime-config-query.html — fetched 2026-09-27 — "if your data is likely to be completely in cache, such as when the database is smaller than the total server memory" (then lowering `random_page_cost` is appropriate)
  - PostgreSQL wiki — Tuning Your PostgreSQL Server — https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server — last edited 2021-03-31 — "This is a guideline for how much memory you expect to be available in the OS and PostgreSQL buffer caches, not an allocation!"
  - Tom Swartz (Crunchy Data) — Optimize PostgreSQL Server Performance Through Configuration — https://www.crunchydata.com/blog/optimize-postgresql-server-performance — 2020-04-07 — "Most commonly, the value is set to 75% of the total system memory on a dedicated DB server"
  - PostgreSQL Global Development Group — 30.2 When to JIT? — https://www.postgresql.org/docs/current/jit-decision.html — fetched 2026-09-27 — "For short queries the added overhead of performing JIT compilation will often be higher than the time it can save."
  - Christopher Winslett (Crunchy Data) — Postgres 19: How Our Advice Has Changed — https://www.crunchydata.com/blog/postgres-19-how-our-advice-has-changed-since-we-wrote-it — 2026-08-18 — "JIT is off by default in Postgres 19 (it had been on since 12)."
  - Andrew Kane — pgvector README, Performance: Tuning — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "Use a tool like PgTune to set initial values for Postgres server parameters."
- Confidence: medium (sound starting values; our lab used the 4 GB column and behaved well, but the real VPS, its disk and co-tenants decide).
- Conflicts: `effective_cache_size` 50 % (Crunchy's conservative value) versus 75 % (dedicated server); we use the lower end because the app shares the box.

**P-33. Tune autovacuum for crawl churn and for insert-only history.**
- Owner question: new (configuration).
- Why: autovacuum starts on a table when dead rows exceed 20 % of it by default. On `listings`, which the crawler rewrites constantly, that lets dead rows pile up (bloat, heap fetches); `price_history` and `snapshots` are append-only, so only the insert threshold keeps their visibility maps current for index-only scans.
- How: `ALTER TABLE listings SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02, fillfactor = 90);` `ALTER TABLE price_history SET (autovacuum_vacuum_insert_scale_factor = 0.02);` Keep `log_autovacuum_min_duration = '1s'` and watch `n_dead_tup`, `last_autovacuum` and the HOT ratio in `pg_stat_user_tables` weekly. Never disable autovacuum on a table (the lab did it only to demonstrate heap fetches).
- Sources:
  - PostgreSQL Global Development Group — 19.10 Vacuuming (autovacuum) — https://www.postgresql.org/docs/current/runtime-config-autovacuum.html — fetched 2026-09-27 — "The default is 0.2 (20% of table size)."
  - PostgreSQL Global Development Group — same page — "Specifies a fraction of the unfrozen pages in the table to add to autovacuum_vacuum_insert_threshold when deciding whether to trigger a VACUUM."
  - Laurenz Albe (Cybertec) — Tuning autovacuum for PostgreSQL databases — https://www.cybertec-postgresql.com/en/tuning-autovacuum-postgresql/ — 2020-08-26, updated 2025-10-31 — "For that, you reduce autovacuum_vacuum_scale_factor for the table"
- Confidence: medium (values are inference; the mechanism is documented and the lab showed the heap-fetch effect).
- Conflicts: none.

**P-34. Configure the Docker service for what the lab broke.**
- Owner question: new (configuration; CS-4 acceptance criterion 2).
- Why: two defaults of the official image bite this stack: `/dev/shm` is 64 MB, and extensions that need shared memory must be preloaded at start.
- How: In the CS-4 compose service: `image: pgvector/pgvector:0.8.6-pg18` (pinned, PostgreSQL 18 current); `shm_size: 1gb` (at least the largest `maintenance_work_mem` used for index builds: the lab's parallel HNSW build on inline vectors failed at once with `ERROR: could not resize shared memory segment "/PostgreSQL.473791962" to 1070632384 bytes: No space left on device` under the default 64 MB, and succeeded with 1 GB); `command: postgres -c config_file=/etc/postgresql/postgresql.conf` with the P-32 file mounted read-only; `shared_preload_libraries = 'pg_stat_statements'` in it; a named volume for data; `mem_limit` and `cpus` in development to mimic the VPS. A second finding: with TOASTed `vector(512)` columns the same build silently ran without parallel workers (the heap looked like 3 MB), so the error only appears once vectors are stored inline (P-36).
- Sources:
  - Andrew Kane — pgvector README, Docker — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "If you increase `maintenance_work_mem`, make sure `--shm-size` is at least that size to avoid an error with parallel HNSW index builds."
  - PostgreSQL Global Development Group — F.32 pg_stat_statements — https://www.postgresql.org/docs/current/pgstatstatements.html — fetched 2026-09-27 — "This means that a server restart is needed to add or remove the module."
- Confidence: high (reproduced).
- Conflicts: none.

### F. pgvector and duplicate photos

**P-35. Decide first whether you need an approximate index at all.**
- Owner question: 5.
- Why: without an index pgvector does exact search: perfect recall, no build, no tuning, no memory for a graph. An approximate index trades recall for speed and changes results when it is added.
- How: For duplicate detection, candidates are already narrowed by make, model and roughly year (the catalogue from CS-10), so the search is "exact distance within a block of hundreds": lab, a filter matching 977 of 50,000 rows through a B-tree, then exact cosine sort: **recall 1.000 in 5 ms**, and the planner chose this plan by itself once the B-tree existed. A whole-table exact scan of 50,000 × 512 took **58 ms (halfvec) to 79 ms (inline vector)** on one core, and 156 to 385 ms when the vectors were TOASTed (P-36). Add HNSW only for a user-facing "similar listings across the whole market" query, or when an unfiltered exact scan passes about 100 ms (*inference* from the GitLab budget).
- Sources:
  - Andrew Kane — pgvector README, Indexing — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "By default, pgvector performs exact nearest neighbor search, which provides perfect recall."
  - pgvector project — pgvector 0.8.0 Released! (postgresql.org news) — https://www.postgresql.org/about/news/pgvector-080-released-2952/ — 2024-11-11 — "If you can achieve the same query performance without using an ANN index, this is usually preferable as it lets you achieve 100% recall"
  - Supabase — Going to Production (AI & Vectors) — https://supabase.com/docs/guides/ai/going-to-prod — fetched 2026-09-27 — "You don't have to create indexes in these cases and can use sequential scans instead."
- Confidence: high (measured).
- Conflicts: none.

**P-36. Store embeddings where scans stay fast: `halfvec`, a narrow side table, inline storage.**
- Owner question: 5.
- Why: a `vector(512)` is about 2 KB, just over the ~2 KB TOAST threshold, so PostgreSQL moves every vector out of line. Exact scans then fetch each vector through the TOAST index, and the planner, which does not count TOAST in its costs, thinks the table is tiny and will not scan it in parallel.
- How: Lab, 50,000 × 512: `vector(512)` default storage: heap 3 MB + TOAST 130 MB, exact search **354 to 385 ms per query** (250,385 buffer hits, about 5 per row); the same data with `ALTER TABLE … ALTER COLUMN embedding SET STORAGE PLAIN`: heap 130 MB, **79 ms**; as `halfvec(512)` (1 KB, inline without any setting): heap 56 MB, **58 ms**, recall 0.998 against float32 truth. Rules: (1) `halfvec(n)` for stored embeddings (pgvector's own scaling advice); (2) `SET STORAGE PLAIN` whenever a row would pass 2 KB (`vector` above about 500 dimensions, `halfvec` above about 1,000); (3) a narrow side table `listing_embeddings (listing_id, kind, model, model_version, embedding, created_at)` so crawler updates on `listings` never rewrite vectors and vectors never slow listing scans; (4) record the model and version, because vectors from different models are not comparable and a model change means re-embedding.
- Sources:
  - Andrew Kane — pgvector README, Troubleshooting — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "The planner doesn’t consider out-of-line storage in cost estimates, which can make a serial scan look cheaper."
  - Andrew Kane — pgvector README, Scaling — same URL — "Use the `halfvec` type instead of `vector` for tables"
  - PostgreSQL Global Development Group — 66.2 TOAST — https://www.postgresql.org/docs/current/storage-toast.html — fetched 2026-09-27 — "The TOAST management code is triggered only when a row value to be stored in a table is wider than TOAST_TUPLE_THRESHOLD bytes (normally 2 kB)."
- Confidence: high (measured).
- Conflicts: none.

**P-37. Use HNSW with default build options, tune `ef_search` per query, and keep IVFFlat for static data.**
- Owner question: 5.
- Why: HNSW gives the better speed-recall trade-off and needs no training data; IVFFlat builds in seconds and uses little memory but must be built after the data exists and needs more probes for the same recall.
- How: Lab, 50,000 × 512 "structured" vectors (32-dimensional latent plus noise, closer to real embeddings), 100 queries, recall@10 against exact truth:

  | Index | Build (2 CPUs) | Size | Setting | Recall@10 | Mean latency |
  |---|---|---|---|---|---|
  | none (exact, TOASTed) | 0 | 0 | — | 1.000 | 156 ms |
  | HNSW m 16, ef_construction 64 | 53 s | 130 MB | ef_search 40 | 0.870 | 1.15 ms |
  | same | | | ef_search 100 | 0.978 | 2.51 ms |
  | same | | | ef_search 200 | 0.999 | 4.70 ms |
  | IVFFlat lists 50 | 1.9 s | 130 MB | probes 1 | 0.214 | 0.72 ms |
  | same | | | probes 7 (√lists) | 0.698 | 4.50 ms |
  | same | | | probes 20 | 0.951 | 11.6 ms |

  Keep `m = 16, ef_construction = 64` unless measured recall is low (on isotropic data `m = 32, ef_construction = 128` took 221 s instead of 63 s). Set `ef_search` per query with `SET LOCAL hnsw.ef_search = 100` inside the query's transaction; 100 was the knee here. IVFFlat only for a static, rebuilt-nightly table where build time matters more than latency; `lists = rows / 1000` up to a million rows and `probes` of at least √lists.
- Sources:
  - Andrew Kane — pgvector README, HNSW — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "It has better query performance than IVFFlat (in terms of speed-recall tradeoff), but has slower build times and uses more memory."
  - Andrew Kane — pgvector README, IVFFlat — same URL — "a good place to start is `rows / 1000` for up to 1M rows and `sqrt(rows)` for over 1M rows"
  - Supabase — HNSW indexes — https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes — fetched 2026-09-27 — "HNSW should be your default choice when creating a vector index."
  - Christopher Winslett (Crunchy Data) — HNSW Indexes with Postgres and pgvector — https://www.crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector — 2023-09-01 — "When increased, these values will slow the speed of index build drastically, while not improving performance."
  - Neon — Optimize pgvector search — https://neon.com/docs/ai/ai-vector-search-optimization — fetched 2026-09-27 — "If accuracy is lower than 0.9, there may be opportunity for improvement by increasing ef_construction."
- Confidence: high for the mechanics; the recall numbers hold only for this synthetic data (P-39).
- Conflicts: Supabase reports 35 % more throughput with `m = 32, ef_construction = 80` on 1 million OpenAI vectors; the README says keep defaults unless recall is low. Both are consistent: change them only after measuring on our data.

**P-38. Give HNSW builds memory, cores and shared memory, and build after loading.**
- Owner question: 5.
- Why: HNSW builds fast only while the whole graph fits in `maintenance_work_mem`; after that it writes to disk and slows down severalfold.
- How: Lab, 50,000 × 512 on 2 CPUs: `maintenance_work_mem = 64MB` printed `NOTICE: hnsw graph no longer fits into maintenance_work_mem after 24269 tuples` and took **190 s**; with 1 GB, **57 s**; with 1 GB and 2 parallel workers on inline data, 53 s (only 2 cores; more cores help more); `halfvec` data, 39 s. So: load or backfill first, then `SET maintenance_work_mem = '1GB'` (at least the expected index size; the lab index was 130 MB, `halfvec` 65 MB) and `SET max_parallel_maintenance_workers = 2` in the build session only, never above 50 to 60 % of RAM; `CREATE INDEX CONCURRENTLY` in production; `shm_size` at least `maintenance_work_mem` in Docker (P-34); watch `pg_stat_progress_create_index`. On a 4 GB VPS run large builds in the quiet hours.
- Sources:
  - Andrew Kane — pgvector README, Index Build Time — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "Indexes build significantly faster when the graph fits into `maintenance_work_mem`"
  - Andrew Kane — pgvector README, Index Build Time — same URL — "Note: Do not set `maintenance_work_mem` so high that it exhausts the memory on the server"
  - Neon — The pgvector extension — https://neon.com/docs/extensions/pgvector — fetched 2026-09-27 — "your maintenance_work_mem setting should not exceed 50 to 60 percent of your compute's available RAM."
- Confidence: high (measured).
- Conflicts: none.

**P-39. Measure recall on your own data before trusting any `ef_search`.**
- Owner question: 5 and 4.
- Why: approximate recall depends on how clustered the embeddings are, and it degrades silently.
- How: Lab, the same HNSW index on 50,000 **isotropic random** vectors (no structure, the worst case): recall@10 **0.077 at ef_search 40, 0.173 at 100, 0.300 at 200, 0.483 at 400**, against 0.870 to 0.999 on structured vectors. Even planted near-copies (cosine 0.95 to their source) were ranked first only 87 times in 100 at ef_search 40 (99 at 100). So recall is a property of our data, not of pgvector: keep a labelled set of known duplicate pairs and a sample of queries (CS-9's evaluation), compute exact results with `SET LOCAL enable_indexscan = off`, and report recall@k with every change of model, dimension, index option or `ef_search`; rerun weekly on a sample in production.
- Sources:
  - Andrew Kane — pgvector README, Monitoring — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "Monitor recall by comparing results from approximate search with exact search."
  - Neon — Optimize pgvector search — https://neon.com/docs/ai/ai-vector-search-optimization — fetched 2026-09-27 — "This approach does an exact search and guarantees 100% recall, but it can be costly with large datasets."
- Confidence: high (measured).
- Conflicts: none.

**P-40. Filter vector searches the right way for the filter's selectivity.**
- Owner question: 5.
- Why: an HNSW scan returns about `ef_search` nearest candidates, then applies the `WHERE` clause; a filter matching 2 % of rows leaves almost nothing.
- How: Lab, "most similar listings in one bucket" (977 of 50,000 rows, 2 %), 10 wanted: HNSW, ef_search 40, iterative scan off: **0.9 rows returned on average**, recall 0.09; ef_search 200: 4.2 rows, 0.42; `hnsw.iterative_scan = strict_order`: 10 rows, recall 0.88, 13 ms; `relaxed_order`: 10 rows, **0.98**, 13 ms; a B-tree on the filter column plus exact sort (the planner's own choice once the B-tree existed): 10 rows, **1.00, 5 ms**. For a 40 % filter (Tehran) HNSW alone returned 10 of 10 after skipping 18 rows. Rules: selective filters (one model, one city and year) go B-tree first and exact; broad filters use HNSW with `SET LOCAL hnsw.iterative_scan = relaxed_order` (and `hnsw.max_scan_tuples`, default 20,000, as the stop); a handful of fixed filter values (a vehicle class) can get partial HNSW indexes; re-sort relaxed results by exact distance with a `MATERIALIZED` CTE when order matters. If the application needs an exact count of 10, oversample (Crunchy's starting pool is k divided by the filter's selectivity, times 2).
- Sources:
  - Andrew Kane — pgvector README, Filtering — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "With approximate indexes, filtering is applied *after* the index is scanned."
  - Andrew Kane — pgvector README, Iterative Index Scans — same URL — "Starting with 0.8.0, you can enable iterative index scans, which will automatically scan more of the index until enough results are found"
  - Christopher Winslett (Crunchy Data) — Hybrid Search Patterns with Postgres and pgvector — https://www.crunchydata.com/blog/hybrid-vector-search — 2026-07-30 — "If the condition matches about 10% of rows and hnsw.ef_search is 40, you should expect only about four survivors on average"
  - Christopher Winslett (Crunchy Data) — same article — "The partial index is smaller (it only holds the filtered rows), builds faster, and has effectively 100% recall within that filtered subset."
- Confidence: high (measured).
- Conflicts: none; the README's "Exact indexes work well for conditions that match a low percentage of rows" matches the lab.

**P-41. Quantise before buying memory: `halfvec` indexes, then binary quantisation with re-ranking.**
- Owner question: 5.
- Why: an HNSW index stores the vectors themselves, so it is as large as the data (130 MB for 50,000 × 512 float32) and wants to live in RAM.
- How: Lab on structured data: HNSW on `(embedding::halfvec(512))` **65 MB**, built in 43 s, recall 0.859 at ef_search 40 and **0.979 at 100 (2.0 ms)**, the same as float32. Binary quantisation, `hnsw ((binary_quantize(embedding)::bit(512)) bit_hamming_ops)`: **18 MB**, built in 20 s; top-10 by Hamming distance alone had recall 0.51, re-ranking the top 100 by exact cosine 0.913 (2.2 ms), the top 200 0.976 (4.2 ms). So `halfvec` first (no recall loss here), binary quantisation with re-ranking when the index outgrows memory, and always check recall (P-39) because binary quantisation suits some embedding models better than others. Dimension limits for indexes: `vector` 2,000, `halfvec` 4,000, `bit` 64,000, `sparsevec` 1,000 non-zero elements; choose a model of at most about 1,024 dimensions.
- Sources:
  - Andrew Kane — pgvector README, Half-Precision Indexing — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "Index vectors at half precision for smaller indexes"
  - Andrew Kane — pgvector README, Binary Quantization — same URL — "Re-rank by the original vectors for better recall"
  - Andrew Kane — pgvector README, HNSW — same URL — "`vector` - up to 2,000 dimensions"
- Confidence: high for sizes and this data; medium for binary quantisation on our future model (model-dependent).
- Conflicts: none.

**P-42. Write vector queries the index can use, from TypeScript.**
- Owner question: 5 and 6.
- Why: the index is used only for `ORDER BY <distance operator> LIMIT n` in ascending order; a computed similarity in the `ORDER BY`, a missing `LIMIT` or a type mismatch silently scans the table.
- How: `ORDER BY e.embedding <=> $1::halfvec(768) LIMIT 20` (cosine) and compute `1 - (e.embedding <=> $1)` only in the select list. For normalised embeddings, inner product (`<#>`, negative, so still ascending) is the fastest. Register types once per pool (`import pgvector from 'pgvector/pg'; new pg.Pool({ onConnect: async (c) => pgvector.registerTypes(c) })`, verified that `pg-pool` 3.14 calls `onConnect`) and pass `pgvector.toSql(array)`; Drizzle ORM 0.31+ has built-in `vector` and `halfvec` column types (pass B). Settings per query in one transaction: `BEGIN; SET LOCAL hnsw.ef_search = 100; SET LOCAL hnsw.iterative_scan = 'relaxed_order'; SELECT …; COMMIT;` (safe under PgBouncer transaction mode). `NULL` vectors and, for cosine, zero vectors are not indexed, so a listing whose embedding failed is invisible to similarity search; keep the embedding job's failures in the review queue.
- Sources:
  - Andrew Kane — pgvector README, Troubleshooting — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "the `ORDER BY` must be the result of a distance operator (not an expression) in ascending order."
  - Andrew Kane — pgvector README, Exact Search — same URL — "If vectors are normalized to length 1 (like OpenAI embeddings), use inner product for best performance."
  - Andrew Kane — pgvector-node README — https://github.com/pgvector/pgvector-node — master, fetched 2026-09-27 (cross-checked with Context7 `/pgvector/pgvector-node`) — "new pg.Pool({onConnect: async (client) => await pgvector.registerTypes(client)});"
  - Andrew Kane — pgvector README, Troubleshooting — https://github.com/pgvector/pgvector — "Also, note that `NULL` vectors are not indexed (as well as zero vectors for cosine distance)."
- Confidence: high.
- Conflicts: none.

**P-43. Keep vector indexes healthy: pin a fixed pgvector, reindex before vacuum, rebuild after a model change.**
- Owner question: 5.
- Why: HNSW vacuum is slow and had real bugs in 2026; pgvector releases are small and frequent.
- How: Pin `0.8.6` (0.8.3, 2026-06-17, fixed possible HNSW index corruption during vacuum; 0.8.4, 2026-06-30, fixed a "graph not repaired" error) and read the changelog before each upgrade (`ALTER EXTENSION vector UPDATE`). If vacuum of a table with an HNSW index runs long, `REINDEX INDEX CONCURRENTLY` first, then `VACUUM`. Batch embedding writes in the worker (an HNSW insert is a graph search); after an embedding model change, build the new index on the new column or partition concurrently, switch reads, then drop the old.
- Sources:
  - Andrew Kane — pgvector CHANGELOG — https://github.com/pgvector/pgvector/blob/master/CHANGELOG.md — 0.8.6 released 2026-07-29 — "Fixed possible index corruption with HNSW vacuuming" (0.8.3)
  - Andrew Kane — pgvector README, Vacuuming — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "Vacuuming can take a while for HNSW indexes. Speed it up by reindexing first."
- Confidence: high.
- Conflicts: none.

**P-44. Fuse full-text and vector results with reciprocal rank fusion, in one SQL statement.**
- Owner question: 5.
- Why: keyword and semantic scores are on different scales; RRF combines ranks only, so neither side needs calibrating.
- How: Two CTEs, each limited (for example 50 rows): the keyword leg ranked by `ts_rank_cd` or trigram similarity (pass A decides the Persian text side), the vector leg by distance; `FULL OUTER JOIN` on `id`; score `coalesce(1.0 / (k + kw.rank), 0) + coalesce(1.0 / (k + sem.rank), 0)`, optionally weighted; order by score. `k = 60` in pgvector's example, 50 in Supabase's function; both work, and it is a tuning constant for the evaluation set. Not measured in this lab.
- Sources:
  - Andrew Kane — pgvector README, Hybrid Search — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "You can use Reciprocal Rank Fusion or a cross-encoder to combine results."
  - Andrew Kane — pgvector-python example rrf.py — https://github.com/pgvector/pgvector-python/blob/master/examples/hybrid_search/rrf.py — master, fetched 2026-09-27 — "COALESCE(1.0 / (%(k)s + semantic_search.rank), 0.0) +" (with `k = 60`)
  - Supabase — Hybrid search — https://supabase.com/docs/guides/ai/hybrid-search — fetched 2026-09-27 — "The final query combines the results from the two CTEs using reciprocal rank fusion (RRF)."
- Confidence: medium (well documented; not measured on Persian listings).
- Conflicts: `k` 60 versus 50; immaterial until evaluated.

**P-45. Detect duplicate photos with a 64-bit perceptual hash and an exact Hamming search, not embeddings.**
- Owner question: 5.
- Why: cross-posted listings reuse the same photos, resized, recompressed and sometimes watermarked. A perceptual hash (pHash or dHash) is built for exactly that; an image embedding also matches different photos of similar cars (two white Pride 131s), which is "similar", not "duplicate".
- How: Compute a 64-bit hash in the worker when a photo is stored (CS-29), store it as `bigint` (8 bytes) next to the photo, and compare with `bit_count((phash # $1)::bit(64)) <= $2`. Lab, 500,000 hashes, 100 queries that were copies with 0 to 6 bits flipped:

  | Method | Index size | Build | Per query | Found |
  |---|---|---|---|---|
  | sequential scan, `bit_count` on XOR | none | none | 44 ms | 100 / 100 |
  | multi-index hashing: four 16-bit chunks, each probed with its 16 one-bit variants via B-tree expression indexes (exact up to 7 bits) | 60 MB | under 1 s | **0.8 ms** | 100 / 100 |
  | eight 8-bit chunks, index-only scans | 121 MB | 2 s | 1.9 ms | exact up to 7 bits |
  | pgvector HNSW on `phash::bit(64)`, `bit_hamming_ops` | 148 MB | 191 s | 1.1 ms (ef 40) / 5.7 ms (ef 200) | 92 / 100, 100 / 100 |

  Start with the sequential scan limited to the same model (a few thousand rows, well under a millisecond), move to multi-index hashing when unfiltered checks matter, and skip HNSW for 64-bit hashes (approximate, bigger than the table, slow to build). The threshold must be calibrated on labelled Carshenas pairs (CS-11): Krawetz's rule of thumb is up to about 10 bits for "variation", and watermarks and crops will move hashes more (*inference*). Keep image embeddings for a later "same car, different photo" candidate step, always confirmed by structured fields (make, model, year, mileage, city). Uniform random hashes are the easy case; real car photos are more alike, so real candidate counts per query will be higher (*inference*).
- Sources:
  - Neal Krawetz (The Hacker Factor Blog) — Looks Like It — https://www.hackerfactor.com/blog/index.php?/archives/432-Looks-Like-It.html — 2011-05-26 — "A distance of 5 means a few things may be different, but they are probably still close enough to be similar."
  - Neal Krawetz (The Hacker Factor Blog) — Kind of Like That — https://www.hackerfactor.com/blog/index.php?/archives/529-Kind-of-Like-That.html — 2013-01-21 — "A value greater than 10 is likely a different image, and a value between 1 and 10 is potentially a variation."
  - Gurmeet Singh Manku, Arvind Jain, Anish Das Sarma (Google) — Detecting Near-Duplicates for Web Crawling — https://research.google.com/pubs/archive/33026.pdf — WWW 2007 — "We experimentally validate that for a repository of 8B webpages, 64-bit simhash fingerprints and k = 3 are reasonable."
  - Meta — PDQ reference implementation README — https://github.com/facebook/ThreatExchange/blob/main/pdq/README.md — last change 2025-11-04 — "Distance Threshold to consider two hashes to be similar/matching: <=31" (for 256-bit PDQ hashes)
  - Andrew Kane — pgvector README, Binary Vectors — https://github.com/pgvector/pgvector — master, fetched 2026-09-27 — "Use the `bit` type to store binary vectors" (the linked example stores a 64-bit pHash as `bit(64)`)
  - PostgreSQL Global Development Group — 9.6 Bit String Functions — https://www.postgresql.org/docs/current/functions-bitstring.html — fetched 2026-09-27 — "Returns the number of bits set in the bit string (also known as “popcount”)."
- Confidence: high for the search mechanics (measured); medium for pHash's accuracy on Iranian listing photos until CS-11 measures it.
- Conflicts: pgvector's own example uses HNSW-capable `bit(64)` for image hashes; at our scale the exact B-tree method measured faster, smaller and exact. PDQ (256-bit) is designed to be more robust than a 64-bit pHash but costs four times the storage; Meta lists C++, PHP, Python, Java and WASM implementations (WASM should run in Node; *inference*); revisit if 64-bit hashes miss too many watermarked copies.

### G. Working with the database in code

**P-46. Keep SQL visible, named and reviewed; make the database do set work.**
- Owner question: 6.
- Why: most performance problems are written in application code: a loop of queries, a filter in JavaScript after fetching everything, a full-row update, a transaction around a network call. They are invisible unless someone reads the SQL.
- How: (1) Queries live in server-only query functions (ADR-0004), one function per query, named after what it answers (`findActiveListingsByModel`), so `pg_stat_statements`, logs and code search line up; if pass B picks a query builder, the reviewer still reads the generated SQL (`toSQL()` or logging). (2) Every new or changed query ships with its `EXPLAIN (ANALYZE, BUFFERS)` on the lab dataset in the task notes (the database reviewer checks it). (3) Filtering, joining, aggregating and ranking happen in SQL; JavaScript never loads a table to filter it. (4) The crawler compares new values to stored ones and updates only changed columns, or skips the write (P-11). (5) Money and ids come back from node-postgres as strings (`int8`, `numeric`): parse toman amounts to `BigInt` or keep them as strings to the formatter; never `Number()` a price in the billions of toman without a range check (*inference*: `Number` is exact only up to 2^53, which toman prices do not reach, but ids and sums might). (6) After each release, look at the top statements and the new plans (P-15, P-17), and write one line in `docs/learnings.md` when something surprised you.
- Sources:
  - Markus Winand — Use The Index, Luke: Nested Loops, ORMs and the N+1 Problem — https://use-the-index-luke.com/sql/join/nested-loops-join-n1-problem — undated, fetched 2026-09-27 — "Tip Execute joins in the database."
  - Brian Carlson — node-postgres: Data Types — https://github.com/brianc/node-postgres/blob/master/docs/pages/features/types.mdx — last change 2023-11-19 — "node-postgres will convert a database type to a JavaScript string if it doesn't have a registered type parser for the database type."
  - Markus Winand — Use The Index, Luke: Update — https://use-the-index-luke.com/sql/dml/update — undated — "ORM tools, however, might generate update statements that set all columns every time."
- Confidence: medium (practice synthesised from the sources and the lab; the lab verified that `pg` 8.23 returns `int8` and `numeric` as strings and `real` as a number).
- Conflicts: none.

## Lab

### Set-up

- **Machine**: Lenovo ThinkPad E15, Intel Core i7-10510U (4 cores, 8 threads, `nproc` = 8), 31 GiB RAM, SSD behind LVM, Ubuntu 24.04 with Linux 7.0.0-34, Docker 29.1.3.
- **Container**: `pgvector/pgvector:pg17` (image built 2026-08-13): PostgreSQL 17.11 (Debian 17.11-1.pgdg12+2), pgvector 0.8.6, pg_stat_statements 1.11. Started as `docker run -d --name carshenas-lab-perf --cpus=2 --memory=4g --shm-size=1g -e POSTGRES_PASSWORD=lab -p 55434:5432 pgvector/pgvector:pg17 -c shared_preload_libraries=pg_stat_statements -c shared_buffers=1GB -c effective_cache_size=3GB -c work_mem=16MB -c maintenance_work_mem=256MB -c random_page_cost=1.1 -c effective_io_concurrency=200 -c track_io_timing=on -c max_wal_size=4GB -c pg_stat_statements.track_utility=off -c log_min_duration_statement=2000` (the 4 GB column of P-32; `jit` stayed on and never triggered). A second, throwaway container with the default 64 MB `/dev/shm` tested the shared-memory failure. Both were removed afterwards.
- **Why PostgreSQL 17**: it was the image available locally. Everything measured applies to 18 except where a tip names an 18 feature (skip scan, `BUFFERS` by default, `Index Searches`, asynchronous I/O), which would make some sequential and bitmap paths faster.
- **Noise**: five other research containers ran on the same laptop, and the host load average reached 24 during two runs. Treat milliseconds as ±30 % between repeats (the same exact vector scan measured 354 and 156 ms in two runs); buffer and row counts are exact and are the numbers to compare.
- **Data** (`01-schema-data.sql`): 500,000 listings over 40 makes and 200 models with skewed popularity (model 1 = 85,353 rows, 17 %), 30 cities (Tehran 40 %), model years 1380 to 1404, mileage correlated with age, prices in whole million toman, `deal_score real`, status 15 % active, 25 % sold, 60 % expired; `price_history` 2,247,570 rows in time order; `listing_photos` 500,000 rows with a random 64-bit hash each, 2,000 of them planted near-duplicates. Vectors (`gen_vectors.py`, NumPy): two sets of 50,000 × 512 normalised vectors, "iso" (isotropic Gaussian, the worst case) and "lowrank" (a 32-dimensional latent mapped to 512 dimensions plus noise at about 30 % of the signal), 100 queries each, exact top-10 truth computed in NumPy, plus a 2 % "bucket" attribute for filtered queries.
- **Files** (in the research session's lab (not kept), except `07-report.sql`, kept as `lab/performance/07-report.sql`): numbered SQL scripts with `NN-out.txt` outputs, `06-nplus1.mjs` (Node 22.14, `pg` 8.23.0), `bench/*.sql` (pgbench scripts), `12-bench-fn.sql` and `15-bench-q.sql` (recall and latency harness), `gen_vectors.py`. The 490 MB vector files were deleted; `gen_vectors.py` regenerates them with seed 42.

### Results

| # | Experiment | Result | Tip |
|---|---|---|---|
| L-1 | Composite order | Wide band (model 150, 0.5 to 3 billion toman, 412 rows): `(model_id, price_toman)` 5 index pages, 408 buffers, 0.99 ms; `(price_toman, model_id)` about 758 index pages, 1,170 buffers, 13.6 ms. Narrow band (model 7, 1.0 to 1.1 billion, 360 rows): 4 against about 40 index pages, 0.43 against 0.63 ms; two single-column indexes (BitmapAnd) 27 index pages, 3.5 ms; no index, parallel seq scan 62.7 ms | P-3 |
| L-2 | Non-leading column only | `WHERE price_toman BETWEEN …` on `(model_id, price_toman)`: "Index Scan" reading the whole index, 1,469 buffers, 20.7 ms | P-2 |
| L-3 | Partial index, "model 7, active, best deals, 20" | Sizes: partial 1,648 kB; full `(model_id, deal_score)` 11 MB; `(status, model_id, deal_score)` 15 MB. Buffers: 22, 127 (`Rows Removed by Filter: 104`), 23. Without `status = 'active'` in the query, or with `status = $1` under a forced generic plan: seq scan and sort | P-4, P-5 |
| L-4 | Covering index, valuation comparables (338 rows) | Key only: 334 buffers, 0.51 ms. `INCLUDE (price_toman)`, vacuumed: 5 buffers, 0.25 ms, `Heap Fetches: 0`. After updating 20 % of rows, autovacuum off: `Heap Fetches: 409`, 405 buffers, 1.75 ms. After `VACUUM`: 6 buffers | P-6 |
| L-5 | Keyset versus OFFSET, active listings by deal score | OFFSET 0: 0.08 ms, 23 buffers; 1,980: 1.95 ms, 2,010; 19,980: 18.9 ms, 20,077; 59,980: 66 ms, 60,227. Keyset at pages 1,000 and 3,000: 0.06 to 0.07 ms, 23 buffers. Float cursor as a literal: previous page's last row repeated; typed parameter or `::real` cast: identical to OFFSET | P-20 |
| L-6 | N+1 versus batched (20 listings + last 3 prices), 300 pages | Median / p95 local: N+1 11.45 / 22.25 ms; `Promise.all` 2.58 / 5.17; `ANY($1)` 1.64 / 2.62; `LATERAL` 1.11 / 1.82. With +1 ms each way: 59.56 / 70.94; 10.67 / 12.47; 6.22 / 7.14; 3.56 / 4.07. Statements per page 21, 21, 2, 1; server execution per page 0.72, 1.04, 0.37, 0.43 ms | P-22 |
| L-7 | pg_stat_statements after 60 s of pgbench, 4 clients (15,875 transactions) | Top: city count 1,604 calls, 131 s total (59.9 %), mean 81.8 ms, 8,288 buffers per call; deep OFFSET 1,092 calls, 32.2 %, mean 64.7 ms, 30,066 buffers per call; the N+1 lookup 21,020 calls, 0.4 %, mean 0.04 ms | P-15 |
| L-8 | Counting active listings in Tehran (29,863) | Naive 50.4 ms, 8,288 buffers; partial index on `city_id`: 9.4 ms, 28 buffers (index-only); capped at 1,001: 0.57 ms, 3 buffers; estimate 29,064. Whole table: 59 ms (parallel index-only scan) versus `reltuples` 500,000 | P-21 |
| L-9 | Deleting 20 listings with cascading children, no child indexes | 4,481 ms (`Trigger for constraint price_history_listing_id_fkey: time=3690.478 calls=20`, photos 790.5 ms). With indexes on both child columns: 1.25 ms (triggers 0.63 and 0.46 ms). Plan tree alone: 0.24 ms in both | P-9 |
| L-10 | HOT, crawler touching `last_seen_at` on 74,572 active rows, three passes | fillfactor 100, no index on it: 0 % HOT, 48 / 45 / 42 MB WAL, 3.4 / 3.5 / 2.7 s. Fillfactor 90, no index: 67 / 71 / 74 % HOT, 18 / 18 / 17 MB, 1.1 / 1.0 / 1.0 s. Fillfactor 90 plus index on it: 0 % HOT, 49 / 45 / 41 MB, 3.6 / 4.7 / 3.4 s; indexes 71 → 87 MB | P-11 |
| L-11 | Planner statistics | `make_id = 2 AND model_id = 7`: estimate 646, actual 8,182; after `CREATE STATISTICS (dependencies, ndistinct, mcv)`: 7,783. Join with price history 85 → 67 ms. `model_year <= 1390 AND mileage_km < 60000`: estimate 51,120, actual 0, unchanged by extended statistics | P-14 |
| L-12 | BRIN versus B-tree on `price_history.observed_at` (correlation 1.0) | Size 24 kB versus 48 MB; one-week range (29,225 rows): 6.4 ms (256 lossy heap blocks) versus 6.2 ms | P-8 |
| L-13 | Sargability | `first_seen_at::date = …`: 66 ms, 1,370 buffers; half-open range: 0.14 ms, 7 buffers. `price_toman / 1000000 BETWEEN …`: 49.7 ms (full index read) | P-7 |
| L-14 | Unused and duplicate indexes after L-7 | Never scanned: the original covering index (27 MB, bloated by L-4's updates; the planner used its fresh 15 MB duplicate), `last_seen_at` (9.5 MB), a redundant key-only index, and the photo foreign-key index (needed for deletes). The wiki query flagged the exact duplicate pair (42 MB) | P-12 |
| L-15 | Pool size, 2-CPU server, short reads, two runs | Clients 1 / 2 / 4 / 8 / 16 / 32 / 64: 1,360-1,461 / 2,398-2,427 / 2,240-2,787 / 2,114-2,125 / 1,981-2,034 / 1,967-2,373 / 2,203-2,224 transactions per second; mean latency 0.7 / 0.8 / 1.4-1.8 / 3.8 / 7.9-8.1 / 13.5-16.3 / 28.8-29.0 ms. 128 clients: `FATAL: sorry, too many clients already` | P-29 |
| L-16 | `SELECT *` on a table with 2 KB TOASTed vectors, 1,003 rows | Needed columns: 3.3 ms, 16 kB. `SELECT *`: `EXPLAIN ANALYZE` 2.6 ms; with `SERIALIZE` 29 ms, 4.7 MB, 3,035 extra buffers | P-23 |
| L-17 | Vector storage and exact search, 50,000 × 512, one core | `vector(512)`: heap 3 MB + TOAST 130 MB, exact 354-385 ms per query (156 ms in a later warm run on "lowrank"). `STORAGE PLAIN`: heap 130 MB, 79 ms. `halfvec(512)`: 56 MB, 58 ms, recall 0.998 | P-36 |
| L-18 | HNSW build, "lowrank", defaults | `maintenance_work_mem` 64 MB, serial: 190 s, NOTICE at 24,269 tuples. 1 GB serial: 57 s. 1 GB "2 workers" on the TOASTed table: 53 s (no workers actually launched; heap too small). Inline table: 60 s serial, 53 s with 2 workers. `halfvec` table: 39 s, 65 MB. Index size 130 MB. "iso" with `m = 32, ef_construction = 128`: 221 s, same size | P-38 |
| L-19 | Recall@10 and mean latency, 100 queries | "lowrank" HNSW: ef 40 0.870 / 1.15 ms; ef 100 0.978 / 2.51 ms; ef 200 0.999 / 4.70 ms. `halfvec` index: 0.859 / 1.12 ms, 0.979 / 2.00 ms. Binary quantisation (18 MB, 20 s build): alone 0.510 / 1.55 ms; re-rank top 100: 0.913 / 2.18 ms; top 200: 0.976 / 4.18 ms. IVFFlat (lists 50, 1.9 s build, 130 MB): probes 1 0.214 / 0.72 ms; 7 0.698 / 4.50 ms; 20 0.951 / 11.6 ms. "iso" HNSW: 0.077, 0.173, 0.300, 0.483 at ef 40, 100, 200, 400 (10.3 ms). Near-copies in "iso" ranked first: 87 / 100 at ef 40, 99 / 100 at ef 100 | P-37, P-39, P-41 |
| L-20 | Filtered similarity, 2 % filter, 10 wanted | ef 40, iterative off: 0.9 rows, recall 0.090, 1.6 ms. ef 200 off: 4.2 rows, 0.419, 5.4 ms. `strict_order`: 10 rows, 0.882, 13.4 ms. `relaxed_order`: 10 rows, 0.984, 12.9 ms. B-tree then exact (planner's choice): 10 rows, 1.000, 5.0 ms | P-40 |
| L-21 | Hamming search over 500,000 64-bit hashes, 100 copies with 0 to 6 flipped bits | Seq scan `bit_count(xor)`: 44 ms, 3,198 buffers, 100 / 100. Four 16-bit chunks + one-bit probes (B-tree): 0.79 ms mean, 60 MB, 100 / 100. Eight 8-bit chunks (index-only): 1.9 ms, 121 MB. HNSW on `bit(64)`: 191 s build, 148 MB, 92 / 100 at 1.11 ms (ef 40), 100 / 100 at 5.67 ms (ef 200) | P-45 |
| L-22 | Docker shared memory | Default 64 MB `/dev/shm`, 1 GB `maintenance_work_mem`, 2 workers, inline vectors: `ERROR: could not resize shared memory segment … to 1070632384 bytes: No space left on device`. TOASTed vectors: built serially in 44 s without error | P-34 |
| L-23 | Other checks | `auto_explain` logged a 25 ms plan with buffers (`19b-autoexplain.txt`). Generic plans: under `auto` the skewed `model_id` statement stayed on custom plans after 7 runs. `pg_test_timing`: 23 ns per clock read. node-postgres 8.23 returns `int8` and `numeric` as strings, `real` as a number | P-15, P-17, P-26, P-46 |

Two plan excerpts that carry the argument:

```text
-- L-9, before the child indexes (plan tree fast, cost in the triggers)
 Delete on listings (actual time=0.239..0.240 rows=0 loops=1)
 ...
 Trigger for constraint price_history_listing_id_fkey: time=3690.478 calls=20
 Trigger for constraint listing_photos_listing_id_fkey: time=790.511 calls=20
 Execution Time: 4481.365 ms

-- L-1, wrong column order: model_id is in Index Cond but does not narrow the scan
 Index Scan using listings_price_model_idx on listings (actual time=3.256..13.528 rows=412 loops=1)
   Index Cond: ((price_toman >= 500000000) AND (price_toman <= '3000000000'::bigint) AND (model_id = 150))
   Buffers: shared hit=1170
```

## Recommended pgvector setup for Carshenas

This is a proposal for the owner and for CS-11 and CS-29; the embedding model itself is chosen with CS-8 (it must run or be reachable from Iran, which favours an open-weights model on the worker's CPU; *inference*).

1. **Image and version.** `pgvector/pgvector:0.8.6-pg18` in Docker Compose with `shm_size: 1gb` and the P-32 configuration file; `CREATE EXTENSION vector;` in the first migration. Upgrade pgvector only after reading its changelog; never below 0.8.4.
2. **Start exact.** No approximate index until a user-facing query needs whole-table similarity or an unfiltered exact scan passes about 100 ms. Duplicate detection filters first by make, model and year (B-tree), then sorts exactly (lab: recall 1.00 in 5 ms per 1,000-row block).
3. **Schema.** A narrow side table, one row per listing, kind and model:

   ```sql
   CREATE TABLE listing_embeddings (
     listing_id  bigint      NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
     kind        text        NOT NULL CHECK (kind IN ('text', 'image')),
     model       text        NOT NULL,             -- name and version, e.g. 'e5-base@2026-10'
     embedding   halfvec(768) NOT NULL,            -- 768 × 2 bytes ≈ 1.5 kB: stays inline
     created_at  timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (listing_id, kind, model)
   );
   -- only if the model has more than about 1,000 dimensions:
   -- ALTER TABLE listing_embeddings ALTER COLUMN embedding SET STORAGE PLAIN;
   ```

   The primary key starts with `listing_id`, so it also serves the cascade from `listings` (P-9). Dimensions: at most about 1,024 (index limit for `halfvec` is 4,000, but memory and TOAST favour smaller).
4. **Duplicate candidates (exact within a block).**

   ```sql
   SELECT e.listing_id, e.embedding <=> $1::halfvec(768) AS distance
   FROM listing_embeddings e
   JOIN listings l ON l.id = e.listing_id
   WHERE l.model_id = $2
     AND l.model_year BETWEEN $3 - 1 AND $3 + 1
     AND e.kind = 'text' AND e.model = 'e5-base@2026-10'   -- literals, so partial indexes stay usable (P-5)
   ORDER BY e.embedding <=> $1::halfvec(768)
   LIMIT 20;
   ```

   Candidates are confirmed by structured fields and, for photos, by the perceptual hash (item 9); the distance threshold comes from CS-9's labelled pairs.
5. **When an approximate index is justified.** One partial HNSW index per kind and model, built after the backfill, in the worker's quiet hours:

   ```sql
   SET maintenance_work_mem = '1GB';          -- at least the index size; ≤ 50–60 % of RAM
   SET max_parallel_maintenance_workers = 2;
   CREATE INDEX CONCURRENTLY listing_embeddings_text_e5_hnsw
     ON listing_embeddings USING hnsw (embedding halfvec_cosine_ops)
     WHERE kind = 'text' AND model = 'e5-base@2026-10';
   ```

   Defaults `m = 16`, `ef_construction = 64`. Size estimate about 1.3 kB per row for 512-dimensional `halfvec` (lab), so about 2 kB per row at 768 dimensions: 300,000 listings ≈ 600 MB, which fits an 8 GB VPS and strains a 4 GB one (*inference*). If it strains, use a binary-quantised expression index with re-ranking (lab: 18 MB instead of 65, recall 0.91 to 0.98 with re-ranking of 100 to 200 candidates).
6. **Query settings, per query.** In the same transaction as the query: `SET LOCAL hnsw.ef_search = 100;` and, when a `WHERE` filter is broad, `SET LOCAL hnsw.iterative_scan = 'relaxed_order';` (`hnsw.max_scan_tuples` default 20,000 is the stop). Selective filters go B-tree first and exact (P-40). If exact distance order matters after a relaxed scan, re-sort in a `MATERIALIZED` CTE.
7. **TypeScript.** `pgvector/pg`'s `registerTypes` in the pool's `onConnect`, `pgvector.toSql()` for parameters, `ORDER BY embedding <=> $1 LIMIT n` exactly (P-42); if pass B chooses Drizzle, its built-in `halfvec` column type and distance helpers.
8. **Recall as an evaluation.** A fixed set of labelled duplicate pairs and 100 sampled queries; exact results with `SET LOCAL enable_indexscan = off`; recall@10 and duplicate-pair hit rate reported with every change of model, dimension, index option or `ef_search`, and weekly in production (target ≥ 0.95, *inference*). This is an AI step under AGENTS.md, so it ships with its numbers.
9. **Photos are not embeddings.** 64-bit perceptual hash (`bigint`) per stored photo; exact Hamming search by `bit_count((phash # $1)::bit(64)) <= t` within the same model, or the four-chunk multi-index B-tree scheme when checking across all listings; `t` calibrated on labelled pairs (start near 10 bits and measure). Image embeddings only later, as a second candidate source.
10. **Hybrid text search.** If pass A keeps search in PostgreSQL, fuse the keyword leg and the vector leg with reciprocal rank fusion (`k` about 60, 50 rows per leg) in one SQL statement (P-44).
11. **Operations.** `REINDEX INDEX CONCURRENTLY` before a long vacuum on the embeddings table; a new partial index per new model, switch, then drop the old; watch the index size against RAM and `pg_statio_user_indexes` hit ratios.

## Sources consulted

All fetched on 2026-09-26 or 2026-09-27. "Docs" dates are the documentation version served on that day.

| Source (author; why credible) | URL | Date | Used in |
|---|---|---|---|
| PostgreSQL Global Development Group, PostgreSQL 18 manual (the project) | https://www.postgresql.org/docs/current/ — pages: indexes-multicolumn, indexes-types, indexes-ordering, indexes-bitmap-scans, indexes-unique, indexes-expressional, indexes-partial, indexes-index-only-scans, indexes-examine, sql-createindex, sql-reindex, ddl-constraints, using-explain, sql-explain, planner-stats, multivariate-statistics-examples, sql-createstatistics, pgstatstatements, auto-explain, runtime-config-resource, runtime-config-query, runtime-config-logging, runtime-config-statistics, runtime-config-autovacuum, runtime-config-client, runtime-config-connection, queries-with, queries-limit, sql-prepare, protocol-flow, storage-hot, storage-toast, monitoring-stats, routine-vacuuming, pgtrgm, brin, gin, hash-index, btree, functions-bitstring, functions-comparisons, jit-decision, progress-reporting, textsearch-indexes | 18 (current) | P-1 to P-17, P-20 to P-28, P-32, P-33, P-45 |
| PostgreSQL release notes 12, 16, 17, 18 | https://www.postgresql.org/docs/release/12.0/ (and 16.0, 17.0, 18.0) | 2019 to 2025 | P-2, P-11, P-15, P-16, P-25 |
| PostgreSQL 19 manual (via Context7 `/websites/postgresql_19`) | https://www.postgresql.org/docs/19/runtime-config-query.html | 19 beta | P-32 (JIT off by default) |
| PostgreSQL wiki: Number Of Database Connections; Tuning Your PostgreSQL Server; Index Maintenance; Count estimate; Don't Do This; Slow Query Questions | https://wiki.postgresql.org/wiki/Number_Of_Database_Connections and siblings | 2014-03-14; 2021-03-31; 2021-06-09; 2024-11-17; 2024-11-21 | P-7, P-12, P-21, P-29, P-32 |
| Markus Winand, Use The Index, Luke (book site; author of SQL Performance Explained) | https://use-the-index-luke.com/ — concatenated keys, ranges, functions, dates, obfuscation, top-N, fetch next page, no-offset, index-only scan, insert, update, N+1 | undated chapters; no-offset 2014-08-06, updated 2023-09-08 | P-2, P-3, P-4, P-7, P-11, P-20, P-22, P-23, P-46 |
| Andrew Kane, pgvector README and CHANGELOG (the author) | https://github.com/pgvector/pgvector | 0.8.6 released 2026-07-29 | P-13, P-32, P-34 to P-45 |
| Andrew Kane, pgvector-node README; pgvector-python examples (imagehash, hybrid_search/rrf.py) | https://github.com/pgvector/pgvector-node, https://github.com/pgvector/pgvector-python | master, 2026-09-27 | P-42, P-44, P-45 |
| pgvector project, "pgvector 0.8.0 Released!" (postgresql.org news) | https://www.postgresql.org/about/news/pgvector-080-released-2952/ | 2024-11-11 | P-35 |
| Andrew Kane, "Introducing Dexter, the Automatic Indexer for Postgres"; Dexter README | https://ankane.org/introducing-dexter, https://github.com/ankane/dexter | 2017-06-26; master | P-18 |
| HypoPG project, Usage | https://hypopg.readthedocs.io/en/rel1_stable/usage.html | stable docs | P-18 |
| Haki Benita (developer and database writer): unused index space; hash indexes; SQL tricks of an application DBA | https://hakibenita.com/postgresql-unused-index-size, …/postgresql-hash-index, …/sql-tricks-application-dba | 2021-02-01; 2021-01-11; 2020-07-27 | P-5, P-8, P-12 |
| Laurenz Albe, Cybertec (PostgreSQL contributor, consultant): foreign-key indexes; HOT updates; count(*); pagination and total count; unused indexes; autovacuum tuning | https://www.cybertec-postgresql.com/en/index-your-foreign-key/ and siblings | 2018 to 2023, updated to 2026-05-07 | P-9, P-11, P-12, P-21, P-33 |
| Michael Christofides, pgMustard (EXPLAIN tooling; PostgreSQL 18 BUFFERS-by-default advocate): glossary pages Rows Removed by Filter, Heap Fetches, Sort Method, Buffers Shared Hit, Index-Only Scan | https://www.pgmustard.com/docs/explain/… | undated | P-6, P-16, P-18 |
| Lukas Fittl, pganalyze (5mins of Postgres): benchmarking multi-column, covering and hash indexes; BRIN; index selection; Index Advisor | https://pganalyze.com/blog/5mins-postgres-benchmarking-indexes and siblings | 2022-04-01 to 2023-06-15 | P-3, P-8 |
| Nikolay Samokhvalov, Postgres.ai: EXPLAIN needs BUFFERS; pg_stat_statements how-tos parts 1 to 3 | https://postgres.ai/blog/20220106-explain-analyze-needs-buffers-to-improve-the-postgres-query-optimization-process, https://github.com/postgres-ai/postgres-howtos | 2022-01-06; 2023-10 to 2023-12 | P-1, P-15, P-16 |
| Crunchy Data: Christopher Winslett, Hybrid Search Patterns (2026-07-30), Postgres 19 advice (2026-08-18), HNSW Indexes (2023-09-01), Performance Tips (2023-05-05), Scaling Vector Data (2023-08-25); Tom Swartz, server configuration (2020-04-07) | https://www.crunchydata.com/blog/… | 2020 to 2026 | P-3, P-6, P-24, P-32, P-37, P-40 |
| Supabase docs: HNSW indexes, IVFFlat indexes, hybrid search, going to production, compute add-ons, engineering for scale | https://supabase.com/docs/guides/ai/… | page build 2026-09-26 | P-19, P-35, P-37, P-44 |
| Neon docs: pgvector extension; Optimize pgvector search | https://neon.com/docs/extensions/pgvector, https://neon.com/docs/ai/ai-vector-search-optimization | undated, current | P-37, P-38, P-39 |
| GitLab development docs: adding database indexes, foreign keys, pagination guidelines, keyset pagination, understanding EXPLAIN plans, query performance | https://docs.gitlab.com/development/database/… | current | P-1, P-9, P-12, P-16, P-19, P-20, P-21 |
| Hubert "depesz" Lubaczewski: Explaining the unexplainable, parts 1 and 6 (author of explain.depesz.com) | https://www.depesz.com/2013/04/16/explaining-the-unexplainable/, …/2021/06/20/explaining-the-unexplainable-part-6-buffers/ | 2013-04-16; 2021-06-20 | P-16 |
| explain.dalibo.com; pgMustard home | https://explain.dalibo.com/, https://www.pgmustard.com/ | current | P-18 |
| Brian Carlson, node-postgres docs: pooling, pool sizing, pg.Pool, pg.Client, queries, data types | https://node-postgres.com/ | current (types page 2023-11-19) | P-26, P-27, P-29, P-30, P-46 |
| Rasmus Porsager, postgres.js README | https://github.com/porsager/postgres | master (3.4.9 installed) | P-26, P-31 |
| PgBouncer: features; configuration | https://www.pgbouncer.org/features.html, https://www.pgbouncer.org/config.html | current | P-31 |
| Prisma docs: Next.js help (hot-reload singleton) | https://www.prisma.io/docs/orm/more/help-and-troubleshooting/nextjs-help | current (Prisma ORM 7) | P-30 |
| Neal Krawetz, The Hacker Factor Blog: Looks Like It; Kind of Like That (perceptual hashes) | https://www.hackerfactor.com/blog/index.php?/archives/432-Looks-Like-It.html, …/529-Kind-of-Like-That.html | 2011-05-26; 2013-01-21 | P-45 |
| Meta, PDQ reference implementation README | https://github.com/facebook/ThreatExchange/blob/main/pdq/README.md | 2025-11-04 | P-45 |
| Manku, Jain, Das Sarma (Google), Detecting Near-Duplicates for Web Crawling | https://research.google.com/pubs/archive/33026.pdf | WWW 2007 | P-45 |
| Context7 cross-checks: `/pgvector/pgvector` (iterative scan options), `/pgvector/pgvector-node` (type registration), `/websites/postgresql_19` (JIT default, EXPLAIN IO) | — | 2026-09-27 | P-32, P-40, P-42 |

Pages that could not be used: pgMustard's `loops` glossary page returned 404 (depesz and the manual cover loops). Material from pganalyze's "How Postgres Chooses Which Index To Use" and the GitLab keyset page was read but not quoted.
