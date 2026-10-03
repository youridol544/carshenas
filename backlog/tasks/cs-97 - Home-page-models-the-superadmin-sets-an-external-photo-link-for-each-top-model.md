---
id: CS-97
title: >-
  Home page models: the superadmin sets an external photo link for each top
  model
status: Done
assignee:
  - '@claude'
created_date: '2026-10-03 03:33'
updated_date: '2026-10-03 06:01'
labels:
  - frontend
  - backend
dependencies: []
references:
  - docs/decisions/0038-model-photos-are-an-address-the-superadmin-gives.md
priority: high
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The home page popular-models tiles (CS-67) and the models index show body-type sample photos, so a Peugeot Pars or a 206 shows an unrelated sedan or hatchback. The owner asked (2026-10-03) that the superadmin can give each top model an external image link (an https address, like the hero photos but hosted elsewhere) that the tiles show, with the body-type photo as the fallback.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The superadmin section lists the models shown on the home page and lets the superadmin set, replace or clear an https image link per model, recording who changed it and when
- [x] #2 An image link is checked before it is saved: https only, a plausible image address, a length limit; a link that fails to load on the page falls back to the body-type photo without a layout shift
- [x] #3 The home page tiles and the models index show the model photo when a link is set, and the sample label only on the body-type fallback
- [x] #4 Photos are shown from their own addresses and never downloaded or stored by us (ADR-0025 spirit); the page sends no referrer to them
- [x] #5 A Playwright test covers setting a link, the tile showing it, a broken link falling back, and a non-superadmin being refused
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions: ADR-0038. model_photo_link (one row per model, https/length/plain/host checks by name, append-only model_photo_link_change, set_model_photo_link() SECURITY DEFINER for the admin role, web role column grant model_id+url). Whether an address is an image is confirmed by a live preview the browser loads itself (the app never fetches); Save is enabled only once the preview loaded. Tiles (home and /models) show the remote photo through next/image unoptimized with referrerPolicy no-referrer in the same 4:3 frame; onError (also a failure before hydration) falls back to the body-type sample with its «عکس نمونه» label; cache tag model-photos is dropped by the action. Evidence: pnpm check, pnpm db:check green; PGlite schema test model-photo-link-constraints; unit test of the rules; Playwright e2e/tests/app/model-photos.spec.ts mobile and desktop: bad address refused, broken preview blocks save, save, tile and index show the photo without the sample label and with no-referrer, a photo that later 404s falls back with identical tile size, removal, 404 for visitor and buyer.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The superadmin sets, replaces or clears an https image link for each popular model at /admin/model-photos with a live preview, recorded with who and when through set_model_photo_link(); the home tiles and the models index show that photo from its own host (never stored or proxied, no referrer) and fall back to the body-type sample, with its label only on the sample, when it does not load. Decisions in ADR-0038. Verified by pnpm check, pnpm db:check and Playwright on phone and desktop.
<!-- SECTION:FINAL_SUMMARY:END -->
