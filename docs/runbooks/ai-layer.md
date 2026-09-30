# The AI layer: add a task, choose its model, and check the layer against Metis

Every call to a language model goes through `packages/ai` (`@carshenas/ai`, CS-45), by task name, to Metis AI's native routes (ADR-0019), on the AI SDK's core and provider packages under a layer of our own (ADR-0021). The web app and the worker may not import `ai` or `@ai-sdk/*` themselves (lint). The rules the layer follows come from CS-43's research, `docs/research/2026-09-29-prompting-context-engineering-and-agents.md`, section "What Carshenas adopts".

## What a call does

`ai.call('listing.facts', input, { signal })`:

1. **Look up the cache.** Renders the input and looks up `ai_answer` by the SHA-256 of the task, the prompt version, the model with its options and the rendered input. A hit is checked again against the task's schema and checks, and then answered with no request.
2. **Ask the model once.** Uses Metis's route for the task's model with native structured output: json_schema strict for OpenAI, `output_config.format` for Claude, `responseJsonSchema` for Gemini, JSON mode for DeepSeek. The SDK's own retries are off.
3. **Validate the answer.** Reads the finish reason and OpenAI's refusal field first, then validates the answer against the schema, then runs the task's checks.
4. **Re-ask once at most.** A failure is fed back with each problem named: the field, the value seen and what is admissible. The same answer twice stops the loop.
5. **Return one outcome.** `ok` with a validated value and its `answerId`, or `invalid`, `refusal`, `truncated` or `empty` for the review queue, never with the value. A call with no answer at all throws `ModelCallError`, whose `reason` and `retryable` tell the queue whether to retry.
6. **Write one line.** `model call completed` holds the task, prompt version, provider, the requested and answering model, the request id, outcome, attempts, `cached`, the latency, the tokens (uncached input, cache read, cache write, output and reasoning) and the cost at Metis's live price. It never holds the prompt, the input or the answer.

## Add a task

1. **Define it.** Write the task in its own file under `packages/ai/src/tasks/` with `defineTask`:
   - a name `<area>.<what>`;
   - the instructions, which are the stable prefix: rules, glossary and examples, with no dates or ids;
   - a zod schema in CS-43's portable profile: a strict object, every field required, `not_stated` as an enum value, evidence before the value;
   - `render(input)`, the variable part, sent last. It is what the cache key hashes, so normalise text before it (CS-43, pattern 17).
2. **Add checks, if any.** Rules the schema cannot state go in `checks: { version, run }`. Change `version` whenever `run` changes: it is part of the prompt version, so a changed check gets new keys. A stored answer that fails a changed check under the old version is re-asked on every call, and the layer warns `stored answer fails the checks of its own version`.
3. **Register it.** Add one line to `packages/ai/src/registry.ts` with:
   - the model: `openai('gpt-5.6-luna', { reasoningEffort: 'low' })`, `anthropic('claude-haiku-4-5')`, `google('gemini-3.1-flash-lite')` or `deepseek('deepseek-v4-flash')`;
   - the fallback model CS-46 names;
   - the settings `maxOutputTokens`, `timeoutMs`, `maxReasks` (0 or 1) and, optionally, `promptCache`.
4. **Snapshot the prompt.** Add a snapshot test of the rendered prompt, like `task.test.ts`, and a test of the checks. Refresh snapshots with `pnpm --filter @carshenas/ai test:update-snapshots` and read the diff: a changed word shows there.
5. **Hand it to a job.** In the worker, set `callsModels: true` on the job and call `context.models.call(...)`. The worker then needs `METIS_API_KEY` to start.

Switching a task's model is changing its `model` line: the prompt version stays, and the cache key changes with the model.

## The key

`METIS_API_KEY` lives in the git-ignored `.env` locally (`example.env` shows the line) and in the server's secret store in production (ADR-0019, CS-37). The package never reads the environment: the worker reads it in `src/env.ts` and passes it in.

- A worker with a job that calls models refuses to start without it: one fatal line, `METIS_API_KEY is not set: …`, then exit 1.
- A worker whose jobs call no model, `pnpm check` and a fresh clone need no key.

## Prompt caching

Set `promptCache: '5m'` or `'1h'` on a task to ask the providers to cache its instructions:

- **Claude** gets `cache_control` on the instructions. It caches only prefixes of at least 4,096 tokens on Haiku 4.5, and 1,024 on Sonnet 5.
- **OpenAI** gets a prompt cache key. GPT-5.6 caches prefixes of at least 1,024 tokens automatically anyway.
- **Gemini and DeepSeek** cache on their own.

Metis's own `cache` body parameter is refused by OpenAI, Anthropic and Gemini: `docs/research/2026-09-29-metis-ai.md`, finding 9.

## Check the layer against Metis

The upgrade gate (ADR-0021 point 1): a new major version of the AI SDK, or a changed pin, is adopted only after all three pass.

| Command | What it checks | Network, cost |
|---|---|---|
| `pnpm --filter @carshenas/ai test` | Everything in `packages/ai/src/*.test.ts`: the re-ask, the outcomes, the cache, the log line and the key, plus the wire check (what each provider package sends to Metis's four routes, and Metis's recorded answers replayed) | none: a guard fails any real request |
| `pnpm --filter @carshenas/ai live` | CS-42's three synthetic listings through the layer on the four routes; `-- --record` refreshes the recorded answers in `src/test-support/recorded/` | Metis, about US$0.01 |
| `pnpm db:check` | The PostgreSQL cache on the worker's role, and its plans at 100,000 answers (`apps/worker/src/models.db.test.ts`) | local PostgreSQL |

`pnpm --filter @carshenas/ai pass-through <probe | recheck | latency | bill-baseline | bill-cached | batch-status>` repeats CS-45's measurements of what Metis passes through. Its results, like `live`'s, go to `packages/ai/results/`, which git ignores; copy a run a note quotes into that note's evidence folder. Run both scripts from an Iranian network.

## Reading the lines

Every call writes `model call completed` at `info`, or at `warn` for an outcome other than ok. Some examples, with the local log searches in `docs/runbooks/logs-and-errors.md`:

- `outcome: "invalid"` with `problemPaths`: the fields that failed after the re-ask. The listing goes to review.
- `outcome: "error"` with `errorReason` and `status`: no answer. `rate_limited` and `unavailable` are retried by the queue; `unauthorized`, `no_credit` and `rejected` need a person.
- `cached: true` with `costUsd: 0`: answered from `ai_answer`.
- `answeringModel` different from `model`: Metis routed the request to another model (CS-42).
- `model call warning` with a `warning` object: the SDK's own warning about a setting a model does not support or runs in a compatibility mode (DeepSeek's schema, logprobs on a reasoning model). The first layer in a process sends these through its logger instead of the process's warning stream.
- `stored answer fails the checks of its own version`: a task's checks changed without a new `checks.version`, so a stored answer is asked again on every call. Bump the version.
