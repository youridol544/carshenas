---
id: CS-16
title: 'Search results page, best deals first'
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-26 20:13'
labels:
  - frontend
  - design
milestone: m-5
dependencies:
  - CS-3
  - CS-14
  - CS-25
references:
  - .claude/skills/ui-design/references/listing-patterns.md
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The first screen a buyer sees, cloned from CarGurus's results page with the Iran-specific details in the listing-patterns reference.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each result shows the title, asking price, deal badge with the gap to market value, mileage, city, condition summary, days on market and sources
- [ ] #2 Filters work as a batch sheet on phones with applied filters as chips, and the filter state lives in the URL
- [ ] #3 Loading, empty, no-results and error states exist, and Playwright tests on phone and desktop pass the RTL, overflow and axe checks
- [ ] #4 The page is added to e2e/fixtures/app-pages.ts so the stress matrix and the gorilla cover it
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner decisions of 2026-09-26 (CS-27) that shape this page:
- Photos are hotlinked from the source (images.unoptimized; ADR-0008) inside a fixed 4:3 frame, with a same-size placeholder and a link out where a source refuses.
- Partial Prefetching is on: the first screen's cards pass prefetch={true} (react-patterns ui-craft.md, ListingCard aboveTheFold); other links get the route's shared shell.
- Pending indicators hold for a minimum time with the spin-delay package, approved by the owner; add it here with the first real indicator.
- Staggers, if any, follow reading order grouped by importance; buttons get the hand cursor from globals.css.
<!-- SECTION:NOTES:END -->
