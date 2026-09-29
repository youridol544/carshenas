# Which TypeScript library should Carshenas's AI layer be built on?

- Date: 2026-09-29
- Asked by / for: Pedrum, for CS-44. Carshenas will call several models for different steps (extraction, duplicate decisions, query understanding, explanations) through Metis AI (ADR-0019), and perhaps other providers later, so the code needs one abstraction that stays maintainable as steps and models change.
- Outcome: (filled in last)

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

## Sources

(in progress)

## Findings

(in progress)

## Recommendation

(in progress)
