---
id: CS-46
title: >-
  Choose a model for each AI step: Artificial Analysis, then a bake-off on real
  listings
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 08:57'
labels:
  - research
  - ai
  - eval
milestone: m-3
dependencies:
  - CS-42
  - CS-45
  - CS-33
references:
  - docs/research/2026-09-30-model-per-ai-step.md
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Each AI step needs the model with the best balance of quality, cost and speed among those Metis serves (CS-42). Artificial Analysis (artificialanalysis.ai) publishes independent measurements of models' intelligence, output speed and price, and a model recommender, which give the first shortlist. Persian text and strict structured output matter more here than general benchmarks, so the shortlist is tested on real listings and queries through the AI layer (CS-45).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A research note shortlists models for each AI step (extraction, duplicate decisions, query understanding, explanations) from Artificial Analysis's measurements, filtered to what Metis serves, with each model's intelligence, speed and price and the date they were read
- [x] #2 A bake-off runs the shortlisted models through the AI layer on at least 30 real listing texts and 20 real queries, and reports the rate of schema-valid output, accuracy checked by hand, latency and cost per thousand calls
- [x] #3 The AI layer registry names a default model and a fallback on another provider for each step, with the reason; CS-52 confirms the extraction model on its labelled set (its criterion 5), since that set does not exist before CS-48
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Metis today: read the live model lists of the four native routes, /api/v1/meta and the live pricing endpoint (2026-09-30), so the shortlist holds only what Metis serves, at the price it lists.
2. Artificial Analysis with the agent browser (npx playwright cli): the model recommender filtered to OpenAI, Anthropic, Google and DeepSeek, the leaderboard (intelligence index, output speed, latency, price) and the benchmarks that bear on each step (instruction following, long context, hallucination). Record every figure with the date read.
3. Research note docs/research/2026-09-30-model-per-ai-step.md: shortlist per step (extraction, duplicate decisions, query understanding, explanations) with intelligence, speed and price, filtered to Metis; and the embedding question (is one needed, and which Metis embedding model if so).
4. Real listings: one bounded discovery round of the CS-33 crawler in lane F own database (the owner allowed it on 2026-09-30, as a one-off exception to the one-crawling-lane rule), Divar paused again afterwards. 30+ listing texts, personal data removed, become the bake-off set; 20 queries drafted in buyers styles (owner decision 2026-09-30), both labelled by hand before any model sees them.
5. Bake-off through the AI layer (packages/ai/scripts/bakeoff): bake-off tasks for the four steps, each shortlisted model at its measured settings; report schema-valid rate, hand-checked accuracy, latency p50/p95 and cost per 1,000 calls at Metis live prices; evidence copied to the note folder.
6. Registry: a default model and a fallback on another provider for each step, with the reason, in packages/ai/src/registry.ts, with tests; runbook updated.
7. AC 3 second half: CS-52 criterion 5 already confirms the extraction model on the labelled set; reword CS-46 AC 3 to point there (decided on the recommendation, 2026-09-30).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-30, real listings for the bake-off: no lane held any listing text (lane A only CS-33's counts). With the owner's approval, as a one-off exception to the one-crawling-lane rule, lane F ran one discovery round of the CS-33 crawler in its own database (CRAWLER_USER_AGENT CarshenasBot/0.1 with the repository URL as contact, the owner's choice; a lane F superadmin to enable the source). 08:00 to 08:15 UTC: 20 search pages and 121 posts, 141 requests, one 404 (a listing deleted since discovery), no refusal, challenge or 429; Divar paused again at 141 and the worker stopped. 120 snapshots, 68 private and 52 dealer listings. Observed for CS-35 and CS-41: the lane twice sat idle for two minutes with 400+ jobs queued and nothing logged (08:06:06 to 08:08:05 and 08:10:05 to 08:12:05) while the queue's fetch polled every second.

2026-09-30, research and bake-off. Metis today (pnpm --filter @carshenas/ai models): 165 OpenAI, 13 Anthropic, 61 Gemini, 4 DeepSeek models; gemini-3.8-flash is listed but refused (400 MODEL_NOT_SUPPORTED) and unpriced, gpt-6.1-sol unpriced, gemini-flash-latest unpinnable, Gemini 3.7 Flash refuses thinking level minimal. Artificial Analysis read with the agent browser 07:46-07:58 UTC: the recommender per step with the providers filter set to Anthropic, DeepSeek, Google and OpenAI, the leaderboard with status All, and AA-Omniscience hallucination for 22 candidates; no Persian evaluation exists and IFBench does not cover the current models. Bake-off through the layer (packages/ai/scripts/bakeoff, 08:21-08:39 UTC): 36 real listings plus 3 injection variants (extraction, three runs), 24 written searches, 20 duplicate questions, 20 deal fact sets, labelled by hand before any run and adjudicated after the first (data/README.md). 1,604 calls, US$3.14 at Metis list prices. The owner then said to run nothing more, decide here and finalize with no review (2026-09-30).

Decided 2026-09-30 by the owner instruction "decide here ... decide and finalize the task", in STEP_MODELS (packages/ai/src/registry.ts): extraction Gemini 3.7 Flash low (99.3% of fields over 117 calls, 0 of 21 injected values taken, $1.64 per 1,000), fallback GPT-6 Luna low; duplicates Gemini 3.7 Flash low, fallback Claude Sonnet 5.5 low effort; query Gemini 3.5 Flash-Lite minimal (24 of 24, p95 1.8 s), fallback GPT-6 Luna none; explanations GPT-6 Luna low (17 of 20 faithful by hand, $0.13 per 1,000), fallback Claude Sonnet 5.5 no thinking. Embeddings: none now; text-embedding-3-small then gemini-embedding-001 when the CS-55 trigger fires. Criterion 3 reworded the same day (its labelled-set confirmation is CS-52 criterion 5). .prettierignore now ignores packages/ai/results/, which the root check read although packages/ai/.gitignore ignores it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Chose a model and a fallback for each AI step and wrote them into STEP_MODELS (packages/ai/src/registry.ts), decided on 2026-09-30 by the owner instruction to decide here. Research note docs/research/2026-09-30-model-per-ai-step.md: Metis model lists and live prices of the day; Artificial Analysis recommender run per step with the providers filter set to Anthropic, DeepSeek, Google and OpenAI, the leaderboard (intelligence, speed, latency, price) and AA-Omniscience hallucination, all read 2026-09-30; no Persian evaluation exists, and gemini-3.8-flash is listed by Metis but refused. Bake-off through the AI layer (packages/ai/scripts/bakeoff, pnpm --filter @carshenas/ai bakeoff): 36 real Divar listings crawled once by lane F with the owner approval plus 3 injection variants, 24 searches written in buyer styles, 20 duplicate questions and 20 deal fact sets, labelled by hand, with valid-output rates, field accuracy, latency p50 and p95, and cost per 1,000 calls; explanations also judged by hand. Decisions: extraction and duplicates on Gemini 3.7 Flash (low), query understanding on Gemini 3.5 Flash-Lite (minimal), explanations on GPT-6 Luna (low), each with a fallback on another provider; no embedding model until the CS-55 trigger (text-embedding-3-small first). Verified with registry.test.ts (fallback on another provider, never metis-gpt, priced by Metis) and pnpm check (lint, typecheck, all tests, formatting) passing. 1,604 calls cost US$3.14. Extraction confirmation on the labelled set is CS-52 criterion 5.
<!-- SECTION:FINAL_SUMMARY:END -->
