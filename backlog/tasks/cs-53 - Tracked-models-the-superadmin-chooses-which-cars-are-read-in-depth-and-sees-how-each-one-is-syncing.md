---
id: CS-53
title: >-
  Tracked models: the superadmin chooses which cars are read in depth and sees
  how each one is syncing
status: Done
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-03 06:01'
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
- [x] #1 The superadmin tracks, pauses and untracks a model (a make and model, optionally one trim) from the superadmin section with a priority, and every change is recorded with who made it and when
- [x] #2 Tracking a model starts a backfill: details of its active listings already seen in sweeps are fetched newest first within the daily budget, and the superadmin section shows the backfill's progress
- [x] #3 The ten models with the most active Tehran listings in the first complete sweep are tracked at the start, and the superadmin section lists untracked models by their active listings
- [x] #4 Each tracked model shows its sync: active listings, new and gone listings in the last 24 hours, the last sweep, the median age of the last check, the date of its market value and the share of its listings with a deal rating
- [x] #5 Every tracked model records who created it and how: the owner for the first ten; approved crawl requests follow in CS-71
- [x] #6 Every tracked model shows how it was created, by the owner or from an approved crawl request (CS-71), with who approved it and when; setting a request fulfilled when its model is read
- [x] #7 Detail requests and extraction cover tracked models only; valuations and search keep covering every listing with details, and a paused or untracked model keeps its last market value with its date and leaves search after 48 hours
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
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

Decisions (owner delegated, 2026-10-03): ADR-0037. tracked_model is a table (origin seed/superadmin/request, priority high/normal/low, state tracking/paused) changed only through change_tracked_model() and decide_crawl_request() (an approval tracks its model, declining an approved request takes it back; hand removal of an unread request model is blocked); fulfil_crawl_requests() by the worker. Criterion 5 read safely: detail requests and extraction cover tracking models only; valuations and search keep covering listings with details (a paused or untracked model keeps its market value with its date and leaves search after the 48 h window).
Evidence: pnpm check green; pnpm db:check green (web 137, worker 110, replay up/down/up); PGlite schema tests tracked-model-constraints; worker db tests tracked-backfill (planner newest first by priority, bounded queue, waits while paused, fulfils requests); Playwright e2e/tests/app/tracked-models.spec.ts mobile and desktop (cover, priority, pause, resume, untrack with confirm, audit rows, request origin and decline, 404 for visitor and buyer).
EXPLAIN (ANALYZE, BUFFERS) on the lane copy of main (23,752 listings): backfill candidates for one model 6.0 ms (listing_source_model_id_idx); tracked keys 0.5 ms; screen stats 95 ms (all listings of tracked models, expected to grow with them); rated counts 19 ms; last sweeps 1 ms; untracked models 10 ms.
Seed: 10 models from the first measurement matched through catalogue_source_key (lane: 10 rows).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Tracked models are a table (tracked_model + append-only tracked_model_change) the superadmin changes at /admin/tracked-models through a function that records who and when; the ten most listed models are seeded as the owner's; an approved crawl request tracks its model and is set fulfilled by the worker once its listings are read; the screen shows each model's sync, origin and history, untracked models by active listings, and says honestly that the backfill is queued while the crawl is paused. The worker reads the table at run time and a bounded backfill planner (newest first, by priority) feeds the lane within the daily budget. Decisions in ADR-0037. Verified by pnpm check, pnpm db:check, PGlite schema tests, worker db tests and Playwright (phone and desktop).
<!-- SECTION:FINAL_SUMMARY:END -->
