---
id: CS-53
title: >-
  Tracked models: the superadmin chooses which cars are read in depth and sees
  how each one is syncing
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-03 03:48'
labels:
  - crawler
  - backend
milestone: m-3
dependencies:
  - CS-40
  - CS-35
  - CS-50
references:
  - >-
    docs/decisions/0037-tracked-models-are-a-table-the-superadmin-changes-through-a-function.md
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's idea of 2026-09-28: a superadmin adds the car models the crawler covers ("company peaguot -> 206, 405, saipa -> quik atlas"), starting with the ten most listed, and keeps track of their sync. ADR-0017 point 4 shapes it: the daily sweep (CS-35) reads the whole Tehran car feed at list level anyway, so no model is ever invisible, and tracking a model decides where detail requests, extraction, valuations and search results are spent. Models are picked from the catalogue (CS-50), which is seeded from the sources' own make and model lists (Divar's `/car/<make>/<model>` pages), so nobody types names by hand. Until this task lands, the tracked models are a configured list (CS-33).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The superadmin tracks, pauses and untracks a model (a make and model, optionally one trim) from the superadmin section with a priority, and every change is recorded with who made it and when
- [ ] #2 Tracking a model starts a backfill: details of its active listings already seen in sweeps are fetched newest first within the daily budget, and the superadmin section shows the backfill's progress
- [ ] #3 The ten models with the most active Tehran listings in the first complete sweep are tracked at the start, and the superadmin section lists untracked models by their active listings
- [ ] #4 Each tracked model shows its sync: active listings, new and gone listings in the last 24 hours, the last sweep, the median age of the last check, the date of its market value and the share of its listings with a deal rating
- [ ] #5 Detail requests, extraction, valuations and search results cover tracked models only, and a paused model keeps its last data, shown with its date
- [ ] #6 Every tracked model records who created it and how: the owner for the first ten; approved crawl requests follow in CS-71
- [ ] #7 Every tracked model shows how it was created, by the owner or from an approved crawl request (CS-71), with who approved it and when; setting a request fulfilled when its model is read
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Migrations: tracked_model + tracked_model_change (append-only audit), change_tracked_model() and decide_crawl_request() (approval tracks, decline of an approved request takes it back), fulfil_crawl_requests() for the worker, view tracked_model_scope over the table, seed of the owner's ten.
2. Worker: read tracked models from the table at run time (discovery round, sweeps, measurement), plan-backfill job (fulfils requests, keeps ~150 backfill jobs queued, newest first, weighted by priority) through the lane and budget; waits while the source is paused.
3. ADR-0037: what tracking decides (safe interpretation of criterion 5).
4. Superadmin /admin/tracked-models: sync panel per model, track/pause/resume/priority/untrack, untracked models by active listings, origin and audit, honest crawl-paused note.
5. Tests: PGlite schema tests, worker db tests, Playwright admin flows phone and desktop; data-model.md, runbook.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-71 (2026-10-03): approved rows of crawl_request (state approved; model_id, trim_id; the files in crawl_request_file are the demand) are your input; set state fulfilled and fulfilled_at, and replace the body of the view tracked_model_scope. The superadmin screen /admin/crawl-requests already lists tracked models with their origin (owner, or a fulfilled request with approver and date). ADR-0036.
<!-- SECTION:NOTES:END -->
