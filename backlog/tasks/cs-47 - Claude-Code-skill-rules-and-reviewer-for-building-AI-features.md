---
id: CS-47
title: 'Claude Code skill, rules and reviewer for building AI features'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - dx
  - ai
milestone: m-3
dependencies:
  - CS-43
  - CS-44
  - CS-45
  - CS-46
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents write most of Carshenas's code, so the AI practice has to live where Claude Code reads it, as the database, interface and React practice already does (the database and ui-design skills, the rule packs, the reviewers). This task turns the research note on prompting and agents (CS-43), the AI layer's ADR (CS-44) and the model choices (CS-46) into three things:
- a skill for AI features, covering prompts, context engineering, structured outputs and their retries, evaluations and the harness, prompt injection, cost, and when to build an agent;
- a rule pack that attaches to AI code paths;
- a read-only reviewer that checks an AI change before review.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A skill for AI features gives worked examples on the AI layer: a versioned prompt that carries the glossary, a structured extraction retried on validation errors, an evaluation run on a labelled set, a defence against instructions inside listing text, and a cost report
- [ ] #2 A rule pack attaches when an agent opens AI code, and states the rules that are never broken: output validated against a schema, nothing unvalidated stored, numbers a user sees from the database, an evaluation before a step ships, no personal data in prompts or logs
- [ ] #3 A read-only reviewer agent checks an AI change against those rules and the task's evaluation, with evidence it produces itself
- [ ] #4 `.claude/skills/README.md` lists the skill with its sources, and AGENTS.md points to it in one line while staying under 150 lines
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
