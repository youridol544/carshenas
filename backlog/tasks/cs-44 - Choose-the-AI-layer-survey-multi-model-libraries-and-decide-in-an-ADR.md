---
id: CS-44
title: 'Choose the AI layer: survey multi-model libraries and decide in an ADR'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - research
  - ai
  - backend
milestone: m-3
dependencies:
  - CS-42
  - CS-43
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Carshenas will call several models for different steps (extraction, duplicate decisions, query understanding, explanations), through Metis now (CS-42) and perhaps other providers later. The code therefore needs one clean abstraction that stays maintainable as steps and models change. Open-source libraries already solve parts of it, for example the Vercel AI SDK, LiteLLM, instructor-js, BAML, Mastra and LangChain.js. This task compares them for the TypeScript stack, using Context7 for their current documentation and their repositories on GitHub, and records the choice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A research note compares the candidate libraries on compatibility with Metis, structured outputs with schema validation and retries that feed the error back, streaming and tool calling, usage and cost reporting, OpenTelemetry, test doubles, maintenance activity and licence
- [ ] #2 An ADR records the library and the shape of the project's AI layer, within ADR-0011 point 6: models chosen by task in one registry, versioned prompts, validation with bounded retries, a cache keyed by input hash, and cost and latency logging
- [ ] #3 A spike calls a Metis model through the chosen library and gets output that passes the schema, and a test shows a validation failure fed back and corrected
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
