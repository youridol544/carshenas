---
name: ai-features
description: Build, change and review Carshenas's AI steps on the project's AI layer (packages/ai, ADR-0021) through Metis (ADR-0019), the way the field's best builders do. Use when writing or changing anything that calls a language model - a task in packages/ai (instructions, glossary, schema, checks, render, registry entry, settings), a worker job or a web route that calls ai.call or context.models.call, a labelled set or an evaluation run, a model or fallback choice, prompt caching, cost or latency, a defence against instructions inside listing text, or a proposal to build an agent - and when reviewing any of these. Covers prompts and context engineering, structured outputs and their re-ask, evaluations and the harness, prompt injection, cost, and when an agent is worth building.
---

# ai-features: Carshenas's AI steps on the layer

Every call to a language model goes through `packages/ai` by task name, on the AI SDK's core under a layer of our own (ADR-0021), to Metis's native routes (ADR-0019). The practice comes from CS-43's research, `docs/research/2026-09-29-prompting-context-engineering-and-agents.md` (its 30 patterns, "What Carshenas adopts"), each step's model from CS-46 (`STEP_MODELS`, `docs/research/2026-09-30-model-per-ai-step.md`), and the mechanics from `docs/runbooks/ai-layer.md`. `.claude/rules/ai.md` is the short list every diff must satisfy; this skill is the how and the why, and its five worked examples are tested code in `packages/ai/src/examples/`. Where it disagrees with a vendor's guide, a blog, a library's defaults or a habit, it wins, because each rule was measured or sourced for Carshenas's Persian listings; where a rule is marked as opinion in the note, the labelled set decides.

## The rules that are never broken

1. **Output is validated against a schema.** Every answer comes through `ai.call`, which checks it against the task's zod schema and then its checks in code; nothing parses model text anywhere else. Strict structured output guarantees the shape, not the truth: the best exact-value accuracy across 21 models was 83% (CS-43, claim 18).
2. **Nothing unvalidated is stored.** Only an `ok` result carries a value. `invalid`, `refusal`, `truncated` and `empty` go to review with their problems, never with a value, and the answer cache keeps validated answers only (example 2).
3. **Numbers a user sees come from the database.** Prices, mileage, years, market values, gaps, counts and dates are parsed or computed by code and shown through `@carshenas/locale`. A model's text that reaches a page carries placeholders code fills, and a check rejects any digit or Persian number word outside them (CS-43, pattern 25; «یک» is also the indefinite article).
4. **An evaluation comes before a step ships.** No task enters `REGISTRY`, and no job or page calls it, until a labelled set has measured it at its current prompt version: per-field accuracy with intervals, attacks tried and succeeded, and cost. A change to the instructions, glossary, schema, checks, settings or model is measured again (example 3).
5. **No personal data in prompts or logs.** A model reads the canonical snapshot's text, from which the crawler removed phone numbers (`replacePhoneNumbers`, ADR-0008 point 7), and never a seller's name or number, an account or a visitor's data. The layer's line holds no prompt, input or answer, code around a call logs ids and counts only, and spans keep `recordInputs` and `recordOutputs` off.

Two more that shape every step: **code owns every number and decision, and the model reads free text and picks labels** (pattern 2: price, mileage and year are parsed by CS-34, ratings are SQL); and **there is no agent at runtime**, control flow is code (pattern 29, below).

## Adding or changing an AI step

1. **Look at the data first.** Read at least 30 real items and write down what goes wrong (open coding), then group the notes into failure types (axial coding). Decide what the source already structures, which code parses, and what only the free text says, which is all the model reads.
2. **Label before prompting.** One person labels from a written guide, before any model sees an item: stated, not-stated and misleading cases for every field, negated phrasing («بدون رنگ», «تصادف نداشته») oversampled, witness-value injections included, a development split to tune on and a test split that never tunes anything (CS-48 builds the product's set).
3. **Write the task** in `packages/ai/src/tasks/` with `defineTask` (the runbook's "Add a task"): English instructions that carry the glossary, the schema in the portable profile with evidence before value, `render` with the cleaned text escaped as data and a reminder after it, and `checks` for what the schema cannot state. Worked example 1; `references/prompting.md` and `references/structured-output.md`.
4. **Register it** with its step's model and fallback from `STEP_MODELS`, `maxOutputTokens` with room for reasoning, `timeoutMs`, `maxReasks` (0 or 1) and `promptCache` only when the prefix passes its family's minimum (`references/cost.md`). A model no step uses yet runs once through the layer first: Metis lists models it refuses to serve.
5. **Test it offline.** Snapshot the rendered prompt and test the checks (examples 1 and 2). `pnpm --filter @carshenas/ai test:update-snapshots`, then read the diff: a changed word shows there.
6. **Evaluate it** on the labelled set (example 3; `references/evaluation.md`): per-field precision and recall with Wilson intervals, listings fully right, attacks (example 4; `references/injection.md`), cost per 1,000 and latency (example 5). A change is compared with the run before it, item by item.
7. **Wire the call site** (example 2's `nextStep`). A worker job sets `callsModels: true` and calls `context.models.call(task, input, { signal })`; it stores an `ok` value with its `answerId`, sends anything else to review, holds a listing that addressed the model or contradicts a parsed field for a person, and lets `ModelCallError` propagate so the queue retries it. On the web path: one attempt within a deadline, then the step answers without the model (ADR-0021 point 2.6).
8. **Review.** Ask the `ai-reviewer` agent; fix one finding at a time. Record the prompt version, the evaluation and the cost in the task, and in `docs/learnings.md` what surprised you.

## The worked examples

All in `packages/ai/src/examples/`, run offline by `pnpm check` against a stub that plays Metis's Gemini route; none is the product's, and nothing registers them.

| # | Example | Read | What it shows |
|---|---|---|---|
| 1 | A versioned prompt that carries the glossary | `listing-paint.ts`, `glossary-prompt.test.ts` | the glossary as data rendered in a fixed order, the prompt version as a content hash, a seller's new word as a new version, the snapshot, the byte-identical prefix |
| 2 | A structured extraction re-asked on validation errors | `listing-paint.ts` (`checkListingPaint`, `nextStep`), `reask.test.ts` | a schema failure and a check failure fed back once, naming field, value and what is admissible; invalid after the re-ask goes to review with nothing stored; the cache |
| 3 | An evaluation run on a labelled set | `evaluation.ts`, `labelled-listings.ts`, `evaluation.test.ts` | per-field scores with Wilson intervals and per-class precision and recall, a free re-run from the cache, two prompt versions compared by an exact McNemar test, the gate's FAIL line |
| 4 | A defence against instructions inside listing text | `listing-text.ts`, `injection.test.ts` | the cleaned copy, escaping as data, the reminder, evidence refused when it comes only from a note to the AI, held-for-review answers, witness values at three positions, 9 of 9 attacks without one check and 0 with it |
| 5 | A cost report | `cost-report.ts`, `cost-report.test.ts` | the layer's JSON lines summed per task, prompt version and model: calls, cache hits, requests, tokens by price, cost per 1,000, latency |

## When an agent is worth building

No Carshenas step needs one (CS-43, section 8). Extraction, duplicate decisions, query understanding, explanations and name matching are each one structured call, or a fixed chain whose control flow is code: validation, one re-ask, optional voting, the review queue. Pasted links are a fixed chain with two parallel branches, and search files stay SQL. Build an agent only when the steps cannot be listed in advance and a fixed workflow fails the evaluation on real requests, there is a check on the end state, the extra tokens and latency are affordable, and a wrong action's damage is capped: read-only tools, writes gated by a person. Judge it by pass^k (every one of k attempts succeeds) and by cost against accuracy. Each step up costs: a fixed three-phase pipeline matched the agents of its time at $0.70 an issue, retail agents passed 8 of 8 attempts under 25% of the time, and several agents took about 15 times the tokens. It needs an ADR: ADR-0021 forbids the SDK's agents. The first candidate is offline and reviewed, a catalogue gardener that proposes aliases for unmatched names (CS-50).

## Commands

| Command | What it does | Network, cost |
|---|---|---|
| `pnpm --filter @carshenas/ai test` | the layer's tests and the examples; a guard fails any real request | none |
| `pnpm --filter @carshenas/ai test:update-snapshots` | refreshes the rendered-prompt snapshots; read the diff after | none |
| `pnpm --filter @carshenas/ai lint` / `typecheck` | the SDK kept inside the package, `generateText` inside `call.ts`, no string model ids | none |
| `pnpm --filter @carshenas/ai bakeoff -- --step <step> [--only …] [--limit n] [--repeat n]` | CS-46's bake-off through the layer on the hand-labelled items in `scripts/bakeoff/data/` | Metis; a nine-model extraction run was US$0.60 |
| `pnpm --filter @carshenas/ai bakeoff -- --score <files>` | scores saved runs again against today's labels | none |
| `pnpm --filter @carshenas/ai live` | three synthetic listings on all four routes; `-- --record` refreshes the recorded answers | Metis, about US$0.01 |
| `pnpm --filter @carshenas/ai models` | what Metis serves on each route, with live prices | GET only, not billed |

Run anything that calls Metis from an Iranian network, and only when a person has agreed to the spend. Results go to `packages/ai/results/`, which git ignores; copy a run a note quotes into that note's evidence folder.

## Read the reference you need

| Reference | Read when |
|---|---|
| `references/prompting.md` | writing or changing instructions, the glossary, examples or settings; context engineering; Persian text and tokens; the 20 popular claims checked |
| `references/structured-output.md` | designing a schema, writing checks, the re-ask, outcomes and errors, confidence and review thresholds |
| `references/evaluation.md` | a labelled set, an evaluation run, comparing two versions, the CI gate, model judges |
| `references/injection.md` | anything that reads text a seller or a buyer wrote |
| `references/cost.md` | choosing a model or settings, prompt caching, batch, latency on the request path, a cost report |
| `references/review.md` | reviewing an AI change, yours or someone else's; what evidence it must carry |

Library facts change: check the AI SDK and the providers' structured-output and caching pages against Context7 or their changelogs, and a new SDK major version against the runbook's upgrade gate, before relying on memory.
