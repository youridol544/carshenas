---
id: CS-16
title: 'Search results page, best deals first'
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-26 21:16'
labels:
  - frontend
  - design
milestone: m-5
dependencies:
  - CS-3
  - CS-14
  - CS-25
  - CS-29
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
- [ ] #5 Listing photos are shown from the stored ArvanCloud copies (ADR-0010), and a listing without a usable photo shows the same-size placeholder
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner decisions (CS-27 on 2026-09-26, revised in CS-28 on 2026-09-27) that shape this page:
- Photos are our copies in ArvanCloud Object Storage (ADR-0010; stored by CS-29), in a fixed 4:3 frame; a listing without a usable photo shows the same-size placeholder (ListingPhoto in react-patterns ui-craft.md). Until CS-29 lands, listings have no photos.
- Per-link prefetching (Partial Prefetching is off): the first screen's cards pass prefetch={true}, a full prefetch of the listing page, so a tap opens it at once and the photo morph plays (ListingCard aboveTheFold); the other links keep the default.
- Pending indicators hold for a minimum time with the spin-delay package, approved by the owner; add it here with the first real indicator.
- Staggers, if any, follow reading order grouped by importance; buttons get the hand cursor from globals.css.
<!-- SECTION:NOTES:END -->
