---
id: CS-8
title: Extract structured listings from snapshots with an LLM and the domain glossary
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 11:55'
labels:
  - ai
  - backend
milestone: m-3
dependencies:
  - CS-6
  - CS-9
references:
  - docs/product/glossary.md
  - docs/decisions/0007-data-search-and-ingestion-stack.md
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Listings are free text: trim, model year, mileage, paint and body condition, insurance and price type (negotiable, installment, swap) are written in many ways. The product rests on turning them into a strict schema, and Torob's reviewers will look for how that is engineered and measured.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A versioned prompt carries the glossary and produces output validated against a strict schema in code; invalid output is retried or sent to a review queue, never stored
- [ ] #2 Each extracted field has a confidence, and fields below the threshold are queued for review
- [ ] #3 Results are cached by input hash, so re-running on unchanged snapshots makes no model calls
- [ ] #4 Negotiable, installment and swap prices are recognised and flagged
- [ ] #5 The LLM provider, the model and the measured cost per thousand listings are recorded in ADR-0007 or a successor, with the provider reachable from where the worker runs
- [ ] #6 Field-level accuracy on the CS-9 evaluation set is reported with the prompt version, and the overall target of at least 95 % is met or the gap explained
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-4 (2026-09-27): extraction tables are planned in docs/design/data-model.md (extraction with input_sha256 for the cache by input hash, one row per field with its confidence, review items below the threshold); the listing attribute columns arrive with the types CS-2 decides. ADR-0007 is superseded; its LLM rules continue as ADR-0011 point 6, which is the successor criterion #5 refers to.

CS-2 (2026-09-27, ADR-0014, proposed): extraction converts every stated price to whole tomans. Rials divide by 10; «میلیون» and «میلیارد» words and shorthand such as «۱۲۵۰» meaning 1,250 million are expanded; after the redenomination, new rials multiply by 1,000 and qerans by 10. Accept the separators U+002C, U+060C, U+066B and U+066C, all three digit scripts and a leading U+200F; placeholder prices get price_type placeholder. Model years: model_year_written (sh, ad or both), model_year_ad only when stated, model_year_sh always set (model_year_ad minus 621 for a Gregorian-only ad, enforced by a CHECK). Divar pairs years as «۱۴۰۴ - ۲۰۲۵».

CS-2 review (2026-09-27): the price and model-year constraints for listing are written word for word in docs/design/data-model.md (layer 3) and were tested on 13 rows each. asking_price_toman is set only for asking and down_payment_toman only for installment; a placeholder carries no amount (its figure stays in the snapshot). The model-year CHECK spells out IS [NOT] NULL in every branch. listing has rows, so add the columns bare and the constraints NOT VALID, and validate them in a later migration.
<!-- SECTION:NOTES:END -->
