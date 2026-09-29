# ADR-0019: Reach every language model through Metis AI, with the key in the environment, and keep working when it is down

- Status: proposed. Choosing Metis is the owner's decision of 2026-09-29. The routes and the fallback await acceptance.
- Date: 2026-09-29
- Deciders: Pedrum
- Related: tasks CS-42, CS-44, CS-45, CS-46, CS-37; ADR-0011 point 6 (AI steps); ADR-0017 (the worker runs on an Iranian network); `docs/research/2026-09-29-metis-ai.md`

## Context

Carshenas's AI steps need language models:
- extracting facts from a listing's free text;
- deciding whether two listings are the same car;
- understanding a plain-Farsi query;
- explaining a rating.

The worker runs on an Iranian network (ADR-0017). The large providers refuse Iranian addresses and cannot be paid from Iran.

Metis AI is an Iranian gateway. It serves OpenAI's, Anthropic's, Google's, DeepSeek's and other models in those providers' own API formats, and bills in rials. On 2026-09-29, calls from an Iranian network through Metis returned output valid against one JSON Schema on every route that was tried. Five models answered in about 1.5 to 3 s median, at $0.13 to $3.56 per 1,000 extractions (the research note).

It is still one company between Carshenas and every model. It promises only 90% monthly uptime, excludes upstream outages, and publishes no rate limits.

## Decision

1. **Metis AI is the model provider, by the owner's decision of 2026-09-29.** Its one key, `METIS_API_KEY`, lives only in the environment: the git-ignored `.env` locally, the server's secret store in production (CS-37). It is never committed, logged, put in a prompt or sent to a browser. A missing key stops the process at start with a clear message (CS-45).
2. **Structured output goes through the providers' native routes.**
   - `https://api.metisai.ir/openai/v1`: Chat Completions with `response_format` json_schema strict.
   - `https://api.metisai.ir/anthropic`: Messages with `output_config.format`.
   - Gemini's `generateContent` at `https://api.metisai.ir`, with `responseJsonSchema`.
   - DeepSeek only in its JSON mode.

   The OpenAI-format wrappers to other providers are not used for structured output, because they pass `response_format` through untranslated and the provider refuses it.
3. **Every answer is validated in code, whatever the route promises.** Every call records the model that answered, the tokens, the latency and the cost at Metis's list price (ADR-0011 point 6).
4. **When Metis or its upstream is down, AI work degrades instead of failing.**
   - Jobs that call a model wait in the queue and retry with backoff. Facts parsed by code, search and ratings keep working, and plain-Farsi search falls back to the filters.
   - After a configured outage, the AI layer may switch a task to Metis's model for the national internet, `metis-gpt`, or to Sotoon's Gemma 3 27B. The answer is validated the same way, and the switch is visible in the logs and in the result.
   - If Metis itself becomes unusable, another Iranian gateway with OpenAI's format takes its place through the same model registry, after the labelled set (CS-48) shows its accuracy. AvalAI and GapGPT both answered on 2026-09-29; neither has been studied.

## Alternatives considered

- **Calling OpenAI, Anthropic or Google directly**: they refuse Iranian addresses and need payment in dollars, and the worker runs in Iran.
- **Another Iranian gateway as the primary**: the owner chose Metis. Others are kept as the last fallback, to be studied when needed.
- **A self-hosted open-weight model on an Iranian GPU server**: no international link needed. But it means paying for a GPU and running it, and its Persian extraction is weaker, judging by Gemma 3 27B here (37 of 54 fields right, against 48 to 54 for the others). Reconsider if a shutdown takes down every gateway at once.
- **One OpenAI-format route for every provider**: a simpler client, but it loses structured output for Claude and Gemini, as measured.

## Consequences

- **Positive:**
  - one key and one bill in rials;
  - the providers' own formats and official SDKs work with only the base URL changed;
  - every major model family is available for choosing a model per step (CS-46);
  - embeddings and rerankers come from the same account.
- **Negative and risks:**
  - one company in the path, under a 90% SLA;
  - dollar prices converted at the free-market rate, so the cost in tomans moves;
  - prepaid credit that is never refunded and expires after a year;
  - listing text reaches the upstream providers, so personal data must be removed first;
  - Metis's per-key rate limits are unpublished;
  - jev was unavailable on 2026-09-29, because Metis's credits at TypeSafe were empty.
- **Follow-ups:**
  - CS-44 chooses a library that speaks at least OpenAI's and Anthropic's formats.
  - CS-45 builds the model registry, validation with bounded retries, cost logging and the switch to a fallback model.
  - CS-46 adds `metis-gpt`, Sotoon's Gemma and jev to the bake-off.
  - CS-37 puts the key in the server's secret store.
  - Proposed to the owner:
    - ask Metis about per-key limits, jev's credits and behaviour during a shutdown;
    - test a second gateway with an account.
