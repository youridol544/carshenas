---
id: CS-46
title: >-
  Choose a model for each AI step: Artificial Analysis, then a bake-off on real
  listings
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - research
  - ai
  - eval
milestone: m-3
dependencies:
  - CS-42
  - CS-45
  - CS-33
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Each AI step needs the model with the best balance of quality, cost and speed among those Metis serves (CS-42). Artificial Analysis (artificialanalysis.ai) publishes independent measurements of models' intelligence, output speed and price, and a model recommender, which give the first shortlist. Persian text and strict structured output matter more here than general benchmarks, so the shortlist is tested on real listings and queries through the AI layer (CS-45).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A research note shortlists models for each AI step (extraction, duplicate decisions, query understanding, explanations) from Artificial Analysis's measurements, filtered to what Metis serves, with each model's intelligence, speed and price and the date they were read
- [ ] #2 A bake-off runs the shortlisted models through the AI layer on at least 30 real listing texts and 20 real queries, and reports the rate of schema-valid output, accuracy checked by hand, latency and cost per thousand calls
- [ ] #3 The AI layer's registry names a default model for each step with the reason, and extraction's model is confirmed on the labelled set in CS-52
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
