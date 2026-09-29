---
id: CS-42
title: 'Metis AI: its models, API, prices, limits and reachability from Iran'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-29 13:56'
labels:
  - research
  - ai
milestone: m-3
dependencies: []
references:
  - docs/research/2026-09-29-metis-ai.md
  - docs/decisions/0019-reach-language-models-through-metis-ai.md
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research note docs/research/2026-09-29-metis-ai.md, questions first. Sources: Metis's docs (docs.metisai.ir), its published model catalogue (www.metisai.ir/models.json) checked against the live model lists, its terms and privacy page, and TypeSafe's docs for jev. Topics:
   - which models Metis serves (provider, model, context window, structured output and tool calling, embeddings);
   - its API routes (OpenAI, Anthropic and Gemini formats, the DeepSeek, MiMo and Grok wrappers, the native Metis API, TypeSafe System One, the national-internet model);
   - compatibility with common SDKs;
   - prices (US dollars per million tokens, billed in rials at the free-market dollar rate), rate limits, terms, SLA and data retention.
   Each fact carries its source and date.
2. Lab docs/research/2026-09-29-metis-ai/lab/, like the CS-2 lab: its own package.json with pinned SDKs; node_modules and per-run results are ignored.
   - catalogue.mjs reads the live model lists.
   - probe.mjs defines one schema in zod and sends its JSON Schema to at least three models on different routes (OpenAI, Anthropic, Gemini, DeepSeek). It validates every answer in code and records latency, tokens, cost at list price and rate-limit headers. It also calls jev (TypeSafe System One) on the same texts, the national-internet model metis-gpt and one embedding endpoint, and records Metis's error shapes.
   - sdk-check.mjs points the official OpenAI, Anthropic and Google SDKs at Metis.
   The lab uses synthetic listing texts only. The key is read from .env and never printed.
3. Network evidence: calls to Metis leave through the Iranian ISP, shown by path and timing and recorded without addresses. This network sends foreign destinations through a UK exit.
4. ADR-0019 (number reserved for CS-42 across the parallel lanes), status proposed:
   - Metis is the provider, by the owner's decision of 2026-09-29;
   - the key lives in the environment only;
   - which routes to use;
   - the fallback: AI steps degrade to queued work, then Metis's national-internet model, then a second Iranian gateway.
   Add index rows, and put the note and the ADR on the task as refs.
5. Evidence per criterion, a task-reviewer pass, then In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-29: the research note, the lab and the evidence are in docs/research/2026-09-29-metis-ai(.md|/). All Metis calls came from the owner's workstation, whose network sends Iranian destinations through the ISP directly and foreign ones through a UK exit; api.metisai.ir takes the direct path. Three evidence runs (13:40 to 13:50 UTC): the live model lists, 45 structured calls through eight route and model combinations (42 answers, all valid against one JSON Schema; three refusals of json_schema, each retried in the route's other mode), and the three official SDKs working with only the base URL changed. jev (TypeSafe System One, the owner's suggestion) returned 402 on every call: Metis's own credits at TypeSafe were empty. ADR-0019 (proposed) records Metis, the native routes, the key in the environment and the fallback. AGENTS.md (AI steps) and example.env name the key; the key itself is only in the worktree's .env.
<!-- SECTION:NOTES:END -->
