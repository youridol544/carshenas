---
paths:
  - "packages/ai/**"
  - "apps/worker/src/models*.ts"
  - "apps/web/src/server/ai/**"
  - "apps/web/src/features/search-understanding/server/**"
---

# AI steps: tasks, prompts, schemas, checks and evaluations (packages/ai)

Load the `ai-features` skill before adding or changing a task, its instructions or glossary, a schema or a check, a model or its settings, an evaluation or a call site; its references hold the reasons and sources, and `packages/ai/src/examples/` five worked examples that run offline. Decisions: ADR-0019 (Metis), ADR-0021 (the layer), CS-46's `STEP_MODELS`; the practice: `docs/research/2026-09-29-prompting-context-engineering-and-agents.md`; the how-to: `docs/runbooks/ai-layer.md`. Already enforced, so fix what the message says: lint keeps the AI SDK inside `packages/ai` and `generateText` inside `call.ts`, refuses a model written as a string, `process.env` and `console`; the tests refuse the network. This file is what they cannot see.

## Never broken

1. **Output validated against a schema.** A model is reached only through `ai.call` (`context.models.call` in a job): the task's zod schema, then its checks in code. Nothing parses model text itself; a strict schema guarantees the shape, not the truth.
2. **Nothing unvalidated stored.** Only an `ok` result has a value, and only it is stored, with its `answerId`. `invalid`, `refusal`, `truncated` and `empty` go to review with their problems; a `ModelCallError` propagates so the queue retries it.
3. **Numbers a user sees come from the database.** Prices, mileage, years, market values, gaps, counts and dates are parsed or computed by code and shown through `@carshenas/locale`, never taken from model text. Model text that reaches a page carries placeholders code fills, and a check rejects any digit or Persian number word outside them.
4. **An evaluation before a step ships.** No task enters `REGISTRY`, and no job or page calls it, until a labelled set has measured it at its current prompt version: per-field accuracy with intervals, attacks tried and succeeded, cost per 1,000. A changed instruction, glossary word, schema, check, setting or model is measured again and compared listing by listing; so is a changed `render` or text cleaning, whose `renderVersion` is bumped with it so the prompt version changes (CS-84).
5. **No personal data in prompts or logs.** `render` reads the canonical snapshot's text, from which the crawler removed phone numbers, and no seller, account or visitor field. No log line or span holds a prompt, an input, an answer or a problem's message, which quotes the listing: ids, counts and field paths only. `recordInputs` and `recordOutputs` stay off.

## Writing a task

- The instructions are the stable prefix: English with the sellers' Persian words verbatim, the glossary as data with each rule's reason, few rules, what to do rather than what not to, no date, id or input. The variable input goes last, in the user turn: cleaned, escaped as data, with a reminder after it.
- The schema is a strict object with every field required, `not_stated` as an enum value rather than a null, and evidence before the value it supports.
- A check holds only what the model can fix by reading again (grounding, cross-field rules), each problem naming the field, the value seen and what is admissible; bump `checks.version` whenever `run` changes. A disagreement with a field code parsed is held for a person, never re-asked into agreement.
- The registry entry takes its step's model and fallback from `STEP_MODELS`, a `ModelChoice` and never a string; `maxOutputTokens` leaves room for reasoning; `maxReasks` is 0 or 1; `promptCache` only above the family's caching minimum. A model no step uses yet runs once through the layer first.
- Reasoning is the route's effort or thinking setting, measured on the labelled set: no "think step by step", no temperature, no persona, no capitals.
- Snapshot the rendered prompt and read the diff of every refresh; write the zero-width non-joiner as `^` with `fa()` or from its code point, never typed.

## At the call site

- Handle every outcome (`nextStep` in `examples/listing-paint.ts`): store the value of an `ok` result, send the rest to review, and hold for a person an answer from a listing that addressed the model or hides tag characters, or one that contradicts the glossary words the listing writes or a field code parsed.
- Pass the job's `signal`. In the worker the queue retries; on the web path there is one attempt within a deadline, after which the step answers without the model.
- No agent, tool or model-chosen control flow at runtime: the sequence of calls is code.

## Verify before calling it done

`pnpm --filter @carshenas/ai lint`, `typecheck` and `test`; the snapshot diff read word by word; the evaluation at the new prompt version, with its cost; then the `ai-reviewer` agent. Anything that calls Metis costs money and runs from an Iranian network, and only when a person has agreed to it.
