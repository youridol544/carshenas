# ADR-0021: Call models through the AI SDK's core and provider packages, under a thin layer of our own

- Status: accepted (2026-09-29), with the owner's answers to this ADR's questions that day: the AI SDK's core and provider packages; one re-ask before review; and the Metis pass-through checks in CS-45. Corrected the same day, before merge, after CS-44's task review, with the decision unchanged: Ax's place among the alternatives, the Portkey dates, the size of the re-ask code, where ADR-0011's confidence per field fits, what the web path falls back to, and where the upgrade gate moves.
- Date: 2026-09-29
- Deciders: Pedrum
- Related: tasks CS-44, CS-45, CS-46, CS-47, CS-48; ADR-0011 point 6, ADR-0016, ADR-0018, ADR-0019; `docs/research/2026-09-29-ai-layer-library.md`, `docs/research/2026-09-29-prompting-context-engineering-and-agents.md`

## Context

Carshenas calls language models for four steps, from the worker and from the web app, all through Metis's native routes (ADR-0019):
- extraction;
- duplicate decisions;
- query understanding;
- explanations.

Each route has its own request format, structured-output parameter, usage fields, finish reasons and errors.

ADR-0011 point 6 and CS-43 add what every call must do:
- versioned prompts;
- a strict schema validated in code;
- a bounded re-ask that feeds the error back;
- typed refusals, truncations and empty answers;
- a cache keyed by input hash;
- cost and latency logs without personal data.

Without a shared layer each step would build all of this again. On the wrong library, the layer would work against that library's defaults. The research note compares twelve candidates on these points and measures the front-runner against Metis from Iran.

## Decision

1. **The library.**
   - **Packages:**
     - `ai` (AI SDK 7);
     - `@ai-sdk/openai`, on Chat Completions through `.chat()` as ADR-0019 names it;
     - `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/deepseek`;
     - `@ai-sdk/otel`.

     They are pinned to exact versions (`ai` 7.0.122 and its providers on 2026-09-29). Each provider is created with Metis's base URL and `METIS_API_KEY`. Only `packages/ai` imports them.
   - **Used:**
     - `generateText` and `streamText` with `Output.object`;
     - the SDK's error types;
     - language-model middleware;
     - `@ai-sdk/otel`;
     - the mocks from `ai/test`, in tests.
   - **Not used:**
     - string model ids, which resolve to Vercel's AI Gateway;
     - agents, UI packages, MCP, and the gateway and harness packages.

     CS-45 forbids them by lint.
   - **Upgrades:** a new major version is adopted only after the wire check, the re-ask tests and a live run pass against it. Until CS-45 moves the wire check and the tests into `packages/ai`, under the workspace's lockfile, they are the lab's in `docs/research/2026-09-29-ai-layer-library/lab/`.
2. **The layer** (`packages/ai`, built in CS-45), within ADR-0011 point 6:
   1. **A registry.** There is one typed entry per task, holding:
      - the model, a provider object and never a string;
      - its fallback model (ADR-0019 point 4);
      - the prompt and its version, the schema and the checks;
      - the reasoning effort, output budget, timeout and number of re-asks.

      Switching a task's model is a one-line change.
   2. **Versioned prompts.**
      - The instructions and the glossary are code in the package.
      - The version is a content hash of the instructions, the schema and the settings.
      - The variable input goes last.
      - Rendered prompts are snapshotted in tests.
   3. **Validation with a bounded re-ask.**
      - The SDK validates the answer against the zod schema, written in CS-43's portable profile. The checks in code run next.
      - A failure is fed back once, by the owner's decision of 2026-09-29. The re-ask carries a fixed context: the input, the last answer, and each problem with the failing field, the value seen and what is admissible.
      - The same answer twice stops the loop. After that, a typed failure goes to review, never an unvalidated value.
      - Each call has one outcome: ok, invalid, refusal, truncated or empty.
      - ADR-0011 point 6's confidence per field and review queue build on this outcome: CS-52 attaches confidence signals to an ok result (CS-43, pattern 20), and CS-48's labelled set sets the thresholds.
      - The finish reason is read before the output. OpenAI's refusal field is read from the response. Anthropic's structured-output mode is set explicitly.
   4. **A cache keyed by input hash.**
      - It lives in PostgreSQL.
      - The key is a hash of the task, the prompt version, the schema, the model, the settings and the normalised input.
      - It sits in front of the checked call and stores validated results only. A hit makes no request.
   5. **Cost and latency logging.**
      - There is one line per call through `packages/observability`, holding:
        - the task and prompt version;
        - the requested and answering model and the request id;
        - tokens split into uncached, cache read, cache write, output and reasoning;
        - the latency, the attempts and the outcome;
        - the cost at Metis's live price.
      - It never holds the prompt or the listing text.
      - Spans come through `@ai-sdk/otel` into the project's tracer, with `recordInputs` and `recordOutputs` off.
   6. **Transport retries at one layer.**
      - In the worker, the SDK's `maxRetries` is 0 and the queue retries (ADR-0018, ADR-0019 point 4).
      - On the web request path there is one attempt within a deadline. Past it, the step answers without the model, as ADR-0019 point 4 says: plain-Farsi search falls back to the filters.

## Alternatives considered

- **The official SDKs with our own adapters.** They are proven on Metis (CS-42) and have the fewest layers. But they mean four request shapes, three usage shapes and three error hierarchies to map, and telemetry and test doubles to write, which the AI SDK already does and the lab verified on all four routes. This is the fallback if the AI SDK stops fitting.
- **Ax.** Like LangChain.js when it is configured for it, Ax can use native structured output on all four routes, and unlike the others it re-asks by itself. But:
  - it writes part of the prompt around ours;
  - one person wrote 352 of its 386 commits since July;
  - it had eight major versions in 2026;
  - it re-sends refusals up to four times;
  - its usage reports the requested model, not the answering one;
  - its `postinstall` writes into `.claude/skills/`.
- **LangChain.js, Mastra, Genkit and TanStack AI.** These frameworks' defaults work against Metis or the layer:
  - LangChain.js gives native structured output only on request, and its transport retries pay again for a validation failure.
  - Mastra ignores the Gemini base URL and ships Enterprise-licensed code in its core package.
  - Genkit supports zod 3 only and puts prompts on every span.
  - TanStack AI is pre-1.0 and has no re-ask.
- **BAML, pi-ai and instructor-js.** None uses native structured output:
  - BAML parses the schema back out of the prompt;
  - pi-ai offers it only as a forced tool;
  - instructor-js sends an empty schema with zod 4 and has not changed since January 2025.
- **A gateway service: LiteLLM or Portkey.** Either is another service on the VPS.
  - LiteLLM sends Claude the deprecated `output_format`, needs an 83-table Prisma schema and 4 GiB, and shipped a credential stealer on PyPI on 2026-03-24.
  - Portkey's released gateway drops Claude's structured output. Its repository has had no commit since 2026-05-25, around the company's acquisition by Palo Alto Networks (announced 2026-04-30, closed 2026-05-29).

## Consequences

- **Positive:**
  - one request shape and native structured output across Metis's routes, verified from Iran (24 of 24 valid);
  - the prompt stays ours;
  - typed outcomes, normalised usage and the answering model;
  - spans free of listing text;
  - mocks and middleware for tests, the cache and the log;
  - the most active project of the set.
- **Negative and risks:**
  - a major version about every six months, pinned and gated by the lab;
  - about 130 lines of our own for the re-ask;
  - two gaps covered in the layer: OpenAI's refusal field, and Anthropic's mode for models the package does not recognise;
  - `@ai-sdk/gateway` and `@vercel/oidc` installed but unused;
  - three defaults that are wrong for Carshenas and must be set: `recordInputs`, `recordOutputs` and `maxRetries`.
- **Follow-ups:**
  - CS-45 builds the layer on this decision.
  - CS-45 also measures, through the layer, the Metis pass-through checks CS-43 listed, by the owner's decision of 2026-09-29: prompt caching (`cache` and Anthropic's `cache_control`), batch, log-probabilities, Gemini's `responseFormat`, and the latency Metis adds at the 95th percentile.
  - CS-46 names each task's model and fallback in the registry.
  - CS-47 turns these rules into the skill and the rule pack.
  - CS-48 evaluates through the layer.
