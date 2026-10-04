# The AI layer: add a task, choose its model, and check the layer against Metis

Every call to a language model goes through `packages/ai` (`@carshenas/ai`, CS-45), by task name, to Metis AI's native routes (ADR-0019), on the AI SDK's core and provider packages under a layer of our own (ADR-0021). The web app and the worker may not import `ai` or `@ai-sdk/*` themselves (lint). The rules the layer follows come from CS-43's research, `docs/research/2026-09-29-prompting-context-engineering-and-agents.md`, section "What Carshenas adopts". Building or changing a step: the `ai-features` skill has the practice and five worked examples (`packages/ai/src/examples/`), `.claude/rules/ai.md` the rules that are never broken, and the `ai-reviewer` agent reviews the change.

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
   - `render(input)`, the variable part, sent last. It is what the cache key hashes, so normalise text before it (CS-43, pattern 17);
   - `renderVersion`, part of the prompt version as the checks' version is: change it whenever `render` or the text cleaning it calls (`tasks/listing-text.ts`) would write another text for some input, so the evaluation the new prompt needs is asked for (CS-84). `defineTask` refuses an empty one.
2. **Add checks, if any.** Rules the schema cannot state go in `checks: { version, run }`. Change `version` whenever `run` changes: it is part of the prompt version, so a changed check gets new keys. A stored answer that fails a changed check under the old version is re-asked on every call, and the layer warns `stored answer fails the checks of its own version`.
3. **Register it.** Add one entry to `packages/ai/src/registry.ts` with:
   - the model and the fallback of its step from `STEP_MODELS` (CS-46: `extraction`, `duplicates`, `query`, `explanation`), each with the reason and the measurements in `docs/research/2026-09-30-model-per-ai-step.md`;
   - the settings `maxOutputTokens`, `timeoutMs`, `maxReasks` (0 or 1) and, optionally, `promptCache`.

   A model is written as `openai(id, options)`, `anthropic(…)`, `google(…)` or `deepseek(…)`, never as a string. Before naming a model the steps do not use, run it once through the layer (`pnpm --filter @carshenas/ai bakeoff`): Metis lists models it refuses to serve (`gemini-3.8-flash` on 2026-09-30), lists some with no price (the cost line is then null) and refuses some settings (Gemini 3.7 Flash refuses thinking level `minimal`).
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

`pnpm --filter @carshenas/ai models` lists what Metis's four routes and its meta endpoint serve, with its live prices (GET requests only, nothing billed). `pnpm --filter @carshenas/ai bakeoff --step <extraction | query | duplicate | explanation> [--only <labels>] [--limit n] [--repeat n]` runs CS-46's bake-off on the hand-labelled items in `scripts/bakeoff/data/` and prints the table; `--score <results files>` scores saved runs again against the labels without calling a model (paths from `packages/ai`, or absolute). Write no `--` before the options: pnpm 10 hands it on and the script refuses it. A full extraction run of nine models cost about US$0.60 on 2026-09-30. `pnpm --filter @carshenas/ai pass-through <probe | recheck | latency | bill-baseline | bill-cached | batch-status>` repeats CS-45's measurements of what Metis passes through. Its results, like `live`'s, go to `packages/ai/results/`, which git ignores; copy a run a note quotes into that note's evidence folder. Run both scripts from an Iranian network.

## Reading the lines

Every call writes `model call completed` at `info`, or at `warn` for an outcome other than ok. Some examples, with the local log searches in `docs/runbooks/logs-and-errors.md`:

- `outcome: "invalid"` with `problemPaths`: the fields that failed after the re-ask. The listing goes to review.
- `outcome: "error"` with `errorReason` and `status`: no answer. `rate_limited` and `unavailable` are retried by the queue; `unauthorized`, `no_credit` and `rejected` need a person.
- `cached: true` with `costUsd: 0`: answered from `ai_answer`.
- `answeringModel` different from `model`: Metis routed the request to another model (CS-42).
- `model call warning` with a `warning` object: the SDK's own warning about a setting a model does not support or runs in a compatibility mode (DeepSeek's schema, logprobs on a reasoning model). The first layer in a process sends these through its logger instead of the process's warning stream.
- `stored answer fails the checks of its own version`: a task's checks changed without a new `checks.version`, so a stored answer is asked again on every call. Bump the version.

## The extraction job (CS-52)

`extraction.read` (every five minutes) reads each active listing's newest snapshot with `listing.facts`. It stops for the Tehran day once that day's paid calls cost `dailyCapUsd`, US$10 by default in its schedule's payload, and writes `extraction daily cap reached` at `warn`. The next Tehran day resumes.

- **What the cap counts** (`model_spend`): every paid call whatever came back, including an answer sent to review and a call with no answer. A timed-out attempt, or a call whose price was unknown, counts as a US$0.01 estimate. Answers from the cache cost nothing and have no row.
- **No price, no run:** when the model has no known price, the job does not run (`extraction stopped: the model has no known price`).
- **A snapshot that keeps failing:** after three calls that time out or are rejected, it goes to review with outcome `error`, and the job reads the next one. An outage, a bad key or an empty balance fails the run instead, and the queue retries it.

- **Results:** each field's value, evidence and confidence is in `extraction_field`. Below 0.75 it waits in `review_item`, and so does a whole extraction held because the listing addressed the model or hid tag characters.
- **Price merge:** the listing is derived again in the same transaction, so a down payment the text states becomes `price_type = installment` at once.
- **Before changing the task:** a change to its prompt version needs a new evaluation (`listing-facts:evaluate`, `docs/evidence/listing-facts/`). `registry.test.ts` fails until the new version and its evidence are recorded. The new version then reads every active listing again, within the cap.
- **Paid answers from a lane:** a lane that ran the evaluation or the job holds paid `ai_answer` rows. They move into main's database when the lane's task merges, and main's database is never replaced. In the lane run `pnpm --filter @carshenas/ai listing-facts:handoff --export <file>`; in main after the merge run `pnpm --filter @carshenas/ai listing-facts:handoff --import <file>`. The import is keyed by cache key and never overwrites a row, so the worker then answers those listings from the cache at no cost. Both ends use `WORKER_DATABASE_URL`.

## Plain-Farsi search (`query.filters`, CS-62)

The first AI step on the web path (ADR-0029, `docs/specs/S04-plain-farsi-search.md`). Code reads a typed sentence first (`packages/search/src/understand/`); the task asks the model only about the words left. The web app creates the layer on the first question that needs it (`apps/web/src/server/ai/models.ts`), caches answers in `ai_answer` and records every paid call in `model_spend`.

- **Where it runs (CS-111, ADR-0043).** The box takes a sentence and the buyer lands on the results in one step. The server action reads it by code and never calls a model; the search page draws it from code, and from a model's answer too when `ai_answer` holds one for the sentence (`cachedModelStep`: the layer's own cache, a request that would be paid is refused, so drawing a page never spends). With the switch on and nothing cached, the page asks `POST /api/search/understand` in the background, once per sentence per tab, and replaces its address when the model read more; the limits below apply to that route alone. With the switch off nothing is asked and the page says nothing about a model.
- **The master switch is off.** `SEARCH_UNDERSTANDING_AI=1` (or `true`) turns the model on; unset or `0` leaves code alone answering, which needs no key and no network. It is read through `apps/web/src/server/env.ts` on every question, so turning it off stops the next one without a restart. Never put it in a file of the repository: the credit on the Metis account is for work a person starts, and the demo's operator switches it on. Nothing in the repository schedules a model call.
- **Its limits**, all read per question: `SEARCH_UNDERSTANDING_DAILY_CAP_USD` (US$1 per Tehran day, summed from `model_spend` for task `query.filters`), `SEARCH_UNDERSTANDING_VISITOR_LIMIT` (40 paid questions per client address and hour, in `auth_throttle` scope `understand_address`, hashed), `SEARCH_UNDERSTANDING_CONCURRENCY` (4 at once per process). A stored answer is never counted. Past a limit, a slow call or an invalid answer, the response is code's own with `understanding.degraded.reason`.
- **Where the day's spend is:** `SELECT spend_today_query_usd_micros() / 1e6` (or the read-only role's `SELECT sum(cost_usd_micros)/1e6 FROM model_spend WHERE task='query.filters' AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'Asia/Tehran'`). The web role reaches `ai_answer` and `model_spend` only through functions limited to this task.
- **Evaluate:** `pnpm --filter @carshenas/ai query-understanding:evaluate [--mode full|code-only|model-only] [--split development|test|all] [--budget usd] [--cache-only] [--fresh]`; `--mode code-only` is free and offline; `--score <run.json>[,<run.json>]` prints a report again. `query-understanding:code-only` is the offline loop on the frozen catalogue rows (`data/lexicon-rows.json`, refreshed by `query-understanding:export-lexicon`). The labelling guide is `scripts/query-understanding/labelling-guide.md`; a changed prompt, schema, check, instruction or the model changes the prompt version, which `registry.test.ts` pins, so run the evaluation again and record it in `docs/evidence/query-understanding/`. Run the test split once per version.
- **Hand-off of paid answers to another database:** `pnpm --filter @carshenas/ai query-understanding:handoff --export <file>` in the lane and `--import <file>` in the target; keyed by the cache key, idempotent.

