---
id: CS-62
title: Plain-Farsi search into structured filters
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-02 15:41'
labels:
  - ai
  - search
milestone: m-5
dependencies:
  - CS-59
references:
  - .claude/skills/ui-design/references/listing-patterns.md
  - docs/research/2026-09-28-torob-challenge-expectations-and-field.md
priority: high
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Buyers describe what they want in words («۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ»). Turning that into filters, and showing the buyer what was understood, is the challenge's 'rank by user intent' step.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Queries become filters validated against the same schema as the filter UI, and the understood filters are shown as removable chips
- [ ] #2 Words the parser could not use are shown to the buyer, never dropped silently
- [ ] #3 Intent words such as ride-hailing or family use map to documented filter or ranking adjustments
- [ ] #4 Accuracy is measured on a labelled set of at least 50 queries
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read and decide (done 2026-10-02): the search package (filters, catalogues, one SearchSchema, chips, explain, vocabulary), CS-59's API, the AI layer (registry, STEP_MODELS.query, answer cache, spend table), the ai-features skill and rules, CS-46's bake-off. Decisions are in the notes below.
2. Labelling guide and labelled set first (before any model sees an item): packages/ai/scripts/query-understanding/ (labelling-guide.md, data/queries.ts, 100+ queries in 17 categories, development and test splits, the owner's vague request and its variants, typos, Persian and Arabic digits, budgets, Finglish, nonsense and injections).
3. The deterministic pass in code, in packages/search/src/understand/: normalisation and tokens with spans, number phrases (digits in any script, Persian number words, scale words, relations), a lexicon of makes, models, trims, cities, districts and colours read from the catalogue and its aliases, a table of documented phrases, a table of documented intents with their filter adjustments and conflict rules, typo matching by edit distance. It claims tokens, so the words nobody claimed are the unused words, and decides whether the model is needed (unclaimed words, ambiguity, negation, or a long query).
4. The AI task query.filters in packages/ai/src/tasks/query-filters.ts: English instructions with the vocabulary rendered from the definitions, a strict schema in the portable profile (readings with evidence before value, strength direct, inferred or weak), a user turn with the query as data, what code already settled and the candidates; checks in code (evidence grounded outside text addressed to an AI, ids and values valid for their filter, every number parsed by code from the buyer's own words, never taken from the model); snapshot and check tests; injection tests; the registry entry on STEP_MODELS.query after its evaluation.
5. The merge in packages/search (code readings plus the model's validated readings, validated again against SearchSchema; conflicts resolved explicitly; chips with removal, suggestions, unused words, notes, one Farsi explanation built by code; the degraded flag).
6. The web backend: POST /api/search/understand, a per-visitor window, a daily spend cap from model_spend, the answer cache through the web role (one migration: grants on ai_answer and model_spend, a throttle scope), a deadline with a fallback to the code reading and plain text search, one in-process concurrency limit, no personal data in logs.
7. The interface: a self-contained component for the explanation, removable chips, suggestions, unused words and the degraded notice (accessible, Farsi, RTL, phone first), a host page for its Playwright test; after CS-61 merges, wired into the search box with a whole-flow test.
8. Evaluation: development split while writing, the test split once per prompt version; per-field and per-query accuracy with intervals, code-only share, applied/inferred/suggested precision (the confidence threshold), injection results, cost per 1,000, latency; the report under docs/evidence/query-understanding/2026-10-02/; the registry pin test; the runbook; an ADR and spec S03; a handoff script for paid answers.
9. Verify: pnpm check, pnpm db:check, Playwright with --workers=2 at phone and desktop widths, craft checks, latency measured on a production build; finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-28: raised to high. "Rank by user intent" is the third line of Torob's brief, and «فهم عبارت جست‌وجو» (Persian, Finglish and typos) is the first of the ten problems on Torob's careers page.

Renumbered on 2026-09-29: this task was CS-15 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-15; the archived CS-15 points here.

CS-47 (2026-09-30): the AI rule pack .claude/rules/ai.md attaches when an agent reads a file under packages/ai/** or apps/worker/src/models*.ts. When this task creates the web app counterpart of apps/worker/src/models.ts (where the web app creates the layer with its key), add that path to the rule pack paths. Load the ai-features skill before building the step.

Owner, 2026-09-30: buyers may not name a model at all, for example «یک ماشین تمیز کم کار و بیدردسر میخوام که همه چیش از نظر فنی خوب باشه و تمیز باشه» (a clean, low-mileage, trouble-free car, technically sound). The step must turn such a request into filters too (low mileage for its age, intact body, sound engine and gearbox, no declared damage, perhaps good or better deal ratings, popular easy-to-maintain models), and say which filters it inferred so the buyer can change them.

2026-10-02 slice 1 (decisions, the owner is away and delegated them): code first, a model for the rest. packages/search/src/understand/ holds the deterministic pass (cleaning and tokens that remember where they were typed, number reader, lexicon of catalogue names and aliases, documented phrases, intents table, quantity reader, code pass, merge, orchestrator); the model step is injected, so the web route and the evaluation bind it to the AI layer. A claim covers tokens; the words nobody claims are the unused words, never dropped. Code claims are final: the model can only add readings for words code left, and where it disagrees with a code claim of the same filter code wins. A reading is kept by code only when certain: a negation beside it («نباشه», unclaimed «بدون») releases the words to the model, and soft phrases («ماشین تمیز») are read only when nothing else is left. Numbers are the buyer's own: the model returns number words, which code reads again (quantityFromWords); a price under 20,000,000 tomans, a year no car has or a number the code cannot read is shown as not understood, never applied. Gregorian years are minus 621 (ADR-0014); zero kilometres is at most 100; no relation word is a budget (at most); strictly «زیر ۱۴۰۰» is 1399. Tehran adds no filter (74% of listings carry no city) and says so; another city is shown as outside the market; a catalogue entry with no searchable listing is applied and noted «not tracked». Aliases the first pass needed live where the catalogue's aliases live (apps/worker/src/catalogue/aliases.ts: «۲۰۷», Finglish pejo/pezho/paraid/kooik, corolla, soren, MAKE_ALIASES synced by catalogue:sync): `pnpm catalogue:sync` after the merge in main produces the rows.
Labelled set: packages/ai/scripts/query-understanding/ (163 written queries, 83 development and 80 test, 18 categories; labelling-guide.md written before any model or the code saw them). Code alone on the development split: 79 of 83 fully right, 62 of 62 labelled settledByCode need no model; the four others are Finglish or vague requests the model is asked about. The test split has not been run.
<!-- SECTION:NOTES:END -->
