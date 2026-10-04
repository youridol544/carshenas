---
id: CS-112
title: >-
  Interface polish: centered button labels, no scrollbars on rails, no nested
  scroll in the filters
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-04 07:05'
updated_date: '2026-10-04 08:19'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (owner away 2026-10-04, decided here; no ADR needed, per the coordinator).

1. Button (AC 1). Cause: Spinner kept an in-flow slot (20 px plus gap-2) beside the label in a justify-center button, so the label sat half the slot (14 px) right of centre; measured on «بفهم» before the change: offset 14 px (button 348 px wide, label group centred, label not). Fix, once, in the shared parts: Spinner is an overlay (absolute, 16 px, inset-e-2, centred from top to bottom) in the padding at the inline end; actionClasses gives every level group relative pending-slot, and pending-slot (globals.css) gives a button that holds a spinner padding-inline 2rem so the 16 px indicator keeps 8 px from the label. Options measured and rejected: a mirrored invisible slot at the other end (the button grows 48 px); the spinner replacing the label (breaks keep-the-label); 4 px clearance without extra padding (spinner touches the border, looked cramped on mock screenshots). Callers: the 12 wrapper spans (SubmitButton, filter sheet apply, ask-crawl, save-search, file controls, results list, admin forms) now render a direct child Spinner; chips that swap a check for the spinner use Spinner inline; the save-search row trigger (link-like) keeps its own slot. plain-search.tsx (بفهم) and paste-link-form.tsx (ارزیابی قیمت) needed no edit (CS-111 and CS-115 own them). Side effect found and fixed: the filter sheet apply button wrapped its label at 360 px with the wider padding, so its «پاک کردن فیلترها» is now a tertiary action (as on the desktop rail) and the apply label stays on one line at 360 and 412.

2. Rows (AC 2). One shared pattern, src/components/ui/scroll-rail.tsx: useScrollRail (RTL-safe reach, step 0.85 of the width, smooth scrollBy, instant under reduced motion), RailButtons (the two buttons for a row with a heading: hidden below a fine pointer, kept in the layout and invisible while the row fits, aria-disabled at an end), ScrollRail (the whole row: overlay buttons over the two ends, current item brought to the middle, focus handed to the other button when one goes away under it), scrollbar-none in globals.css (scrollbar-width plus the WebKit pseudo-element), arithmetic in scroll-rail-math.ts with unit tests. The buttons are ordinary buttons in the Tab order; copy is one pair (RAIL_COPY: قبلی and بعدی). Jabama: the pattern comes from the teardown note (section 3, arrows in the heading row on desktop, none on a phone; its capture report names swiper); no new capture was made, the lane rule is to request no site.

3. Filters (AC 3). Filter rail: max-height and overflow removed, pinned (sticky top-4) only while its measured height plus 2 x 16 px fits the window (ResizeObserver and resize); with the lane data it is 1546 px tall, so static at 1440x900 and sticky at 1440x2400. Facet lists (database lists and the colours, a list written in code) show their first five (six for the colours) and any chosen value, grow with نمایش بیشتر (n) by ten or by as many as are shown (a list of 270 trims is six presses), shrink with نمایش کمتر, one button keeps focus; a list that would hide one or two options shows them. Phone sheet: Drawer.Content stays its one scroll area (modal, page behind inert); ModalSheet lost its second, nested scroll area (viewport overflow plus popup max-h-dvh became popup max-h-full).

Sweep of apps/web/src for scrolling regions (AC 4), before and after, each with its decision. Method: grep for overflow-auto, overflow-x-auto, overflow-y-auto, overflow-scroll, scroll-snap, snap-x, max-h with overflow, scrollbar and scrollBy, then a live scan of every public page at 412 and 1440 px (no-scrollbars.spec.ts; craft-checks.js reports the same).
- features/home card-rail.tsx (the 4 catalogue rows) and popular-models.tsx (a copy of the same row): hidden scrollbar, previous and next in the heading row; popular models now renders CardRail, so there is one row.
- features/search catalogue-strip.tsx: hidden scrollbar; its own StripButton replaced by ScrollRail's overlay buttons (they were tabindex -1 and mouse only; they are Tab stops now); the open catalogue is brought to the middle by ScrollRail.
- features/search applied-chips.tsx (scrolls below 1024 px, wraps above): ScrollRail.
- features/model year-chips.tsx with current-into-view.tsx: ScrollRail with the current year brought to the middle; current-into-view.tsx deleted.
- features/search-files chip-row.tsx (account, signed in): ScrollRail. features/marked-listings marked-view.tsx (account): ScrollRail, its hand-made mask replaced by the shared fade.
- features/listing photo-gallery.tsx: the photo carousel keeps its own previous and next buttons and its counter (CS-64), scrollbar hidden through the shared utility instead of an arbitrary property; the thumbnail strip is hidden-scrollbar with a fade and follows the photo in view, and has no buttons of its own (the carousel's buttons move it): kept, with that reason.
- features/model trend-table.tsx and features/data-status freshness-chart.tsx (a table in a disclosure): kept as a safety net with a hidden scrollbar and a fade; the table fits a 320 px phone, it scrolls only at very large text (WCAG 1.4.10 reflow beats a page that scrolls sideways).
- features/search filter-rail.tsx (max-h calc(100dvh - 2rem) with overflow-y-auto): removed; pinned only while it fits.
- features/search filter-sheet.tsx (Drawer.Content overflow-y-auto): kept, the sheet's one scroll area in a modal whose page behind does not scroll; the lists inside grow in place, nothing scrolls inside it.
- components/ui modal-sheet.tsx (Dialog.Viewport overflow-y-auto around Popup max-h-dvh overflow-y-auto, which scrolled by the viewport's 32 px padding on a desktop): the viewport's removed, the popup (max-h-full) is the one area.
- components/ui info-popover.tsx and features/marks mark-button.tsx (Popup max-h-(--available-height) overflow-y-auto): kept, with a reason: an overlay that must never be taller than the screen; at normal text it has nothing to scroll (asserted), it scrolls only at very large text.
- Not scroll areas: overflow-hidden skeleton rows and clips, overflow-x-clip charts, overflow-visible SVGs, html scrollbar-gutter: stable (the page's own).
- Admin tables (listings-section, jobs-section, search-files-screen, admin freshness-chart): no scroll wrapper exists; below sm or md they turn into card lists. Nothing to change.
Result of the live scan at 412 and 1440: no element has a horizontal scrollbar, no scroll area sits inside another, the only vertical scroll area on a public page is the open filters sheet's panel.
<!-- SECTION:NOTES:END -->
