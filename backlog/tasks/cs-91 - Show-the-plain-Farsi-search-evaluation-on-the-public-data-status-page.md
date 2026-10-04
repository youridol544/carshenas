---
id: CS-91
title: Show the plain-Farsi search evaluation on the public data-status page
status: To Do
assignee: []
created_date: '2026-10-02 18:24'
updated_date: '2026-10-04 10:38'
labels:
  - frontend
milestone: m-5
dependencies: []
references:
  - apps/web/src/features/data-status
priority: low
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The public data-status page (CS-66) shows the published evaluation of the listing-text reading from the ai_evaluation table. CS-62 adds a second AI step, plain-Farsi search, with its own evaluation (code only 94.5 %, with the model 96.9 %, cost per 1,000 queries), which a visitor who wants to know how far to trust the search box would look for on the same page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A query.filters row is added to ai_evaluation by a migration from the CS-62 report, and the data-status page shows it beside the listing-text reading with its prompt version, date and the two modes
- [ ] #2 The page test covers a page with both rows
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deferred by the owner on 2026-10-04 (the AI account is short on tokens): not started or stopped; nothing from this task is merged.
<!-- SECTION:NOTES:END -->
