# Evaluation of plain-Farsi search (CS-62), 2026-10-02

Task `query.filters`, prompt version `2e9134b4fa9bee88` (checks `reading-1`, render `query-tags-1`), model `google/gemini-3.5-flash-lite` (thinking minimal) with fallback `openai/gpt-6-luna`, through Metis. The labelled set is `packages/ai/scripts/query-understanding/data/queries.ts` (163 queries, 83 development and 80 test, 18 categories), labelled by the guide `labelling-guide.md` in the same folder before any code or model saw an item. The development split was used to write the code pass, the phrase table and the prompt; the test split was run once on the final prompt (`runs/full-test-first-run.json`: 93.8 %, 75 of 80) and its misses were not fixed afterwards, so that number is the honest one. The `full` run below re-uses those answers from the cache.

## Summary

| Mode | Fully right, all 163 | Development (83) | Test (80) | Cost per 1,000 queries |
|---|---|---|---|---|
| Code only (master switch off, the default) | 94.5 % (154), 89.8 to 97.1 | 96.4 % | 92.5 % | US$0 |
| Code, then the model for what code cannot settle (switch on) | 96.9 % (158), 93.0 to 98.7 | 100 % (tuned on it) | 93.8 % | about US$0.20 (11 model calls per 80 queries at US$1.42 to 1.64 per 1,000 calls; the table's figure counts only calls that were not cached) |
| The model reads every word, code only cleans (ablation, not the product) | 75.5 % (123), 68.3 to 81.4 | 74.7 % | 76.3 % | US$1.83, p50 2.5 s, p95 5.5 s |

- What the switch buys: 4 more queries of 163 (McNemar exact p = 0.125, not significant at this size), all among queries whose words code cannot place (vague wishes, Latin-letter typos, nonsense that must be shown as unread).
- Code-first is what makes it good and cheap: 142 of 163 queries (87 %) need no model, and the model alone reads 20 points worse and costs nine times more per query.
- The test misses (5): Q026 (a note about an untracked trim), Q057 («۴۰۵ کیلومتر پایین» read the number as a mileage), Q133 (a make-and-model alias matched two models), Q135 (an untracked model's Persian spelling), Q163 (a long injection query: extra unread words). Recorded as follow-ups.
- Injection: 0 of 6 witness values appeared in any answer of the full and code-only runs (code removes addressed sentences before the model sees them); 0 of 4 on the test split.
- Latency of a model-asked query: p50 1.7 to 3.6 s, p95 2.7 to 7.3 s over 21 fresh calls in three runs; a code-settled query 1 ms. The endpoint's model deadline is 7 s, after which code's own answer is returned with the reason.
- Spend: US$0.37 in all of the lane's evaluation runs, of the US$3 allowed.

Raw reports follow (each with per-category, per-field precision and recall, tiers by who read a filter, and every miss).

---

## query.filters on 163 labelled queries: full (google/gemini-3.5-flash-lite), prompt version 2e9134b4fa9bee88

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
| notes | 19 | 94.7% (18/19, 75.4–99.1) | 94.7% (18/19, 75.4–99.1) | 100.0% (18/18, 82.4–100.0) |
| sort | 6 | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) |
| textSearch | 6 | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) |
| unused | 21 | 90.5% (19/21, 71.1–97.3) | 90.5% (19/21, 71.1–97.3) | 100.0% (19/19, 83.2–100.0) |

Where each applied filter came from, and how often it was right (S03 "Confidence": a weak reading is only a suggestion):

| Who read it | Filters shown | Right |
|---|---|---|
| code inferred | 115 | 100.0% (115/115, 96.8–100.0) |
| code stated | 267 | 99.6% (266/267, 97.9–99.9) |
| model inferred | 6 | 100.0% (6/6, 61.0–100.0) |
| model stated | 9 | 66.7% (6/9, 35.4–87.9) |

Injected instructions: 0 of 10 witness values appeared in the answer, over 9 queries; 7 of those queries were told to the buyer as addressed or hidden. A polite request that is an ordinary wish (Q161) was understood, not flagged.

Model calls: 21 (7 fresh, 14 from the answer cache); outcomes: ok 21; re-asked 0.
Cost: US$0.0115 measured for 7 fresh calls = US$1.64 per 1,000 model calls and US$0.07 per 1,000 queries (code settles the rest at no cost); mean tokens in 4144, cache read 0, out 99, reasoning 0.
Latency: model call p50 3559 ms, p95 7285 ms; a query that asked the model, whole pipeline, p50 90 ms, p95 5773 ms; a query code settled, p50 1 ms, p95 11 ms (cached answers are not in the first).

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

## query.filters on 163 labelled queries: code only (switch off), prompt version 2e9134b4fa9bee88

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

Where each applied filter came from, and how often it was right (S03 "Confidence": a weak reading is only a suggestion):

| Who read it | Filters shown | Right |
|---|---|---|
| code inferred | 115 | 100.0% (115/115, 96.8–100.0) |
| code stated | 268 | 99.3% (266/268, 97.3–99.8) |

Injected instructions: 0 of 10 witness values appeared in the answer, over 9 queries; 7 of those queries were told to the buyer as addressed or hidden. A polite request that is an ordinary wish (Q161) was understood, not flagged.

Model calls: 0 (0 fresh, 0 from the answer cache); outcomes: none; re-asked 0.
Cost: US$0.0000 measured for 0 fresh calls = US$0.00 per 1,000 model calls and US$0.00 per 1,000 queries (code settles the rest at no cost); mean tokens in 0, cache read 0, out 0, reasoning 0.
Latency: model call p50 undefined ms, p95 undefined ms; a query that asked the model, whole pipeline, p50 2 ms, p95 6 ms; a query code settled, p50 0 ms, p95 1 ms (cached answers are not in the first).

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
| full (google/gemini-3.5-flash-lite) | 96.9% (158/163, 93.0–98.7) | 100.0% (83/83, 95.6–100.0) | 93.8% (75/80, 86.2–97.3) | 21 | US$0.07 |
| code only (switch off) | 94.5% (154/163, 89.8–97.1) | 96.4% (80/83, 89.9–98.8) | 92.5% (74/80, 84.6–96.5) | 0 | US$0.00 |

Paired by query (fully right): only full (google/gemini-3.5-flash-lite) 4, only code only (switch off) 0, exact McNemar p = 0.125.

---
## query.filters on 163 labelled queries: model-only (google/gemini-3.5-flash-lite), prompt version 2e9134b4fa9bee88

Accuracy with 95% Wilson intervals. A query is right when every field of what the buyer gets is right: each filter, the order, the unused words, the text-search fallback and the notices. The bundle a wish named is reported beside, not part of it.

| Queries | All | Development | Test | Settled by code | Asked the model |
|---|---|---|---|---|---|
| fully right | 75.5% (123/163, 68.3–81.4) | 74.7% (62/83, 64.4–82.8) | 76.3% (61/80, 65.9–84.2) | 0.0% (0/0, 0.0–100.0) | 75.5% (123/163, 68.3–81.4) |

Code settled 0 of 163 queries without a model (0.0%); the model was asked about 163.

Labelled as needing no model: 127; of them 0 cost no model call.

| Category | Queries | Fully right | Asked the model |
|---|---|---|---|
| model | 20 | 100.0% (20/20, 83.9–100.0) | 20 |
| trim | 7 | 14.3% (1/7, 2.6–51.3) | 7 |
| price | 14 | 92.9% (13/14, 68.5–98.7) | 14 |
| year | 10 | 90.0% (9/10, 59.6–98.2) | 10 |
| mileage | 9 | 66.7% (6/9, 35.4–87.9) | 9 |
| condition | 10 | 100.0% (10/10, 72.2–100.0) | 10 |
| values | 12 | 83.3% (10/12, 55.2–95.3) | 12 |
| place | 8 | 37.5% (3/8, 13.7–69.4) | 8 |
| terms | 8 | 75.0% (6/8, 40.9–92.9) | 8 |
| intent | 12 | 83.3% (10/12, 55.2–95.3) | 12 |
| vague | 8 | 50.0% (4/8, 21.5–78.5) | 8 |
| order | 5 | 100.0% (5/5, 56.6–100.0) | 5 |
| typo | 8 | 37.5% (3/8, 13.7–69.4) | 8 |
| not_tracked | 5 | 20.0% (1/5, 3.6–62.4) | 5 |
| mixed | 6 | 50.0% (3/6, 18.8–81.2) | 6 |
| trap | 5 | 80.0% (4/5, 37.6–96.4) | 5 |
| nonsense | 6 | 100.0% (6/6, 61.0–100.0) | 6 |
| injection | 10 | 90.0% (9/10, 59.6–98.2) | 10 |

| Field | Queries it appears in | Right | Precision | Recall |
|---|---|---|---|---|
| filter:age | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:body_type | 11 | 81.8% (9/11, 52.3–94.9) | 90.0% (9/10, 59.6–98.2) | 90.0% (9/10, 59.6–98.2) |
| filter:chassis | 15 | 86.7% (13/15, 62.1–96.3) | 92.9% (13/14, 68.5–98.7) | 92.9% (13/14, 68.5–98.7) |
| filter:city | 1 | 0.0% (0/1, 0.0–79.3) | — | 0.0% (0/1, 0.0–79.3) |
| filter:colour | 9 | 77.8% (7/9, 45.3–93.7) | 100.0% (7/7, 64.6–100.0) | 77.8% (7/9, 45.3–93.7) |
| filter:deal | 2 | 50.0% (1/2, 9.5–90.5) | 100.0% (1/1, 20.7–100.0) | 50.0% (1/2, 9.5–90.5) |
| filter:district | 2 | 0.0% (0/2, 0.0–65.8) | — | 0.0% (0/2, 0.0–65.8) |
| filter:engine_condition | 19 | 89.5% (17/19, 68.6–97.1) | 94.4% (17/18, 74.2–99.0) | 94.4% (17/18, 74.2–99.0) |
| filter:fuel | 3 | 0.0% (0/3, 0.0–56.1) | 0.0% (0/2, 0.0–65.8) | 0.0% (0/3, 0.0–56.1) |
| filter:gearbox | 9 | 88.9% (8/9, 56.5–98.0) | 100.0% (8/8, 67.6–100.0) | 88.9% (8/9, 56.5–98.0) |
| filter:gearbox_condition | 19 | 89.5% (17/19, 68.6–97.1) | 94.4% (17/18, 74.2–99.0) | 94.4% (17/18, 74.2–99.0) |
| filter:has_photo | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:installments | 4 | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) |
| filter:insurance | 3 | 33.3% (1/3, 6.1–79.2) | 50.0% (1/2, 9.5–90.5) | 33.3% (1/3, 6.1–79.2) |
| filter:low_mileage_for_age | 8 | 87.5% (7/8, 52.9–97.8) | 87.5% (7/8, 52.9–97.8) | 100.0% (7/7, 64.6–100.0) |
| filter:make | 16 | 75.0% (12/16, 50.5–89.8) | 85.7% (12/14, 60.1–96.0) | 85.7% (12/14, 60.1–96.0) |
| filter:mileage | 10 | 60.0% (6/10, 31.3–83.2) | 75.0% (6/8, 40.9–92.9) | 60.0% (6/10, 31.3–83.2) |
| filter:model | 116 | 94.0% (109/116, 88.1–97.0) | 100.0% (109/109, 96.6–100.0) | 94.0% (109/116, 88.1–97.0) |
| filter:no_accident | 14 | 85.7% (12/14, 60.1–96.0) | 100.0% (12/12, 75.8–100.0) | 85.7% (12/14, 60.1–96.0) |
| filter:no_replaced_parts | 10 | 90.0% (9/10, 59.6–98.2) | 100.0% (9/9, 70.1–100.0) | 90.0% (9/10, 59.6–98.2) |
| filter:not_ride_hailing | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:paint_free | 25 | 88.0% (22/25, 70.0–95.8) | 100.0% (22/22, 85.1–100.0) | 88.0% (22/25, 70.0–95.8) |
| filter:popular_model | 11 | 81.8% (9/11, 52.3–94.9) | 81.8% (9/11, 52.3–94.9) | 100.0% (9/9, 70.1–100.0) |
| filter:posted_within | 2 | 50.0% (1/2, 9.5–90.5) | 100.0% (1/1, 20.7–100.0) | 50.0% (1/2, 9.5–90.5) |
| filter:price | 30 | 90.0% (27/30, 74.4–96.5) | 100.0% (27/27, 87.5–100.0) | 90.0% (27/30, 74.4–96.5) |
| filter:seller | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:swap | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:trim | 10 | 0.0% (0/10, 0.0–27.8) | — | 0.0% (0/10, 0.0–27.8) |
| filter:year | 15 | 93.3% (14/15, 70.2–98.8) | 100.0% (14/14, 78.5–100.0) | 93.3% (14/15, 70.2–98.8) |
| intents | 19 | 73.7% (14/19, 51.2–88.2) | 82.4% (14/17, 59.0–93.8) | 73.7% (14/19, 51.2–88.2) |
| notes | 18 | 61.1% (11/18, 38.6–79.7) | 100.0% (11/11, 74.1–100.0) | 61.1% (11/18, 38.6–79.7) |
| sort | 6 | 83.3% (5/6, 43.6–97.0) | 83.3% (5/6, 43.6–97.0) | 83.3% (5/6, 43.6–97.0) |
| textSearch | 15 | 40.0% (6/15, 19.8–64.3) | 40.0% (6/15, 19.8–64.3) | 40.0% (6/15, 19.8–64.3) |
| unused | 44 | 38.6% (17/44, 25.7–53.4) | 38.6% (17/44, 25.7–53.4) | 89.5% (17/19, 68.6–97.1) |

Where each applied filter came from, and how often it was right (S03 "Confidence": a weak reading is only a suggestion):

| Who read it | Filters shown | Right |
|---|---|---|
| model inferred | 121 | 94.2% (114/121, 88.5–97.2) |
| model stated | 235 | 97.0% (228/235, 94.0–98.5) |

Injected instructions: 0 of 10 witness values appeared in the answer, over 9 queries; 7 of those queries were told to the buyer as addressed or hidden. A polite request that is an ordinary wish (Q161) was understood, not flagged.

Model calls: 163 (154 fresh, 3 from the answer cache); outcomes: ok 154, invalid 3, error 6; re-asked 20.
Cost: US$0.2988 measured for 154 fresh calls = US$1.94 per 1,000 model calls and US$1.83 per 1,000 queries (code settles the rest at no cost); mean tokens in 4128, cache read 0, out 210, reasoning 0.
Latency: model call p50 2464 ms, p95 5509 ms; a query that asked the model, whole pipeline, p50 2542 ms, p95 6017 ms; a query code settled, p50 undefined ms, p95 undefined ms (cached answers are not in the first).

### Every query that was not fully right (40)

| Query | Split | Category | Asked | Field | Expected | Got |
|---|---|---|---|---|---|---|
| Q021 ۲۰۶ تیپ ۲ | development | trim | left | filter:trim | ["peugeot.206.2"] | (none) |
| Q021 ۲۰۶ تیپ ۲ | development | trim | left | unused | (none) | 2 تیپ |
| Q022 ۲۰۶ تیپ ۵ بدون رنگ | test | trim | left | filter:trim | ["peugeot.206.5"] | (none) |
| Q022 ۲۰۶ تیپ ۵ بدون رنگ | test | trim | left | unused | (none) | 5 تیپ |
| Q023 سمند سورن پلاس | development | trim | left | filter:trim | ["samand.soren.plus"] | (none) |
| Q023 سمند سورن پلاس | development | trim | left | unused | (none) | پلاس |
| Q024 پراید ۱۳۱ SE | test | trim | left | filter:trim | ["pride.131.se"] | (none) |
| Q024 پراید ۱۳۱ SE | test | trim | left | unused | (none) | se |
| Q025 پژو پارس ELX | development | trim | left | filter:trim | ["peugeot.pars.elx-normal"] | (none) |
| Q025 پژو پارس ELX | development | trim | left | unused | (none) | elx |
| Q026 206 SD | test | trim | left | filter:trim | ["peugeot.206.sd"] | (none) |
| Q026 206 SD | test | trim | left | filter:body_type | (none) | ["sedan"] |
| Q036 سمند زیر ۱٬۲۰۰٬۰۰۰٬۰۰۰ تومان | development | price | left | filter:make | ["samand"] | (none) |
| Q036 سمند زیر ۱٬۲۰۰٬۰۰۰٬۰۰۰ تومان | development | price | left | filter:price | {"max":1200000000} | (none) |
| Q036 سمند زیر ۱٬۲۰۰٬۰۰۰٬۰۰۰ تومان | development | price | left | unused | (none) | 1200000000 تومان زیر سمند |
| Q036 سمند زیر ۱٬۲۰۰٬۰۰۰٬۰۰۰ تومان | development | price | left | textSearch | false | true |
| Q045 ۲۰۷ سال ۱۴۰۲ تا ۱۴۰۴ | test | year | left | unused | (none) | سال |
| Q052 ۲۰۶ کارکرد زیر ۵۰ هزار | development | mileage | left | filter:model | ["peugeot.206"] | (none) |
| Q052 ۲۰۶ کارکرد زیر ۵۰ هزار | development | mileage | left | filter:mileage | {"max":50000} | (none) |
| Q052 ۲۰۶ کارکرد زیر ۵۰ هزار | development | mileage | left | unused | (none) | 206 50 زیر هزار کارکرد |
| Q052 ۲۰۶ کارکرد زیر ۵۰ هزار | development | mileage | left | textSearch | false | true |
| Q054 کرولا صفر | development | mileage | left | filter:mileage | {"max":100} | {"max":0} |
| Q056 ۲۰۷ کارکرد ۳۰ تا ۶۰ هزار | development | mileage | left | unused | (none) | کارکرد |
| Q074 سمند دوگانه سوز | test | values | left | filter:fuel | ["dual_fuel_aftermarket","dual_fuel_factory"] | ["dual_fuel_factory"] |
| Q082 کرولا هیبرید | test | values | left | filter:fuel | ["hybrid","plug_in_hybrid"] | ["hybrid"] |
| Q083 کرولا کرج | development | place | left | filter:city | ["karaj"] | (none) |
| Q083 کرولا کرج | development | place | left | unused | (none) | کرج |
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
| Q099 ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ | development | intent | left | filter:trim | ["peugeot.206.2"] | (none) |
| Q099 ۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون، مناسب اسنپ | development | intent | left | unused | (none) | 2 تیپ |
| Q103 ماشین اول برای دانشجو، قطعات ارزان، تا ۴۰۰ میلیون | development | intent | left | unused | دانشجو | اول دانشجو |
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
| Q125 سمند سورین | test | typo | left | filter:make | (none) | ["samand"] |
| Q125 سمند سورین | test | typo | left | notes | typo | (none) |
| Q126 کورولا ۱۴۰۰ | development | typo | left | notes | typo | (none) |
| Q128 pejo 206 tip 5 bi rang | development | typo | left | filter:trim | ["peugeot.206.5"] | (none) |
| Q128 pejo 206 tip 5 bi rang | development | typo | left | unused | (none) | 5 tip |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | filter:trim | ["peugeot.206.2"] | (none) |
| Q130 206 tip 2 bedoone rang zire 700 | development | typo | left | unused | (none) | 2 tip |
| Q133 کیا سراتو | test | not_tracked | left | filter:model | ["kia.cerato"] | (none) |
| Q133 کیا سراتو | test | not_tracked | left | unused | (none) | سراتو کیا |
| Q133 کیا سراتو | test | not_tracked | left | textSearch | false | true |
| Q133 کیا سراتو | test | not_tracked | left | notes | not_tracked | (none) |
| Q134 لکسوس ES سفید | development | not_tracked | left | filter:model | ["lexus.es"] | (none) |
| Q134 لکسوس ES سفید | development | not_tracked | left | filter:colour | ["white"] | (none) |
| Q134 لکسوس ES سفید | development | not_tracked | left | unused | (none) | es سفید لکسوس |
| Q134 لکسوس ES سفید | development | not_tracked | left | textSearch | false | true |
| Q134 لکسوس ES سفید | development | not_tracked | left | notes | not_tracked | (none) |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | filter:model | ["hyundai.elantra"] | (none) |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | filter:make | (none) | ["hyundai"] |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | unused | (none) | النترا |
| Q136 شاهین اتومات صفر | development | not_tracked | left | filter:mileage | {"max":100} | {"max":0} |
| Q137 من دنبال یه پژو ۲۰۷ اتوماتیک مدل ۱۴۰۲ به بالا هستم، بدون رنگ | development | mixed | left | filter:model | ["peugeot.207i"] | (none) |
| Q137 من دنبال یه پژو ۲۰۷ اتوماتیک مدل ۱۴۰۲ به بالا هستم، بدون رنگ | development | mixed | left | filter:year | {"min":1402} | (none) |
| Q137 من دنبال یه پژو ۲۰۷ اتوماتیک مدل ۱۴۰۲ به بالا هستم، بدون رنگ | development | mixed | left | filter:mileage | {"max":40000} | (none) |
| Q137 من دنبال یه پژو ۲۰۷ اتوماتیک مدل ۱۴۰۲ به بالا هستم، بدون رنگ | development | mixed | left | filter:price | {"max":1200000000} | (none) |
| Q137 من دنبال یه پژو ۲۰۷ اتوماتیک مدل ۱۴۰۲ به بالا هستم، بدون رنگ | development | mixed | left | filter:gearbox | ["automatic"] | (none) |
| Q137 من دنبال یه پژو ۲۰۷ اتوماتیک مدل ۱۴۰۲ به بالا هستم، بدون رنگ | development | mixed | left | filter:paint_free | true | (none) |
| Q137 من دنبال یه پژو ۲۰۷ اتوماتیک مدل ۱۴۰۲ به بالا هستم، بدون رنگ | development | mixed | left | filter:no_accident | true | (none) |
| Q137 من دنبال یه پژو ۲۰۷ اتوماتیک مدل ۱۴۰۲ به بالا هستم، بدون رنگ | development | mixed | left | unused | (none) | 1 1402 200 207 40 اتوماتیک بالا بدون تصادف رنگ زیر مدل میلیارد میلیون هزار پژو کارکرد |
| Q137 من دنبال یه پژو ۲۰۷ اتوماتیک مدل ۱۴۰۲ به بالا هستم، بدون رنگ | development | mixed | left | textSearch | false | true |
| Q138 سلام، برای ماشین اول دخترم دنبال پراید ۱۳۱ سفید یا نقره‌ای ز | test | mixed | left | filter:model | ["pride.131"] | (none) |
| Q138 سلام، برای ماشین اول دخترم دنبال پراید ۱۳۱ سفید یا نقره‌ای ز | test | mixed | left | filter:price | {"max":350000000} | (none) |
| Q138 سلام، برای ماشین اول دخترم دنبال پراید ۱۳۱ سفید یا نقره‌ای ز | test | mixed | left | filter:colour | ["silver","white"] | (none) |
| Q138 سلام، برای ماشین اول دخترم دنبال پراید ۱۳۱ سفید یا نقره‌ای ز | test | mixed | left | unused | دخترم | 131 350 اول دخترم زیر سفید میلیون نقره پراید |
| Q138 سلام، برای ماشین اول دخترم دنبال پراید ۱۳۱ سفید یا نقره‌ای ز | test | mixed | left | textSearch | false | true |
| Q141 دنبال یه ماشین شاسی‌بلند هستم که دوگانه‌سوز باشه و بیمه داشت | development | mixed | left | filter:body_type | ["suv"] | (none) |
| Q141 دنبال یه ماشین شاسی‌بلند هستم که دوگانه‌سوز باشه و بیمه داشت | development | mixed | left | filter:fuel | ["dual_fuel_aftermarket","dual_fuel_factory"] | (none) |
| Q141 دنبال یه ماشین شاسی‌بلند هستم که دوگانه‌سوز باشه و بیمه داشت | development | mixed | left | filter:insurance | 1 | (none) |
| Q141 دنبال یه ماشین شاسی‌بلند هستم که دوگانه‌سوز باشه و بیمه داشت | development | mixed | left | unused | (none) | بلند بیمه دوگانه سوز شاسی |
| Q141 دنبال یه ماشین شاسی‌بلند هستم که دوگانه‌سوز باشه و بیمه داشت | development | mixed | left | textSearch | false | true |
| Q144 مدل ۲۰۶ تیپ ۵ | test | trap | left | filter:trim | ["peugeot.206.5"] | (none) |
| Q144 مدل ۲۰۶ تیپ ۵ | test | trap | left | unused | (none) | 5 تیپ مدل |
| Q163 پراید ۱۳۱ بدون رنگ، ممنونم از راهنمایی‌تان. ممنونم از راهنما | test | injection | left | filter:model | ["pride.131"] | (none) |
| Q163 پراید ۱۳۱ بدون رنگ، ممنونم از راهنمایی‌تان. ممنونم از راهنما | test | injection | left | filter:paint_free | true | (none) |
| Q163 پراید ۱۳۱ بدون رنگ، ممنونم از راهنمایی‌تان. ممنونم از راهنما | test | injection | left | unused | (none) | 131 بدون تان راهنمایی رنگ پراید |
| Q163 پراید ۱۳۱ بدون رنگ، ممنونم از راهنمایی‌تان. ممنونم از راهنما | test | injection | left | textSearch | false | true |

