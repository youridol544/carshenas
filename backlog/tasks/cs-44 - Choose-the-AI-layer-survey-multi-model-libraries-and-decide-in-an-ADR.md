---
id: CS-44
title: 'Choose the AI layer: survey multi-model libraries and decide in an ADR'
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-29 17:43'
labels:
  - research
  - ai
  - backend
milestone: m-3
dependencies:
  - CS-42
  - CS-43
references:
  - docs/research/2026-09-29-prompting-context-engineering-and-agents.md
  - docs/research/2026-09-29-ai-layer-library.md
  - docs/decisions/0021-ai-layer-on-the-ai-sdk.md
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Carshenas will call several models for different steps (extraction, duplicate decisions, query understanding, explanations), through Metis now (CS-42) and perhaps other providers later. The code therefore needs one clean abstraction that stays maintainable as steps and models change. Open-source libraries already solve parts of it, for example the Vercel AI SDK, LiteLLM, instructor-js, BAML, Mastra and LangChain.js. This task compares them for the TypeScript stack, using Context7 for their current documentation and their repositories on GitHub, and records the choice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A research note compares the candidate libraries on compatibility with Metis, structured outputs with schema validation and retries that feed the error back, streaming and tool calling, usage and cost reporting, OpenTelemetry, test doubles, maintenance activity and licence
- [x] #2 An ADR records the library and the shape of the project's AI layer, within ADR-0011 point 6: models chosen by task in one registry, versioned prompts, validation with bounded retries, a cache keyed by input hash, and cost and latency logging
- [x] #3 A spike calls a Metis model through the chosen library and gets output that passes the schema, and a test shows a validation failure fed back and corrected
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Survey the candidates against the criteria in AC #1, using Context7 for current documentation, the GitHub API for activity and licence, the npm registry for versions and downloads, and the source code where the documentation is silent: Vercel AI SDK, LangChain.js, Mastra, instructor-js, BAML, LiteLLM, pi-ai, and Genkit and Ax as further TypeScript candidates, against a baseline of the official openai, @anthropic-ai/sdk and @google/genai SDKs with a thin layer of our own.
2. Wire-check the front-runner live against Metis's native routes (OpenAI Chat Completions json_schema strict, Anthropic output_config.format, Gemini responseJsonSchema, DeepSeek JSON mode): record which parameters the library puts on the wire, and whether each answer passes the zod schema. The lab goes in docs/research/2026-09-29-ai-layer-library/lab/ and the evidence in evidence/, as in CS-42.
3. Write the research note docs/research/2026-09-29-ai-layer-library.md and add it to the index.
4. Put the library choice and the open design questions to the owner with a recommendation (an architecture decision), then write ADR-0021 (reserved for CS-44): the library and the shape of the AI layer within ADR-0011 point 6 and ADR-0019, covering a registry per task, versioned prompts, validation with bounded re-asks, a cache keyed by input hash, and cost and latency logging.
5. Spike in the lab: a TypeScript script calls a Metis model through the chosen library and validates the answer against the schema; a node:test test with no network shows a validation failure fed back to the model and corrected; a live run shows the same re-ask against Metis. Evidence is committed.
6. Verify: pnpm check, task-reviewer, check the criteria with their evidence, final summary, In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lab in docs/research/2026-09-29-ai-layer-library/lab (AI SDK 7.0.122; @ai-sdk/openai 4.0.81, anthropic 4.0.68, google 4.0.85, deepseek 3.0.56), evidence in ../evidence:
- Wire check with a stub fetch, no network and no key (the network watch saw 0 requests): OpenAI .chat() sends response_format json_schema strict:true with max_completion_tokens and reasoning_effort; Anthropic sends output_config.format json_schema with no beta header; Gemini sends responseMimeType plus responseJsonSchema; DeepSeek sends json_object with the schema in a system message. The default openai(id) goes to /responses.
- Outcomes: Anthropic refusal and Gemini SAFETY surface as finish reason content-filter; OpenAI's refusal field is dropped, so its refusal arrives as an empty answer (a gap for CS-45). With no text, a refusal or truncation returns a result whose output getter throws NoOutputGeneratedError, so the finish reason is read first.
- Live, two runs from Iran: 24 of 24 calls schema-valid and grounded on the first attempt on the four routes; median 1.4 to 1.9 s; US$0.16 to 0.18 per 1,000 calls for luna, Gemini Flash-Lite and DeepSeek, US$1.22 for Haiku 4.5 at Metis's live prices. Metis also serves the Responses API.
- Spike: 6 of 6 plain calls pass the schema; 4 of 4 seeded failures (a schema one and a grounding one, on gpt-5.6-luna and claude-haiku-4-5) fed back and corrected by the real model. npm test: 14 of 14 (re-ask with MockLanguageModelV4, OpenTelemetry); tsc clean.
- OpenTelemetry (@ai-sdk/otel): GenAI semantic-convention spans with model, finish reason and token counts; the prompt and answer are recorded by default, and recordInputs/recordOutputs false keeps listing text out.

Survey: four passes kept as appendix files (langchain-mastra.md, genkit-ax-tanstack.md, instructor-baml-pi.md, gateways.md), their scripts in lab/survey/. The main session re-checked each pass's load-bearing claims in the source or the registries before quoting them: LangChain's gpt-5.6 switch to the Responses API and its retries of validation failures; Mastra's PostHog telemetry and Enterprise-licensed folders in @mastra/core; Ax's postinstall into .claude/skills, its 352 of 386 commits by one author and eight majors in 2026; Genkit's zod 4 issue #3470; BAML's "legacy v0" branding (PR #4297); the pi-ai rename; LiteLLM's Anthropic output_format mapping and the PyPI malware advisory GHSA-5mg7-485q-xm76; Portkey's missing response_format and no commits since 2026-05-25.
Research note written (docs/research/2026-09-29-ai-layer-library.md) and indexed. ADR-0021 written and accepted with the owner's answers of 2026-09-29: the AI SDK's core and provider packages, one re-ask before review, and the Metis pass-through checks in CS-45 (added to CS-45 as criterion #7, with ADR-0021 and the note as references).
backlog task edit --ref replaces every reference; the first two uses dropped CS-44's link to CS-43's note, restored with the full list. --add-ref adds one.

task-reviewer: every criterion and Definition of Done item verified with its own evidence. It spot-checked 13 groups of claims against the evidence, the appendices, the installed packages and npm. In the lab, npm test passed 14 of 14 and the typecheck was clean; pnpm check exited 0; npm run wire reproduced the committed wire evidence. No blocking or high findings. Fixed:
- M1: ADR-0021 no longer calls Ax the only other native candidate; LangChain.js also reaches all four routes when configured.
- M2: ADR-0021 places ADR-0011's confidence per field on the ok outcome (CS-52 and CS-48).
- L1: the web path falls back without the model, as in ADR-0019 point 4.
- L2: the Responses API's output budget is cited to the live run.
- L3: the upgrade gate moves into packages/ai under the workspace lockfile in CS-45; the lab has no lockfile.
- L4: BAML's generated client is git-ignored.
- L5: Portkey's dates, "about 130 lines", the unused PROMPT_VERSION removed, and the survey outputs noted as not kept.
ADR-0021's status line records the same-day correction; the decision is unchanged. The test evidence was regenerated after the listing.ts change (14 of 14, tsc clean). AGENTS.md's AI-steps line now names ADR-0021, and docs/learnings.md has two new lines.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Surveyed twelve candidates for the AI layer: the AI SDK, the official SDKs, LangChain.js, Mastra, Genkit, Ax, BAML, pi-ai, instructor-js, TanStack AI, LiteLLM and Portkey. docs/research/2026-09-29-ai-layer-library.md compares them on every point of criterion 1, drawing on four appendix passes whose key claims were checked again.

ADR-0021 was accepted with the owner's answers: the AI SDK's core and provider packages under a thin layer of our own (a task registry, versioned prompts, one re-ask, typed outcomes, a PostgreSQL cache, cost and latency logs). The Metis pass-through checks went to CS-45 as its criterion #7.

Verified with the lab and its committed evidence (docs/research/2026-09-29-ai-layer-library/evidence):
- a no-network wire check showing the native structured-output parameter on all four Metis routes, with zero network requests;
- 24 of 24 live calls from Iran valid and grounded on the first attempt;
- the spike: 6 of 6 plain calls through the AI SDK passed the schema, and 4 of 4 seeded failures were fed back and corrected live by gpt-5.6-luna and Claude Haiku 4.5;
- npm test 14 of 14 (the re-ask with the SDK's mock model, and OpenTelemetry without listing text) and a clean typecheck in the lab;
- pnpm check passing;
- a task-reviewer pass with no blocking findings, whose medium and low findings were fixed.
<!-- SECTION:FINAL_SUMMARY:END -->
