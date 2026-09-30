---
id: CS-72
title: >-
  Proactive matching: every pipeline run fills search files and alerts their
  buyers
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 22:06'
labels:
  - backend
milestone: m-8
dependencies:
  - CS-70
  - CS-68
  - CS-35
  - CS-51
priority: high
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29: after each run of the pipeline, Karshenas goes through every watching search file, adds the new listings that match, and tells the buyer, without the buyer searching again. This is the product working for the buyer between visits. Matching reads the same definitions as search (CS-58).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After each run that adds or changes listings, every watching search file gets its new matches, stored with the time they were found
- [ ] #2 A new match rated good or better, and a price drop on a match, notify the buyer once each, and many at once become one summary per run
- [ ] #3 A file finds exactly what the search page shows for its search, proven by tests on fixtures
- [ ] #4 Each run's matching time and number of notifications are recorded and shown in the superadmin section (CS-41)
- [ ] #5 Matching stays within a measured time budget at the demo's volume, with its queries checked with EXPLAIN (ANALYZE, BUFFERS)
- [ ] #6 A buyer can mute one search file, and create_notification() creates nothing from that file for them.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
