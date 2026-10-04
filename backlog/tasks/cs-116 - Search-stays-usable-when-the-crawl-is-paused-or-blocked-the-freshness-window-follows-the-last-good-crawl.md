---
id: CS-116
title: >-
  Search stays usable when the crawl is paused or blocked: the freshness window
  follows the last good crawl
status: To Do
assignee: []
created_date: '2026-10-04 09:29'
labels:
  - backend
  - frontend
dependencies: []
priority: high
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Search only shows listings seen in the last 48 hours (ADR-0028). When the crawl is paused, blocked, or the machine is off for two days, search empties: on 2026-10-03 the searchable listings fell from 5,978 to 3,861 after a pause. A reviewer opens the link days after it was sent, so one blocked crawl must not empty the product. The window should follow the source’s last good read, not the clock, and the pages should say honestly how old the data is.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The freshness window is measured from the last time the source was read successfully (its newest completed sweep or list read) instead of the clock: listings seen within 48 hours of that moment stay searchable while the source is paused, stopped on a block or its worker is down, and the window returns to the clock when the crawl runs normally
- [ ] #2 Search, the home page and the listing page say when the data was last refreshed in one quiet line (Jalali date and time) when it is older than a few hours, and a listing’s own last-checked time stays true; no page implies fresh data while the crawl is stopped
- [ ] #3 Valuation keeps running on what is searchable and every rating or market value shown from older data keeps its date; the superadmin’s sources screen shows the age of the data and which of the two windows (clock or last good crawl) is in force
- [ ] #4 The refresh path of the search table handles the changed rule without rewriting the table each minute, the changed queries are measured with EXPLAIN (ANALYZE, BUFFERS), and the rule is covered by database tests (paused source, stopped source, running source, boundary at 48 hours); a new ADR revises ADR-0028
- [ ] #5 Copy follows the product voice guide (CS-104); checks are typecheck and unit and database tests of the changed files; no end-to-end run is needed per change
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
