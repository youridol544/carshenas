---
id: CS-62
title: Plain-Farsi search into structured filters
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 09:58'
labels:
  - ai
  - search
milestone: m-5
dependencies:
  - CS-59
references:
  - .claude/skills/ui-design/references/listing-patterns.md
  - docs/research/2026-09-28-torob-challenge-expectations-and-field.md
priority: high
ordinal: 31000
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-28: raised to high. "Rank by user intent" is the third line of Torob's brief, and «فهم عبارت جست‌وجو» (Persian, Finglish and typos) is the first of the ten problems on Torob's careers page.

Renumbered on 2026-09-29: this task was CS-15 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-15; the archived CS-15 points here.

CS-47 (2026-09-30): the AI rule pack .claude/rules/ai.md attaches when an agent reads a file under packages/ai/** or apps/worker/src/models*.ts. When this task creates the web app counterpart of apps/worker/src/models.ts (where the web app creates the layer with its key), add that path to the rule pack paths. Load the ai-features skill before building the step.
<!-- SECTION:NOTES:END -->
