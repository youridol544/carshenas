---
id: CS-94
title: 'Marks producer: drive from new events instead of every mark'
status: To Do
assignee: []
created_date: '2026-10-03 01:35'
labels:
  - backend
dependencies: []
priority: low
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The marks.notify job joins every listing_mark to its listing newer price events and compares every mark seen_status with its listing; measured 277 ms and 154 ms a tick at 108k marks. Drive it from listing_price_event rows newer than a global high-water mark and from status changes since the last tick instead (CS-69 review, ADR-0033).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A tick at 100k marks costs under 20 ms when nothing changed, measured with EXPLAIN ANALYZE
- [ ] #2 Notifications stay one per event and none is missed after a worker restart, shown by a database test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
