---
id: CS-93
title: Wire plain-Farsi search into the search page
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-02 21:16'
updated_date: '2026-10-02 21:16'
labels:
  - search
  - ai
dependencies: []
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mount PlainSearch in SearchScreen's understanding slot (CS-62 follow-up): a closed disclosure under the search box; applying a sentence's filters opens /search with them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The search page offers a sentence box that shows what was understood as removable chips and applies the rest to the address
- [x] #2 The owner's vague request opens the clean-and-easy catalogue; the master switch stays off by default and the box says so
- [x] #3 A whole-flow Playwright test passes on phone and desktop
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PlainSearchPanel (a closed disclosure) is mounted in SearchScreen's understanding slot from the search page; applying closes it and opens /search with the filters. Evidence: e2e/tests/app/plain-search-flow.spec.ts passes on phone and desktop (8/8), screenshots in docs/evidence/query-understanding/2026-10-02/screenshots; pnpm check passes. The model stays off by default.
<!-- SECTION:FINAL_SUMMARY:END -->
