---
id: CS-17
title: 'Listing page: market-value gauge, comparables, explanation and also-listed-on'
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-26 20:33'
labels:
  - frontend
  - ai
milestone: m-5
dependencies:
  - CS-16
  - CS-12
  - CS-11
references:
  - .claude/skills/ui-design/references/listing-patterns.md
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The page where the product earns trust: why this price is a good or a bad deal, based on which cars, and whether the same car is cheaper elsewhere.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The gauge shows the five bands, the market value and this listing's price, with the market value's date
- [ ] #2 The explanation is generated from stored facts only, and a test proves every number in it comes from the database
- [ ] #3 Comparables, price history, condition chips with their source sentence, risk flags and the duplicate group (cheapest first) are shown
- [ ] #4 The primary action clicks out to the source listing
- [ ] #5 Playwright tests cover the page on phone and desktop, and it is added to e2e/fixtures/app-pages.ts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-27 (2026-09-27): Partial Prefetching is on, so the listing page reads its params behind Suspense. A listing that turns out to be missing is then served with HTTP 200 and a noindex tag instead of a 404 (next-app-router.md). Decide here whether that is acceptable, or how the page handles it. For the photo morph from the results page, read the listing in a 'use cache' function so the first screen's cards can prefetch it with prefetch={true} (react-patterns ui-craft.md §6).
<!-- SECTION:NOTES:END -->
