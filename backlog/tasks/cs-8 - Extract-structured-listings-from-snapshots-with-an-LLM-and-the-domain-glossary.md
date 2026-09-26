---
id: CS-8
title: Extract structured listings from snapshots with an LLM and the domain glossary
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-26 09:21'
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
