---
id: CS-45
title: 'Build the AI layer: a shared package on the chosen library'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-29 17:21'
labels:
  - backend
  - ai
milestone: m-3
dependencies:
  - CS-44
  - CS-32
references:
  - docs/research/2026-09-29-prompting-context-engineering-and-agents.md
  - docs/decisions/0021-ai-layer-on-the-ai-sdk.md
  - docs/research/2026-09-29-ai-layer-library.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-44 decides the library and the shape of the AI layer. This task builds it once, so every AI step uses it: the worker's (extraction, duplicate decisions) and the web app's (query understanding, explanations). Its rules come from ADR-0011 point 6 and the research note of CS-43.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A workspace package calls models by task name, each mapped to a provider's model in one registry, so switching a task's model is a one-line change
- [ ] #2 A structured call validates the output against its schema; on failure it feeds the validation error back to the model for a bounded number of retries, then returns a typed failure that the caller sends to review, never an unvalidated value
- [ ] #3 Results are cached by a hash of the prompt version, the model and the input, and a cached call makes no network request
- [ ] #4 Every call logs its task, model, prompt version, tokens, cost and latency through packages/observability, with no personal data in the log
- [ ] #5 Tests run against a recorded or fake model with no network, and the package passes pnpm check
- [ ] #6 The Metis API key is read from the environment only, and a missing key fails at start with a clear message
- [ ] #7 The Metis pass-through checks CS-43 listed are measured through the layer and recorded (ADR-0021, the owner's decision of 2026-09-29): whether prompt caching (Metis's cache parameter and Anthropic's cache_control) is honoured and billed as documented, batch, log-probabilities, Gemini's responseFormat, and the latency Metis adds at the 95th percentile
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
