# ADR-0029: Understand a typed sentence with code first, ask a model only for what code cannot settle, and keep the model behind a master switch that is off

- Status: accepted by delegation (2026-10-02; the owner asked that lane decisions be taken without him); point 5 is the owner's instruction of 2026-10-02 relayed by the coordinator
- Date: 2026-10-02
- Deciders: Pedrum (delegated to the CS-62 lane); the coordinator for point 5
- Related: CS-62, CS-63, CS-61; ADR-0019, ADR-0021, ADR-0027; `docs/specs/S03-plain-farsi-search.md`; `docs/evidence/query-understanding/2026-10-02/`

## Context

Torob's challenge and the owner's own example («یک ماشین تمیز کم کار و بیدردسر میخوام …») want a sentence turned into filters a buyer can see and change. The search schema, the filter definitions and the catalogues (CS-58, ADR-0027) already say exactly what a filter is. A model reading every word cost US$1.83 per 1,000 queries, took 2.5 s (p95 5.5 s) and was fully right on 75.5 % of 163 labelled queries; code that reads names, numbers with units and the documented phrases was right on 94.5 % in about a millisecond.

## Decision

1. **Code reads first** (`packages/search/src/understand/`): makes, models and trims by catalogue name and alias, numbers with their units and relations, documented phrases (flags, gearbox, body type, intents, orders), typos by edit distance on long words, and what the data cannot serve (said, never dropped). A query that code settles, 87 % of the labelled set, never reaches a model.
2. **The model is asked only about the words left**, with what code settled as context and the catalogue entries those words may name (`query.filters`, Gemini 3.5 Flash-Lite, fallback GPT-6 Luna). It returns readings: the buyer's own words as evidence, a target (a filter, an intent, an order), values from the lists offered, the buyer's number words (never a number), a strength. Code validates every reading against the search schema and the labels' rules; an invented code, a number the buyer did not write, or evidence that is not the buyer's words is refused.
3. **Confidence.** `direct` and `inferred` readings are applied and shown as chips (stated, or inferred with the words that imply them); `weak` readings are suggestions, one tap to add, never applied. Measured on the labelled set every applied tier was right (code stated 144 of 144, code inferred 49 of 49, model 13 of 13), so the threshold is the model's own strength field.
4. **Injection.** Code removes sentences addressed to a system before the model sees them and tells the buyer; the model is told the search is data and flags what it finds; its output is validated, so a following instruction has nothing to change. 0 of 10 attack witnesses succeeded.
5. **A master switch, off by default.** `SEARCH_UNDERSTANDING_AI`, read through `apps/web/src/server/env.ts`, never set in a file of the repository. Off: the endpoint answers with code alone, needs no key and no network, and says `mode: code_only` (and `degraded.reason: switched_off` when a word needed more). On: a model is asked only for what code cannot settle, behind (a) the answer cache by input hash, (b) a visitor limit of 40 paid questions per address and hour, (c) a daily cap of US$1 per Tehran day summed from `model_spend` (configurable), (d) four questions with the model at once per process, (e) a 7-second deadline. A question that is refused, slow or invalid is answered with code's own result and the reason. Nothing schedules or loops a model call: the credit on the Metis account is for work a person starts.
6. **The gate is metered after the cache.** The AI layer's `beforeRequest` hook runs only when a paid request is about to be made.

## Consequences

- The sentence's answer is a millisecond when code settles it, and about 3 s (p95 4 to 5 s; a call past the 7 s deadline gets code's own answer; none of 21 measured calls did, and 8 of 163 of the longer-answer ablation did, so 7 s stays) when a model is asked; the page says which way it was read.
- A model change or a prompt change makes a new prompt version and needs a new evaluation (`registry.test.ts`).
- The web role gets no privilege on `ai_answer` or `model_spend`: four `SECURITY DEFINER` functions (read an answer, add an answer, add a spend row, sum today) that touch task `query.filters` alone, and a throttle scope (migration). The coordinator's decision of 2026-10-02: no row-level security, which would hide rows from the worker and the read-only role unless each had a policy.
- No word of a buyer that looks like a phone number reaches a model: one shared mask (`maskPhoneLike`, also used by the search log) is applied to the text, the words left and the words of each settled line.
- Test-split misses (5 of 80) are follow-ups, not tuned away.
