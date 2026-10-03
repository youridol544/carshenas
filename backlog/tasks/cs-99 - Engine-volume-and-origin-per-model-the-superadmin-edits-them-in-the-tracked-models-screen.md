---
id: CS-99
title: >-
  Engine volume and origin per model: the superadmin edits them in the tracked
  models screen
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-03 18:05'
updated_date: '2026-10-03 20:34'
labels:
  - backend
  - frontend
dependencies: []
priority: high
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-03: buyers ask by engine volume («حجم موتور بیشتر از ۲۰۰۰») and by origin («ماشین‌های خارجی»), but listings do not carry an engine volume and the catalogue has no origin. Record engine volume (cc) and origin (domestic, imported, joint-venture) per model and optionally per trim, editable by the superadmin from the tracked models screen (add, edit, remove, every change audited with who and when), seeded from the data we have, and available to search and the pages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A model, and optionally a trim, has an engine volume in cc and an origin (domestic, imported or joint-venture), stored with named constraints and range checks; a listing gets the volume and origin of its trim, else its model, unless the listing states its own
- [x] #2 The superadmin adds, edits and removes these specs for any model from the tracked models screen (and for untracked models found in the catalogue), with a validated form, and every change is recorded with who made it and when
- [x] #3 The existing models are seeded where the data allows (what listings and the catalogue already state; what is unknown stays empty and is listed as missing in the screen so the superadmin can fill it), with the share of listings that have a volume reported
- [x] #4 The listing page and the model page show the engine volume and origin when known; search_document carries both so search can filter on them
- [x] #5 Checks pass, with tests for the constraints, the inheritance (trim over model over nothing, listing value over both) and the admin flow on phone and desktop
- [x] #6 Divar listings are not requested for this task (no crawl); docs and data-model updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Investigate: raw snapshots state an engine volume in 1 of 6,169 (a description row), titles in 5 of 6,088; the catalogue has 13 trims whose names state it and rich trims for the ten tracked models; no origin anywhere. Decide: model_spec (model or trim scope, engine_volume_cc range-checked, car_origin domestic/joint_venture/imported, source catalogue/seed/superadmin), model_spec_change append-only, set_model_spec() SECURITY DEFINER for the superadmin, listing.engine_volume_cc for a stated title volume, inheritance listing > trim > model per field in listing_filter_row, search_document engine_volume_cc + car_origin with a marks trigger.
2. Migrations 20261003140000..50 (replayed up/down/up, squawk clean, schema tests), seed from catalogue names and published engines of the ten tracked models and the make-level origin of Iranian-only and import-only makes.
3. Worker: parser reads the title volume (parser v6), derive:listings fills it, search document refresh copies both columns.
4. Superadmin: a specs section in /admin/tracked-models (every catalogue model with listings, missing first, share of listings covered; edit form for model and each trim; add, change, remove; search for untracked models), tracked cards show the spec line; history.
5. Listing page and model page show volume and origin with where it comes from.
6. Tests: constraints, inheritance, function, admin flow (phone and desktop); docs: data-model, ADR-0039.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
model_spec (volume and origin per model and trim, named checks), model_spec_change (append-only; its down migration drops it, warned in the header), set_model_spec() (superadmin only), listing.engine_volume_cc from titles (parser v6, litre reads limited to engine contexts), search_document columns kept fresh by statement-level marks of the whole model. A model volume counts only where no trim contradicts it (view model_spec_agreed); seed 258 rows (12 from trim names). Coverage on the lane DB (23,125 active): 79.8% have a volume (5 from the title, 14,401 from a trim, 4,042 from a model: Pride 131, Quick, Dena plus; 4,677 unknown), all have an origin; the screen shows this split and the listing page marks a model volume as حدودی؛ طبق مدل. Post-merge in main: pnpm db:migrate, restart worker, pnpm derive:listings, pnpm search:rebuild; the 72 ai_answer rows are a cache, not imported. Evidence: model-spec-constraints.test.ts, e2e model-specs.spec.ts, pnpm check and pnpm db:check green.
<!-- SECTION:FINAL_SUMMARY:END -->
