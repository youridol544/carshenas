# Pass: LiteLLM and Portkey's open-source gateway as a service between Carshenas and Metis (CS-44)

- Date: 2026-09-29. One of four survey passes behind `../2026-09-29-ai-layer-library.md`.
- Method: source read at recorded commits, cited as `path@sha:lines`; documentation through Context7; security records from the GitHub advisory database, PyPI and the projects' own issues. Neither gateway was run, and Metis was not called. **Checked** means read in the source; **vendor** means a documentation claim; **inferred** means read from code but not run.
- Commits: LiteLLM `d46304900f283f34226a5021935efe67de6730b5` (`@d463049`, main on 2026-09-29, pyproject 1.104.0). Portkey gateway main `669825cbe89ee51569918b8f78a9db486fd69dd4` (`@669825c`, 2026-05-25), release tag `v1.15.2`, and the unreleased branch `2.0.0` at `8febc1dc1d85053dd374922e547b4db1af0fab79` (`@8febc1d`, last commit 2026-03-14).
- Re-checked by the main session before the note quotes them: LiteLLM's Anthropic mapping to `output_format` with the beta header `structured-outputs-2025-11-13` (`litellm/llms/anthropic/chat/transformation.py@d463049:1339, 1534-1536, 1865-1868`; `litellm/types/llms/anthropic.py@d463049:759`); advisory GHSA-5mg7-485q-xm76 (critical, published 2026-03-25: "Two LiteLLM versions published containing credential harvesting malware", pip `litellm` 1.82.7 to 1.82.8); Portkey's `AnthropicChatCompleteConfig` (`src/providers/anthropic/chatComplete.ts@669825c:268`) has no `response_format` key; the Portkey repository has 0 commits since 2026-07-01, last pushed 2026-05-25, latest release v1.15.2 of 2026-01-12.

## LiteLLM Proxy (BerriAI/litellm), run as a separate gateway

There is no official JavaScript or TypeScript client: the npm package `litellm` is a third-party "JS Implementation of LiteLLM" (zya/litellmjs 0.12.0, last published 2024-01-03). From TypeScript, LiteLLM is a Python service called with the `openai` SDK, or the Anthropic SDK on its `/v1/messages` route.

### 1. Compatibility with Metis

- **Base URL per provider (checked).** Anthropic appends `/v1/messages` unless present, so `https://api.metisai.ir/anthropic` works (`litellm/main.py@d463049:2899-2912`), with `x-api-key` (`litellm/llms/anthropic/common_utils.py@d463049:895`). Gemini builds `{api_base}/models/{model}:{endpoint}` with `x-goog-api-key`, `alt=sse` when streaming (`litellm/llms/vertex_ai/vertex_llm_base.py@d463049:655-697`): `api_base: https://api.metisai.ir/v1beta`. OpenAI and DeepSeek take `api_base`; DeepSeek appends `/chat/completions` (`litellm/llms/deepseek/chat/transformation.py@d463049:356-372`).
- **Anthropic, for an OpenAI-format `json_schema` (checked).** Model entries flagged `supports_native_structured_output` (every current Claude id in the bundled map, such as `claude-sonnet-4-5`, `claude-haiku-4-5`, `claude-opus-4-6`) get `$defs` inlined and unenforceable constraints moved into descriptions, then **a top-level `output_format: {type: "json_schema", schema}` with `anthropic-beta: structured-outputs-2025-11-13`** (`litellm/llms/anthropic/chat/transformation.py@d463049:1528-1536, 1339-1364, 528-575, 1864-1868`; body at `:2074-2080`; constant at `litellm/types/llms/anthropic.py@d463049:759`). That is the deprecated form, not `output_config.format`; whether Metis accepts it is UNVERIFIED. Claude models without the flag get a forced tool `json_tool_call` (`:1537-1547`, `litellm/constants.py@d463049:1525`). An explicit `output_config` is validated and forwarded (`:2084-2130`); reaching it through the proxy's `extra_body` is UNVERIFIED.
- **Gemini (checked).** Names matching `gemini-(?:[2-9]|[1-9]\d+)(?:\.|\-)` get `generationConfig.response_mime_type: "application/json"` and `response_json_schema`, with `strict` removed; older names get an OpenAPI-style `response_schema` without `additionalProperties` (`vertex_and_google_ai_studio_gemini.py@d463049:778-820`, `vertex_ai/common_utils.py@d463049:319-344`, `vertex_ai/gemini/transformation.py@d463049:1201-1238`). The keys are snake_case; ProtoJSON parsers accept both spellings, but whether Metis forwards snake_case unchanged is UNVERIFIED.
- **DeepSeek (checked).** `response_format` passes through unchanged (`deepseek/chat/transformation.py@d463049:18-62`), and the bundled map marks `deepseek-chat` as supporting a response schema, so a `json_schema` request would reach Metis and be refused; our code would have to send `json_object` itself.

### 2. Validation, retries and fallbacks

- `enable_json_schema_validation` (global, per request, or `litellm_settings`) validates `message.content` with `jsonschema` and raises `JSONSchemaValidationError` (`litellm/utils.py@d463049:1576-1612`, `json_validation_rule.py@d463049:99-119`; vendor: it "raise[s] a `JSONSchemaValidationError`"). It never re-asks with the error (checked).
- The error is built on a synthetic HTTP 500 (`litellm/exceptions.py@d463049:892-936`) and the router retries 408, 409, 429 and 5xx (`litellm/utils.py@d463049:7107-7131`, `router.py@d463049:7892-7896`), so a schema failure is likely re-sent unchanged (inferred).
- Fallbacks: `fallbacks`, `context_window_fallbacks`, `content_policy_fallbacks` and a per-exception `retry_policy` (vendor).
- On the forced-tool path, a `json_tool_call` answer overwrites `stop_reason` with `"stop"` (`transformation.py@d463049:2665-2668`), which hides truncation, and a top-level key named `values` is unwrapped (`:2772-2779`) (checked).

### 3. Streaming and tool calling

`tool_choice` and `parallel_tool_calls` are mapped to Anthropic's format (`transformation.py@d463049:1503-1512`); Gemini streaming on a custom base uses `alt=sse`; the proxy also serves Anthropic-format `/v1/messages` (checked).

### 4. Usage and cost

Anthropic's `prompt_tokens` includes cache reads and writes, with `prompt_tokens_details.cached_tokens` and `cache_creation_input_tokens` (`transformation.py@d463049:2365-2455`); `model` is the provider's answering model (`:2686`; Gemini's `modelVersion` at `vertex_and_google_ai_studio_gemini.py@d463049:2426-2427`) (checked). Prices come from a bundled map of about 4,400 entries in US dollars, overridable per deployment with `model_info.input_cost_per_token` and `output_cost_per_token` (vendor), so Metis's prices can be set. The proxy returns `x-litellm-response-cost` with input, output, cache-read and reasoning parts, and `x-litellm-model-id` and `x-litellm-model-api-base` (`litellm/proxy/common_request_processing.py@d463049:1776-1809`, checked). Spend logs need PostgreSQL through Prisma, whose schema has 83 models including `LiteLLM_SpendLogs` (`schema.prisma@d463049:1-4`); without a database "Spend tracking, virtual keys, and max_budget enforcement are disabled" (vendor). Prompts are not stored in spend logs by default (`litellm/proxy/_types.py@d463049:2931-2934`).

### 5. OpenTelemetry

`callbacks: ["otel"]` exports OTLP with `gen_ai.*` attributes and continues an incoming `traceparent` (`opentelemetry.py@d463049:2967-2990`). Content is captured by default (`custom_logger.py@d463049:89-91`); `turn_off_message_logging: true` or `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=false` turns it off (`opentelemetry.py@d463049:587-625`) (checked).

### 6. Test doubles

The Python SDK's `mock_response` takes text, a dict or an exception name such as `"litellm.RateLimitError"` (`litellm/main.py@d463049:771-810, 888-960`). On the proxy, `mock_response` in a request body is stripped unless a key's or team's metadata sets `allow_client_mock_response` (`litellm/proxy/litellm_pre_call_utils.py@d463049:259-275, 355-356, 2008-2013`), and virtual keys need the database; `mock_response` inside a model's `litellm_params` works, as LiteLLM's own tests use it (`tests/test_litellm/proxy/test_litellm_pre_call_utils.py@d463049:7942`). A TypeScript test would fake the OpenAI-compatible HTTP API and skip LiteLLM; testing LiteLLM's translation needs Python or Docker in CI.

### 7. Typed outcomes

`core_helpers.py@d463049:197-258` maps Anthropic `refusal` to `content_filter`, `max_tokens` to `length`, `tool_use` to `tool_calls`; Gemini `SAFETY`, `RECITATION` and `PROHIBITED_CONTENT` to `content_filter`, `MAX_TOKENS` to `length`; anything unknown to `stop` with a warning. A Gemini `promptFeedback.blockReason` becomes `content_filter` (`vertex_and_google_ai_studio_gemini.py@d463049:2430-2434, 1630-1680`). A refusal and a safety block look the same, and the forced-tool path rewrites truncation to `stop` (above).

### 8. What it adds to operate

- A separate Python service (`>=3.10,<3.15`, `pyproject.toml@d463049:6`); the GHCR image is cosign-signed (`README.md@d463049:571-590`), built on Chainguard wolfi with Node bundled for the Prisma CLI (`Dockerfile@d463049:4-7, 128`).
- Its database layer is `prisma-client-py` (`pyproject.toml@d463049:103`), whose repository is archived (last push 2025-04-10); 83 tables in PostgreSQL; the project's compose file uses `postgres:16`, and PostgreSQL 18 is UNVERIFIED.
- Redis optional for one instance; "Run Redis (7.0 or newer) as soon as you run more than one proxy instance" (vendor).
- "Give each pod 1 vCPU and 4Gi of memory…", with 4 GiB described as a floor because the Prisma engine's memory grows (vendor).
- An admin UI at `/ui`, which needs the database.
- **Licence**: MIT except `enterprise/` (`LICENSE@d463049:1-4`), whose licence allows production use only with a BerriAI subscription. The `proxy` extra pins `litellm-enterprise==0.1.71` (`pyproject.toml@d463049:79`), which PyPI lists as `LicenseRef-Proprietary`: `pip install 'litellm[proxy]'` installs proprietary code by default, its features off without `LITELLM_LICENSE`. Paid features include SSO beyond 5 users, audit logs, RBAC, IP allowlists, key rotation, team logging and log export (vendor).
- **Outbound calls**: no product telemetry (`--telemetry` is a "Deprecated no-op", `proxy_cli.py@d463049:793-799`); the licence server only with `LITELLM_LICENSE` (`litellm_license.py@d463049:30, 100-127`). At start-up it fetches the cost map and Anthropic beta-header configuration from raw.githubusercontent.com (5 s timeout, then the bundled copy), and the UI fetches a blog feed, router presets and policy templates; `LITELLM_LOCAL_MODEL_COST_MAP`, `_ANTHROPIC_BETA_HEADERS`, `_BLOG_POSTS`, `_AUTOROUTER_PRESETS` and `_POLICY_TEMPLATES` switch each off (`litellm/__init__.py@d463049:425-440`, `get_model_cost_map.py@d463049:618-650`). No vendor account. Reachability of GHCR and raw GitHub from Iran is UNVERIFIED.

### 9. Security

- **Compromised PyPI releases.** On 2026-03-24 at 10:39 UTC, PyPI 1.82.7 and 1.82.8 shipped a credential stealer (in 1.82.8, `litellm_init.pth` runs at every Python start). Root cause: a compromised Trivy dependency in CI exposed static PyPI, GHCR and Docker credentials; PyPI quarantined the packages about 40 minutes later; the project says Docker image users were not affected; remediation was trusted publishing, pinned CI and cosign. Sources: issues #24512 and #24518, the project's blog post of 2026-03-27, GHSA-5mg7-485q-xm76 (critical), GHSA-92x9-889m-jgmw and OSSF MAL-2026-2144.
- **The proxy.** The GitHub advisory database lists 27 reviewed `litellm` advisories published in 2026: 5 critical (one the malware), 9 high, 4 medium, 9 low. The other critical ones: CVE-2026-35030 (OIDC authentication bypass, before 1.83.0), CVE-2026-42208 (SQL injection in API-key verification, 1.81.16 to before 1.83.7), CVE-2026-49468 (authentication bypass through the Host header, before 1.84.0), CVE-2026-37004 (template injection in `/prompts/test`, before 1.83.7). The latest, CVE-2026-84377 (2026-08-26): SSRF and provider-credential exfiltration through request-body routing parameters, before 1.94.0.

### 10. Maintenance and licence

GitHub on 2026-09-29: 59,865 stars, licence NOASSERTION (the dual licence), pushed 2026-09-29, 5,442 open issues and pull requests. v1.103.0 and v1.104.0-rc.1 on 2026-09-28, with patch lines v1.100.3, v1.99.4 and v1.98.1 on 2026-09-25; PyPI's latest is 1.103.0 (2026-09-27). 13,140 commits on main since 2026-07-01, about 145 a day; 1,758 contributors including anonymous ones.

**Verdict: partial.** It is the only one of the two that turns an OpenAI-format `json_schema` into Claude's and Gemini's native structured output, types refusals and truncation, prices calls at custom rates and exports OpenTelemetry with content switchable. But it adds a Python service with an 83-table Prisma schema and a 4 GiB memory floor to one small VPS, sends Claude the deprecated `output_format` (untested against Metis), never re-asks on a schema failure, and has had heavy security churn in 2026.

## Portkey's open-source AI Gateway (`@portkey-ai/gateway`, TypeScript on Hono)

The `portkey-ai` client 3.1.0 pins `openai` 6.8.1 and defaults to `https://api.portkey.ai/v1` (`dist/src/constants.js:27`); against a self-hosted gateway the plain `openai` SDK with `x-portkey-*` headers is enough.

### 1. Compatibility with Metis

- **Base URL (checked).** `x-portkey-custom-host`, or `custom_host` in a config, replaces the provider's base URL and the provider path is appended (`requestContext.ts@669825c:127-133`, `providerContext.ts@669825c:96-106`). Anthropic: `…/v1` + `/messages`, `X-API-Key`, and always an `anthropic-beta` header, `messages-2023-12-15` by default (`src/providers/anthropic/api.ts@669825c:4, 10, 17`); Metis's acceptance UNVERIFIED. Google: the key in the query string (`?key=…`), not `x-goog-api-key` (`google/api.ts@669825c:17, 21`); Metis's acceptance UNVERIFIED. OpenAI appends `/chat/completions`; DeepSeek `/v1/chat/completions`.
- **Anthropic: `json_schema` dropped silently (checked).** Requests are built only from keys the provider config lists (`src/services/transformToProviderRequest.ts@669825c:75-127`), `AnthropicChatCompleteConfig` has no `response_format` (`anthropic/chatComplete.ts@669825c:268-472`), and the native `/v1/messages` whitelist has neither `output_config` nor `output_format` (`anthropic-base/messages.ts@669825c:3-68`). Portkey's documentation of Anthropic structured outputs describes the hosted product.
- **Gemini (checked).** `json_schema` becomes `responseMimeType: "application/json"` with an OpenAPI-style `responseSchema`, after deleting `additionalProperties` and `$schema` and inlining `$defs` (`google/chatComplete.ts@669825c:74-81, 399-402`, `google-vertex-ai/utils.ts@669825c:247-320`); not `responseJsonSchema`.
- **DeepSeek (checked).** `response_format` passes through, but the config has no `tools` or `tool_choice`, so tools are dropped (`deepseek/chatComplete.ts@669825c:16-88`); the workaround is `provider: openai` with the custom host `…/deepseek/v1`.
- The unreleased `2.0.0` branch maps Anthropic `response_format` to `output_config.format` (`anthropic/chatComplete.ts@8febc1d:272-295, 505-515`), Gemini to `responseJsonSchema` (`google/chatComplete.ts@8febc1d:76-80`) and Anthropic's `refusal` (`finishReasonMap.ts@8febc1d:21`).

### 2. Validation, retries and fallbacks

No validation on the request path. The optional `default.jsonSchema` guardrail validates with `@cfworker/json-schema` but finds JSON only in code fences or with the lazy pattern `/{[\s\S]*?}/g` (`plugins/default/jsonSchema.ts@669825c:28-47`); run alone in Node, that pattern cut a bare nested object `{"listing":{…},"confidence":0.9}` down to the unparseable `{"listing":{…}`, so nested JSON without fences fails. A failed deny-guardrail answers status 446 (`handlerUtils.ts@669825c:1338`). Retries (`retry: {attempts, on_status_codes}`, 429, 500, 502, 503 and 504 by default, `src/globals.ts@669825c:38`) and fallbacks (`strategy: {mode: "fallback", on_status_codes}`) resend the same request; nothing feeds an error back.

### 3. Streaming and tool calling

Anthropic and Gemini streaming and tools are mapped (`anthropic/chatComplete.ts@669825c:368-434, 636+`); the DeepSeek provider drops tools.

### 4. Usage and cost

Anthropic's `prompt_tokens` is `input_tokens` without the cache tokens while `total_tokens` adds them in, with `cached_tokens` and the answering `model` (`anthropic/chatComplete.ts@669825c:590, 611-626`); Gemini reports `modelVersion`, `reasoning_tokens` and `cached_tokens` (`google/chatComplete.ts@669825c:649, 721, 725`). No cost computation outside the provider folders, and no database, so no spend logs; the README marks cost analytics as hosted.

### 5. OpenTelemetry

No `@opentelemetry` dependency and no `traceparent` handling; the only OTLP-shaped object is an internal tool-execution log record (`logsService.ts@669825c:64-92`). In v1.15.2 the Node build always attaches the log middleware (`src/index.ts@v1.15.2:97-100`); main disables logs without an admin token (commit 9bcaee4, 2026-05-19), unreleased.

### 6. Test doubles

No mock-response feature; the npm package ships only a `bin` (`package.json@669825c:80`). Tests would fake the OpenAI-compatible API, or run the gateway against a local fake upstream.

### 7. Typed outcomes

`strictOpenAiCompliance` is on by default (`requestContext.ts@669825c:99-108`) and unmapped reasons become `stop` (`src/providers/utils.ts@669825c:73-84`); the Anthropic map lacks `refusal` (`finishReasonMap.ts@669825c:15-21`, `anthropic/types.ts@669825c:26-32`), so **a Claude refusal arrives as `finish_reason: "stop"`**. Gemini `SAFETY` becomes `content_filter` and `MAX_TOKENS` `length`; a response with no candidates becomes an untyped error, `Invalid response received from google…` (`google/chatComplete.ts@669825c:626, 732`).

### 8. What it adds to operate

A Node service built `FROM node:20-alpine` (`Dockerfile@669825c:2, 29`), and Node 20 reached end of life on 2026-04-30. No database; Redis optional (`REDIS_CONNECTION_STRING`, `src/index.ts@669825c:49-50`). Vendor claims "<1ms latency" and a "tiny footprint (122kb)"; runtime memory UNVERIFIED. MIT. Installing from npm runs `postinstall: patch-package` (`package.json@669825c:41`). Nothing in the server source calls home; the local UI embeds Google Tag Manager and loads an unpinned `unpkg.com/lucide@latest` (`src/public/index.html@669825c:908, 920, 1208`). No vendor account.

### 9. Security

- CVE-2025-66405 / GHSA-hhh5-2cvx-vmfp (medium, 2025-12-01): SSRF through `x-portkey-custom-host`, fixed in 1.14.0.
- CVE-2026-82270 (OSV and VulnCheck, 2026-08-28): a bypass of that fix; `POST /v1/proxy/*` is registered without the request validator, unlike `/v1/*` (`src/index.ts@669825c:287` against `:290`), and forwards the caller's Authorization header to any host. It affects every release through 1.15.2 and is still present at the head of main. The reporter says they emailed on 2026-06-01 without an answer; issue #1718 (opened 2026-07-03) is open, with unanswered follow-ups on 2026-09-13 and 2026-09-24.
- v1.15.2 serves `/log/stream` without authentication (`src/start-server.ts@v1.15.2:72`) and broadcasts each request's `requestOptions` (`src/middlewares/log/index.ts@v1.15.2:75-82`); fix commit c9ee943 (2026-05-19) adds redaction of `providerOptions` and upstream headers, meaning keys were broadcast before. Discussion #1656 calls the route "previously insecure" and says the fix applies to "versions > 1.16.0", a release that does not exist. No advisory filed.
- No malware advisories for `@portkey-ai/gateway` or `portkey-ai`.

### 10. Maintenance and licence

GitHub on 2026-09-29: 13,109 stars, MIT, pushed 2026-05-25, 279 open issues and pull requests; releases v1.15.2 (2026-01-12), v1.15.1 (2025-12-24), v1.15.0 (2025-12-23), no 2.x on npm or Docker Hub; 0 commits since 2026-07-01 and 41 in all of 2026; 123 contributors. npm: `@portkey-ai/gateway` 292 downloads in the week of 2026-09-21, `portkey-ai` 217,133. Palo Alto Networks announced it would acquire Portkey on 2026-04-30 and closed on 2026-05-29, folding it into Prisma AIRS; neither press release mentions the open-source gateway.

**Verdict: poor.** The released gateway drops Claude's `response_format`, sends Gemini the weaker `responseSchema` with the key in the URL, reports Claude refusals as `stop`, has no cost tracking or OpenTelemetry, and has been dormant since the acquisition, with an unpatched SSRF and a log stream that exposed credentials in its latest release. The `2.0.0` branch fixes the mapping but is unreleased and has stalled.

## Sources

- docs.litellm.ai, read 2026-09-29: `/docs/completion/json_mode`, `/docs/providers/gemini`, `/docs/proxy/custom_pricing`, `/docs/proxy/config_settings`, `/docs/proxy/docker_quick_start`, `/docs/proxy/prod`, `/docs/observability/opentelemetry_integration`, `/docs/enterprise`, `/blog/security-townhall-updates`.
- https://github.com/BerriAI/litellm/issues/24512 and /24518; https://github.com/advisories/GHSA-5mg7-485q-xm76 and GHSA-92x9-889m-jgmw; `gh api repos/BerriAI/litellm/security-advisories`; https://pypi.org/pypi/litellm/json and https://pypi.org/pypi/litellm-enterprise/json; https://www.npmjs.com/package/litellm; https://protobuf.dev/programming-guides/json/; https://github.com/RobertCraigie/prisma-client-py.
- https://portkey.ai/docs/integrations/llms/anthropic/structured-outputs (through Context7); https://github.com/Portkey-AI/gateway/issues/1718; https://github.com/Portkey-AI/gateway/discussions/1656; https://api.osv.dev/v1/vulns/CVE-2026-82270; https://github.com/advisories/GHSA-hhh5-2cvx-vmfp; https://www.paloaltonetworks.com/company/press/2026/palo-alto-networks-to-acquire-portkey-to-secure-the-rise-of-ai-agents; https://www.paloaltonetworks.com/company/press/2026/palo-alto-networks-completes-acquisition-of-portkey-to-secure-ai-agents; https://hub.docker.com/r/portkeyai/gateway/tags; https://raw.githubusercontent.com/nodejs/Release/main/schedule.json; the npm registry.
