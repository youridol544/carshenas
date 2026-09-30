---
id: CS-55
title: Cross-site duplicate detection
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 07:59'
labels:
  - ai
  - backend
milestone: m-3
dependencies:
  - CS-54
  - CS-50
references:
  - docs/decisions/0008-crawl-only-what-sources-allow.md
priority: high
ordinal: 24000
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
From CS-28 (owner, 2026-09-27; ADR-0010): photo similarity uses our stored copies in ArvanCloud Object Storage (CS-60), which exist only for sources whose terms allow downloading photos.

CS-4 (2026-09-27): the tables are planned in docs/design/data-model.md (vehicle with merge tombstones, listing_pair with its evidence, append-only pair_decision where a human verdict outranks a machine one, vehicle_membership as tstzrange history with an exclusion constraint, listing_contact_hash). Vectors stay in PostgreSQL (ADR-0011): halfvec side tables, exact search inside a block first, HNSW only when measured; photos are compared first by a 64-bit perceptual hash stored as bigint. The database skill's references/vectors.md has the configuration.

2026-09-28: no longer waits for CS-60. Photo similarity (criterion 2) applies only if CS-60 ends with stored photos; until then pairs are scored on text and attributes. Once groups exist, the valuation (CS-51) leaves duplicates out of the comparables, and search shows each group once (CS-59).

2026-09-28, from the field survey: no entry follows one car over time. Include same-source reposts as candidate pairs, so that a car re-posted under a new token joins its vehicle, and its days on market and price history continue across reposts and sites. Capot linked 1,058 cross-site pairs conservatively; report precision first.

2026-09-28, a risk from the field survey: khodrobin says cross-site duplicates are rare, and Capot linked 1,058 among about 22,800 listings, roughly 5 %. Measure the cross-posting rate between Divar and Bama on the tracked models first. If «ارزان‌تر در ...» proves rare, the demo leads with one car's price history across reposts, which needs the same groups, and shows cross-site groups where they exist.

Renumbered on 2026-09-29: this task was CS-11 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-11; the archived CS-11 points here.

2026-09-30 (ADR-0025): photos are never downloaded or stored, so there are no stored copies to compare. Photo similarity would need a download that keeps only the perceptual hash, paced as a request to the source's photo host (ADR-0008 point 5): decide here whether that is worth its requests, or match on text, attributes and phone hashes alone. Each listing's photo addresses are in listing_photo (CS-34).
<!-- SECTION:NOTES:END -->
