---
id: CS-111
title: >-
  Smart search in one step: type a sentence, land on the results with the
  filters applied
status: To Do
assignee: []
created_date: '2026-10-04 07:04'
labels:
  - frontend
  - backend
dependencies: []
priority: high
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: the plain-Farsi box asks too much of the buyer: type, press «بفهم» (a strange word), read the understood chips, press again to see the listings, and in the hero there is one more step. It must happen by itself: one box, one action, and the buyer lands on /search with the filters already applied and shown. The two-click flow and the disclosure panel are removed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The home hero and the search page have one search box for free text; pressing Enter or the one button goes to /search with the results already filtered by what the sentence said, with no confirm step, no «understood» panel to approve and no second button; the example chips under the hero box submit directly (one click shows results)
- [ ] #2 The understanding runs by code on the server before the page is drawn, the address becomes the canonical filter form with the sentence kept in the box, and what the code could not read is shown as a quiet removable chip; words that would make the result empty are dropped automatically, step by step, and the page says which were dropped with a way to put them back, so a sentence never ends in a dead end
- [ ] #3 The applied filters appear as removable chips at the top of the results in plain words; removing or changing a chip updates the results at once; the sentence stays editable; the model path (behind its default-off switch) refines the reading in the background without a click and the page shows the code results at once; with the switch off nothing waits
- [ ] #4 A vague sentence such as «یک ماشین تمیز، کم‌کارکرد و بی‌دردسر» lands on results with the clean catalogue applied and shown, and phrases with a price, a year, a mileage, an engine volume or an origin land with those chips; saving the search as a search file keeps the applied filters
- [ ] #5 Phone and desktop Playwright tests prove one step from the home hero and from /search, the dropping of words that empty the result, the switch-off case and the back button returning to the previous page with its box content; the words on the box and chips follow the product voice guide (CS-104)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
