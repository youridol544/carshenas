---
id: CS-59
title: PostgreSQL listing search and search API
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-02 17:07'
labels:
  - search
  - backend
milestone: m-5
dependencies:
  - CS-51
  - CS-58
references:
  - .claude/skills/ui-design/references/listing-patterns.md
  - docs/decisions/0007-data-search-and-ingestion-stack.md
  - docs/decisions/0011-postgresql-for-records-search-vectors-and-jobs.md
  - docs/research/2026-09-27-postgresql-only-data-stack.md
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
priority: high
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Buyers search in Persian with typos, Latin-typed model names and filters, and results rank by deal and freshness. Search runs in PostgreSQL itself (ADR-0011): a Persian normaliser feeding a generated tsvector, an alias table, pg_trgm for typos, sorts served by composite indexes that lead with the equality column, keyset pagination, and facets that are precomputed, cached or sampled instead of counted live for broad queries. A search engine is added only when a measured trigger in docs/research/2026-09-27-postgresql-only-data-stack.md fires. The database skill's references/search.md has the design.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Search in PostgreSQL supports every filter and catalogue of the shared definitions (CS-58), and sorts by best deal, price, mileage, newest listing and model year
- [x] #2 Persian analysis normalises Arabic ي and ك, zero-width non-joiners and all digit scripts, and matches Latin-typed model names, proven by tests
- [x] #3 The search table and the facet counts derived from it can be rebuilt from the listings with one command
- [x] #4 Search API responses stay under 300 ms at the 95th percentile on the local dataset
- [x] #5 Results contain only active listings whose details have been read, each seen within the freshness window of ADR-0017
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Migrations: search_normalize (fa_normalize plus NFKC, alef/heh folds, harakat and bidi marks removed, letters split from digits), the fa_search text configuration, the search_word typo vocabulary and search_tsquery (every word required, prefixes except numbers, an unknown word OR-ed with its closest vocabulary word by levenshtein); search_document (listing_filter_row columns for searchable listings plus km_per_year, valued_on, cover photo, search_text and a generated tsvector), one B-tree per order with its NULLS placement, a GIN; search_facet_count; search_document_stale with statement-level triggers on listing, listing_photo, extraction_field and valuation_run.
2. packages/search/src/document.ts: one statement builds the rows of a set of listings or all, writing only changed rows and removing unsearchable ones (inactive, private source, untracked model, not seen for 48 hours); facet counts (options, catalogues, total) and the vocabulary refreshed after it.
3. Worker: search.refresh every minute drains the marks; search.rebuild nightly and pnpm search:rebuild rebuild every row (criterion 3).
4. Keyset pagination helper in sql.ts for every order (mixed directions and NULLS LAST spelled out), tested against a comparator.
5. Web search API: features/search/server/search-queries.ts (results page with DTOs, total exact or estimated, facets live or precomputed, options from search_facet_count) and GET /api/search for client paging; search logged without personal data.
6. Measure: EXPLAIN (ANALYZE, BUFFERS) for every order, catalogue (LIMIT trap on karshenas-pick), text query and count; add equality-first composites only where a plan needs them; p95 of the API over a query mix on a production build (criterion 4).
7. Tests: normalisation and Latin names (criterion 2), every filter and catalogue on search_document (criterion 1), triggers and refresh, keyset, freshness and tracked-model rules (criterion 5). Docs: data-model.md, ADR for the freshness mechanism and search API, runbook.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-4 (2026-09-27): criteria reworded for ADR-0011 (search in PostgreSQL; the old criteria named an Elasticsearch index), same scope. Recommendations from the research, not criteria unless the owner adds them: record EXPLAIN (ANALYZE, BUFFERS) for each sort; measure p95 with facets included on a dataset of production size (the lab: 300,000 listings p95 92 ms, 1,000,000 p95 116 ms with sampled facets); evaluate typo and alias matching on a labelled query set, which trigger 6 for adding a search engine needs; precompute landing, make and model facets after each crawl batch and cache repeated ones.

2026-09-28: ranking is multi-stage, as Torob's careers page names it («رتبه‌بندی چندمرحله‌ای»): filters select the candidates, the deal score orders them, and freshness and duplicate groups adjust the order. Once CS-55 forms groups, a group appears once, with its cheapest listing first. Log each search (query, filters, result count, no personal data) so CS-62's labelled queries and the demand shown in the superadmin section (CS-53) come from real use.

Renumbered on 2026-09-29: this task was CS-14 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-14; the archived CS-14 points here.

Decisions (owner delegated every decision on 2026-09-30; ADR-0028 accepted by delegation):
- Freshness mechanism: statement-level triggers (SECURITY DEFINER, pinned search_path) on listing (insert; update of any value), listing_photo (insert, update, delete of listings that still exist), extraction_field (insert; the table is append-only) and valuation_run (becoming succeeded marks every active listing) write search_document_stale; search.refresh every minute takes marks in batches of 10,000 (FOR UPDATE SKIP LOCKED) and rebuilds their rows in the same transaction; search.rebuild nightly at 04:30 and pnpm search:rebuild rebuild every row. Options: refresh after each writer (every future writer must remember it), a materialized view (recomputes everything, cannot drop rows ageing past 48 h), a shadow swap (the worker does not own the table; not needed at 23k rows). Measured: trigger overhead 0.63 s on an update of all 23,360 listings (1.22 to 1.85 s); draining 23,476 unchanged marks 0.9 s; a rebuild that changes nothing 0.6 to 0.8 s; from empty 4.5 s.
- One build statement for any scope: rows that are new or differ are written, unsearchable ones removed (inactive, private source, untracked model, not seen for 48 h: the last whatever the scope). ON CONFLICT with a WHERE locked every unchanged row (3.0 s): the rows that differ are compared first (0.8 s).
- search_text stored as written; text_vector is generated with search_normalize, so only written rows are normalised (normalising 23k rows cost 2.6 s).
- Tracked models: resolved each build from TRACKED_MODELS through catalogue_source_key (level model); a listing without a model is not searchable. Freshness: 48 hours (ADR-0017 point 6), in the build and as a condition on every read.
- Text: search_normalize (fa_normalize after NFKC; alef and heh forms, harakat, bidi marks, letters split from digits), fa_search (copy of simple), search_word vocabulary with fuzzystrmatch levenshtein correction, and document expansion with the catalogue English names and non-rejected aliases instead of ts_rewrite. Every word required, prefixes except numbers.
- Counts: search_facet_count holds the total, each catalogue and each option of the seven row-backed filters, recounted by every build (catalogue counts move with the clock). A search that is everything or an unchanged catalogue reads them; others count exactly up to 50,000. Facets of a filtered search are counted live, each without its own filter (22 ms for the seven over model peugeot.206).
- API: features/search/server/search-queries.ts for Server Components (searchListings, readSearchFacets, readFilterOptionCounts, readCatalogueCounts) and GET /api/search with the page URL parameters plus cursor, limit (1 to 48) and facets=1, for what a page asks after rendering. Opaque keyset cursor (order, the last row sort values as text, listing id); searchAfter in @carshenas/search/sql spells out each term for mixed directions and NULLS LAST. Each search logged (words with digit runs of 7+ masked, filter names, order, catalogue, count, duration; no person).
- Indexes: one per order with its NULLS placement (price ascending and descending separately), a GIN, and city_key with the default order (karaj 5.4 to 0.12 ms). Model and make composites measured unused while every searchable model has 1,200+ listings, so left out. The worker holds MAINTAIN and analyses after a build that changed 1,000+ rows (without statistics «پژو» was estimated at 76 rows and took 15 ms instead of 0.4 ms).
- Schema test changes: a single bigint primary key that is also a foreign key (a row extending another) need not be an identity; indexes that differ only in direction are not duplicates (indoption). PGlite loads fuzzystrmatch.

Measured (lane, 23,360 listings, 2026-10-01): every page query, catalogue, text query and keyset page under 9 ms (docs/evidence/search-api/2026-10-01/plans.txt); karshenas-pick (98 matches) 7.4 ms by a seq scan, not the LIMIT trap; API p95 33.8 ms with one client and 223.7 ms with eight on a production build (load-results.md). The view previously took 2 to 55 ms per catalogue.

Found: only 3,008 of 23,360 listings have a city (the others were never read in detail), so a city filter keeps only those; the top best deal on the lane has 109 km for a 1397 car (a data problem for CS-51/CS-34, not search).

Validation (2026-10-01): pnpm check passed (lint, Squawk, typecheck, unit tests incl. cursor.test.ts, schema tests with the two refined checks, formatting). Search integration tests on a scratch database: packages/search 101 pass (document.db.test.ts: every filter case and catalogue keeps on search_document what it keeps on the view; every order paged by keyset in pages of 1 and 7 equals one read; normalisation of Arabic yeh and kaf, ZWNJ, Persian, Arabic-Indic and Latin digits, letters run into digits; Latin English names, curated aliases, case and prefixes; typo correction; sold, aged out, untracked and private-source rows removed; only changed rows written); apps/worker search.db.test.ts 4 pass (triggers mark, refresh and rebuild as the worker role, schedules). EXPLAIN plans in docs/evidence/search-api/2026-10-01/plans.txt; load in load-results.md. pnpm search:rebuild on the lane: 23,360 rows from empty in 4.5 s, 0.6 s when nothing changed.

pnpm db:check passed on 2026-10-01 after the last commit: replay up, down, up; schema and type drift; web, worker (search.db.test.ts 4), accounts and search (101) integration tests.

Criterion 5 reworded on 2026-10-02 (coordinator, from the database review): it said "only active listings of tracked models". The tracked list lives in code, a code list leaking into a derived table is fragile (an empty list deleted every row), and a listing's details are only read for tracked models or pasted links anyway, so "details read" (price_type is set) is the condition, and it is the one a result card needs: on main 74 % of the active listings are bare list rows with no title, year, price, mileage, city or photo, so they cannot be shown as cards or rated. They enter the table by themselves when their details are read (a trigger marks them). The listings a crawl sees and the share searchable are both counted for a data-status page (search_facet_count, facet seen and total).

Review round (2026-10-02, database-reviewer and task-reviewer lists, all twelve and nine items): done in 6c40c36, dde3a5d and fef87f6. Validation after the last commit: pnpm check and pnpm db:check pass (web 65, worker, accounts and search integration tests: search package keyset depth over 12,000 rows, facets equivalence, typo rules, build lock and in-flight writers). Evidence: docs/evidence/search-api/2026-10-02/README.md. Lane table rebuilt with pnpm search:rebuild: 3,008 searchable rows of 23,360 active listings (the details-read ones).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
search_document holds one row per searchable listing (active, public source, details read, seen within 48 hours), kept fresh by append-only marks from triggers and a minute refresh that never blocks a writer, rebuilt in id ranges by search.rebuild and pnpm search:rebuild, with counts, vocabulary and build events recorded so a failed part is repaired. Persian search, keyset pages (branches per index range, cursors validated per column type), count-only and capped totals, shared-scan facets, indexes for rare filters, a tight typo fallback that reports its corrections. Verified by pnpm check, pnpm db:check, EXPLAIN evidence and load runs (lane p95 52 ms with one client, 160 ms with eight).
<!-- SECTION:FINAL_SUMMARY:END -->
