---
id: CS-97
title: >-
  Home page models: the superadmin sets an external photo link for each top
  model
status: To Do
assignee: []
created_date: '2026-10-03 03:33'
labels:
  - frontend
  - backend
dependencies: []
priority: high
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The home page popular-models tiles (CS-67) and the models index show body-type sample photos, so a Peugeot Pars or a 206 shows an unrelated sedan or hatchback. The owner asked (2026-10-03) that the superadmin can give each top model an external image link (an https address, like the hero photos but hosted elsewhere) that the tiles show, with the body-type photo as the fallback.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The superadmin section lists the models shown on the home page and lets the superadmin set, replace or clear an https image link per model, recording who changed it and when
- [ ] #2 An image link is checked before it is saved: https only, a plausible image address, a length limit; a link that fails to load on the page falls back to the body-type photo without a layout shift
- [ ] #3 The home page tiles and the models index show the model photo when a link is set, and the sample label only on the body-type fallback
- [ ] #4 Photos are shown from their own addresses and never downloaded or stored by us (ADR-0025 spirit); the page sends no referrer to them
- [ ] #5 A Playwright test covers setting a link, the tile showing it, a broken link falling back, and a non-superadmin being refused
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
