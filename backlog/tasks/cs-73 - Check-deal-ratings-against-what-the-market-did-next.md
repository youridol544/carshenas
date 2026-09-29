---
id: CS-73
title: Check deal ratings against what the market did next
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - eval
  - backend
milestone: m-4
dependencies:
  - CS-51
  - CS-35
references:
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
  - docs/research/2026-09-28-listing-data-and-freshness.md
priority: medium
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A deal rating claims that a price is good or bad, and the market answers within days: well-priced cars should leave the market sooner. Only a live index can watch that (ADR-0017), and it is evidence no hand label can fake. It complements the held-out error of CS-51, which checks the market value rather than the rating. Leaving the market is not always a sale: on Divar a listing also leaves when it expires or its seller removes it, so the report says which departures it counts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Time to leaving the market is compared across the five ratings, for listings rated when first seen, with a survival curve per rating that counts the listings still on the market
- [ ] #2 The report states whether better ratings left sooner, with the number of listings per rating, the rating version and the period covered
- [ ] #3 One command re-runs the comparison, and its latest report is kept in the repository
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
