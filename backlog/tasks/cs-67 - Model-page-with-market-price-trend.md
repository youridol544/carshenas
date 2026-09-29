---
id: CS-67
title: Model page with market price trend
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - frontend
milestone: m-5
dependencies:
  - CS-64
priority: medium
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Torob's product page applied to cars: one page per make, model, trim and year, with the market's direction and every listing ranked by deal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The page shows today's market value and range, a weekly trend with Jalali dates, and all listings of the model ranked by deal
- [ ] #2 Playwright tests cover the page on phone and desktop, and it is added to e2e/fixtures/app-pages.ts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Renumbered on 2026-09-29: this task was CS-18 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-18; the archived CS-18 points here.
<!-- SECTION:NOTES:END -->
