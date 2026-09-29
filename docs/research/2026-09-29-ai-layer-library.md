# Which TypeScript library should Carshenas's AI layer be built on?

- Date: 2026-09-29
- Asked by / for: Pedrum, for CS-44. Carshenas will call several models for different steps (extraction, duplicate decisions, query understanding, explanations) through Metis AI (ADR-0019), and perhaps other providers later, so the code needs one abstraction that stays maintainable as steps and models change.
- Outcome: ADR-0021, accepted on 2026-09-29 with the owner's answers: the AI SDK's core and provider packages under a thin layer of Carshenas's own, one re-ask before review, and the Metis pass-through checks in CS-45. A lab and evidence folder, `2026-09-29-ai-layer-library/`: what the AI SDK puts on the wire to Metis's four routes, 24 of 24 live calls from Iran valid and grounded on the first attempt, the re-ask spike (14 tests with no network; four seeded failures corrected live by gpt-5.6-luna and Claude Haiku 4.5), and what its OpenTelemetry spans record. Four survey passes are kept beside it as appendix files.

## Questions

1. Which open-source libraries could carry the AI layer of a TypeScript stack (Next.js 16 for the web app, a Node.js worker), and what does each one do? The task names the Vercel AI SDK, LiteLLM, instructor-js, BAML, Mastra and LangChain.js; CS-43 added pi-ai. The baseline is the providers' official SDKs, which CS-42 showed working against Metis, with a thin layer of our own.
2. For each candidate:
   1. **Compatibility with Metis.** Can each provider's base URL be set? Does it speak the routes ADR-0019 requires for structured output: OpenAI Chat Completions with `response_format` json_schema strict at `/openai/v1`, Anthropic Messages with `output_config.format` at `/anthropic`, Gemini `generateContent` with `responseJsonSchema`, and DeepSeek in JSON mode?
   2. **Structured output.** Does it use each provider's native strict mode, validate the answer against a zod schema, and re-ask with the validation error fed back? How many times, and with what message?
   3. **Streaming and tool calling.**
   4. **Usage and cost reporting.** Tokens split into cached, cache-write, output and reasoning; the model that answered; the provider's request id; cost.
   5. **OpenTelemetry.** Does it emit spans, and can prompts and listing text be kept out of them?
   6. **Test doubles.** A mock model, recorded replies, or a custom `fetch`, so tests run with no network.
   7. **Maintenance activity and licence.** Releases, commits, contributors, open issues and downloads, and the licence.
   8. **What CS-43 added.** Typed refusals, truncation and empty answers; no dependence on log-probabilities; a place for a registry per task, versioned prompts and a cache keyed by input hash.
3. Does the front-runner reach Metis's native routes on the wire, from Iran, and return output that passes the schema? Does its re-ask path correct a validation failure?
4. Where does the library stop and Carshenas's own code begin: the registry, versioned prompts, validation with bounded retries, the cache keyed by input hash, and cost and latency logging (ADR-0011 point 6)?

## Method

- **What was already known is not repeated.** CS-42 measured Metis's routes with the official SDKs (`2026-09-29-metis-ai.md`); CS-43 set the design rules the layer must follow (`2026-09-29-prompting-context-engineering-and-agents.md`, section "What Carshenas adopts"). This note cites both.
- **Documentation** through Context7 (the AI SDK at `/websites/ai-sdk_dev`, and each candidate's library id, named in its appendix), read on 2026-09-29.
- **Activity and licences** from the GitHub API (repository, releases, commits since 2026-07-01, contributors) and the npm registry (latest version and date, dependencies, weekly downloads for 2026-09-21 to 27), read on 2026-09-29.
- **Source code** where the documentation is silent, cited as `path@commit:lines` or, for installed packages, `package@version file:line`.
- **Four survey passes**, one per group of candidates, each kept as an appendix file with its method, its sources and the claims the main session checked again before this note quotes them:

  | File | Candidates | How they were checked |
  |---|---|---|
  | `langchain-mastra.md` | LangChain.js, Mastra | run against a stub `fetch` (`lab/survey/langchain`, `lab/survey/mastra`), source |
  | `genkit-ax-tanstack.md` | Genkit, Ax, TanStack AI | source and resolved lockfiles |
  | `instructor-baml-pi.md` | instructor-js, BAML, pi-ai | probes against fakes and a local mock server (`lab/survey/instructor`, `baml`, `pi`), source |
  | `gateways.md` | LiteLLM, Portkey's open-source gateway | source, advisories |

  No survey probe called Metis or any paid API.
- **The front-runner measured** in `2026-09-29-ai-layer-library/lab/` (its README says how to rerun it), with the runs quoted here copied into `evidence/`:
  - [L1] `wire.ts`: each provider package pointed at Metis with a stub `fetch`, no network and no key, recording the request and how canned refusals, truncations and empty answers surface (`evidence/wire-2026-09-29.json`).
  - [L2] `live.ts`: the four routes from an Iranian network, three synthetic listings each, twice (`evidence/live-first-run-2026-09-29.json`, `evidence/live-2026-09-29.json`), plus one call on OpenAI's Responses API.
  - [L3] The spike: `reask.test.ts` with the SDK's mock model, and `spike.ts` live (`evidence/spike-2026-09-29.json`, `evidence/tests-2026-09-29.txt`).
  - [L4] `telemetry.test.ts`: what `@ai-sdk/otel` puts on spans (`evidence/tests-2026-09-29.txt`).
  - The lab's calls cost US$0.0054 (the second live run's 12 priced calls) and US$0.0073 (the spike) at Metis's live prices.

Anything not checked is marked UNVERIFIED.

## Sources

**The AI SDK** (Vercel; documentation read through Context7 on 2026-09-29; the source is the published npm packages at the versions named)
- [AISDK-SD] "Generating Structured Data", https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data — the maker's documentation: `generateText` with `Output.object`, and its two errors.
- [AISDK-NOGE] "AI_NoObjectGeneratedError", https://ai-sdk.dev/docs/reference/ai-sdk-errors/ai-no-object-generated-error — the error's properties (text, response, usage, finish reason, cause).
- [AISDK-TEST] "Testing", https://ai-sdk.dev/docs/ai-sdk-core/testing — `MockLanguageModelV4`, `simulateReadableStream`.
- [AISDK-TEL] "Telemetry", https://ai-sdk.dev/docs/ai-sdk-core/telemetry, and "Migration Guide 7.0", https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0 — `registerTelemetry`, `@ai-sdk/otel`, `recordInputs` and `recordOutputs`; the 7.0 renames (`instructions`, `telemetry`, `result.finalStep`).
- [AISDK-PROV] "Provider & Model Management", https://ai-sdk.dev/docs/ai-sdk-core/provider-management, and "customProvider", https://ai-sdk.dev/docs/reference/ai-sdk-core/custom-provider — registries, aliases, `defaultSettingsMiddleware`.
- [AISDK-ANT] "Anthropic provider", https://ai-sdk.dev/providers/ai-sdk-providers/anthropic, and "Migration Guide 6.0", https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0 — `createAnthropic` options, `structuredOutputMode`.
- [AISDK-CACHE] "Caching Responses", https://ai-sdk.dev/docs/advanced/caching — caching through language-model middleware.
- [AISDK-SRC] The packages installed by the lab, read on 2026-09-29: `ai@7.0.122`, `@ai-sdk/openai@4.0.81`, `@ai-sdk/anthropic@4.0.68`, `@ai-sdk/google@4.0.85`, `@ai-sdk/deepseek@3.0.56`, `@ai-sdk/provider-utils@5.0.51`, `@ai-sdk/otel@1.0.122`. Lines are cited where used.
- [AISDK-GH] https://github.com/vercel/ai — Apache-2.0 (the LICENSE file is the short Apache notice, so GitHub reports NOASSERTION); activity from `gh api` on 2026-09-29.

**The official SDKs** (the makers' own)
- [OAI-SDK] https://github.com/openai/openai-node, `openai@7.23.0` (`helpers/zod.d.ts:84, 106`: `zodResponseFormat`, `zodTextFormat`).
- [ANT-SDK] https://github.com/anthropics/anthropic-sdk-typescript, `@anthropic-ai/sdk@0.129.0` (`helpers/zod.d.ts:12`: `zodOutputFormat`).
- [GOO-SDK] https://github.com/googleapis/js-genai, `@google/genai@2.24.0`.
- [CS42-SDK] `2026-09-29-metis-ai/evidence/sdk-2026-09-29.json`: each SDK returned a schema-valid answer through Metis with only the base URL and the key changed.

**The candidates** — each appendix lists its own sources, about 60 in all: repositories at recorded commits, npm tarballs, the vendors' documentation, GitHub advisories, issues and pull requests, PyPI, and two press releases.

**Metis and the project**
- ADR-0019 (Metis's native routes, the key in the environment, degrading when it is down); ADR-0011 point 6 (LLM steps); ADR-0016 (logging); ADR-0018 (failures retried at one layer).
- `2026-09-29-metis-ai.md` [CS42] and `2026-09-29-prompting-context-engineering-and-agents.md` [CS43], with its appendix `structured.md` §A (how libraries re-ask).
- Metis's live prices, `GET https://api.metisai.ir/api/v1/meta/providers/pricing` (no key), read by the lab on 2026-09-29; the rows used are in `evidence/live-2026-09-29.json`.

**Measured here**
- [L1] to [L4], as listed under Method.

## Findings

### 1. The candidates

| Candidate | What it is | Licence | Latest | Weekly downloads | Majors and churn | Activity since 2026-07-01 |
|---|---|---|---|---|---|---|
| **AI SDK** (`ai`, `@ai-sdk/*`) | Vercel's toolkit: one call shape over provider packages, with structured output, middleware, telemetry and mocks | Apache-2.0 | `ai` 7.0.122, 2026-09-28 | 30.4M (`ai`); 15.9M `@ai-sdk/openai`; 15.2M anthropic; 9.8M google | 5.0 2025-07-31, 6.0 2025-12-22, 7.0 2026-06-25 | 1,347 commits; 720 contributors; 510 open issues and 952 open pull requests |
| **Official SDKs** | `openai`, `@anthropic-ai/sdk`, `@google/genai`, each speaking its maker's API | Apache-2.0, MIT, Apache-2.0 | 7.23.0 (09-23), 0.129.0 (09-28), 2.24.0 (09-22) | 44.9M, 46.4M, 26.7M | openai 7.0 2026-07-27; genai 2.0 2026-05-07; anthropic still 0.x | 781, 274 and 145 commits |
| **LangChain.js** | A framework: chat models, parsers, agents | MIT | core 1.2.13, 2026-09-27 | 6.3M (core) | core 1.0 on 2025-10-17, then 1.x | 175 commits (squash merges); 1,120 contributors |
| **Mastra** | An agent framework on bundled copies of AI SDK 6 providers | Apache-2.0, except `ee/` folders under a source-available licence | core 1.71.0, 2026-09-25 | 2.0M | 1.0 on 2026-01-20, then 84 releases | 3,967 commits |
| **Genkit** | Google's framework: plugins, Dotprompt files, a developer UI | Apache-2.0 | 1.42.0, 2026-09-01 | 253k | 1.0 GA 2025-02-07; 2.0 (zod 4) undated | 45 commits touching `js/` |
| **Ax** | "DSPy for TypeScript": signatures, re-ask, optimisers | Apache-2.0 | 24.0.24, 2026-09-27 | 62k | 15 majors since 2024-10-21, eight in 2026 | 386 commits, 352 by one author |
| **BAML** v0 | A DSL with code generation and a Rust runtime; schema-aligned parsing | Apache-2.0 (npm says MIT) | 0.226.2, 2026-09-01 | 255k | 0.x; branded "legacy" v0 on 2026-07-31 | 18 of 659 commits in the v0 runtime |
| **pi-ai** | The provider layer of the pi coding agent | MIT | 0.87.1, 2026-09-22 | 6.6M | 0.x; eight breaking releases since 2026-07-01; renamed 2026-05-07 | 434 commits in `packages/ai` |
| **instructor-js** | A zod re-ask wrapper over the OpenAI client | MIT | 1.7.0, 2025-01-27 | 26k | — | none; last push 2025-01-27 |
| **TanStack AI** | A streaming chat SDK with UI clients | MIT | 0.63.0, 2026-09-27 | 551k | pre-1.0, 93 releases since 2025-12-04 | 442 commits |
| **LiteLLM** Proxy | A Python gateway service | MIT, except a proprietary `enterprise/` installed with the `proxy` extra | 1.103.0 on PyPI, 2026-09-27 | — | several release lines | 13,140 commits |
| **Portkey** gateway | A TypeScript gateway service | MIT | v1.15.2, 2026-01-12 | 292 (`@portkey-ai/gateway`) | a 2.0 branch, unreleased | none since 2026-05-25 |

Sources: [AISDK-GH], the npm registry and `gh api` on 2026-09-29 for the AI SDK and the official SDKs; the appendices for the rest.

### 2. Compatibility with Metis: what goes on the wire

ADR-0019 needs four things: Chat Completions with `response_format` json_schema strict, Anthropic's `output_config.format`, Gemini's `responseJsonSchema`, and DeepSeek in JSON mode. Metis's OpenAI-format wrappers drop structured output for Claude and Gemini [CS42], so a library that speaks only OpenAI's format fails this test.

| Candidate | OpenAI: json_schema strict | Anthropic: `output_config.format` | Gemini: `responseJsonSchema` | DeepSeek: JSON mode | Base URL, headers, `fetch` |
|---|---|---|---|---|---|
| **AI SDK** | Yes, with `.chat(id)` [L1, L2]; the default `openai(id)` uses the Responses API, which Metis also served [L2] | Yes, the generally available form, no beta header [L1, L2] | Yes [L1, L2] | Yes: `json_object`, the schema in a system message [L1, L2] | Yes, per provider |
| Official SDKs | Yes [CS42-SDK] | Yes [CS42-SDK] | Yes, schema passed by hand [CS42-SDK] | Yes, through `openai` [CS42-SDK] | Yes |
| LangChain.js | Only with `ChatOpenAICompletions`: `ChatOpenAI` sends any `gpt-5.6` model to the Responses API whatever the option says | Only with `method: "jsonSchema"`; the default is a forced tool call | Only with `method: "jsonSchema"` in `@langchain/google` | `jsonMode`, schema not in the prompt | Yes |
| Mastra 1.71.0 | Responses API for `openai/…`; a custom `url` turns every provider into OpenAI format | Yes, through an environment variable | No: the base URL is ignored and `responseSchema` is sent (fixed on main 2026-09-28, unreleased) | Yes | Partly |
| Genkit | json_schema without `strict` | No: no base-URL option; the deprecated beta `output_format` only | Yes | Schema in the prompt | Anthropic only through the environment |
| Ax | Yes (`AxAIOpenAI`) | Yes, after `setAPIURL`; beta headers by default | Yes, after `setAPIURL` | `json_object` | Yes |
| BAML | Never native: the schema goes in the prompt | Never native | Never native | Never native | Yes |
| pi-ai | Only as a forced strict tool, or by replacing the payload | Forced strict tool, `?beta=true` | Not verified: the adapter refuses a custom `fetch` | Compatibility settings needed | Yes |
| instructor-js | No: non-strict tools or `json_object`; with zod 4 the schema sent is empty | Forced tool; base URL only through the environment | Unreachable | `json_object` | OpenAI only |
| TanStack AI | Yes (the Chat Completions adapter) | Through the beta endpoint | `responseSchema` | not checked | Yes |
| LiteLLM | Passes through | The deprecated `output_format` with a beta header | `response_json_schema`, in snake_case | Passes `json_schema`, which Metis refuses | Yes |
| Portkey | Passes through | Dropped silently | `responseSchema`, key in the URL | Tools dropped | Yes |

### 3. Validation, re-ask and typed outcomes

CS-43 asked for a re-ask that carries the validation error, typed refusals, truncation and empty answers, and nothing that depends on log-probabilities; none of the candidates depends on log-probabilities.

| Candidate | Validates with zod 4 | Re-asks with the error | Refusal | Truncation | Empty answer |
|---|---|---|---|---|---|
| **AI SDK** | Yes: a failed parse or schema throws `NoObjectGeneratedError` with the text, usage, finish reason and the `ZodError` [AISDK-SD, AISDK-NOGE; `ai@7.0.122 dist/index.js:4214, 4228`] | **No**; the lab's `reask.ts` adds it in about 130 lines, tested [L3] | Anthropic and Gemini: finish reason `content-filter` [L1]; **OpenAI's `refusal` field is not read** (`@ai-sdk/openai@4.0.81` contains no "refusal"), so it arrives as an empty answer [L1] | `length` [L1] | Detected [L1] |
| Official SDKs | OpenAI and Anthropic parse helpers; Gemini by hand | No | Each SDK's own form | Each SDK's own form | Each SDK's own form |
| LangChain.js | Yes, but the error message carries the model's full text | Only in the agent API, without an attempt limit and without zod refinements; transport retries (six by default) re-send a validation failure as if transient: three paid calls at `maxRetries: 2` | Not typed; OpenAI's field dropped | `LengthFinishReasonError`, also retried | A missing forced tool call returns `undefined` |
| Mastra | Yes | Only with a second, structuring model: two calls per attempt | `undefined`, no error | Typed error | `undefined`, no error |
| Genkit | **zod 3 only** (issue #3470, open since 2025-08-24) | No | `other` | Not an error; partial JSON can pass | — |
| Ax | Yes (Standard Schema) | **Yes**, three re-asks by default, failed answers kept in the conversation | Typed by the provider layer, then re-sent up to four times and returned as a generic error | Checked after parsing, so re-asked first | Re-asked |
| BAML | Its own types | No: `retry_policy` covers network errors | An HTTP or validation error | **A cut answer becomes a silently truncated record** unless an allow-list is set | — |
| pi-ai | By hand, on tool arguments | No | Typed ("The model refused…") | `length` | Typed |
| instructor-js | **Crashes on the first failure** (`zod-validation-error` reads `errors`) | Yes, with zod 3 and `retryAllErrors` | None | A JSON `SyntaxError` | A JSON `SyntaxError` |
| TanStack AI | Yes | No | Folded into a normal finish | A run error | — |
| LiteLLM | Raises a JSON Schema error | No; the error is likely retried as a 500 | `content_filter` | `length`, except on the forced-tool path | — |
| Portkey | An optional guardrail that fails on nested JSON | No | **`stop`** | `length` | — |

### 4. Usage, OpenTelemetry and test doubles

| Candidate | Tokens: cache read, cache write, reasoning | Answering model; request id | Cost | OpenTelemetry | Listing text kept out of spans | Test doubles |
|---|---|---|---|---|---|---|
| **AI SDK** | All three [L1, L2] | Yes [L2]; the response headers, with `x-request-id` or `request-id` [L2] | Ours, from Metis's prices [L2] | `@ai-sdk/otel`, GenAI semantic conventions [L4] | Yes, with `recordInputs` and `recordOutputs` off; **both are on by default** [L4] | `MockLanguageModelV4`, middleware, `fetch` [L3] |
| Official SDKs | Each SDK's own fields | Yes | Ours | None built in | — | `fetch` |
| LangChain.js | Yes | Model yes; request id no | No | None; LangSmith only | LangSmith switches | A fake model that skips parsing |
| Mastra | Yes | Yes | Its own price list | Separate packages | Per call | Mocks; `fetch` only through AI SDK objects |
| Genkit | Varies by plugin | Raw only | No | Its own SDK; spans carry the full input and output | **No switch** | `mockModel` |
| Ax | Yes | Requested model only; request id yes | Built-in list prices | Spans without text, except failures | Mostly | `AxMockAIService`, `fetch` |
| BAML | No cache writes or reasoning | Raw only | No | None; a vendor service | **Prompts logged by default** | A local server, `b.request`, `b.parse` |
| pi-ai | Yes, with cost | Yes | Custom prices | None | — | A faux provider |
| instructor-js | Raw | No | No | None; **prompts printed to the console**, no switch | — | A fake client |
| TanStack AI | Yes | — | Provider-reported | A middleware, content off by default | Yes | None shipped |
| LiteLLM | Yes | Yes | Custom prices; spend logs in PostgreSQL through Prisma | Native | Switchable | Restricted on the proxy |
| Portkey | Partly | Yes | No | None | Log stream always on in v1.15.2 | None |

Streaming and tool calling: every candidate streams and calls tools, except that BAML parses tools from text, instructor-js has only its forced response tool and pi-ai always streams. Carshenas needs streaming only for explanations (CS-64) and no step uses tools (CS-43, pattern 29).

### 5. Maintenance, licence and footprint

- **The AI SDK** is the most active and most used: 1,347 commits and 30.4M weekly downloads of `ai`, Apache-2.0 [AISDK-GH]. Its price is churn: a major version about every six months, each with a migration guide (6.0 deprecated `generateObject`; 7.0 renamed system messages to `instructions`, `experimental_telemetry` to `telemetry`, and moved the tracer into `@ai-sdk/otel`) [AISDK-TEL]. The runtime set the lab installs is 16 packages and about 29 MB, plus zod, which the repository already has.
- **The official SDKs** are the makers' own, active, and light (`openai` has no runtime dependencies; `@google/genai` pulls `google-auth-library`, `protobufjs` and `ws`).
- **Warnings from the survey**, each checked again by the main session:
  - Mastra ships Enterprise-licensed code inside `@mastra/core` (`dist/auth/ee`, `dist/agent-builder/ee`), whose licence says "They are not open source" and allows production use only with a written agreement and a licence key, and it embeds PostHog product telemetry that is on unless `MASTRA_TELEMETRY_DISABLED` is set (`langchain-mastra.md`).
  - Ax's `postinstall` writes Claude Code skills into the installing project's `.claude/skills/`, unless `CI` is set or `AX_SKIP_SKILL_INSTALL=1`; 352 of its 386 commits since July are by one author; eight major versions in 2026 (`genkit-ax-tanstack.md`).
  - LiteLLM's PyPI releases 1.82.7 and 1.82.8 carried a credential stealer on 2026-03-24 (GHSA-5mg7-485q-xm76, critical), and the advisory database lists 27 reviewed LiteLLM advisories published in 2026 (`gateways.md`).
  - Portkey's gateway has had no commit since 2026-05-25, around Palo Alto Networks' acquisition of Portkey (announced 2026-04-30, closed 2026-05-29), with an SSRF bypass (CVE-2026-82270) unpatched (`gateways.md`).
  - instructor-js has had no commit since 2025-01-27 and fails with zod 4; BAML's npm line is branded legacy; Genkit waits for a 2.0 to support zod 4 (the appendices).
- **Footprints:** LangChain.js 48 packages and 113 MB; Mastra 152 and 132 MB; Genkit 527 dependencies (235 required); pi-ai 85 and 94 MB; BAML a 55.5 MB native binary with a code-generation step and a client that Node's type stripping cannot run; LiteLLM a Python service with an 83-table Prisma schema and a 4 GiB memory floor (vendor); Ax three packages in a 22 MB bundle.

### 6. The AI SDK measured through Metis

**What goes on the wire [L1].** With `fetch` stubbed, each provider package was asked for the same structured answer. Node's diagnostics channels saw no network request during the run, so the SDK made none of its own; in the live run the same watch saw each of the 14 requests, all to `api.metisai.ir`.

| Provider package, pointed at Metis | Request | Structured output | Output budget | Key |
|---|---|---|---|---|
| `@ai-sdk/openai` 4.0.81, `.chat(id)` | `POST /openai/v1/chat/completions` | `response_format: {type: "json_schema", json_schema: {strict: true, name, schema}}` | `max_completion_tokens`, `reasoning_effort`; instructions as a `developer` message | `Authorization: Bearer` |
| `@ai-sdk/openai`, the default `openai(id)` | `POST /openai/v1/responses` | `text.format: {type: "json_schema", strict: true}` | `max_output_tokens`, `reasoning`, seen in the live run [L2]; the wire check set neither | Bearer |
| `@ai-sdk/anthropic` 4.0.68 | `POST /anthropic/v1/messages` | `output_config.format: {type: "json_schema", schema}`, no beta header | `max_tokens` | `x-api-key` |
| `@ai-sdk/google` 4.0.85 | `POST /v1beta/models/{model}:generateContent` | `generationConfig.responseMimeType` and `responseJsonSchema` | `maxOutputTokens` | `x-goog-api-key` |
| `@ai-sdk/deepseek` 3.0.56 | `POST /deepseek/v1/chat/completions` | `response_format: {type: "json_object"}`, the schema in a system message | `max_tokens` | Bearer |

- The schema is zod's own `toJSONSchema` output (`@ai-sdk/provider-utils@5.0.51 dist/index.js:3229`): every field required, `additionalProperties: false`, the enums intact, and a draft-07 `$schema` key that all three native routes accepted live [L2].
- OpenAI's strict flag defaults to on (`@ai-sdk/openai@4.0.81 dist/index.js:1248`). The Anthropic package uses `output_config.format` for models it recognises by id, Claude Haiku 4.5 and later (`@ai-sdk/anthropic@4.0.68 dist/index.js:4377-4386, 4552`); for another model on an Anthropic-format route it falls back to a JSON tool unless `structuredOutputMode: 'outputFormat'` is set [AISDK-ANT].
- A plain string model id would go to Vercel's AI Gateway, the SDK's global default provider (`ai@7.0.122 dist/index.js:1117-1130, 1279`); the layer must pass provider objects only.

**Live, from Iran [L2].** Two runs, three synthetic listings per route each (CS-42's listings, copied byte for byte), through the lab's re-ask layer with one re-ask allowed:

| Route, model | Valid and grounded on the first attempt | Agrees with the expected facts | Median latency (min–max), ms | Median tokens in / out | Per 1,000 calls at Metis's live price | Answering model |
|---|---|---|---|---|---|---|
| OpenAI, gpt-5.6-luna | 6 of 6 | 6 of 6 | 1,632 (1,118–2,271) | 469 / 45 | $0.16 | `gpt-5.6-luna` |
| Anthropic, claude-haiku-4-5 | 6 of 6 | 6 of 6 | 1,410 (1,340–3,038) | 848 / 56 | $1.22 | `claude-haiku-4-5-20251001` |
| Gemini, gemini-3.1-flash-lite | 6 of 6 | 5 of 6 | 1,514 (1,189–1,716) | 274 / 60 | $0.18 | `gemini-3.1-flash-lite` |
| DeepSeek, deepseek-v4-flash | 6 of 6 | 6 of 6 | 1,856 (1,189–3,998) | 587 / 205 | $0.17 | `deepseek-flash` |

- Every evidence quote was copied exactly, zero-width non-joiners included, so no call needed its re-ask. The one disagreement was Gemini reading «دو لکه رنگ روی گلگیر جلو» as partial paint rather than spots, the ambiguity CS-42 already noted.
- The per-1,000 figure is the median cost of the second run's three calls, priced from Metis's live endpoint (gpt-5.6-luna is priced in tiers by context length). DeepSeek reasoned by default: 120 to 962 reasoning tokens of its output.
- Metis also served the **Responses API**: `openai(id)` returned a valid answer in 1,652 ms, which CS-42 had not checked. ADR-0019 keeps Chat Completions.
- The OpenAI route returned `x-request-id` and rate-limit headers, the Anthropic route `request-id` and rate-limit headers, and the Gemini route only `server-timing`; the DeepSeek route returned none of these.

**Typed outcomes [L1, L3].** From canned replies in each provider's format:

| Reply | OpenAI | Anthropic | Gemini | DeepSeek |
|---|---|---|---|---|
| A refusal | **Empty**: the `refusal` field is dropped | Refusal (`content-filter`, raw `refusal`) | Refusal (`content-filter`, raw `SAFETY`) | — |
| Cut at the token limit | Truncated (`length`) | Truncated | Truncated | Truncated |
| No text | Empty | Empty | Empty | Empty |

Two traps for CS-45:
- With no text, a refusal or truncation does not throw. `generateText` parses the output only when the finish reason is `stop`, or when there is text and no tool call (`ai@7.0.122 dist/index.js:6855`), and reading `result.output` then throws `NoOutputGeneratedError`. So the layer reads the finish reason first.
- OpenAI's refusal must be read from the raw response body.

**The spike [L3].** `reask.ts` wraps `generateText` with `Output.object`. It runs the grounding checks in code and feeds any failure back once with a fixed context: the input, the last answer and each problem, naming the field, the value seen and what is allowed. The same answer twice stops the loop. The result is a typed outcome.
- **With no network** (`reask.test.ts`, 12 tests on the SDK's `MockLanguageModelV4`):
  - a schema failure and a grounding failure are each fed back and corrected;
  - an answer still invalid after the re-ask returns a typed failure and never the value;
  - the re-ask carries only the last answer;
  - a repeated answer stops;
  - refusals, truncations and empty answers, with and without text, are not re-asked.
- **Live** (`spike.ts`), on gpt-5.6-luna and claude-haiku-4-5:
  - Six plain calls passed the schema and the checks on the first attempt.
  - Then an AI SDK middleware answered each model's first call with a seeded mistake: `paint: "unpainted"`, outside the enum, and evidence «بی رنگ» retyped with a space for the zero-width non-joiner. The re-ask went to Metis. It said, for example, `- paint: Invalid option: expected one of "none"|"spots"|"partial"|"full"|"not_stated"; received "unpainted".`
  - All four came back corrected, grounded and schema-valid, in 1,252 to 1,536 ms.

**OpenTelemetry [L4].**
- **What the spans carry:** with `@ai-sdk/otel` and an in-memory exporter, one call made three spans (`invoke_agent`, `step 1`, `chat`). Their attributes follow the GenAI semantic conventions: the requested and answering model, finish reasons, input, output, cache-read and cache-write tokens, and the operation's duration.
- **The default:** the prompt and the answer are recorded, so a listing's text would reach the traces.
- **The fix:** with `recordInputs: false` and `recordOutputs: false`, no span attribute held the listing, the answer or the instructions.

**Transport retries.** The SDK retries twice by default (`maxRetries`), backing off from 2 s by a factor of two and honouring `retry-after-ms` and `retry-after`. It retries only errors a provider marks retryable (`ai@7.0.122 dist/index.js:2955-3001`). ADR-0018 retries a failure at one layer and ADR-0019 retries model jobs in the queue, so the worker sets `maxRetries: 0`; the lab does too.

### 7. What the library leaves to Carshenas

The AI SDK covers the calls themselves:
- one request shape and native structured output on the four routes;
- validation against zod with typed errors;
- normalised usage, finish reasons and the answering model;
- transport retries, middleware, OpenTelemetry spans, and mocks.

The rest is the project's, and CS-45 builds it; the lab's `reask.ts` and `pricing.ts` are its seed:
1. **The registry** (CS-43, pattern 7): one typed entry per task, holding:
   - the model (a provider object built for Metis, never a string id) and its fallback model (ADR-0019 point 4);
   - the prompt and its version, the schema and the checks;
   - the reasoning effort, output budget, timeout and number of re-asks.

   The SDK's `customProvider` and `defaultSettingsMiddleware` [AISDK-PROV] can hold model aliases, but a task needs more than a model.
2. **Versioned prompts** (patterns 8, 18): the instructions and the glossary in code, versioned by a content hash, with the variable input last and rendered prompts snapshotted in tests. With the AI SDK the project writes every word of the prompt; Ax or BAML would write part of it.
3. **Validation with a bounded re-ask and typed outcomes** (patterns 3 to 6): the lab's `generateChecked`, plus reading OpenAI's `refusal` field and choosing Anthropic's structured-output mode explicitly.
4. **A cache keyed by input hash** (pattern 9) in PostgreSQL (ADR-0011): in front of the checked call, storing validated results only. A hit makes no request. The SDK's middleware can host it at the model level [AISDK-CACHE], but only a validated answer is worth caching.
5. **Cost and latency logging** (pattern 10): one log line per call through `packages/observability`, with:
   - the task and prompt version;
   - the requested and answering model and the request id;
   - tokens split into uncached, cache read, cache write, output and reasoning;
   - the latency, the attempts and the outcome;
   - the cost at Metis's live price.

   It carries no text. Spans come through `@ai-sdk/otel` with inputs and outputs off.

## Recommendation

- **Build the layer on the AI SDK's core and provider packages, not on a framework or a gateway:**
  - `ai`, `@ai-sdk/openai` (Chat Completions through `.chat()`), `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/deepseek` and `@ai-sdk/otel`;
  - pinned to exact versions;
  - each provider created with Metis's base URL and `METIS_API_KEY`.
- **The layer on top is Carshenas's own, thin:** the registry, versioned prompts, checks and one re-ask, typed outcomes, a PostgreSQL cache, cost and latency logs. It is used only through `packages/ai` (CS-45).
- **Why the AI SDK:**
  - Through it, the lab put all four of ADR-0019's structured-output parameters on the wire and got valid answers back from Iran (24 of 24). Of the rest, only LangChain.js, when configured for it, and Ax reach all four natively (section 2).
  - It leaves the prompt entirely to us.
  - It types outcomes well enough to build on.
  - Its OpenTelemetry spans can be kept free of listing text.
  - It ships mocks and middleware.
  - Its maintenance is the strongest of the set.
- **Runners-up:**
  - The official SDKs with our own adapters are the fallback. They are proven on Metis, but they mean four request shapes, three usage shapes and three error hierarchies to map, plus telemetry and test doubles to write.
  - Ax re-asks by itself, but it writes part of the prompt, depends on one maintainer, changes major version every few weeks and re-sends refusals.
- **The trade-offs accepted:**
  - A major version about every six months: pin exactly, and rerun the wire check, the re-ask tests and a live run before any upgrade. They are the lab's (`npm run wire`, `npm test`, `npm run live`) until CS-45 moves them into `packages/ai`, under the workspace's lockfile; the lab has no lockfile, so its transitive dependencies (such as `undici` and `eventsource-parser`) can drift between installs.
  - About 130 lines of our own for the re-ask.
  - Two gaps to cover in the layer: OpenAI's `refusal` field, and Anthropic's mode for models it does not recognise.
  - `@ai-sdk/gateway` and `@vercel/oidc` installed as dependencies of `ai` but never used.
- **What would change this recommendation:**
  - an AI SDK release that drops Chat Completions or a native structured-output mode the lab relies on;
  - a model chosen in CS-46 that Metis serves only in a format the SDK's providers do not speak;
  - the layer needing one of Ax's optimisers at run time rather than offline;
  - Metis moving to a format that only a gateway translates.

## Decisions and follow-ups for the owner

The owner answered the first three on 2026-09-29, each with the recommended option; ADR-0021 records them.

1. **The library** (ADR-0021): the AI SDK, as above. *Decided: the AI SDK's core and provider packages.*
2. **How many re-asks** before an item goes to review. CS-43 recommends one. PARSE measured 92% fewer extraction errors within the first retry when the error was fed back with guardrails, compared with a plain re-prompt [CS43, `structured.md` §A.3]. A second retry pays again for less, and the same answer twice stops the loop. *Decided: one.*
3. **Where CS-43's Metis pass-through checks go.** These cover prompt caching (`cache`, Anthropic's `cache_control`), batch, log-probabilities, Gemini's `responseFormat` and the latency Metis adds at the 95th percentile. CS-43 left them "for CS-44's spike or CS-45". They shape the layer's caching and cost, not the choice of library. *Decided: CS-45, measured through the layer.*
4. For CS-45:
   - read OpenAI's `refusal` from the raw response;
   - set Anthropic's `structuredOutputMode` explicitly;
   - read the finish reason before `output`;
   - never pass a string model id, and forbid `ai`'s UI, agent and gateway entry points by lint;
   - switch off `recordInputs` and `recordOutputs`;
   - set `maxRetries: 0` in the worker.
