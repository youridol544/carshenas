---
id: CS-35
title: >-
  Keep listings fresh: inventory sweeps, lifecycle and re-checks within a daily
  request budget
status: To Do
assignee: []
created_date: '2026-09-28 22:11'
labels:
  - crawler
  - backend
milestone: m-2
dependencies:
  - CS-33
references:
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
  - docs/research/2026-09-28-listing-data-and-freshness.md
  - docs/design/data-model.md
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0017 (2026-09-28): Carshenas keeps a live index, not a crawled sample, because a deal rating is only true of a car that is still for sale at the price shown, and Torob names price freshness («تازگی قیمت») as one of the three things every search is about. CS-33 brings new listings in; this task keeps the index current without reading every listing every day. At ADR-0008's floor of one request per three seconds, a host allows at most 28,800 requests a day, while one list page returns about 25 listings, so list pages carry the whole market and detail requests are spent only where they change what a buyer sees. Listings leave the market (sold, expired, gone) and must stop appearing; prices change and must become price events; freshness is measured and shown, not assumed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A daily sweep reads every Divar Tehran car listing from list pages only, refreshes when each was last seen, and records each model's count of active listings
- [ ] #2 A listing missing from a complete sweep is re-checked with one detail request and marked sold, expired or gone accordingly, and a listing past the source's own expiry is marked expired without any request
- [ ] #3 A price change seen in a list row or a detail becomes one price event, and a re-check that finds nothing changed stores no new snapshot
- [ ] #4 Each source has a configured daily request budget, spent in the priority order ADR-0017 sets, and each run reports what it spent on what
- [ ] #5 A re-check can be requested for one listing, as the listing page does when it is opened (CS-64); it goes through the same per-host queue and floor, and is skipped while the last check is younger than the freshness window
- [ ] #6 Freshness is measured per source and per tracked model: time from posting to first sighting, age of the last check of listings shown on results pages, and new and gone listings per day
- [ ] #7 Tests against a local stub prove the lifecycle transitions and the budget, and that no request bypasses the per-host floor
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
