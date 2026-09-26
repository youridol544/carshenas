---
id: CS-11
title: Cross-site duplicate detection
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-26 21:16'
labels:
  - ai
  - backend
milestone: m-3
dependencies:
  - CS-10
  - CS-7
  - CS-29
references:
  - docs/decisions/0008-crawl-only-what-sources-allow.md
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Sellers post the same car on several sites. Buyers should see it once, with the cheapest listing first and every other place it is listed: Torob's list of sellers applied to cars.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Candidate pairs are generated only within the same trim, year band, city and mileage band
- [ ] #2 Pairs are scored with text similarity and, where the source allows images, photo similarity; borderline pairs are decided by the LLM with the reason stored
- [ ] #3 Precision and recall are measured on a hand-labelled set of pairs, with precision of at least 95 % or the gap explained
- [ ] #4 Phone numbers, if used at all, are stored only as salted hashes (ADR-0008)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-28 (owner, 2026-09-27; ADR-0010): photo similarity uses our stored copies in ArvanCloud Object Storage (CS-29), which exist only for sources whose terms allow downloading photos.
<!-- SECTION:NOTES:END -->
