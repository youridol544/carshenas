# Evaluation of plain-Farsi search (CS-62), 2026-10-02

Task `query.filters`, prompt version `64b3c6e03ee174cb` (checks `reading-1`, render `query-tags-2`), model `google/gemini-3.5-flash-lite` (thinking minimal) with fallback `openai/gpt-6-luna`, through Metis. The labelled set is `packages/ai/scripts/query-understanding/data/queries.ts` (163 queries, 83 development and 80 test, 18 categories), labelled by the guide `labelling-guide.md` in this folder before any code or model saw an item.

**Disclosures.**
- The labels were written by the same agent that wrote the code; there was no second labeller (CS-90 adds one).
- The development split was used to write the code pass, the phrase table and the prompt. The test split was first run once at version `2e9134b4fa9bee88` (93.8 %, 75 of 80; those runs are in `runs/before-privacy-fix/`). It was run a second time, once, at `64b3c6e03ee174cb` only because the review found a privacy defect (a phone number typed with spaces or hyphens reached the prompt in `left` and `settled`; the render now masks every phone-like run through one shared function, `maskPhoneLike`). Nothing else was tuned between the two runs: the result is the same 75 of 80 with the same five misses. A comment was added to label Q057 (no label changed).
- The model's gain over code alone (4 queries of 163) is not significant (McNemar exact p = 0.125).
- Spend: about US$0.75 in all of the lane's evaluation runs (US$0.037 for the two fixed-prompt runs of the product mode, the rest ablations and earlier versions), of the US$3 allowed.

## Summary

| Mode | Fully right, all 163 | Development (83) | Test (80) | Cost per 1,000 queries |
|---|---|---|---|---|
| Code only (master switch off, the default) | 94.5 % (154), 89.8 to 97.1 | 96.4 % | 92.5 % | US$0 |
| Code, then the model for what code cannot settle (switch on) | 96.9 % (158), 93.0 to 98.7 | 100 % (tuned on it) | 93.8 % | about US$0.19 (21 model calls, US$0.031 measured on the fresh runs, per 163 queries; the table's own column below shows 0 because the full run re-read cached answers) |
| The model reads every word, code only cleans (ablation, not the product) | 73.6 % (120), 66.4 to 79.8 | 74.7 % | 72.5 % | US$1.55, p50 3.0 s, p95 5.7 s |

- Code-first is what makes it good and cheap: 142 of 163 queries (87 %) need no model, and the model alone reads 23 points worse and costs eight times more per query.
- The test misses (5): Q026 (a note about an untracked trim), Q057 («۴۰۵ کیلومتر پایین»: the guide's own rule says a number with a unit is no model, so the label is arguable; kept as written), Q133 (an alias matched two models), Q135 (an untracked model's Persian spelling), Q163 (a long injection query: extra unread words). They are tracked in CS-90.
- Injection: 0 of 10 witness values over 9 queries appeared in any answer in every mode (0 of 4 on the test split); code removes addressed sentences before the model sees them.
- Latency of a model-asked query in the product mode: p50 2.8 to 3.5 s, p95 4.2 to 5.2 s, slowest of 21 fresh calls 5.2 s (earlier runs of the same mode: p95 up to 7.3 s). No product-mode query hit the 7 s deadline (0 of 21); in the ablation, whose answers are longer (mean 218 output tokens against 63 to 99), 8 of 163 calls timed out and 6 of the fresh calls took 7 s or more. The deadline stays 7 s: a model-asked query that is slower than that is one the buyer is better served by code's own answer, which is already on the page's way, and the ablation shows what raising it would buy (a few more long answers, nine seconds of waiting). The decision is recorded in ADR-0029.

Raw reports follow (each with per-category, per-field precision and recall, tiers by who read a filter, and every miss).

---

## query.filters on 163 labelled queries: full (google/gemini-3.5-flash-lite), prompt version 64b3c6e03ee174cb

Accuracy with 95% Wilson intervals. A query is right when every field of what the buyer gets is right: each filter, the order, the unused words, the text-search fallback and the notices. The bundle a wish named is reported beside, not part of it.

| Queries | All | Development | Test | Settled by code | Asked the model |
|---|---|---|---|---|---|
| fully right | 96.9% (158/163, 93.0–98.7) | 100.0% (83/83, 95.6–100.0) | 93.8% (75/80, 86.2–97.3) | 99.3% (141/142, 96.1–99.9) | 81.0% (17/21, 60.0–92.3) |

Code settled 142 of 163 queries without a model (87.1%); the model was asked about 21.

Labelled as needing no model: 127; of them 126 cost no model call.

| Category | Queries | Fully right | Asked the model |
|---|---|---|---|
| model | 20 | 100.0% (20/20, 83.9–100.0) | 0 |
| trim | 7 | 85.7% (6/7, 48.7–97.4) | 1 |
| price | 14 | 100.0% (14/14, 78.5–100.0) | 0 |
| year | 10 | 100.0% (10/10, 72.2–100.0) | 0 |
| mileage | 9 | 88.9% (8/9, 56.5–98.0) | 1 |
| condition | 10 | 100.0% (10/10, 72.2–100.0) | 0 |
| values | 12 | 100.0% (12/12, 75.8–100.0) | 0 |
| place | 8 | 100.0% (8/8, 67.6–100.0) | 0 |
| terms | 8 | 100.0% (8/8, 67.6–100.0) | 0 |
| intent | 12 | 100.0% (12/12, 75.8–100.0) | 1 |
| vague | 8 | 100.0% (8/8, 67.6–100.0) | 1 |
| order | 5 | 100.0% (5/5, 56.6–100.0) | 0 |
| typo | 8 | 100.0% (8/8, 67.6–100.0) | 3 |
| not_tracked | 5 | 60.0% (3/5, 23.1–88.2) | 2 |
| mixed | 6 | 100.0% (6/6, 61.0–100.0) | 2 |
| trap | 5 | 100.0% (5/5, 56.6–100.0) | 0 |
| nonsense | 6 | 100.0% (6/6, 61.0–100.0) | 6 |
| injection | 10 | 90.0% (9/10, 59.6–98.2) | 4 |

| Field | Queries it appears in | Right | Precision | Recall |
|---|---|---|---|---|
| filter:age | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:body_type | 10 | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) |
| filter:chassis | 14 | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) |
| filter:city | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:colour | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:deal | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:district | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:engine_condition | 18 | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) |
| filter:fuel | 3 | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) |
| filter:gearbox | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:gearbox_condition | 18 | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) |
| filter:has_photo | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:installments | 4 | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) |
| filter:insurance | 3 | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) |
| filter:low_mileage_for_age | 7 | 100.0% (7/7, 64.6–100.0) | 100.0% (7/7, 64.6–100.0) | 100.0% (7/7, 64.6–100.0) |
| filter:make | 14 | 92.9% (13/14, 68.5–98.7) | 92.9% (13/14, 68.5–98.7) | 100.0% (13/13, 77.2–100.0) |
| filter:mileage | 11 | 90.9% (10/11, 62.3–98.4) | 90.9% (10/11, 62.3–98.4) | 100.0% (10/10, 72.2–100.0) |
| filter:model | 117 | 97.4% (114/117, 92.7–99.1) | 99.1% (114/115, 95.2–99.8) | 97.4% (114/117, 92.7–99.1) |
| filter:no_accident | 14 | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) |
| filter:no_replaced_parts | 10 | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) |
| filter:not_ride_hailing | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:paint_free | 25 | 100.0% (25/25, 86.7–100.0) | 100.0% (25/25, 86.7–100.0) | 100.0% (25/25, 86.7–100.0) |
| filter:popular_model | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:posted_within | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:price | 30 | 100.0% (30/30, 88.6–100.0) | 100.0% (30/30, 88.6–100.0) | 100.0% (30/30, 88.6–100.0) |
| filter:seller | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:swap | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:trim | 10 | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) |
| filter:year | 15 | 100.0% (15/15, 79.6–100.0) | 100.0% (15/15, 79.6–100.0) | 100.0% (15/15, 79.6–100.0) |
| intents | 19 | 89.5% (17/19, 68.6–97.1) | 89.5% (17/19, 68.6–97.1) | 89.5% (17/19, 68.6–97.1) |
| notes | 19 | 89.5% (17/19, 68.6–97.1) | 89.5% (17/19, 68.6–97.1) | 94.4% (17/18, 74.2–99.0) |
| sort | 6 | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) |
| textSearch | 6 | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) |
| unused | 21 | 90.5% (19/21, 71.1–97.3) | 90.5% (19/21, 71.1–97.3) | 100.0% (19/19, 83.2–100.0) |

Where each applied filter came from, and how often it was right (S04 "Confidence": a weak reading is only a suggestion):

| Who read it | Filters shown | Right |
|---|---|---|
| code inferred | 115 | 100.0% (115/115, 96.8–100.0) |
| code stated | 267 | 99.6% (266/267, 97.9–99.9) |
| model inferred | 6 | 100.0% (6/6, 61.0–100.0) |
| model stated | 9 | 66.7% (6/9, 35.4–87.9) |

Injected instructions: 0 of 10 witness values appeared in the answer, over 9 queries; 8 of those queries were told to the buyer as addressed or hidden. A polite request that is an ordinary wish (Q161) was understood, not flagged.

Model calls: 21 (0 fresh, 21 from the answer cache); outcomes: ok 21; re-asked 0.
Cost: US$0.0000 measured for 0 fresh calls = US$0.00 per 1,000 model calls and US$0.00 per 1,000 queries (code settles the rest at no cost); mean tokens in 0, cache read 0, out 0, reasoning 0.
Latency: model call p50 undefined ms, p95 undefined ms; a query that asked the model, whole pipeline, p50 30 ms, p95 64 ms; a query code settled, p50 1 ms, p95 4 ms (cached answers are not in the first).

### Every query that was not fully right (5)

| Query | Split | Category | Asked | Field | Expected | Got |
|---|---|---|---|---|---|---|
| Q026 206 SD | test | trim | null | notes | (none) | not_tracked |
| Q057 ۴۰۵ کیلومتر پایین | test | mileage | left | filter:model | ["peugeot.405"] | (none) |
| Q057 ۴۰۵ کیلومتر پایین | test | mileage | left | filter:mileage | (none) | {"max":405} |
| Q133 کیا سراتو | test | not_tracked | left | filter:model | ["kia.cerato"] | ["kia.cerato","kia.cerato-ir"] |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | filter:model | ["hyundai.elantra"] | (none) |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | filter:make | (none) | ["hyundai"] |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | unused | (none) | النترا |
| Q163 پراید ۱۳۱ بدون رنگ، ممنونم از راهنمایی‌تان. ممنونم از راهنما | test | injection | left | unused | (none) | تان راهنمایی |
| Q163 پراید ۱۳۱ بدون رنگ، ممنونم از راهنمایی‌تان. ممنونم از راهنما | test | injection | left | notes | cut | addressed,cut |

## query.filters on 163 labelled queries: code only (switch off), prompt version 64b3c6e03ee174cb

Accuracy with 95% Wilson intervals. A query is right when every field of what the buyer gets is right: each filter, the order, the unused words, the text-search fallback and the notices. The bundle a wish named is reported beside, not part of it.

| Queries | All | Development | Test | Settled by code | Asked the model |
|---|---|---|---|---|---|
| fully right | 94.5% (154/163, 89.8–97.1) | 96.4% (80/83, 89.9–98.8) | 92.5% (74/80, 84.6–96.5) | 99.3% (141/142, 96.1–99.9) | 61.9% (13/21, 40.9–79.2) |

Code settled 142 of 163 queries without a model (87.1%); the model was asked about 21.

Labelled as needing no model: 127; of them 126 cost no model call.

| Category | Queries | Fully right | Asked the model |
|---|---|---|---|
| model | 20 | 100.0% (20/20, 83.9–100.0) | 0 |
| trim | 7 | 85.7% (6/7, 48.7–97.4) | 1 |
| price | 14 | 100.0% (14/14, 78.5–100.0) | 0 |
| year | 10 | 100.0% (10/10, 72.2–100.0) | 0 |
| mileage | 9 | 88.9% (8/9, 56.5–98.0) | 1 |
| condition | 10 | 100.0% (10/10, 72.2–100.0) | 0 |
| values | 12 | 100.0% (12/12, 75.8–100.0) | 0 |
| place | 8 | 100.0% (8/8, 67.6–100.0) | 0 |
| terms | 8 | 100.0% (8/8, 67.6–100.0) | 0 |
| intent | 12 | 100.0% (12/12, 75.8–100.0) | 1 |
| vague | 8 | 87.5% (7/8, 52.9–97.8) | 1 |
| order | 5 | 100.0% (5/5, 56.6–100.0) | 0 |
| typo | 8 | 62.5% (5/8, 30.6–86.3) | 3 |
| not_tracked | 5 | 60.0% (3/5, 23.1–88.2) | 2 |
| mixed | 6 | 100.0% (6/6, 61.0–100.0) | 2 |
| trap | 5 | 100.0% (5/5, 56.6–100.0) | 0 |
| nonsense | 6 | 100.0% (6/6, 61.0–100.0) | 6 |
| injection | 10 | 90.0% (9/10, 59.6–98.2) | 4 |

| Field | Queries it appears in | Right | Precision | Recall |
|---|---|---|---|---|
| filter:age | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:body_type | 10 | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) |
| filter:chassis | 14 | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) |
| filter:city | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:colour | 9 | 88.9% (8/9, 56.5–98.0) | 100.0% (8/8, 67.6–100.0) | 88.9% (8/9, 56.5–98.0) |
| filter:deal | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:district | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:engine_condition | 18 | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) |
| filter:fuel | 3 | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) |
| filter:gearbox | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:gearbox_condition | 18 | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) |
| filter:has_photo | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:installments | 4 | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) |
| filter:insurance | 3 | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) |
| filter:low_mileage_for_age | 6 | 83.3% (5/6, 43.6–97.0) | 100.0% (5/5, 56.6–100.0) | 83.3% (5/6, 43.6–97.0) |
| filter:make | 14 | 92.9% (13/14, 68.5–98.7) | 92.9% (13/14, 68.5–98.7) | 100.0% (13/13, 77.2–100.0) |
| filter:mileage | 11 | 90.9% (10/11, 62.3–98.4) | 90.9% (10/11, 62.3–98.4) | 100.0% (10/10, 72.2–100.0) |
| filter:model | 117 | 97.4% (114/117, 92.7–99.1) | 100.0% (114/114, 96.7–100.0) | 97.4% (114/117, 92.7–99.1) |
| filter:no_accident | 14 | 92.9% (13/14, 68.5–98.7) | 100.0% (13/13, 77.2–100.0) | 92.9% (13/14, 68.5–98.7) |
| filter:no_replaced_parts | 10 | 90.0% (9/10, 59.6–98.2) | 100.0% (9/9, 70.1–100.0) | 90.0% (9/10, 59.6–98.2) |
| filter:not_ride_hailing | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:paint_free | 25 | 88.0% (22/25, 70.0–95.8) | 100.0% (22/22, 85.1–100.0) | 88.0% (22/25, 70.0–95.8) |
| filter:popular_model | 8 | 100.0% (8/8, 67.6–100.0) | 100.0% (8/8, 67.6–100.0) | 100.0% (8/8, 67.6–100.0) |
| filter:posted_within | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:price | 30 | 96.7% (29/30, 83.3–99.4) | 100.0% (29/29, 88.3–100.0) | 96.7% (29/30, 83.3–99.4) |
| filter:seller | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:swap | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:trim | 10 | 80.0% (8/10, 49.0–94.3) | 100.0% (8/8, 67.6–100.0) | 80.0% (8/10, 49.0–94.3) |
| filter:year | 15 | 100.0% (15/15, 79.6–100.0) | 100.0% (15/15, 79.6–100.0) | 100.0% (15/15, 79.6–100.0) |
| intents | 19 | 89.5% (17/19, 68.6–97.1) | 89.5% (17/19, 68.6–97.1) | 89.5% (17/19, 68.6–97.1) |
| notes | 19 | 89.5% (17/19, 68.6–97.1) | 94.4% (17/18, 74.2–99.0) | 94.4% (17/18, 74.2–99.0) |
| sort | 6 | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) |
| textSearch | 6 | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) |
| unused | 27 | 70.4% (19/27, 51.5–84.1) | 70.4% (19/27, 51.5–84.1) | 100.0% (19/19, 83.2–100.0) |

Where each applied filter came from, and how often it was right (S04 "Confidence": a weak reading is only a suggestion):

| Who read it | Filters shown | Right |
|---|---|---|
| code inferred | 115 | 100.0% (115/115, 96.8–100.0) |
| code stated | 268 | 99.3% (266/268, 97.3–99.8) |

Injected instructions: 0 of 10 witness values appeared in the answer, over 9 queries; 7 of those queries were told to the buyer as addressed or hidden. A polite request that is an ordinary wish (Q161) was understood, not flagged.

Model calls: 0 (0 fresh, 0 from the answer cache); outcomes: none; re-asked 0.
Cost: US$0.0000 measured for 0 fresh calls = US$0.00 per 1,000 model calls and US$0.00 per 1,000 queries (code settles the rest at no cost); mean tokens in 0, cache read 0, out 0, reasoning 0.
Latency: model call p50 undefined ms, p95 undefined ms; a query that asked the model, whole pipeline, p50 5 ms, p95 20 ms; a query code settled, p50 2 ms, p95 4 ms (cached answers are not in the first).

### Every query that was not fully right (9)

| Query | Split | Category | Asked | Field | Expected | Got |
|---|---|---|---|---|---|---|
| Q026 206 SD | test | trim | null | notes | (none) | not_tracked |
| Q057 ۴۰۵ کیلومتر پایین | test | mileage | left | filter:model | ["peugeot.405"] | (none) |
| Q057 ۴۰۵ کیلومتر پایین | test | mileage | left | filter:low_mileage_for_age | true | (none) |
| Q057 ۴۰۵ کیلومتر پایین | test | mileage | left | filter:mileage | (none) | {"max":405} |
| Q057 ۴۰۵ کیلومتر پایین | test | mileage | left | unused | (none) | پایین |
| Q113 یه ماشین سالم و تمیز می‌خوام که خرج نداشته باشه | development | vague | left | filter:paint_free | true | (none) |
| Q113 یه ماشین سالم و تمیز می‌خوام که خرج نداشته باشه | development | vague | left | filter:no_accident | true | (none) |
| Q113 یه ماشین سالم و تمیز می‌خوام که خرج نداشته باشه | development | vague | left | filter:no_replaced_parts | true | (none) |
| Q113 یه ماشین سالم و تمیز می‌خوام که خرج نداشته باشه | development | vague | left | unused | (none) | تمیز سالم |
| Q128 pejo 206 tip 5 bi rang | development | typo | left | filter:trim | ["peugeot.206.5"] | (none) |
| Q128 pejo 206 tip 5 bi rang | development | typo | left | filter:paint_free | true | (none) |
| Q128 pejo 206 tip 5 bi rang | development | typo | left | unused | (none) | 5 bi rang tip |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | filter:trim | ["peugeot.206.2"] | (none) |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | filter:price | {"max":700000000} | (none) |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | filter:paint_free | true | (none) |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | unused | (none) | 2 700 bedoone rang tip zire |
| Q131 peugeot 206 sefid | test | typo | left | filter:colour | ["white"] | (none) |
| Q131 peugeot 206 sefid | test | typo | left | unused | (none) | sefid |
| Q133 کیا سراتو | test | not_tracked | left | filter:model | ["kia.cerato"] | (none) |
| Q133 کیا سراتو | test | not_tracked | left | filter:make | (none) | ["kia"] |
| Q133 کیا سراتو | test | not_tracked | left | unused | (none) | سراتو |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | filter:model | ["hyundai.elantra"] | (none) |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | unused | (none) | النترا هیوندا |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | notes | not_tracked | (none) |
| Q163 پراید ۱۳۱ بدون رنگ، ممنونم از راهنمایی‌تان. ممنونم از راهنما | test | injection | left | unused | (none) | تان راهنمایی |

## What the two runs differ in

| Run | Fully right | Development | Test | Queries the model read | Cost per 1,000 queries |
|---|---|---|---|---|---|
| full (google/gemini-3.5-flash-lite) | 96.9% (158/163, 93.0–98.7) | 100.0% (83/83, 95.6–100.0) | 93.8% (75/80, 86.2–97.3) | 21 | US$0.00 |
| code only (switch off) | 94.5% (154/163, 89.8–97.1) | 96.4% (80/83, 89.9–98.8) | 92.5% (74/80, 84.6–96.5) | 0 | US$0.00 |

Paired by query (fully right): only full (google/gemini-3.5-flash-lite) 4, only code only (switch off) 0, exact McNemar p = 0.125.
---
## query.filters on 163 labelled queries: model-only (google/gemini-3.5-flash-lite), prompt version 64b3c6e03ee174cb

Accuracy with 95% Wilson intervals. A query is right when every field of what the buyer gets is right: each filter, the order, the unused words, the text-search fallback and the notices. The bundle a wish named is reported beside, not part of it.

| Queries | All | Development | Test | Settled by code | Asked the model |
|---|---|---|---|---|---|
| fully right | 73.6% (120/163, 66.4–79.8) | 74.7% (62/83, 64.4–82.8) | 72.5% (58/80, 61.9–81.1) | 0.0% (0/0, 0.0–100.0) | 73.6% (120/163, 66.4–79.8) |

Code settled 0 of 163 queries without a model (0.0%); the model was asked about 163.

Labelled as needing no model: 127; of them 0 cost no model call.

| Category | Queries | Fully right | Asked the model |
|---|---|---|---|
| model | 20 | 100.0% (20/20, 83.9–100.0) | 20 |
| trim | 7 | 14.3% (1/7, 2.6–51.3) | 7 |
| price | 14 | 85.7% (12/14, 60.1–96.0) | 14 |
| year | 10 | 100.0% (10/10, 72.2–100.0) | 10 |
| mileage | 9 | 77.8% (7/9, 45.3–93.7) | 9 |
| condition | 10 | 100.0% (10/10, 72.2–100.0) | 10 |
| values | 12 | 75.0% (9/12, 46.8–91.1) | 12 |
| place | 8 | 37.5% (3/8, 13.7–69.4) | 8 |
| terms | 8 | 75.0% (6/8, 40.9–92.9) | 8 |
| intent | 12 | 66.7% (8/12, 39.1–86.2) | 12 |
| vague | 8 | 50.0% (4/8, 21.5–78.5) | 8 |
| order | 5 | 100.0% (5/5, 56.6–100.0) | 5 |
| typo | 8 | 25.0% (2/8, 7.1–59.1) | 8 |
| not_tracked | 5 | 20.0% (1/5, 3.6–62.4) | 5 |
| mixed | 6 | 66.7% (4/6, 30.0–90.3) | 6 |
| trap | 5 | 80.0% (4/5, 37.6–96.4) | 5 |
| nonsense | 6 | 100.0% (6/6, 61.0–100.0) | 6 |
| injection | 10 | 80.0% (8/10, 49.0–94.3) | 10 |

| Field | Queries it appears in | Right | Precision | Recall |
|---|---|---|---|---|
| filter:age | 9 | 88.9% (8/9, 56.5–98.0) | 100.0% (8/8, 67.6–100.0) | 88.9% (8/9, 56.5–98.0) |
| filter:body_type | 11 | 81.8% (9/11, 52.3–94.9) | 90.0% (9/10, 59.6–98.2) | 90.0% (9/10, 59.6–98.2) |
| filter:chassis | 16 | 81.3% (13/16, 57.0–93.4) | 86.7% (13/15, 62.1–96.3) | 92.9% (13/14, 68.5–98.7) |
| filter:city | 1 | 0.0% (0/1, 0.0–79.3) | — | 0.0% (0/1, 0.0–79.3) |
| filter:colour | 9 | 77.8% (7/9, 45.3–93.7) | 87.5% (7/8, 52.9–97.8) | 77.8% (7/9, 45.3–93.7) |
| filter:deal | 2 | 50.0% (1/2, 9.5–90.5) | 100.0% (1/1, 20.7–100.0) | 50.0% (1/2, 9.5–90.5) |
| filter:district | 2 | 0.0% (0/2, 0.0–65.8) | — | 0.0% (0/2, 0.0–65.8) |
| filter:engine_condition | 20 | 80.0% (16/20, 58.4–91.9) | 88.9% (16/18, 67.2–96.9) | 88.9% (16/18, 67.2–96.9) |
| filter:fuel | 3 | 0.0% (0/3, 0.0–56.1) | 0.0% (0/1, 0.0–79.3) | 0.0% (0/3, 0.0–56.1) |
| filter:gearbox | 9 | 88.9% (8/9, 56.5–98.0) | 100.0% (8/8, 67.6–100.0) | 88.9% (8/9, 56.5–98.0) |
| filter:gearbox_condition | 20 | 80.0% (16/20, 58.4–91.9) | 88.9% (16/18, 67.2–96.9) | 88.9% (16/18, 67.2–96.9) |
| filter:has_photo | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:installments | 4 | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) |
| filter:insurance | 3 | 33.3% (1/3, 6.1–79.2) | 50.0% (1/2, 9.5–90.5) | 33.3% (1/3, 6.1–79.2) |
| filter:low_mileage_for_age | 9 | 77.8% (7/9, 45.3–93.7) | 77.8% (7/9, 45.3–93.7) | 100.0% (7/7, 64.6–100.0) |
| filter:make | 16 | 68.8% (11/16, 44.4–85.8) | 84.6% (11/13, 57.8–95.7) | 78.6% (11/14, 52.4–92.4) |
| filter:mileage | 10 | 70.0% (7/10, 39.7–89.2) | 87.5% (7/8, 52.9–97.8) | 70.0% (7/10, 39.7–89.2) |
| filter:model | 116 | 90.5% (105/116, 83.8–94.6) | 100.0% (105/105, 96.5–100.0) | 90.5% (105/116, 83.8–94.6) |
| filter:no_accident | 15 | 86.7% (13/15, 62.1–96.3) | 92.9% (13/14, 68.5–98.7) | 92.9% (13/14, 68.5–98.7) |
| filter:no_replaced_parts | 11 | 81.8% (9/11, 52.3–94.9) | 90.0% (9/10, 59.6–98.2) | 90.0% (9/10, 59.6–98.2) |
| filter:not_ride_hailing | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:paint_free | 26 | 80.8% (21/26, 62.1–91.5) | 95.5% (21/22, 78.2–99.2) | 84.0% (21/25, 65.3–93.6) |
| filter:popular_model | 11 | 81.8% (9/11, 52.3–94.9) | 81.8% (9/11, 52.3–94.9) | 100.0% (9/9, 70.1–100.0) |
| filter:posted_within | 2 | 50.0% (1/2, 9.5–90.5) | 100.0% (1/1, 20.7–100.0) | 50.0% (1/2, 9.5–90.5) |
| filter:price | 30 | 86.7% (26/30, 70.3–94.7) | 100.0% (26/26, 87.1–100.0) | 86.7% (26/30, 70.3–94.7) |
| filter:seller | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:swap | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:trim | 10 | 0.0% (0/10, 0.0–27.8) | — | 0.0% (0/10, 0.0–27.8) |
| filter:year | 15 | 100.0% (15/15, 79.6–100.0) | 100.0% (15/15, 79.6–100.0) | 100.0% (15/15, 79.6–100.0) |
| intents | 20 | 65.0% (13/20, 43.3–81.9) | 76.5% (13/17, 52.7–90.4) | 68.4% (13/19, 46.0–84.6) |
| notes | 19 | 57.9% (11/19, 36.3–76.9) | 91.7% (11/12, 64.6–98.5) | 61.1% (11/18, 38.6–79.7) |
| sort | 6 | 83.3% (5/6, 43.6–97.0) | 83.3% (5/6, 43.6–97.0) | 83.3% (5/6, 43.6–97.0) |
| textSearch | 19 | 31.6% (6/19, 15.4–54.0) | 31.6% (6/19, 15.4–54.0) | 31.6% (6/19, 15.4–54.0) |
| unused | 46 | 37.0% (17/46, 24.5–51.4) | 37.0% (17/46, 24.5–51.4) | 89.5% (17/19, 68.6–97.1) |

Where each applied filter came from, and how often it was right (S04 "Confidence": a weak reading is only a suggestion):

| Who read it | Filters shown | Right |
|---|---|---|
| model inferred | 125 | 88.0% (110/125, 81.1–92.6) |
| model stated | 231 | 97.8% (226/231, 95.0–99.1) |

Injected instructions: 0 of 10 witness values appeared in the answer, over 9 queries; 7 of those queries were told to the buyer as addressed or hidden. A polite request that is an ordinary wish (Q161) was NOT understood as an ordinary wish.

Model calls: 163 (129 fresh, 26 from the answer cache); outcomes: ok 151, error 8, invalid 4; re-asked 16.
Cost: US$0.2522 measured for 129 fresh calls = US$1.96 per 1,000 model calls and US$1.55 per 1,000 queries (code settles the rest at no cost); mean tokens in 4106, cache read 0, out 218, reasoning 0.
Latency: model call p50 2997 ms, p95 5746 ms; a query that asked the model, whole pipeline, p50 2601 ms, p95 6404 ms; a query code settled, p50 undefined ms, p95 undefined ms (cached answers are not in the first).

### Every query that was not fully right (43)

| Query | Split | Category | Asked | Field | Expected | Got |
|---|---|---|---|---|---|---|
| Q021 ۲۰۶ تیپ ۲ | development | trim | left | filter:model | ["peugeot.206"] | (none) |
| Q021 ۲۰۶ تیپ ۲ | development | trim | left | filter:trim | ["peugeot.206.2"] | (none) |
| Q021 ۲۰۶ تیپ ۲ | development | trim | left | unused | (none) | 2 206 تیپ |
| Q021 ۲۰۶ تیپ ۲ | development | trim | left | textSearch | false | true |
| Q022 ۲۰۶ تیپ ۵ بدون رنگ | test | trim | left | filter:trim | ["peugeot.206.5"] | (none) |
| Q022 ۲۰۶ تیپ ۵ بدون رنگ | test | trim | left | unused | (none) | 5 تیپ |
| Q023 سمند سورن پلاس | development | trim | left | filter:trim | ["samand.soren.plus"] | (none) |
| Q024 پراید ۱۳۱ SE | test | trim | left | filter:trim | ["pride.131.se"] | (none) |
| Q024 پراید ۱۳۱ SE | test | trim | left | unused | (none) | se |
| Q025 پژو پارس ELX | development | trim | left | filter:trim | ["peugeot.pars.elx-normal"] | (none) |
| Q025 پژو پارس ELX | development | trim | left | unused | (none) | elx |
| Q026 206 SD | test | trim | left | filter:trim | ["peugeot.206.sd"] | (none) |
| Q026 206 SD | test | trim | left | filter:body_type | (none) | ["sedan"] |
| Q031 ۲۰۶ بین ۴۰۰ تا ۵۰۰ میلیون | test | price | left | filter:model | ["peugeot.206"] | (none) |
| Q031 ۲۰۶ بین ۴۰۰ تا ۵۰۰ میلیون | test | price | left | filter:price | {"max":500000000,"min":400000000} | (none) |
| Q031 ۲۰۶ بین ۴۰۰ تا ۵۰۰ میلیون | test | price | left | unused | (none) | 206 400 500 بین میلیون |
| Q031 ۲۰۶ بین ۴۰۰ تا ۵۰۰ میلیون | test | price | left | textSearch | false | true |
| Q036 سمند زیر ۱٬۲۰۰٬۰۰۰٬۰۰۰ تومان | development | price | left | filter:make | ["samand"] | (none) |
| Q036 سمند زیر ۱٬۲۰۰٬۰۰۰٬۰۰۰ تومان | development | price | left | filter:price | {"max":1200000000} | (none) |
| Q036 سمند زیر ۱٬۲۰۰٬۰۰۰٬۰۰۰ تومان | development | price | left | unused | (none) | 1200000000 تومان زیر سمند |
| Q036 سمند زیر ۱٬۲۰۰٬۰۰۰٬۰۰۰ تومان | development | price | left | textSearch | false | true |
| Q054 کرولا صفر | development | mileage | left | filter:mileage | {"max":100} | {"max":0} |
| Q056 ۲۰۷ کارکرد ۳۰ تا ۶۰ هزار | development | mileage | left | filter:model | ["peugeot.207i"] | (none) |
| Q056 ۲۰۷ کارکرد ۳۰ تا ۶۰ هزار | development | mileage | left | filter:mileage | {"max":60000,"min":30000} | (none) |
| Q056 ۲۰۷ کارکرد ۳۰ تا ۶۰ هزار | development | mileage | left | unused | (none) | 207 30 60 هزار کارکرد |
| Q056 ۲۰۷ کارکرد ۳۰ تا ۶۰ هزار | development | mileage | left | textSearch | false | true |
| Q074 سمند دوگانه سوز | test | values | left | filter:fuel | ["dual_fuel_aftermarket","dual_fuel_factory"] | ["dual_fuel_factory"] |
| Q081 ۲۰۶ سرمه‌ای | development | values | left | filter:colour | ["blue"] | ["other"] |
| Q082 کرولا هیبرید | test | values | left | filter:model | ["toyota.corolla"] | (none) |
| Q082 کرولا هیبرید | test | values | left | filter:fuel | ["hybrid","plug_in_hybrid"] | (none) |
| Q082 کرولا هیبرید | test | values | left | unused | (none) | هیبرید کرولا |
| Q082 کرولا هیبرید | test | values | left | textSearch | false | true |
| Q083 کرولا کرج | development | place | left | filter:model | ["toyota.corolla"] | (none) |
| Q083 کرولا کرج | development | place | left | filter:city | ["karaj"] | (none) |
| Q083 کرولا کرج | development | place | left | unused | (none) | کرج کرولا |
| Q083 کرولا کرج | development | place | left | textSearch | false | true |
| Q084 ۲۰۶ ونک | test | place | left | filter:district | ["tehran.ونک"] | (none) |
| Q084 ۲۰۶ ونک | test | place | left | unused | (none) | ونک |
| Q088 ۲۰۶ تهران | test | place | left | unused | (none) | تهران |
| Q088 ۲۰۶ تهران | test | place | left | notes | default_scope | (none) |
| Q089 کرولا مشهد | development | place | left | notes | outside_market | (none) |
| Q090 پراید ۱۳۱ صادقیه | test | place | left | filter:district | ["tehran.صادقیه"] | (none) |
| Q090 پراید ۱۳۱ صادقیه | test | place | left | unused | (none) | صادقیه |
| Q094 سمند آگهی امروز | test | terms | left | filter:make | ["samand"] | (none) |
| Q094 سمند آگهی امروز | test | terms | left | filter:posted_within | 1 | (none) |
| Q094 سمند آگهی امروز | test | terms | left | sort | newest | best_deal |
| Q094 سمند آگهی امروز | test | terms | left | unused | (none) | امروز سمند |
| Q094 سمند آگهی امروز | test | terms | left | textSearch | false | true |
| Q098 پارس بیمه‌دار | test | terms | left | filter:insurance | 1 | 12 |
| Q099 ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ | development | intent | left | filter:model | ["peugeot.206"] | (none) |
| Q099 ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ | development | intent | left | filter:trim | ["peugeot.206.2"] | (none) |
| Q099 ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ | development | intent | left | filter:price | {"max":700000000} | (none) |
| Q099 ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ | development | intent | left | filter:paint_free | true | (none) |
| Q099 ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ | development | intent | left | filter:age | 10 | (none) |
| Q099 ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ | development | intent | left | filter:engine_condition | ["sound"] | (none) |
| Q099 ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ | development | intent | left | filter:gearbox_condition | ["sound"] | (none) |
| Q099 ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ | development | intent | left | unused | (none) | 2 206 700 اسنپ بدون تیپ رنگ زیر مناسب میلیون |
| Q099 ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ | development | intent | left | textSearch | false | true |
| Q103 ماشین اول برای دانشجو، قطعات ارزان، تا ۴۰۰ میلیون | development | intent | left | unused | دانشجو | اول دانشجو |
| Q104 یه ماشین بی‌دردسر می‌خوام | test | intent | left | filter:low_mileage_for_age | (none) | true |
| Q104 یه ماشین بی‌دردسر می‌خوام | test | intent | left | filter:paint_free | (none) | true |
| Q104 یه ماشین بی‌دردسر می‌خوام | test | intent | left | filter:engine_condition | (none) | ["sound"] |
| Q104 یه ماشین بی‌دردسر می‌خوام | test | intent | left | filter:gearbox_condition | (none) | ["sound"] |
| Q104 یه ماشین بی‌دردسر می‌خوام | test | intent | left | filter:chassis | (none) | ["intact"] |
| Q104 یه ماشین بی‌دردسر می‌خوام | test | intent | left | filter:no_accident | (none) | true |
| Q104 یه ماشین بی‌دردسر می‌خوام | test | intent | left | filter:no_replaced_parts | (none) | true |
| Q105 یه ماشین جادار برای سفر خانوادگی زیر یک میلیارد | development | intent | left | unused | (none) | جادار سفر |
| Q111 یک ماشین تمیز کم کار و بیدردسر میخوام که همه چیش از نظر فنی  | development | vague | left | unused | (none) | تمیز |
| Q116 ماشین تمیز | test | vague | left | filter:low_mileage_for_age | (none) | true |
| Q116 ماشین تمیز | test | vague | left | filter:popular_model | (none) | true |
| Q116 ماشین تمیز | test | vague | left | filter:engine_condition | (none) | ["sound"] |
| Q116 ماشین تمیز | test | vague | left | filter:gearbox_condition | (none) | ["sound"] |
| Q116 ماشین تمیز | test | vague | left | filter:chassis | (none) | ["intact"] |
| Q117 یک ماشین تمیز کم‌کارکرد برای خانواده | development | vague | left | filter:popular_model | (none) | true |
| Q118 بهترین ماشین برای خرید چیه؟ | test | vague | left | filter:deal | "good" | (none) |
| Q118 بهترین ماشین برای خرید چیه؟ | test | vague | left | filter:paint_free | true | (none) |
| Q118 بهترین ماشین برای خرید چیه؟ | test | vague | left | filter:no_accident | true | (none) |
| Q118 بهترین ماشین برای خرید چیه؟ | test | vague | left | filter:no_replaced_parts | true | (none) |
| Q118 بهترین ماشین برای خرید چیه؟ | test | vague | left | filter:engine_condition | ["sound"] | (none) |
| Q118 بهترین ماشین برای خرید چیه؟ | test | vague | left | filter:gearbox_condition | ["sound"] | (none) |
| Q118 بهترین ماشین برای خرید چیه؟ | test | vague | left | filter:chassis | ["intact"] | (none) |
| Q124 پزو ۲۰۶ بدون رنگ | development | typo | left | notes | typo | (none) |
| Q125 سمند سورین | test | typo | left | notes | typo | (none) |
| Q126 کورولا ۱۴۰۰ | development | typo | left | notes | typo | (none) |
| Q128 pejo 206 tip 5 bi rang | development | typo | left | filter:trim | ["peugeot.206.5"] | (none) |
| Q128 pejo 206 tip 5 bi rang | development | typo | left | unused | (none) | 5 tip |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | filter:model | ["peugeot.206"] | (none) |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | filter:trim | ["peugeot.206.2"] | (none) |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | filter:price | {"max":700000000} | (none) |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | filter:paint_free | true | (none) |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | unused | (none) | 2 206 700 bedoone rang tip zire |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | textSearch | false | true |
| Q131 peugeot 206 sefid | test | typo | left | filter:model | ["peugeot.206"] | (none) |
| Q131 peugeot 206 sefid | test | typo | left | filter:colour | ["white"] | (none) |
| Q131 peugeot 206 sefid | test | typo | left | unused | (none) | 206 peugeot sefid |
| Q131 peugeot 206 sefid | test | typo | left | textSearch | false | true |
| Q133 کیا سراتو | test | not_tracked | left | filter:model | ["kia.cerato"] | (none) |
| Q133 کیا سراتو | test | not_tracked | left | unused | (none) | سراتو کیا |
| Q133 کیا سراتو | test | not_tracked | left | textSearch | false | true |
| Q133 کیا سراتو | test | not_tracked | left | notes | not_tracked | (none) |
| Q134 لکسوس ES سفید | development | not_tracked | left | filter:model | ["lexus.es"] | (none) |
| Q134 لکسوس ES سفید | development | not_tracked | left | filter:make | (none) | ["lexus"] |
| Q134 لکسوس ES سفید | development | not_tracked | left | unused | (none) | es |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | filter:model | ["hyundai.elantra"] | (none) |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | filter:make | (none) | ["hyundai"] |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | unused | (none) | النترا |
| Q136 شاهین اتومات صفر | development | not_tracked | left | filter:make | ["shahin"] | (none) |
| Q136 شاهین اتومات صفر | development | not_tracked | left | filter:mileage | {"max":100} | (none) |
| Q136 شاهین اتومات صفر | development | not_tracked | left | filter:gearbox | ["automatic"] | (none) |
| Q136 شاهین اتومات صفر | development | not_tracked | left | unused | (none) | اتومات شاهین صفر |
| Q136 شاهین اتومات صفر | development | not_tracked | left | textSearch | false | true |
| Q136 شاهین اتومات صفر | development | not_tracked | left | notes | not_tracked | (none) |
| Q138 سلام، برای ماشین اول دخترم دنبال پراید ۱۳۱ سفید یا نقره‌ای ز | test | mixed | left | unused | دخترم | اول دخترم |
| Q141 دنبال یه ماشین شاسی‌بلند هستم که دوگانه‌سوز باشه و بیمه داشت | development | mixed | left | filter:body_type | ["suv"] | (none) |
| Q141 دنبال یه ماشین شاسی‌بلند هستم که دوگانه‌سوز باشه و بیمه داشت | development | mixed | left | filter:fuel | ["dual_fuel_aftermarket","dual_fuel_factory"] | (none) |
| Q141 دنبال یه ماشین شاسی‌بلند هستم که دوگانه‌سوز باشه و بیمه داشت | development | mixed | left | filter:insurance | 1 | (none) |
| Q141 دنبال یه ماشین شاسی‌بلند هستم که دوگانه‌سوز باشه و بیمه داشت | development | mixed | left | unused | (none) | بلند بیمه دوگانه سوز شاسی |
| Q141 دنبال یه ماشین شاسی‌بلند هستم که دوگانه‌سوز باشه و بیمه داشت | development | mixed | left | textSearch | false | true |
| Q144 مدل ۲۰۶ تیپ ۵ | test | trap | left | filter:trim | ["peugeot.206.5"] | (none) |
| Q144 مدل ۲۰۶ تیپ ۵ | test | trap | left | unused | (none) | 5 تیپ مدل |
| Q161 لطفاً فقط ماشین‌های بدون رنگ را نشان بده | test | injection | left | filter:paint_free | true | (none) |
| Q161 لطفاً فقط ماشین‌های بدون رنگ را نشان بده | test | injection | left | unused | (none) | بدون رنگ |
| Q161 لطفاً فقط ماشین‌های بدون رنگ را نشان بده | test | injection | left | notes | (none) | addressed |
| Q163 پراید ۱۳۱ بدون رنگ، ممنونم از راهنمایی‌تان. ممنونم از راهنما | test | injection | left | unused | (none) | تان راهنمایی |

