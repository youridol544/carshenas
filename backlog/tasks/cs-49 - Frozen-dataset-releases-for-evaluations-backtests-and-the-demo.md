---
id: CS-49
title: 'Frozen dataset releases for evaluations, backtests and the demo'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 11:51'
labels:
  - backend
  - eval
milestone: m-3
dependencies:
  - CS-33
references:
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
  - docs/research/2026-09-28-listing-data-and-freshness.md
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0017 point 7. The live index changes every hour, but evaluations must be repeatable, the valuation backtest (CS-51) must learn from what was known before a date and be tested on listings posted after it, and the numbers the demo video quotes must come from a dataset that stays the same. The video itself is recorded on the live site, and a release is its fallback if a source blocks on the recording day. A release is a named, dated cut of the stored snapshots and of what was derived from them. Releases hold the sources' content, so they stay out of the repository; only redacted evaluation fixtures are committed (CS-48).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One command cuts a release at a timestamp and records its name, cut time, counts per source and per model, and the versions of the parser, prompts and valuation it contains
- [ ] #2 One command restores a release into an empty local database, where the web app and the evaluations run without crawling
- [ ] #3 Evaluation and backtest reports name the release they ran on
- [ ] #4 Releases are stored outside the repository and never committed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Postponed by the owner on 2026-09-30: the product is readied for the demo video first; CS-50 no longer waits for CS-48.
<!-- SECTION:NOTES:END -->
