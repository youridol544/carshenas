---
id: CS-48
title: Hand-labelled evaluation set and extraction evaluation harness
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-29 16:15'
labels:
  - eval
  - ai
milestone: m-3
dependencies:
  - CS-33
  - CS-40
  - CS-47
references:
  - docs/research/2026-09-26-torob-product-and-playbook.md
  - docs/research/2026-09-28-torob-challenge-expectations-and-field.md
  - docs/research/2026-09-29-prompting-context-engineering-and-agents.md
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
No AI step ships without a labelled evaluation set and a reported accuracy (AGENTS.md). Torob reports its own LLM features this way (coverage and accuracy on a hand-checked set), so the harness is part of the product, not a chore.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 At least 200 Divar listings are hand-labelled for every field the parser and the model produce, and stored in the repository with their snapshot references and personal data removed (CS-54 adds Bama's)
- [ ] #2 One command runs the parser and the model on the set and reports per-field precision and recall, overall accuracy, coverage above the confidence threshold, and cost
- [ ] #3 Each report is stored with the prompt version, so accuracy can be compared across prompt changes
- [ ] #4 Labelling guidelines for ambiguous cases (for example «مدل» meaning the model year) are written down
- [ ] #5 Labels are entered in the superadmin section (CS-40) and exported to the repository file, which stays the truth
- [ ] #6 A change to a prompt or to the parser that lowers accuracy below the last accepted report fails the check, and re-running unchanged inputs costs no model calls, because results are cached by input hash
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

2026-09-28: criterion 1 now starts with Divar only, so labelling does not wait for Bama; CS-54 adds at least 50 Bama listings. The set covers the parser's fields (CS-34) as well as the model's (CS-52). Labelling happens in the superadmin section (CS-40). Draw the listings from a release (CS-49) when one exists, so the set names the cut it came from.

2026-09-28: nobody among the 29 public entries reports per-field accuracy on real listings (the field survey), and khodrobin's CI fails when its query-parsing score drops. The last criterion does the same for extraction.

Renumbered on 2026-09-29: this task was CS-9 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-9; the archived CS-9 points here.
<!-- SECTION:NOTES:END -->
