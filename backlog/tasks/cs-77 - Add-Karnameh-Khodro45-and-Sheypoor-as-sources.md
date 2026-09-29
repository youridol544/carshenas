---
id: CS-77
title: 'Add Karnameh, Khodro45 and Sheypoor as sources'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - crawler
  - backend
milestone: m-7
dependencies:
  - CS-54
  - CS-35
references:
  - docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md
  - docs/decisions/0008-crawl-only-what-sources-allow.md
priority: low
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split from CS-54 on 2026-09-28 (ADR-0017): two sources, Divar and Bama, are enough to show cross-site duplicates and «ارزان‌تر در ...» in the demo, and every further source is crawler upkeep with less value for the submission. Karnameh and Khodro45 are inspection platforms, so their listings can carry inspection results, a condition signal worth having after the demo. Their robots.txt and terms were recorded on 2026-09-28 (CS-5), and they are crawled under ADR-0008 as accepted.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Karnameh, Khodro45 and Sheypoor listings of the tracked models in Tehran are read with the same discovery, sweep, lifecycle and budget as Divar and Bama
- [ ] #2 Each source's policy check is recorded before its first crawl, from a reading no older than 30 days (ADR-0008 point 1)
- [ ] #3 Inspection results that Karnameh or Khodro45 listings carry are stored as condition facts with their source
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Carried over from CS-54 (2026-09-28): Karnameh's photo folder `/pictures/car-posts` stays unread while ADR-0010 allows no photos (CS-60); Khodro45's listings are found through its sitemap, and whether to keep away from its filter and `_rsc` URLs, which robots.txt disallows but ADR-0008 no longer requires, is a design choice to settle when this task starts; Sheypoor publishes no terms, so re-read its footer before crawling.
<!-- SECTION:NOTES:END -->
