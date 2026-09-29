---
id: CS-10
title: 'Canonical make, model and trim catalogue and name matching'
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-28 22:12'
labels:
  - ai
  - backend
milestone: m-3
dependencies: []
references:
  - docs/product/glossary.md
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The same car is written «۲۰۶ تیپ ۲», «206 T2» and «پژو ۲۰۶ تیپ دو». Comparables, duplicate detection and model pages all need one canonical trim, which is Torob's own 'same product under different names' problem.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A catalogue of makes, models and trims covers the models crawled in m-2, with aliases in Persian, in Latin letters and with spelled-out numbers
- [ ] #2 Every extracted listing maps to a canonical trim or to an explicit 'unmatched' state that is reported, never guessed
- [ ] #3 Matching accuracy is measured on the CS-9 set and reported
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Renumbered on 2026-09-29: continued as CS-50, in the order of work (backlog/docs, doc-1).
<!-- SECTION:NOTES:END -->
