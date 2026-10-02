---
id: CS-89
title: >-
  Search facets of a broad filter: cache or sample them past 30,000 matching
  rows
status: To Do
assignee: []
created_date: '2026-10-02 17:28'
labels:
  - search
  - backend
milestone: m-5
dependencies: []
priority: low
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-59 measured facets of a broad filter at about 2 microseconds per matching row (75 to 194 ms at 100,000 synthetic listings), so the API p95 is 316 ms with one client and 554 ms with eight there (docs/evidence/search-api/2026-10-02/load-results.md; ADR-0028 Consequences). Not reached on the local dataset (3,008 searchable rows, about 6,000 later). Trigger: searchable rows above about 30,000, or a measured p95 over 300 ms. Cache facets per search (key without the words) or sample them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With 100,000 searchable listings the search API p95 stays under 300 ms with eight clients, facets included
- [ ] #2 Facet counts shown for a cached or sampled search are marked as approximate where they differ from exact
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
