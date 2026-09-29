---
id: CS-42
title: 'Metis AI: its models, API, prices, limits and reachability from Iran'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - research
  - ai
milestone: m-3
dependencies: []
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's decision of 2026-09-29: Carshenas's language models are reached through Metis AI (metisai.ir), an Iranian aggregator that serves many providers' models through its own API. The large providers refuse Iranian addresses, and the worker runs inside Iran (ADR-0017). Before any AI step is built, what Metis offers must be known from its documentation and from calls made from an Iranian network.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A research note records which models Metis serves (provider, model, context window, structured output or tool calling, embeddings), its API shape and compatibility with common SDKs, prices, rate limits, terms of use and data retention, each with its source and date
- [ ] #2 Calls from an Iranian network to at least three models through Metis return output valid against a JSON schema, with the latency and cost of each recorded
- [ ] #3 An ADR records Metis as the provider, as decided by the owner on 2026-09-29, with a fallback if Metis is unavailable, and the API key kept in the environment only
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
