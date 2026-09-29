---
id: CS-13
title: Benchmark market value against published price tables
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-28 22:12'
labels:
  - eval
  - research
milestone: m-4
dependencies: []
references:
  - docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md
priority: medium
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hamrah Mechanic, Karnameh and Bama publish their own daily price estimates. Agreement with them is independent evidence that our market value is sane; they are a check, not a training signal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 For the covered models, our market values are compared with at least one published price table on the same date
- [ ] #2 The comparison reports median absolute percentage error per model and lists the largest disagreements with a likely reason
- [ ] #3 The comparison respects ADR-0008: Hamrah Mechanic's price table only, and no disallowed paths
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-5 (2026-09-28): Hamrah Mechanic's terms of use were outside CS-5. Read and record them, with its robots.txt, before its price table is fetched (ADR-0008 point 1).

Renumbered on 2026-09-29: continued as CS-74, in the order of work (backlog/docs, doc-1).
<!-- SECTION:NOTES:END -->
