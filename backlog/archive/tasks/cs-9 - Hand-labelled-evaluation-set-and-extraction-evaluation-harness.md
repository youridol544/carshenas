---
id: CS-9
title: Hand-labelled evaluation set and extraction evaluation harness
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-28 22:12'
labels:
  - eval
  - ai
milestone: m-3
dependencies: []
references:
  - docs/research/2026-09-26-torob-product-and-playbook.md
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
No AI step ships without a labelled evaluation set and a reported accuracy (AGENTS.md). Torob reports its own LLM features this way (coverage and accuracy on a hand-checked set), so the harness is part of the product, not a chore.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 At least 200 listings from at least two sources are hand-labelled for every extracted field and stored in the repository with their snapshot references
- [ ] #2 One command runs extraction on the set and reports per-field precision and recall, overall accuracy, coverage above the confidence threshold, and cost
- [ ] #3 Each report is stored with the prompt version, so accuracy can be compared across prompt changes
- [ ] #4 Labelling guidelines for ambiguous cases (for example «مدل» meaning the model year) are written down
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-4 (2026-09-27): evaluation sets are curated data whose repository file is the truth (docs/design/data-model.md); if the repository is public, labelled fixtures need phone numbers and seller names removed, an open question routed here.

Renumbered on 2026-09-29: continued as CS-48, in the order of work (backlog/docs, doc-1).
<!-- SECTION:NOTES:END -->
