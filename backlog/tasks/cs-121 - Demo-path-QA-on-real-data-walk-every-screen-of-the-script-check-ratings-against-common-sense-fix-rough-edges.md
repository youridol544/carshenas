---
id: CS-121
title: >-
  Demo path QA on real data: walk every screen of the script, check ratings
  against common sense, fix rough edges
status: To Do
assignee: []
created_date: '2026-10-04 09:37'
labels:
  - qa
  - frontend
dependencies: []
priority: high
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The last step before the deploy and the recording, after the other work is merged: walk the whole demo path as a reviewer would, on real data, and fix what is rough. The reviewers judge taste, usability and whether the numbers are right (docs/product/challenge.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every screen of the demo script (CS-120) is walked on phone and desktop with real data, screenshots are looked at and described, and each defect found is fixed or filed with a reason; the walk is the rehearsal script of CS-120 run once
- [ ] #2 A sample of 50 deal ratings of the popular models is checked against common sense and visible market prices; a rating that is plainly wrong is explained or fixed (a rule or a data fix) and the findings are written down
- [ ] #3 A fresh-context design review and a copy review (the copy-reviewer agent) are done once on the final merged build for home, search, listing, model, paste a link and the status page, and their blocking findings are fixed
- [ ] #4 Test data and junk are removed from the database before the recording (test accounts, e2e rows, scratch listings), the crawl and the valuation run are healthy, and the index has the freshness the script claims
- [ ] #5 pnpm check and the full end-to-end suite pass on main once after everything is merged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
