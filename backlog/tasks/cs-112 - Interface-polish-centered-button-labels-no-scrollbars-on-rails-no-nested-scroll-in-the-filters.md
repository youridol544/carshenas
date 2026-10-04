---
id: CS-112
title: >-
  Interface polish: centered button labels, no scrollbars on rails, no nested
  scroll in the filters
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-04 07:05'
updated_date: '2026-10-04 07:22'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Button (AC1). Make the pending Spinner an overlay in the padding of primary and secondary action buttons (actionClasses): the label is the only in-flow content, so it is centred idle, pending and disabled; buttons that hold a spinner get px-8 so the 16 px overlay never touches the label. Migrate the wrapper spans (SubmitButton, filter sheet apply, ask-crawl, save-search, file controls, results list, admin forms) to the one direct-child Spinner; chips keep an inline slot. plain-search (بفهم) and paste-link-form (ارزیابی قیمت) need no edit (parallel lanes CS-111, CS-115 own them). Sample route /design/buttons (idle, pending, disabled, every level, natural and full width) and a Playwright test measuring label-group centre against button centre within 1 px at 412 and 1440, plus every action-like button on the public pages and the real بفهم and ارزیابی قیمت pending (held request).
2. Rails (AC2). One shared pattern in components/ui/scroll-rail.tsx: useScrollRail (RTL-safe reach, smooth scrollBy of about 85 % of the width, instant under reduced motion), RailButtons, ScrollRail (overlay previous/next buttons only on a fine pointer and only where there is more, focus handed on when one goes away), plus a scrollbar-none utility. Used by CardRail (home catalogues), popular models, catalogue strip, applied chips, year chips, account chip rows and the marked filters; gallery thumbnails and the two tables hide the scrollbar. Edge fades, native snap and swipe stay; a row that fits is not scrollable.
3. Filters (AC3). Filter rail: no max-height and no overflow, sticky only while it fits the window (ResizeObserver); phone sheet keeps its one modal scroller and nothing nests in it. Facet lists (database lists and colours and other choices) show their top items and grow in place with نمایش بیشتر (steps of ten) and نمایش کمتر; keep edits to the bottom of filter-controls.tsx so the CS-99 range control merges cleanly.
4. Sweep and evidence (AC4). Record every scrolling region in apps/web/src with its decision in the task notes; Playwright no-scrollbars spec on home, search with filters open, listing, models, model and check at 412 and 1440 (real scrollbars on: horizontal scrollbar thickness is zero everywhere, no nested scroll region, no vertical scroll region except the open sheet); extend craft-checks.js with scroll regions; rails spec (buttons, smooth, keyboard, reduced motion, fits, touch swipe by CDP). Update docs (craft.md, design-language, ui rule, learnings).
5. Finish: pnpm check, phone and desktop Playwright on a production build, screenshots opened and described, notes, final summary, In Review, commit.
<!-- SECTION:PLAN:END -->
