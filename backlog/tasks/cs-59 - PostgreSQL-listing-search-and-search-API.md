---
id: CS-59
title: PostgreSQL listing search and search API
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 21:59'
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
- [ ] #1 Search in PostgreSQL supports every filter and catalogue of the shared definitions (CS-58), and sorts by best deal, price, mileage, newest listing and model year
- [ ] #2 Persian analysis normalises Arabic ي and ك, zero-width non-joiners and all digit scripts, and matches Latin-typed model names, proven by tests
- [ ] #3 The search table and the facet counts derived from it can be rebuilt from the listings with one command
- [ ] #4 Search API responses stay under 300 ms at the 95th percentile on the local dataset
- [ ] #5 Results contain only active listings of tracked models, each seen within the freshness window of ADR-0017
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
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
<!-- SECTION:NOTES:END -->
