---
id: CS-112
title: >-
  Interface polish: centered button labels, no scrollbars on rails, no nested
  scroll in the filters
status: To Do
assignee: []
created_date: '2026-10-04 07:05'
labels:
  - frontend
dependencies: []
priority: high
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: (1) the text of the «بفهم» button leans to the right instead of being centered, and the same on «ارزیابی قیمت» in the paste-a-link box (the reserved spinner slot pushes the label); (2) every catalogue row and strip scrolls horizontally with a visible scrollbar, which is ugly: look at how Jabama does it and remove the scrollbars, leaving the previous and next buttons to move the row with a smooth scroll; (3) on the search page the filters have vertical scroll inside their facet lists and the catalogues have a horizontal scroll: remove both.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The label of every button is optically centered in every state (idle, pending with a spinner, disabled), fixed once in the shared button so the spinner never moves the label; «بفهم», «ارزیابی قیمت» and every other button are checked at 412 and 1440 with measured offsets (label center against button center within 1 px) and a Playwright test that covers the shared button states
- [ ] #2 No horizontal scrollbar is visible anywhere on the public pages: home catalogue rows, body-type tiles, the search catalogue strip, chip rows and year chips, the model and listing page rails and any other row; the previous and next buttons move a row by about one screen with a smooth scroll and are keyboard accessible, the edge fades stay, native touch swiping still works without a scrollbar, and content that fits is not made scrollable
- [ ] #3 The search filter rail and the phone sheet have no nested scrolling area: facet lists (make, model, colour and others) show their top items and grow in place with a «نمایش بیشتر» control, and the page itself scrolls; the rail is sticky only when it fits the screen
- [ ] #4 A sweep of apps/web/src for scrolling regions (overflow-auto, overflow-x-auto, overflow-y-auto, overflow-scroll and scroll snap rows) lists each with a decision: removed, hidden scrollbar with buttons, or kept with a reason (admin tables may keep a scroll with a reason); a Playwright check asserts no visible scrollbar and no nested scroll container on the public pages at phone and desktop widths; pnpm check passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
