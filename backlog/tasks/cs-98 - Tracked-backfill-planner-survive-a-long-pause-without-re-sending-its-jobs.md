---
id: CS-98
title: 'Tracked backfill planner: survive a long pause without re-sending its jobs'
status: To Do
assignee: []
created_date: '2026-10-03 06:01'
labels:
  - backend
dependencies: []
priority: low
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the CS-53 database re-review (2026-10-03): tracked_backfill rows older than two days (STALE_AFTER) count as lost, so while Divar stays paused the planner re-sends the same 150 listings every two days (about 75 duplicate jobs a day). Also: tracked_backfill_queued_idx serves a table of about 150 rows and will be unused (drop it); rows with attempts of 4 or more are never removed; withdraw_approved_request leaves a model tracking when a trim request on the same model is still approved; the photo host rule blocks every all-numeric label (img.163.com) and its comment says hex while only 0x labels are blocked.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
