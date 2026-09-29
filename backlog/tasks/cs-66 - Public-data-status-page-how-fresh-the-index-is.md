---
id: CS-66
title: 'Public data-status page: how fresh the index is'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - frontend
  - backend
milestone: m-5
dependencies:
  - CS-35
  - CS-3
references:
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
  - docs/product/challenge.md
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Torob's careers page names price freshness («تازگی قیمت») among the three things every search is about, and price validity («اعتبار قیمت»: fresh, valid and reliable) among the ten problems behind a search. Carshenas shows its own freshness in Farsi, the way a status page shows uptime: which sources are being read, when each was last read, how many listings are active, new and gone, and how old the market values are. The same numbers are the demo's evidence that the index is live (ADR-0017 point 6). A paused or blocked source is shown as not being updated, without technical detail.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Farsi page shows, per source and for the whole index, the last successful read, active listings, new and gone listings in the last 24 hours, the median age of the last check of listings shown on results pages, and the date of the market values
- [ ] #2 A paused or blocked source is shown as not being updated, with the date of its latest data
- [ ] #3 Every number comes from the database, and the page answers within the search API's latency target
- [ ] #4 Playwright tests cover the page on phone and desktop with the RTL, overflow and axe checks, and it is added to `e2e/fixtures/app-pages.ts`
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
