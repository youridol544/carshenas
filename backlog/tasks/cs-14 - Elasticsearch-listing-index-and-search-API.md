---
id: CS-14
title: Elasticsearch listing index and search API
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
labels:
  - search
  - backend
milestone: m-5
dependencies:
  - CS-12
references:
  - .claude/skills/ui-design/references/listing-patterns.md
  - docs/decisions/0007-data-search-and-ingestion-stack.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Buyers search in Persian with typos, Latin-typed model names and filters, and results rank by deal and freshness. The index is derived from PostgreSQL and can be rebuilt at any time (ADR-0007).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An index built from PostgreSQL supports the filters in the listing-patterns reference and sorts by best deal, price, mileage, newest listing and model year
- [ ] #2 Persian analysis normalises Arabic ي and ك, zero-width non-joiners and all digit scripts, and matches Latin-typed model names, proven by tests
- [ ] #3 The index can be rebuilt from scratch with one command
- [ ] #4 Search API responses stay under 300 ms at the 95th percentile on the local dataset
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
