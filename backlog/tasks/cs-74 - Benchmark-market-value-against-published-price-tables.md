---
id: CS-74
title: Benchmark market value against published price tables
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 20:09'
labels:
  - eval
  - research
milestone: m-4
dependencies:
  - CS-51
references:
  - docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md
priority: medium
ordinal: 43000
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

Renumbered on 2026-09-29: this task was CS-13 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-13; the archived CS-13 points here.

Owner, 2026-09-30: skipped for now in the CS-58 to CS-75 run (CS-60: no Arvan storage, pages use Divar image addresses directly; CS-74: no other sources than Divar; CS-75: no video or submission yet).
<!-- SECTION:NOTES:END -->
