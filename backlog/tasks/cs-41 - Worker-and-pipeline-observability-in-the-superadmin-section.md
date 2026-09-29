---
id: CS-41
title: Worker and pipeline observability in the superadmin section
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - backend
  - frontend
  - infra
milestone: m-2
dependencies:
  - CS-40
  - CS-32
  - CS-33
  - CS-35
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29: the superadmin must see the worker without reading raw logs. That means whether it is alive, what its jobs are doing, what failed and why, what each source answered, how many listings came in and went out, and how fresh the index is. The crawler runs around the clock on a server in Iran from CS-37 on, so this comes right after the section exists. The numbers come from the database: pg-boss's job tables, crawl runs, the fetch log, listings and their price events.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The worker shows as alive or down, with its version, uptime and last heartbeat, and a stopped worker shows as down within a minute
- [ ] #2 Jobs show per queue and state (waiting, active, completed, failed, retrying, dead-lettered), with recent failures, their error and trace id, and the superadmin can retry or cancel a failed job
- [ ] #3 Crawl runs show per source with their state, duration, requests spent against the daily budget, and outcomes (ok, not modified, not found, gone, blocked, rate-limited, challenge, error)
- [ ] #4 Listings show per source and per tracked model: total, active, and new, changed and gone in the last hour, 24 hours, 7 days or a chosen window, with a chart over time and the median age of the last check
- [ ] #5 Source problems (blocks, rate limits, challenges and values the parser could not read) show with their time and evidence, and a stopped source links to resuming it (CS-40)
- [ ] #6 Every number comes from the database through measured queries, and each screen answers within one second at the demo's volume
- [ ] #7 Playwright tests cover the screens with seeded data
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
