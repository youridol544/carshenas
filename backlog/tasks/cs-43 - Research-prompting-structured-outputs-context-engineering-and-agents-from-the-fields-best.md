---
id: CS-43
title: >-
  Research: prompting, structured outputs, context engineering and agents, from
  the field's best
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - research
  - ai
milestone: m-3
dependencies: []
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner wants the AI work built on the practice of the field's best people, with Ilya Sutskever named as the bar. Sutskever himself has published little practical guidance, so the note draws on those who have published measured, reproducible advice: the model makers' own guides, and engineers and researchers who report evaluations.

The questions:
- prompting and context engineering;
- structured outputs, including validation and a retry that feeds the validation error back to the model;
- confidence and review thresholds;
- evaluations and error analysis;
- prompt injection from text the model reads;
- caching and cost;
- when an agent is worth building and how.

It also asks which open-source projects do similar work: turning classified listings into records, valuing cars, explaining a rating. It feeds the AI layer's ADR (CS-44) and the skill for AI features (CS-47).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A research note answers each question with cited sources, each marked for credibility, and separates measured findings from opinion
- [ ] #2 The note lists the patterns Carshenas adopts, each with its source and the AI step it applies to (extraction, duplicate decisions, query understanding, explanations)
- [ ] #3 The note surveys open-source projects doing similar work and records the ideas worth taking, and why
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
