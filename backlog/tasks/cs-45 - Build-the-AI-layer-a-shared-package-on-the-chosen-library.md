---
id: CS-45
title: 'Build the AI layer: a shared package on the chosen library'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-29 19:15'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
The owner answered the plan questions on 2026-09-29, each with the recommended option: ai_answer is the durable record of validated answers (6); the worker gets the hook and the start check (8); the outage switch to a fallback model is follow-up CS-82, after CS-46 (14); billing is checked on the Metis dashboard before and after the run (11). From then on the owner asked for decisions to be taken on the recommendation without asking.

1. Scaffold packages/ai (@carshenas/ai): TypeScript source run as is, like packages/db and packages/observability. The AI SDK packages are pinned exactly as ADR-0021 says (ai 7.0.122, @ai-sdk/openai 4.0.81, anthropic 4.0.68, google 4.0.85, deepseek 3.0.56, otel 1.0.122, provider 4.0.19), with zod 4.6.5. Lint uses the shared-package rules, plus: a model is never a string literal; no import of the UI, agent, gateway or MCP entry points of the SDK, @ai-sdk/gateway or @vercel/oidc. In apps/web and apps/worker, ai and @ai-sdk/* are reachable only through @carshenas/ai.
2. Metis and the registry.
   - Model choices (openai, anthropic, google and deepseek, each with an id and its provider options) resolve to provider objects created with the Metis base URLs and the key: OpenAI through .chat(), and Anthropic with structuredOutputMode outputFormat set explicitly.
   - defineTask holds the instructions and glossary, a zod schema in the portable profile of CS-43, a render function that puts the variable input last, and checks in code.
   - One registry file maps each task to its model, fallback and settings (output budget, timeout, re-asks, provider options), so switching a model is a one-line change.
   - The product registry starts empty: CS-52 adds the first task and CS-46 names the models. Tests and scripts pass their own registries through the same code.
3. Versioned prompts: the version is a content hash of the instructions, schema and settings. Rendered prompts are snapshotted with node:test, and a test proves that two renders share a byte-identical prefix.
4. The checked call, generateChecked from the lab, hardened:
   - maxRetries is 0, with the timeout of the task plus the signal of the caller;
   - the finish reason is read first; the OpenAI refusal field is read from the raw response body;
   - the schema runs, then the checks, then one re-ask with a fixed context (the input, the last answer, and each problem with its field, the value seen and what is admissible); the same answer twice stops the loop;
   - the outcomes are ok, invalid, refusal, truncated and empty;
   - a provider error is thrown as a typed error that says whether it is retryable, so the queue retries it and a 429 backs off there.
5. The cache (#3): the key is the SHA-256 of a versioned tuple of task, prompt version, provider and model, and the rendered input. Only ok answers are stored. A hit re-validates the stored answer against the current schema and checks, where a stale answer counts as a miss, and a hit sends no request. An AnswerCache interface has a PostgreSQL implementation and an in-memory one for tests and scripts.
6. The table ai_answer:
   - one row per validated answer: the unique cache_key (32 bytes), task, prompt_version, provider, model, answering_model, output jsonb (an object), cost_usd_micros (null when the price is unknown) and created_at;
   - never updated, and kept across prompt versions;
   - carshenas_worker gets SELECT and INSERT; the web role gets nothing until CS-62;
   - the work: the migration, schema tests and codegen; a db test as the worker role in pnpm db:check; EXPLAIN (ANALYZE, BUFFERS) of the lookup and the insert on seeded rows; data-model.md updated (the planned extraction table of layer 2 points at ai_answer, and the purge is noted for CS-52 and CS-60); a database-reviewer pass.
7. The log (#4): one line per call through the given Logger, holding:
   - the task, prompt version, provider, requested and answering model, and request id;
   - the outcome, attempts, cached and fallback flags, and the latency;
   - the tokens: uncached input, cache read, cache write, output and reasoning;
   - the cost in USD at the live Metis price, from a price book loaded from the pricing endpoint and refreshed daily (null when unknown).

   A line never holds the prompt, input or output: a test plants a phone number and a marker and asserts that neither appears. Spans go through @ai-sdk/otel with recordInputs and recordOutputs off, into the tracer of the project, and a test shows the spans carry no text.
8. The key (#6): the package never reads the environment, and createAi refuses a missing or blank key with a typed error whose message says where to set METIS_API_KEY. The worker reads the key in src/env.ts. At start, the worker creates the layer only when a registered job declares that it calls models, and such jobs get it as context.models. So a missing key stops the worker at start, before any job is claimed. The worker as it is today, pnpm check and a fresh clone need no key.
9. Tests with no network (#5):
   - MockLanguageModelV4 for the call logic;
   - recorded Metis replies, captured from the live run on synthetic listings, plus hand-made refusal, truncation and empty variants, replayed through a stub fetch as the wire check of all four routes;
   - a guard that fails any real network request;
   - all of it in pnpm check.
10. The upgrade gate moves from the lab into the package: pnpm --filter @carshenas/ai live runs the four routes through the layer, and the lab README points to it.
11. The Metis pass-through checks (#7), through the layer with the cache off. The stable prefix of a probe task passes the caching minimum of each model family. The checks:
    - the Metis cache parameter on each native route, and the Anthropic cache_control at 5m and 1h: the usage fields, and billing: the owner reads the consumption of the key on the Metis dashboard just before and after the run, with nothing else using the key, and it is compared with the expected cost of each call with and without the cache discounts;
    - OpenAI and Anthropic batch;
    - log-probabilities on OpenAI and Gemini;
    - the Gemini responseFormat against responseJsonSchema;
    - the latency Metis adds: total minus the processing time the provider reports, at p50 and p95 over N calls per route.

    The budget is under US$0.25. The evidence JSON is committed, and a dated section in the Metis note records what it changes.
12. Docs: docs/runbooks/ai-layer.md (add a task, switch a model, run the gate and the checks, read the call lines), the AGENTS.md map, data-model.md and learnings.
13. Verify: pnpm check, pnpm db:check, database-reviewer and task-reviewer, then check the criteria with evidence and move to In Review.
14. The automatic switch to the fallback model after an outage (ADR-0019 point 4) is follow-up CS-82, after CS-46 names the fallbacks; this task keeps a fallback slot in the registry and logs which model answered.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Slice 1 (2026-09-29), packages/ai (@carshenas/ai), with the AI SDK pinned as ADR-0021 says; the lockfile resolved exactly the versions the CS-44 lab verified.
- metis.ts: model choices and the four native routes. Anthropic structuredOutputMode outputFormat, OpenAI strictJsonSchema and Google structuredOutputs are set on every call.
- task.ts: defineTask, the settings, the registry types, and the prompt version (the first 16 hex digits of the SHA-256 of the instructions, the JSON Schema and the output budget).
- call.ts: the checked call from the lab, hardened. It reads the finish reason first, returns structured problems, and throws provider errors as ModelCallError with a reason and whether retrying can help. The OpenAI refusal is read from the raw response body, which needs include.responseBody: the SDK drops the body by default, so the lab could not have read it.
- answer-cache.ts: the cache key (SHA-256 over task, prompt version, provider, model id, model options and rendered input) and an in-memory cache.
- pricing.ts: the live Metis price list, parsed with zod: tiers, 5m and 1h cache-write rates, and a daily refresh.
- ai.ts: createAi refuses a missing key. call(task, input) re-checks a cached answer, prices each call and writes one "model call completed" line without text. The typed public call is an overload over an untyped implementation, since a generic registry cannot be indexed without it.
- Lint: only call.ts may import generateText, and a string model is an error. The web app and the worker may not import ai or @ai-sdk/*: a web lint self-test sample proves it, and lint refused a planted import in a worker job.
- Tests: 87, with no network (a guard rejects the global fetch and watches undici and node:http), including the wire check of the four routes moved from the lab. pnpm check passes.

Slice 2 (2026-09-29): the ai_answer table and the worker hook.
- Migration 20260929183019_create_ai_answer: one row per validated answer, with named CHECKs for the key (32 bytes, unique), task, prompt version, provider, model names, an object output and a cost within the amount bound. The worker gets SELECT and INSERT; the web role gets nothing until CS-62. Squawk is clean; codegen overrides are added for the identity id and the provider union.
- packages/ai/src/answer-store.ts: postgresAnswerCache, a lookup by the key and INSERT ON CONFLICT ON CONSTRAINT ai_answer_cache_key_unique DO NOTHING. json.ts now has its own mutable JSON types, because the SDK JSON types are read-only and the database types are not.
- Tests: schema-constraints.test.ts has a test per constraint (SQLSTATE and name) and one for the grants (the worker may read and insert but never update or delete; the web role reads nothing; the read-only role reads).
- Worker: jobs declare callsModels and get context.models. startModels creates the layer at start only when such a job is registered, checking the key before anything is fetched. main.ts calls it before the runtime starts. Jobs see NO_MODELS otherwise, and may not import models.ts (lint). models.test.ts covers the layer creation, and spawns a real start without the key: one fatal line starting "METIS_API_KEY is not set", then exit 1 before worker started.
- models.db.test.ts, on the worker role in pnpm db:check: a repeated call is answered from ai_answer with no request, even from a second layer instance, and two answers to one key keep the first.
- EXPLAIN (ANALYZE, BUFFERS) at 100,000 answers, on the worker role:
  - the lookup is an index scan of ai_answer_cache_key_unique: 4 shared buffers, 0.045 ms on the first run and 0.021 ms on the second;
  - the insert reads 12 buffers in 0.230 ms;
  - the insert of a stored key reads 5 buffers in 0.179 ms, with 1 conflicting tuple.
- data-model.md: ai_answer is in What exists, the kinds and grants tables, and the diagrams; the planned extraction row now points at ai_answer instead of keeping its own cache key.
- pnpm check and pnpm db:check pass (22 integration tests).

Slice 3 (2026-09-29): the database-reviewer findings, and the live scripts.
- Blocking, fixed: a stored answer that failed the checks of a later check would have been re-asked forever, because the insert hit its key. A task now declares checks: { version, run }, and the version is part of the prompt version, so a changed check is a new key. The layer tests prove that a stale stored answer is never returned (the fresh one is, with a warning naming the checks version) and that a bumped version is asked once, then answered from the cache.
- Should-fix, fixed: put returns the stored row. The insert uses RETURNING id; when it returns nothing, a new statement reads the winning row. The caller of a lost race gets the first answer and its row, and every ok result carries answerId for CS-52.
- Should-fix, fixed: ai_answer_append_only and ai_answer_append_only_truncate on refuse_change_unless_purge. The unmerged migration was rolled back (0 rows) and edited; the schema tests prove 23000 for update, delete and truncate, and a delete inside a purge.
- Nits, fixed: the dollar-cost exception to ADR-0014 is written into the data model types rules; the plan labels say first run and second run; the database rule pack covers answer-store.ts; task names are capped at 100 characters, as the CHECK is.
- Noted for CS-52 and CS-60: an answer stored before a job fails leaves a row no extraction links to.
- Live run (scripts/live.ts): 12 of 12 calls ok on the first attempt on all four routes. The layer line carries the answering model, request id, token split, cost at the live price and latency. One real answer per route is recorded and replayed by wire.test.ts.
- Pass-through probe, recheck and latency: see the Metis note section added in the next slice.
- pnpm check passes (154 web tests, 95 package tests); pnpm db:check passes (22 integration tests).

Slice 4 (2026-09-29): what Metis passes through, and the docs.
- The database-reviewer re-check: all seven findings resolved, verdict ready. It ran its own evidence: 96 package tests, 48 schema tests, pnpm db:check and the plans.
- Pass-through, measured through the layer from Iran, 18:50 to 19:12 UTC, recorded in the Metis note as finding 9 with its evidence files:
  - the Metis cache parameter is refused by OpenAI, Anthropic and Gemini and ignored by DeepSeek;
  - each provider own prompt caching passes through (OpenAI 7,805 written then 7,741 read; Claude 9,496 written then read, at 5m and at 1h; Gemini 3,881 of 8,323 read; DeepSeek 7,808 read);
  - log-probabilities pass on the OpenAI route at effort none (the SDK drops them at a reasoning model default effort), and Gemini Flash-Lite refuses them;
  - Gemini responseFormat works with mimeType APPLICATION_JSON (3 of 3);
  - batch works on the OpenAI route (2 of 2 in 164 s), while Anthropic batches answer 404 from Metis;
  - Metis adds, beyond the provider own processing time, 317 / 779 ms (p50 / p95) on OpenAI and 385 / 1,428 ms on Gemini; its own price endpoint answers in 25 / 44 ms.
  - About US$0.09 at list price.
- Billing is still to be read on the Metis dashboard around the bill-baseline and bill-cached runs.
- Docs: docs/runbooks/ai-layer.md, AGENTS.md map, the lab README pointer to the gate in packages/ai, dated pointers in the CS-43 note, and three learnings lines.
<!-- SECTION:NOTES:END -->
