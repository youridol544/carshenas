---
id: CS-15
title: Plain-Farsi search into structured filters
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
labels:
  - ai
  - search
milestone: m-5
dependencies:
  - CS-14
references:
  - .claude/skills/ui-design/references/listing-patterns.md
priority: medium
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Buyers describe what they want in words («۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ»). Turning that into filters, and showing the buyer what was understood, is the challenge's 'rank by user intent' step.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Queries become filters validated against the same schema as the filter UI, and the understood filters are shown as removable chips
- [ ] #2 Words the parser could not use are shown to the buyer, never dropped silently
- [ ] #3 Intent words such as ride-hailing or family use map to documented filter or ranking adjustments
- [ ] #4 Accuracy is measured on a labelled set of at least 50 queries
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
