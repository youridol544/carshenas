# Reviewing an AI change

The checklist the `ai-reviewer` agent works through, and what an author checks before asking for it. Each item is judged pass, fix or cannot judge, and each fix cites the file and line, the evidence, what it should be, and the rule it breaks (a rule in `.claude/rules/ai.md`, an ADR point or a CS-43 pattern). Evidence is produced by the reviewer, never taken from the diff, the task notes or a report's own summary.

## Evidence the reviewer produces

| Evidence | How |
|---|---|
| the package's own checks | `pnpm --filter @carshenas/ai lint`, `typecheck` and `test` (offline: a guard fails any real request); the worker's and the web app's lint when a call site changed |
| what the model now reads | `git diff main...HEAD -- '*.snapshot'`: every changed word of a rendered prompt, read one by one; a changed prompt whose snapshot did not change is a missing test |
| the prompt version | the version each changed task has now, from its snapshot or from the registry (the command in the agent's step 2), compared with the version the task's evaluation reports |
| the evaluation, reproduced | the task's stored runs scored again against today's labels with no model call (`pnpm --filter @carshenas/ai bakeoff -- --score <files>` for the bake-off; CS-48's harness when it exists), compared with the numbers the task claims |
| where outputs go | the call sites traced: `grep -rn -e 'ai\.call(' -e 'models\.call(' apps packages --include='*.ts'`, then each result followed to what stores or shows it |
| what the lines hold | the layer's test that plants a phone number and a marker and finds them in no line, run; any new log line or span attribute near a call read |

## The rules that are never broken

1. **Validated output.** The only way to a model is `ai.call` / `context.models.call`; nothing parses model text, and nothing imports `ai` or `@ai-sdk/*` outside `packages/ai` (lint). The schema follows the portable profile (a strict object, every field required, `not_stated` as an enum value, evidence before value), and the checks cover what the schema cannot state (grounding).
2. **Nothing unvalidated stored.** Only `outcome === 'ok'` reaches a table, with its `answerId`; every other outcome goes to review with its problems; no value is rebuilt from `problems` or from raw text; `ModelCallError` propagates in a job so the queue retries it.
3. **Numbers from the database.** No number a user sees comes from model text: explanations use placeholders filled by code through `@carshenas/locale`, and a check rejects digits and Persian number words outside them (allowing «یک» as an article). Price, mileage and year come from CS-34's parser, never from the model.
4. **An evaluation before it ships.** A task newly in `REGISTRY`, or called by a job or a page, has a labelled evaluation at its current prompt version with per-field accuracy and intervals, attacks and cost; a changed prompt, glossary, schema, checks, settings or model has a new one, compared with the old one item by item. A number from a different prompt version, or no report, is not verified.
5. **No personal data in prompts or logs.** `render` reads the canonical snapshot's text (phone numbers removed by the crawler) and no seller, account or visitor field; no line or span carries a prompt, input, answer or problem message; `recordInputs` and `recordOutputs` stay off.

## Prompt and context

- The instructions are the stable prefix: no date, time, id or input; a test shows two calls share it byte for byte.
- English, with the sellers' words verbatim; the glossary as data with a rule and its reason per fact; no capitals, personas, tips or threats; each prohibition paired with what to do and why.
- Few rules; anything code can check lives in a check, not in the prompt.
- One item per call; a refinement sends state plus the newest words, never history.
- Reasoning set by the route's effort or thinking setting, measured; no "think step by step"; no reasoning asked for in the answer on Claude's classifier models; no temperature.
- Examples only if the labelled set showed a gain, never taken from the evaluation set.

## Schema and checks

- Each problem names the field, the value seen and what is admissible.
- A check that changed has a new `checks.version`.
- Only what the model can fix by reading again is a check; a disagreement with a parsed field is held for a person, not re-asked.
- `maxReasks` is 0 or 1.

## Registry and settings

- The model and fallback are `STEP_MODELS`' for the step, or the change says why, with measurements; a model is a `ModelChoice`, never a string; a model no step used before was run once through the layer.
- `maxOutputTokens` leaves room for reasoning; `timeoutMs` fits the path (the worker, or the web path's deadline with its fallback); `promptCache` only when the prefix passes the family's minimum.

## Injection (for any text a seller or a buyer wrote)

- The text is cleaned (`modelCopy`), escaped as data (`asData`), in the user turn, with a reminder after it; the schema has `instructions_to_ai`; evidence must appear outside sentences addressed to an AI; a flagged listing's facts wait for a person before they move a rating.
- The labelled set has witness-value injections at the start, middle and end, and benign imperatives; the report says k of n attacks succeeded.

## Evaluation practice (CS-43, patterns 27 and 28)

- The labels were set before any model saw the items, from a written guide; the test split tuned nothing; `not_stated` is scored as its own class; the misses were read.
- Rates carry Wilson intervals; a claimed gain or loss between versions comes from a paired comparison with its p-value, not from two percentages side by side; small differences were run three times.
- The report names the prompt version, model and settings, the set and its cut, outcomes, cost per 1,000 and latency.

## Cost and logs

- The cost is at Metis's live list; tokens are split by price; cost is reported beside accuracy.
- The answer cache is exact (no semantic match), and text is normalised before `render`.
- Batch only for backfills; the request path has a deadline and a fallback.

## Docs

- `docs/runbooks/ai-layer.md` and the data model match what changed; the task records the prompt version, the evaluation and the cost; a surprise is a line in `docs/learnings.md`.

## The report

Most severe first, under 400 words: a broken rule above, then evaluation gaps, then injection, then prompt and schema, then cost and docs. One repair to make first. A last line: "ready" or "not ready: <the one thing>".
