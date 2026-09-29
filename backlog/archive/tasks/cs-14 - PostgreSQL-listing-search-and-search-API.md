---
id: CS-14
title: PostgreSQL listing search and search API
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-28 22:12'
labels:
  - search
  - backend
milestone: m-5
dependencies: []
references:
  - .claude/skills/ui-design/references/listing-patterns.md
  - docs/decisions/0007-data-search-and-ingestion-stack.md
  - docs/decisions/0011-postgresql-for-records-search-vectors-and-jobs.md
  - docs/research/2026-09-27-postgresql-only-data-stack.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Buyers search in Persian with typos, Latin-typed model names and filters, and results rank by deal and freshness. Search runs in PostgreSQL itself (ADR-0011): a Persian normaliser feeding a generated tsvector, an alias table, pg_trgm for typos, sorts served by composite indexes that lead with the equality column, keyset pagination, and facets that are precomputed, cached or sampled instead of counted live for broad queries. A search engine is added only when a measured trigger in docs/research/2026-09-27-postgresql-only-data-stack.md fires. The database skill's references/search.md has the design.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Search in PostgreSQL supports the filters in the listing-patterns reference and sorts by best deal, price, mileage, newest listing and model year
- [ ] #2 Persian analysis normalises Arabic ي and ك, zero-width non-joiners and all digit scripts, and matches Latin-typed model names, proven by tests
- [ ] #3 The search table and the facet counts derived from it can be rebuilt from the listings with one command
- [ ] #4 Search API responses stay under 300 ms at the 95th percentile on the local dataset
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-4 (2026-09-27): criteria reworded for ADR-0011 (search in PostgreSQL; the old criteria named an Elasticsearch index), same scope. Recommendations from the research, not criteria unless the owner adds them: record EXPLAIN (ANALYZE, BUFFERS) for each sort; measure p95 with facets included on a dataset of production size (the lab: 300,000 listings p95 92 ms, 1,000,000 p95 116 ms with sampled facets); evaluate typo and alias matching on a labelled query set, which trigger 6 for adding a search engine needs; precompute landing, make and model facets after each crawl batch and cache repeated ones.

Renumbered on 2026-09-29: continued as CS-59, in the order of work (backlog/docs, doc-1).
<!-- SECTION:NOTES:END -->
