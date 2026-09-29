# Pass: LangChain.js and Mastra as Carshenas's AI layer (CS-44)

- Date: 2026-09-29. One of four survey passes behind `../2026-09-29-ai-layer-library.md`.
- Method: the published packages were run on Node 22.14 against a stub `fetch` that recorded each request and answered with canned provider replies; nothing reached the network and Metis was not called. The scripts are kept in `lab/survey/langchain/` and `lab/survey/mastra/` (exact versions in each `package.json`). Source was read at `langchain-ai/langchainjs@17b6bba8343bdd3f3dfc5c59578e0b72337ec740` (LC) and `mastra-ai/mastra@b844d1941a36bf30efd1d071e8d10471ecabb910` (MA); documentation through Context7.
- Marks: **[run]** checked by running the package; **[src]** read in the source; **[docs]** the vendor's documentation, read 2026-09-29.
- Re-checked by the main session before the note quotes them: LangChain's switch of every `gpt-5.6` model to the Responses API (LC `libs/providers/langchain-openai/src/utils/misc.ts:140-148`); LangChain's default retry handler, which retries any error without a status in its no-retry list, six times by default (LC `libs/langchain-core/src/utils/async_caller.ts:7-18, 258-300, 383`); Mastra's PostHog telemetry (MA `packages/core/src/telemetry/posthog.ts`); the Enterprise-licensed folders in the `@mastra/core` 1.71.0 tarball and the licence text (MA `ee/LICENSE`).

## LangChain.js

Packages run: `@langchain/core` 1.2.13, `@langchain/openai` 1.6.0, `@langchain/anthropic` 1.5.11, `@langchain/google` 0.2.8, `@langchain/deepseek` 1.1.15, zod 4.6.5.

### 1. Compatibility with Metis

- **OpenAI.** Base URL, headers and `fetch` through `configuration: {baseURL, defaultHeaders, fetch}` [docs]. `ChatOpenAI` defaults to Chat Completions but switches itself to the Responses API when built-in tools, custom tools or Responses-only options are used, or when the model name contains `gpt-5.2-pro`, `gpt-5.4-pro`, `gpt-5.5-pro`, `gpt-5.6` or `codex`; `useResponsesApi: false` does not override the model-name rule (LC `chat_models/index.ts:694-714`, `utils/misc.ts:140-148`) [src]. `model: "gpt-5.6"` was posted to `…/openai/v1/responses` [run]. The exported `ChatOpenAICompletions` forces Chat Completions: `POST https://api.metisai.ir/openai/v1/chat/completions` with `response_format: {type: "json_schema", json_schema: {name: "extract", strict: true, schema}}`, through the SDK's `chat.completions.parse` [run].
- **Anthropic.** Base URL through `anthropicApiUrl` or `clientOptions.baseURL`; headers and `fetch` through `clientOptions`, or a whole client through `createClient` (LC `langchain-anthropic/src/chat_models.ts:1070-1080, 1612-1690`). The default structured-output method is `functionCalling`, a forced tool call (`tool_choice: {type: "tool", name: "extract"}`, `:1780`) [run]. `method: "jsonSchema"` sends `output_config: {format: {type: "json_schema", schema}}` through `messages.create`, with no beta header; `output_format` is never sent (`:1263-1318, 1794-1810`) [run: `https://api.metisai.ir/anthropic/v1/messages`, `x-api-key`]. The Anthropic SDK's `transformJSONSchema` moved `minimum`, `maximum` and `$schema` into `description`, and the adapter adds `anthropic-dangerous-direct-browser-access: true`.
- **Gemini.** The new `@langchain/google` (`ChatGoogle`, plain REST) takes an `endpoint` and builds `${endpoint}/v1beta/models/{model}:generateContent` with `x-goog-api-key` (`langchain-google/src/chat_models/base.ts:328-336, 384-400`). Its default structured-output method is `functionCalling` (`:1049`); `method: "jsonSchema"` sends `generationConfig.responseJsonSchema` and `responseMimeType` (`:466-499`) [run]. The older `@langchain/google-genai` 2.3.2 wraps `@google/generative-ai` 0.24.1 (last published 2025-04-30) and sends `responseSchema`; the `@langchain/google` README says it "will be replacing" it.
- **DeepSeek.** `ChatDeepSeek extends ChatOpenAICompletions`, always Chat Completions; `configuration.baseURL` overrides the URL (`langchain-deepseek/src/chat_models.ts:411, 447-453`). Default method `functionCalling`, a forced `tool_choice` (`:818-824`); whether Metis's DeepSeek route accepts a forced tool choice is UNVERIFIED. `method: "jsonMode"` sends `{type: "json_object"}` and puts no schema in the prompt [run].
- **In short:** all four native routes can be reached with one key, but native structured output for Claude and Gemini must be requested per call (`method: "jsonSchema"`), and `gpt-5.6` needs `ChatOpenAICompletions` to stay on Chat Completions.

### 2. Structured output, validation and retries

- zod `^3.25.76 || ^4` and Standard Schema; zod 4.6.5 worked [run]. For OpenAI, zod 4 schemas get `strict: true` hard-coded (`utils/output.ts:107`); `.optional()` fields are left out of `required` while strict is on (LangChain's own TODO says optional properties without `nullable` are not supported, `:114`) [run], and the adapter stamps `title: "extract"` on every property [run].
- A failed validation throws `OutputParserException` with `Failed to parse. Text: "<the full model text>". Error: …` (`langchain-core/src/output_parsers/structured.ts:128-130`): the model's output lands in the error message, a personal-data risk for logs. With `includeRaw: true` the failure becomes `parsed: null` (`language_models/structured_output.ts:117-126`).
- `withStructuredOutput` never re-asks with the validation error. The transport retry loop (default `maxRetries` 6, `utils/async_caller.ts:383`) retries every error without a status in its no-retry list (`:7-18, 258-300`) [src], and OpenAI's json_schema validation runs inside the SDK's `.parse()`, inside that loop: with `maxRetries: 2`, one schema violation became **three identical paid requests** and then a raw `$ZodError` [run].
- The re-ask exists only in the agent API: `createAgent({responseFormat: toolStrategy(schema)})` with the default `handleError: true` returns the error to the model as a tool message, `Failed to parse structured output for tool '<name>':\n  - <error>.` (`libs/langchain/src/agents/errors.ts:35-49`, `nodes/AgentNode.ts:840-870`), with no attempt limit of its own (only the graph's recursion limit), validating with `@cfworker/json-schema` against the converted JSON Schema, so zod refinements and transforms never run (`agents/responses.ts:150-160`, `AgentNode.ts:782`). `providerStrategy` throws "Model output did not satisfy the provided response schema." without re-asking (`AgentNode.ts:425-438`). The legacy `OutputFixingParser` survives in `@langchain/classic`.

### 3. Streaming and tool calling

`.stream()`, `.streamEvents()` and `bindTools()`, with `tool_calls` and `invalid_tool_calls` on each `AIMessage` [docs]. Streaming OpenAI calls send `stream_options.include_usage` by default (`chat_models/completions.ts:123-127`); whether Metis accepts it is UNVERIFIED.

### 4. Usage and cost

`usage_metadata` gives input, output and total tokens with `input_token_details.cache_read` and `cache_creation` and `output_token_details.reasoning` [run]. Anthropic's `input_tokens` there includes the cache tokens; Gemini's output count includes thinking tokens. The answering model is in `response_metadata.model_name` (OpenAI) or `response_metadata.model` (Anthropic; Gemini's `modelVersion`). Response ids are kept; provider request-id headers are not (a stubbed `x-request-id` did not appear) [run]. No cost calculation.

### 5. OpenTelemetry

`@langchain/core` has no OpenTelemetry code; tracing goes through callbacks to LangSmith. The `langsmith` 0.10.5 package is always installed, off unless `LANGSMITH_TRACING=true`; with `LANGSMITH_TRACING_MODE=otel` it can emit OTel spans carrying `gen_ai.prompt` and `gen_ai.completion` (`langsmith@0.10.5 dist/utils/env.js:212-247`), and its JS helper `initializeOTEL` is marked deprecated. `LANGSMITH_HIDE_INPUTS` and `LANGSMITH_HIDE_OUTPUTS` apply before either export path (`dist/client.js:926-935, 1252-1262`; not run). In practice we would write our own `BaseCallbackHandler` that emits spans.

### 6. Test doubles

`fakeModel()` from `@langchain/core/testing` queues messages, tool calls and errors and records calls, but its `withStructuredOutput` returns a value preset with `.structuredResponse()` and skips parsing (`testing/fake_model_builder.ts:148-200`), so it does not exercise the parser. `FakeListChatModel` and `FakeStreamingChatModel` exist. Injecting `fetch` into the real adapters works [run]. No record and replay.

### 7. Typed outcomes

The error codes cover context overflow, rate limits, authentication, model not found, parsing and abort, with none for refusal or truncation (`langchain-core/src/errors/index.ts:6-15`). An Anthropic refusal puts `stop_reason: "refusal"` in `response_metadata` and then throws `OutputParserException` (`Text: ""`), or returns `parsed: null` with `includeRaw` [run]. The Chat Completions converter drops OpenAI's `message.refusal` entirely [run]. A json_schema answer cut at the token limit raises the OpenAI SDK's `LengthFinishReasonError` and is retried as if transient, three calls at `maxRetries: 2` [run]. A forced tool call that never arrives returns `undefined` with no error, on OpenAI and DeepSeek [run]. The newer stream-events path maps Anthropic's `refusal` to `"stop"` (`langchain-anthropic/src/utils/stream_events.ts:179-191`). Nothing depends on log-probabilities.

### 8. Registry, versioned prompts, cache

Prompt templates, `initChatModel`, `withFallbacks`, and a `BaseCache` hook keyed by a sha256 of the prompt and the serialised model parameters (`language_models/chat_models.ts:1115-1151`, `caches/index.ts:1-7`). Versioned prompts only through LangSmith Hub, a hosted service. We would write the task registry, a PostgreSQL cache keyed by our input hash and prompt version, the outcome type, the re-ask and the evaluation harness.

### 9. Maintenance and licence

GitHub on 2026-09-29: 18,239 stars, MIT, pushed 2026-09-29, 609 open issues and pull requests, 1,120 contributors, 175 commits on the default branch since 2026-07-01 (squash merges). Latest releases: langchain 1.5.14, core 1.2.13, openai 1.6.0, google 0.2.8, deepseek 1.1.15 on 2026-09-27; anthropic 1.5.11 on 2026-09-21. Weekly downloads (2026-09-21 to 27): core 6,262,358; openai 4,032,057; langchain 3,248,314; anthropic 1,436,947; google-genai 833,628; google 122,979; deepseek 88,931. Breaking releases of core: 0.2 (2024-05-17), 0.3 (2024-09-13), 1.0 (2025-10-17), then 1.x minors only; legacy APIs moved to `@langchain/classic`; `@langchain/google` is still 0.x.

### 10. Footprint

core, openai, anthropic, google, deepseek and zod install 48 packages, 113 MB (the OpenAI SDK 30 MB, js-tiktoken 22 MB, the Anthropic SDK 14 MB). No native binaries; `langsmith` always installed; `@langchain/google` pulls `google-auth-library`. Compiled ESM, Node ≥ 20 (≥ 22 for `@langchain/openai`). Ran in plain Node 22; in Next.js 16 server code UNVERIFIED.

**Verdict: partial.** The adapters reach all four routes natively when asked, and base URL, headers and `fetch` are injectable. But what the layer exists for is missing or wrong by default: no re-ask with the error outside the agent API, no typed refusal, truncation or empty outcome, transport retries that pay again for a validation failure, no OpenTelemetry, no cache or registry of use.

## Mastra

Package run: `@mastra/core` 1.71.0, npm `latest` (2026-09-24), with zod 4.6.5, through `Agent.generate(…, {structuredOutput})`, a stubbed global `fetch` and `MASTRA_TELEMETRY_DISABLED=1`. The default branch (MA) is ahead of 1.71.0; differences are noted.

**What it is.** An agent framework: agents, workflows, memory, RAG, evals, MCP, A2A, channels, a server, a studio and an editor. It is built on the Vercel AI SDK: `@mastra/core`'s `dist` bundles `@ai-sdk/anthropic@3.0.103`, `@ai-sdk/google@3.0.101`, `@ai-sdk/openai@3.0.88`, `@ai-sdk/openai-compatible@2.0.62` and `@ai-sdk/deepseek` (AI SDK 6 era), with only `@ai-sdk/provider` and `provider-utils` as runtime dependencies, and it accepts AI SDK model objects of specification versions v1 to v4 (MA `llm/model/resolve-model.ts:108-121`). What we would use is `Agent.generate` and `Agent.stream` with `structuredOutput` and the model layer; the rest (memory, workflows, the Hono server, channels, A2A, MCP, sandboxes, voice, evals, studio, editor, deployer, auth, Enterprise code, PostHog) would be dead weight.

### 1. Compatibility with Metis

- **Model strings** (`llm/model/gateways/models-dev.ts:358-377`): `anthropic/…` → the bundled `createAnthropic`; `google/…` → `createGoogleGenerativeAI().chat`; `openai/…` → `createOpenAI().responses` (the Responses API); `deepseek/…` → `createDeepSeek`. Keys from the environment or `apiKey` (`router.ts:333-341`). In 1.71.0 Mastra's own `<PROVIDER>_BASE_URL` override applies only to providers with a URL template in its registry (`dist/models-dev-BBxpv5Vx.js:11498-11505`): DeepSeek works; Anthropic and OpenAI work only because the bundled AI SDK reads `ANTHROPIC_BASE_URL` and `OPENAI_BASE_URL` itself; **Google ignores its override**. On the wire [run]: Anthropic `…/anthropic/v1/messages` with `output_config.format`; OpenAI `…/openai/v1/responses` with a strict json_schema in `text.format`; DeepSeek `…/deepseek/v1/chat/completions` with `json_object` and an injected "Return JSON that conforms to the following schema: …"; **Google went to `generativelanguage.googleapis.com` despite `GOOGLE_BASE_URL`, and sent `responseSchema`**. The fix landed on the default branch on 2026-09-28 (commit 79c3b1fa4d, PR #25354), in no release yet.
- **Object form** `{id, url, apiKey, headers, api}` (`router.ts:137-166`): with `url` set, every provider goes through `createOpenAICompatible().chatModel` with `supportsStructuredOutputs: true` (`:573-594`); `{id: "anthropic/…", url: "https://api.metisai.ir/anthropic"}` posted to `…/anthropic/chat/completions` with `response_format` [run], the OpenAI-format path that loses native structured output for Claude and Gemini on Metis. For OpenAI it is clean Chat Completions with `strict: true` [run]. No `fetch` option.
- **Our own AI SDK provider objects**, or a custom gateway class (`mastra/index.ts:504`, `gateways/base.ts:159-181`), give full control; at that point we install and configure the AI SDK ourselves.

### 2. Structured output, validation and retries

zod 3.25+ or 4, Standard Schema and JSON Schema; zod 4.6.5 worked. The default `errorStrategy: 'strict'` throws `MastraError` `STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED` ("Structured output validation failed: - year: Invalid input: expected number, received string"), with the raw output in `details.value` (`stream/base/output-format-handlers.ts:226-241`) [run]; `'fallback'` substitutes `fallbackValue` [run]; `'warn'` only logs. The single-call path never re-asks, even with `maxProcessorRetries: 2` [run]. A re-ask happens only with a separate structuring `model` and `maxProcessorRetries` set (no retries by default, `agent/types.ts:997-1004`): the processor aborts with a retry (`processors/processors/structured-output.ts:147-155`) and the main agent runs again with the system message `[Processor Feedback] Your previous response was not accepted: [StructuredOutputProcessor] Structuring failed: … Please try again with the feedback in mind.` [run; 1.71.0 `dist/agent-BOxKOk3n.js:28842`]. The structuring model never sees the error, each attempt costs two model calls, and on the default branch the reason is now inserted as a "system-reminder" signal instead (`loop/workflows/agentic-execution/llm-execution-step.ts:1413-1427, 3067-3068`), so the wording is not stable.

### 3. Streaming and tool calling

`agent.stream()` exposes `textStream`, `objectStream` (partial objects), `fullStream` and `object`; `createTool` takes zod input and output schemas [docs].

### 4. Usage and cost

`usage` has `inputTokens`, `outputTokens`, `totalTokens`, `reasoningTokens`, `cachedInputTokens`, `cacheCreationInputTokens` and `raw`; `response.id`, `response.modelId` (the answering model) and `response.headers`, with `request-id` or `x-request-id` [run]. `@mastra/observability` keeps a list-price registry (`observability/mastra/src/metrics/pricing-registry.ts`), not Metis's prices; not run.

### 5. OpenTelemetry

Mastra's own tracing model, exported to OpenTelemetry through the separate Apache-2.0 `@mastra/observability` with `@mastra/otel-exporter` or `@mastra/otel-bridge`, configured on a `Mastra` instance [docs]; `tracingOptions: {hideInput, hideOutput}` and a `SensitiveDataFilter` per call [docs; not run]. **`@mastra/core` also embeds PostHog product telemetry**: `https://us.posthog.com`, a hard-coded project key, `disableGeoip: false`, on unless `MASTRA_TELEMETRY_DISABLED` is `1`, `true` or `yes` (`telemetry/posthog.ts:5-21, 36-48`) [src]; it sends a feature summary and aggregate token usage per provider and model from the Mastra server at start-up (`packages/deployer/src/server/index.ts:668-670`); read in the source, a bare `Agent` does not trigger it. The default logger printed validation and truncation errors with the raw model output to stderr [run].

### 6. Test doubles

`@mastra/core/test-utils/llm-mock` (`createMockModel`, `MastraLanguageModelV2Mock`), and AI SDK mock models are accepted. `fetch` can only be injected through our own AI SDK objects. A record-and-replay package (`@internal/llm-recorder`, on MSW) is private; its README says it "will become a public package in the future."

### 7. Typed outcomes

A `finish_reason: "length"` throws `STRUCTURED_OUTPUT_TRUNCATED` ("Structured output was truncated because the model finished with reason "length"."), and content-filter stops the same way (`output-format-handlers.ts:703-716`) [run]. An Anthropic refusal returns `finishReason: "content-filter"` and `object: undefined` with **no error**, the raw `refusal` lost [run]. Empty content returns `object: undefined` and `finishReason: "stop"`, again with no error [run]. Nothing depends on log-probabilities.

### 8. Registry, versioned prompts, cache

Agents are registered by id on a `Mastra` instance. `@mastra/editor` versions stored agents and prompt blocks in the database with draft and publish [docs]; npm lists no licence for `@mastra/editor` 0.15.3, which contains an `src/ee` folder. The `ResponseCache` processor hashes the exact prompt sent, with a default TTL of 300 s, in memory or Redis (`response-cache.ts:50`). We would still write the PostgreSQL cache keyed by input hash and prompt version, the task registry and the evaluation harness.

### 9. Maintenance and licence

GitHub on 2026-09-29: 28,424 stars, pushed 2026-09-29, 479 open issues and pull requests, 688 contributors, 3,967 commits since 2026-07-01 (including automated version bumps). Releases: core 1.71.0 and 1.70.0 on 2026-09-25, 1.69.0 on 09-24, 1.68.0 on 09-23. Weekly downloads of `@mastra/core`: 2,004,818. Versions: 0.1.0 (2024-10-02) to 0.24.0 (2025-11-05), each minor free to break; 1.0.0 on 2026-01-20, then 84 stable 1.x releases, 28 since 2026-07-01; at least one 1.x minor, 1.11.0 (2026-03-11), is labelled a breaking change (the minimum zod version). **Licence**: GitHub reports NOASSERTION; `LICENSE.md` is Apache-2.0 except any `ee/` directory, which is under the Mastra Enterprise Edition License 2.0, effective 2026-09-22: "Enterprise Features are made available in source-available form. They are not open source.", and production use needs a written agreement and a licence key (`ee/LICENSE` §3.2) [src]. The `@mastra/core` 1.71.0 tarball ships `dist/auth/ee` and `dist/agent-builder/ee` [src]. No Elastic License found; `@mastra/observability`, `otel-*`, `memory` and `pg` are Apache-2.0 on npm.

### 10. Footprint

`@mastra/core` has 30 direct dependencies and installs 152 packages, 132 MB (the package itself 76 MB unpacked): Hono, chat, execa, ws, two copies of `@a2a-js/sdk`, posthog-node, the remark stack, `xxhash-wasm`. No native binaries. Node ≥ 22.13.0 (posthog-node asks for ≥ 22.22.0 and warns on 22.14). Next.js needs `serverExternalPackages: ['@mastra/*']` [docs]. Ran in plain Node [run]. No vendor account.

**Verdict: poor.** Its value is an agent runtime Carshenas does not need, and in 1.71.0 its model layer works against Metis: a custom `url` sends everything in OpenAI format, `openai/…` means the Responses API, and the Gemini base URL is ignored while `responseSchema` is sent. Working around that means passing our own AI SDK provider objects, and then the AI SDK alone does the job at a fraction of the size. Re-asking with the error costs two model calls per attempt, refusals and empty answers arrive as a silent `undefined`, and the core package bundles PostHog telemetry and Enterprise-licensed code.

## Sources

- `gh api` (repository, releases, commits, contributors), `npm view` and api.npmjs.org weekly downloads, all on 2026-09-29.
- The LC and MA files cited above, and Mastra commit 79c3b1fa4d.
- npm tarballs: `@mastra/core@1.71.0`, `@ai-sdk/google@4.0.85`, `openai@7.23.0` (`lib/parser.js:166-175`, `core/error.js:118-121`), `langsmith@0.10.5`.
- Documentation read 2026-09-29: https://docs.langchain.com/oss/javascript/integrations/chat/openai, https://docs.langchain.com/oss/javascript/langchain/models, https://docs.langchain.com/oss/javascript/langchain/structured-output, https://github.com/langchain-ai/docs/blob/main/src/langsmith/trace-with-opentelemetry.mdx, https://github.com/langchain-ai/docs/blob/main/src/langsmith/mask-inputs-outputs.mdx; and, under https://github.com/mastra-ai/mastra/blob/main/docs/src/content/en/, `models/index.mdx`, `docs/agents/structured-output.mdx`, `reference/streaming/agents/stream.mdx`, `reference/streaming/agents/MastraModelOutput.mdx`, `docs/agents/tools.mdx`, `docs/observability/tracing/overview.mdx`, `integrations/observability/opentelemetry.mdx`, `docs/deployment/web-framework.mdx`, `reference/editor/prompt-blocks.mdx`.
