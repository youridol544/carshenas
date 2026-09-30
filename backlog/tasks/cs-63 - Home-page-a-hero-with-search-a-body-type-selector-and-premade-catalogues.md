---
id: CS-63
title: 'Home page: a hero with search, a body-type selector and premade catalogues'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 16:34'
labels:
  - frontend
  - design
milestone: m-5
dependencies:
  - CS-56
  - CS-57
  - CS-58
  - CS-61
  - CS-62
priority: high
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29 for the home page has four parts:
- A big hero with a photograph, the product's motto and a short intro, and the search box.
- Below it, a clickable body-type selector with icons of iconic Iranian cars.
- Then the premade catalogues: «پیشنهاد کارشناس», the best deals in good condition, and the other catalogues of CS-58.
- The layout follows the teardown of CarGurus, Autolist and Jabama (CS-56).

Hero photographs come from Unsplash under its licence, and are self-hosted, because Unsplash's servers are not reliably reachable from Iran.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The hero shows a photograph, the motto and a short intro in Farsi, and the search box; a search goes to the search page with its words understood as filters (CS-62)
- [ ] #2 Hero photographs are Unsplash images stored and served by Carshenas, never loaded from Unsplash at runtime, with each image's licence, author and link recorded in the repository
- [ ] #3 The body-type selector shows the icons of CS-57, and a tap opens the search page filtered by that body type
- [ ] #4 Catalogues show as rows of listing cards, «پیشنهاد کارشناس» first, each linking to the search page with its filters
- [ ] #5 The page follows the teardown's keep, change and drop decisions (CS-56) and the craft checklist, and its largest contentful paint stays under 2.5 s on a phone profile
- [ ] #6 Playwright tests on phone and desktop pass the RTL, overflow and axe checks, and the page is added to e2e/fixtures/app-pages.ts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
«بسپارش به کارشناس» is added to this page by CS-70.

Owner, 2026-09-30 (said during CS-57): a body-type card is shown on the home page, or anywhere else, only when there are listings of that type among the tracked data; e.g. only hatchbacks and sedans tracked means only those two cards. CS-57's BodyTypeSelector takes the available codes (prop available) and renders only those.

From CS-57's design review (2026-09-30): on the home page, load the first row of body-type photos eagerly (loading=eager, perhaps fetchPriority high for the first two); BodyTypePhoto is lazy by default.
<!-- SECTION:NOTES:END -->
