---
id: CS-113
title: >-
  Popular model photos: real photos for the models people search, set through
  the admin links
status: To Do
assignee: []
created_date: '2026-10-04 07:05'
labels:
  - frontend
  - backend
dependencies: []
priority: high
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: the home tiles and model pages show generic sedan and hatchback pictures for the Peugeot 206, 207, Pars and others. CS-97 lets the superadmin set an external photo link per model; fill it for the popular models. Find real, freely licensed photos of each popular model (for example on Wikimedia Commons, with their licence and author), check that each link works from here and is a stable direct image address of a good size, record provenance, set the links through the audited admin path, and show the credits the licences ask for.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The list of popular models is chosen from data (the models with the most listings, the ten tracked models and the home popular row, at least 30 models) and each gets a photo whose licence allows showing it with credit; every link is checked for a 200 answer, an image content type and a usable size, and checked again by a script that can be re-run to find dead links
- [ ] #2 The links, their source pages, authors, licences and the date checked are kept in a committed seed file with a script (idempotent, going through set_model_photo_link as the superadmin so the change is audited and never overwrites a link the superadmin set by hand), and the credit (author and licence, linked) is stored with the link and shown on the model page and in a credits list reachable from the footer
- [ ] #3 The home popular tiles and the models index show the model photo; a model without a photo keeps the body-type fallback with its sample label; a broken link falls back without a layout shift; no image is downloaded, stored or proxied by us
- [ ] #4 A Playwright test covers a tile with a photo, the credit on the model page and the fallback; docs list how to add a photo from the admin screen; after the merge the seed is run on main and the number of models with photos is reported
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
