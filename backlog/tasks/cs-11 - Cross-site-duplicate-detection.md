---
id: CS-11
title: Cross-site duplicate detection
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 06:29'
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
- [ ] #4 Phone numbers, if used at all, are stored only as keyed HMAC-SHA-256 hashes with a key version, never plain or salted (ADR-0008 point 7, ADR-0013)
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

CS-4 (2026-09-27): the tables are planned in docs/design/data-model.md (vehicle with merge tombstones, listing_pair with its evidence, append-only pair_decision where a human verdict outranks a machine one, vehicle_membership as tstzrange history with an exclusion constraint, listing_contact_hash). Vectors stay in PostgreSQL (ADR-0011): halfvec side tables, exact search inside a block first, HNSW only when measured; photos are compared first by a 64-bit perceptual hash stored as bigint. The database skill's references/vectors.md has the configuration.
<!-- SECTION:NOTES:END -->
