# Evaluation of plain-Farsi search with engine volume and origin (CS-100), 2026-10-03

Task `query.filters`, prompt version `b0ff1642901f1124` (the instructions now name engine volume and origin; the filters' vocabulary gained `engine_volume` and `origin`), model `google/gemini-3.5-flash-lite` through Metis, as in `docs/evidence/query-understanding/2026-10-02/report.md`. The labelled set is the 163 queries of CS-62 plus 52 new ones (category `engine_origin`, Q164 to Q215), labelled on 2026-10-03 from `phrases.json` in this folder before the code read them.

**Disclosures.**
- The labels were written by the same agent that wrote the code; there was no second labeller. The 52 new queries were written before the code and then the code was written to read them: they are a development set in spirit, split by alternation (26 and 26) like the others; the numbers say the code reads the phrasings the owner and this task listed, not that it generalises to every way a buyer may write them. A fresh set from real buyers is the next step.
- Two labels were corrected after the first run, by the stated rule (halves round up), because the script that wrote them used round-half-to-even: E039 and E048 (Q202 and Q211 here). One old label was changed because a decision changed: Q143 «کرولا ۱۸۰۰ سی سی» said the volume stays unused when the search had no volume filter; it now says the volume is a range. No other label changed.
- Spend: US$0.0325 (the product run, 21 model calls on the 21 queries code could not settle; the 52 new queries all settled by code) and US$0.1010 (the model alone on the 52 new queries, an ablation of 51 calls), US$0.1335 in all, of the US$3 allowed. Every spend is in `runs/`.

## Summary

| Mode | Fully right | Of the 52 volume and origin queries |
|---|---|---|
| Code only (master switch off, the default), 215 queries | 95.8 % (206) | 100 % (52 of 52) |
| Code, then the model for what code cannot settle (switch on), 215 queries | 97.7 % (210), 94.7 to 99.0 | 100 % (52 of 52; the model was asked about none of them) |
| The model reads every word (ablation, only the 52 new queries, not the product) | | 61.5 % (32 of 52), US$0.10 for 51 calls |

- Before the change, code and the search answered 2 of the 52 as labelled (the two traps that were not about a volume); after, 52 of 52 (`before.md`, `after.md`, each phrase with what was understood and how many listings the search counted).
- The 5 queries not fully right in the product run are the same CS-62 misses (Q026, Q057, Q133, Q135, Q163), tracked in CS-90; none is about volume or origin.
- The model alone reads the volume and origin phrasings 38 points worse than code does and costs US$1.94 per 1,000 queries, which is why they are read by code and the model is only asked about what is left.

Raw reports follow.

---

## query.filters on 215 labelled queries: full (google/gemini-3.5-flash-lite), prompt version b0ff1642901f1124

Accuracy with 95% Wilson intervals. A query is right when every field of what the buyer gets is right: each filter, the order, the unused words, the text-search fallback and the notices. The bundle a wish named is reported beside, not part of it.

| Queries | All | Development | Test | Settled by code | Asked the model |
|---|---|---|---|---|---|
| fully right | 97.7% (210/215, 94.7–99.0) | 100.0% (109/109, 96.6–100.0) | 95.3% (101/106, 89.4–98.0) | 99.5% (193/194, 97.1–99.9) | 81.0% (17/21, 60.0–92.3) |

Code settled 194 of 215 queries without a model (90.2%); the model was asked about 21.

Labelled as needing no model: 180; of them 179 cost no model call.

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
| engine_origin | 52 | 100.0% (52/52, 93.1–100.0) | 0 |

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
| filter:engine_volume | 38 | 100.0% (38/38, 90.8–100.0) | 100.0% (38/38, 90.8–100.0) | 100.0% (38/38, 90.8–100.0) |
| filter:fuel | 4 | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) |
| filter:gearbox | 11 | 100.0% (11/11, 74.1–100.0) | 100.0% (11/11, 74.1–100.0) | 100.0% (11/11, 74.1–100.0) |
| filter:gearbox_condition | 18 | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) |
| filter:has_photo | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:installments | 4 | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) |
| filter:insurance | 3 | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) |
| filter:low_mileage_for_age | 11 | 90.9% (10/11, 62.3–98.4) | 100.0% (10/10, 72.2–100.0) | 90.9% (10/11, 62.3–98.4) |
| filter:make | 14 | 92.9% (13/14, 68.5–98.7) | 92.9% (13/14, 68.5–98.7) | 100.0% (13/13, 77.2–100.0) |
| filter:mileage | 12 | 91.7% (11/12, 64.6–98.5) | 91.7% (11/12, 64.6–98.5) | 100.0% (11/11, 74.1–100.0) |
| filter:model | 122 | 97.5% (119/122, 93.0–99.2) | 99.2% (119/120, 95.4–99.9) | 97.5% (119/122, 93.0–99.2) |
| filter:no_accident | 18 | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) |
| filter:no_replaced_parts | 14 | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) |
| filter:not_ride_hailing | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:origin | 20 | 100.0% (20/20, 83.9–100.0) | 100.0% (20/20, 83.9–100.0) | 100.0% (20/20, 83.9–100.0) |
| filter:paint_free | 29 | 100.0% (29/29, 88.3–100.0) | 100.0% (29/29, 88.3–100.0) | 100.0% (29/29, 88.3–100.0) |
| filter:popular_model | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:posted_within | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:price | 32 | 100.0% (32/32, 89.3–100.0) | 100.0% (32/32, 89.3–100.0) | 100.0% (32/32, 89.3–100.0) |
| filter:seller | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:swap | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:trim | 10 | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) |
| filter:year | 16 | 100.0% (16/16, 80.6–100.0) | 100.0% (16/16, 80.6–100.0) | 100.0% (16/16, 80.6–100.0) |
| intents | 23 | 73.9% (17/23, 53.5–87.5) | 73.9% (17/23, 53.5–87.5) | 89.5% (17/19, 68.6–97.1) |
| notes | 19 | 94.7% (18/19, 75.4–99.1) | 94.7% (18/19, 75.4–99.1) | 100.0% (18/18, 82.4–100.0) |
| sort | 6 | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) |
| textSearch | 6 | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) |
| unused | 21 | 85.7% (18/21, 65.4–95.0) | 85.7% (18/21, 65.4–95.0) | 100.0% (18/18, 82.4–100.0) |

Where each applied filter came from, and how often it was right (S04 "Confidence": a weak reading is only a suggestion):

| Who read it | Filters shown | Right |
|---|---|---|
| code inferred | 127 | 100.0% (127/127, 97.1–100.0) |
| code stated | 348 | 99.7% (347/348, 98.4–99.9) |
| model inferred | 5 | 100.0% (5/5, 56.6–100.0) |
| model stated | 8 | 62.5% (5/8, 30.6–86.3) |

Injected instructions: 0 of 10 witness values appeared in the answer, over 9 queries; 7 of those queries were told to the buyer as addressed or hidden. A polite request that is an ordinary wish (Q161) was understood, not flagged.

Model calls: 21 (21 fresh, 0 from the answer cache); outcomes: ok 21; re-asked 0.
Cost: US$0.0325 measured for 21 fresh calls = US$1.55 per 1,000 model calls and US$0.15 per 1,000 queries (code settles the rest at no cost); mean tokens in 4160, cache read 0, out 63, reasoning 0.
Latency: model call p50 2053 ms, p95 3712 ms; a query that asked the model, whole pipeline, p50 2053 ms, p95 3722 ms; a query code settled, p50 0 ms, p95 1 ms (cached answers are not in the first).

### Every query that was not fully right (5)

| Query | Split | Category | Asked | Field | Expected | Got |
|---|---|---|---|---|---|---|
| Q026 206 SD | test | trim | null | notes | (none) | not_tracked |
| Q057 ۴۰۵ کیلومتر پایین | test | mileage | left | filter:model | ["peugeot.405"] | (none) |
| Q057 ۴۰۵ کیلومتر پایین | test | mileage | left | filter:low_mileage_for_age | true | (none) |
| Q057 ۴۰۵ کیلومتر پایین | test | mileage | left | filter:mileage | (none) | {"max":405} |
| Q057 ۴۰۵ کیلومتر پایین | test | mileage | left | unused | (none) | پایین |
| Q133 کیا سراتو | test | not_tracked | left | filter:model | ["kia.cerato"] | ["kia.cerato","kia.cerato-ir"] |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | filter:model | ["hyundai.elantra"] | (none) |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | filter:make | (none) | ["hyundai"] |
| Q135 هیوندا النترا حدود ۲ میلیارد | test | not_tracked | left | unused | (none) | النترا |
| Q163 پراید ۱۳۱ بدون رنگ، ممنونم از راهنمایی‌تان. ممنونم از راهنما | test | injection | left | unused | (none) | تان راهنمایی |


results: /home/pedrum/Dev/carshenas-cs99/packages/ai/results/query-understanding-2026-10-03T19-03-12.json
fresh calls 21, measured US$0.0325, p95 3712 ms


---

## The model alone on the 52 new queries (ablation)

## query.filters on 52 labelled queries: model-only (google/gemini-3.5-flash-lite), prompt version b0ff1642901f1124

Accuracy with 95% Wilson intervals. A query is right when every field of what the buyer gets is right: each filter, the order, the unused words, the text-search fallback and the notices. The bundle a wish named is reported beside, not part of it.

| Queries | All | Development | Test | Settled by code | Asked the model |
|---|---|---|---|---|---|
| fully right | 61.5% (32/52, 48.0–73.5) | 50.0% (13/26, 32.1–67.9) | 73.1% (19/26, 53.9–86.3) | 0.0% (0/0, 0.0–100.0) | 61.5% (32/52, 48.0–73.5) |

Code settled 0 of 52 queries without a model (0.0%); the model was asked about 52.

Labelled as needing no model: 52; of them 0 cost no model call.

| Category | Queries | Fully right | Asked the model |
|---|---|---|---|
| model | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| trim | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| price | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| year | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| mileage | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| condition | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| values | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| place | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| terms | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| intent | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| vague | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| order | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| typo | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| not_tracked | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| mixed | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| trap | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| nonsense | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| injection | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| engine_origin | 52 | 61.5% (32/52, 48.0–73.5) | 52 |

| Field | Queries it appears in | Right | Precision | Recall |
|---|---|---|---|---|
| filter:chassis | 4 | 0.0% (0/4, 0.0–49.0) | 0.0% (0/4, 0.0–49.0) | — |
| filter:engine_condition | 4 | 0.0% (0/4, 0.0–49.0) | 0.0% (0/4, 0.0–49.0) | — |
| filter:engine_volume | 37 | 70.3% (26/37, 54.2–82.5) | 78.8% (26/33, 62.2–89.3) | 70.3% (26/37, 54.2–82.5) |
| filter:fuel | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:gearbox | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:gearbox_condition | 4 | 0.0% (0/4, 0.0–49.0) | 0.0% (0/4, 0.0–49.0) | — |
| filter:low_mileage_for_age | 8 | 37.5% (3/8, 13.7–69.4) | 42.9% (3/7, 15.8–75.0) | 75.0% (3/4, 30.1–95.4) |
| filter:mileage | 1 | 0.0% (0/1, 0.0–79.3) | — | 0.0% (0/1, 0.0–79.3) |
| filter:model | 5 | 100.0% (5/5, 56.6–100.0) | 100.0% (5/5, 56.6–100.0) | 100.0% (5/5, 56.6–100.0) |
| filter:no_accident | 4 | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) |
| filter:no_replaced_parts | 4 | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) |
| filter:origin | 20 | 60.0% (12/20, 38.7–78.1) | 66.7% (12/18, 43.7–83.7) | 60.0% (12/20, 38.7–78.1) |
| filter:paint_free | 4 | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) |
| filter:popular_model | 3 | 0.0% (0/3, 0.0–56.1) | 0.0% (0/3, 0.0–56.1) | — |
| filter:price | 2 | 50.0% (1/2, 9.5–90.5) | 100.0% (1/1, 20.7–100.0) | 50.0% (1/2, 9.5–90.5) |
| filter:year | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| intents | 4 | 0.0% (0/4, 0.0–49.0) | 0.0% (0/4, 0.0–49.0) | — |
| textSearch | 5 | 0.0% (0/5, 0.0–43.4) | 0.0% (0/5, 0.0–43.4) | 0.0% (0/5, 0.0–43.4) |
| unused | 5 | 0.0% (0/5, 0.0–43.4) | 0.0% (0/5, 0.0–43.4) | — |

Where each applied filter came from, and how often it was right (S04 "Confidence": a weak reading is only a suggestion):

| Who read it | Filters shown | Right |
|---|---|---|
| model inferred | 31 | 38.7% (12/31, 23.7–56.2) |
| model stated | 64 | 79.7% (51/64, 68.3–87.7) |

Injected instructions: 0 of 0 witness values appeared in the answer, over 0 queries; 0 of those queries were told to the buyer as addressed or hidden. A polite request that is an ordinary wish (Q161) was understood, not flagged.

Model calls: 52 (51 fresh, 0 from the answer cache); outcomes: ok 47, invalid 4, error 1; re-asked 8.
Cost: US$0.1010 measured for 51 fresh calls = US$1.98 per 1,000 model calls and US$1.94 per 1,000 queries (code settles the rest at no cost); mean tokens in 4546, cache read 0, out 175, reasoning 0.
Latency: model call p50 2351 ms, p95 5207 ms; a query that asked the model, whole pipeline, p50 2354 ms, p95 5232 ms; a query code settled, p50 undefined ms, p95 undefined ms (cached answers are not in the first).

### Every query that was not fully right (20)

| Query | Split | Category | Asked | Field | Expected | Got |
|---|---|---|---|---|---|---|
| Q166 موتور ۲ لیتری | development | engine_origin | left | filter:engine_volume | {"max":2100,"min":1900} | {"max":2000} |
| Q168 ماشین ۱۶۰۰ سی سی | development | engine_origin | left | filter:engine_volume | {"max":1680,"min":1520} | {"max":1600} |
| Q176 موتور ۱.۶ لیتری | development | engine_origin | left | filter:engine_volume | {"max":1680,"min":1520} | {"max":1600} |
| Q184 موتور ۳٫۵ لیتری و بالاتر | development | engine_origin | left | filter:engine_volume | {"min":3500} | (none) |
| Q184 موتور ۳٫۵ لیتری و بالاتر | development | engine_origin | left | unused | (none) | 3.5 بالاتر لیتری موتور |
| Q184 موتور ۳٫۵ لیتری و بالاتر | development | engine_origin | left | textSearch | false | true |
| Q188 ماشین‌های خارجی تمیز | development | engine_origin | left | filter:low_mileage_for_age | (none) | true |
| Q188 ماشین‌های خارجی تمیز | development | engine_origin | left | filter:popular_model | (none) | true |
| Q188 ماشین‌های خارجی تمیز | development | engine_origin | left | filter:engine_condition | (none) | ["sound"] |
| Q188 ماشین‌های خارجی تمیز | development | engine_origin | left | filter:gearbox_condition | (none) | ["sound"] |
| Q188 ماشین‌های خارجی تمیز | development | engine_origin | left | filter:chassis | (none) | ["intact"] |
| Q191 ماشین ایرانی | test | engine_origin | left | filter:origin | ["domestic","joint_venture"] | ["domestic"] |
| Q192 ماشین ساخت داخل | development | engine_origin | left | filter:origin | ["domestic","joint_venture"] | ["domestic"] |
| Q195 ایرانی تمیز | test | engine_origin | left | filter:origin | ["domestic","joint_venture"] | ["domestic"] |
| Q195 ایرانی تمیز | test | engine_origin | left | filter:low_mileage_for_age | (none) | true |
| Q195 ایرانی تمیز | test | engine_origin | left | filter:popular_model | (none) | true |
| Q195 ایرانی تمیز | test | engine_origin | left | filter:engine_condition | (none) | ["sound"] |
| Q195 ایرانی تمیز | test | engine_origin | left | filter:gearbox_condition | (none) | ["sound"] |
| Q195 ایرانی تمیز | test | engine_origin | left | filter:chassis | (none) | ["intact"] |
| Q196 masshin haye kharejie tamiz | development | engine_origin | left | filter:low_mileage_for_age | (none) | true |
| Q196 masshin haye kharejie tamiz | development | engine_origin | left | filter:popular_model | (none) | true |
| Q196 masshin haye kharejie tamiz | development | engine_origin | left | filter:engine_condition | (none) | ["sound"] |
| Q196 masshin haye kharejie tamiz | development | engine_origin | left | filter:gearbox_condition | (none) | ["sound"] |
| Q196 masshin haye kharejie tamiz | development | engine_origin | left | filter:chassis | (none) | ["intact"] |
| Q198 mashin irani 1600cc | development | engine_origin | left | filter:origin | ["domestic","joint_venture"] | ["domestic"] |
| Q199 ماشین خارجی با موتور ۲۰۰۰ به بالا | test | engine_origin | left | filter:engine_volume | {"min":2000} | (none) |
| Q199 ماشین خارجی با موتور ۲۰۰۰ به بالا | test | engine_origin | left | filter:origin | ["imported"] | (none) |
| Q199 ماشین خارجی با موتور ۲۰۰۰ به بالا | test | engine_origin | left | unused | (none) | 2000 بالا خارجی موتور |
| Q199 ماشین خارجی با موتور ۲۰۰۰ به بالا | test | engine_origin | left | textSearch | false | true |
| Q202 ماشین ایرانی ۱۳۰۰ سی‌سی | development | engine_origin | left | filter:engine_volume | {"max":1370,"min":1240} | {"max":1300} |
| Q202 ماشین ایرانی ۱۳۰۰ سی‌سی | development | engine_origin | left | filter:origin | ["domestic","joint_venture"] | ["domestic"] |
| Q203 کم‌کارکرد خارجی بالای ۲۰۰۰ سی‌سی | test | engine_origin | left | filter:low_mileage_for_age | true | (none) |
| Q203 کم‌کارکرد خارجی بالای ۲۰۰۰ سی‌سی | test | engine_origin | left | filter:engine_volume | {"min":2000} | (none) |
| Q203 کم‌کارکرد خارجی بالای ۲۰۰۰ سی‌سی | test | engine_origin | left | filter:origin | ["imported"] | (none) |
| Q203 کم‌کارکرد خارجی بالای ۲۰۰۰ سی‌سی | test | engine_origin | left | unused | (none) | 2000 بالای خارجی سی کارکرد کم |
| Q203 کم‌کارکرد خارجی بالای ۲۰۰۰ سی‌سی | test | engine_origin | left | textSearch | false | true |
| Q205 ماشین ۲۰۰۰ cc بنزینی اتوماتیک | test | engine_origin | left | filter:engine_volume | {"max":2100,"min":1900} | {"max":2000} |
| Q206 ایرانی اتوماتیک کم کارکرد | development | engine_origin | left | filter:origin | ["domestic","joint_venture"] | ["domestic"] |
| Q210 پژو ۲۰۶ موتور ۱۶۰۰ | development | engine_origin | left | filter:engine_volume | {"max":1680,"min":1520} | {"max":1600} |
| Q211 دنا پلاس ۱۷۰۰ cc | test | engine_origin | left | filter:engine_volume | {"max":1790,"min":1620} | {"max":1700} |
| Q212 تویوتا کرولا خارجی تمیز | development | engine_origin | left | filter:low_mileage_for_age | (none) | true |
| Q212 تویوتا کرولا خارجی تمیز | development | engine_origin | left | filter:engine_condition | (none) | ["sound"] |
| Q212 تویوتا کرولا خارجی تمیز | development | engine_origin | left | filter:gearbox_condition | (none) | ["sound"] |
| Q212 تویوتا کرولا خارجی تمیز | development | engine_origin | left | filter:chassis | (none) | ["intact"] |
| Q214 کارکرد ۲۰۰۰ کیلومتر | development | engine_origin | left | filter:mileage | {"max":2000} | (none) |
| Q214 کارکرد ۲۰۰۰ کیلومتر | development | engine_origin | left | unused | (none) | 2000 کارکرد کیلومتر |
| Q214 کارکرد ۲۰۰۰ کیلومتر | development | engine_origin | left | textSearch | false | true |
| Q215 ماشین ۲۰۰۰ سی‌سی با قیمت زیر ۵۰۰ میلیون | test | engine_origin | left | filter:price | {"max":500000000} | (none) |
| Q215 ماشین ۲۰۰۰ سی‌سی با قیمت زیر ۵۰۰ میلیون | test | engine_origin | left | filter:engine_volume | {"max":2100,"min":1900} | (none) |
| Q215 ماشین ۲۰۰۰ سی‌سی با قیمت زیر ۵۰۰ میلیون | test | engine_origin | left | unused | (none) | 2000 500 زیر سی قیمت میلیون |
| Q215 ماشین ۲۰۰۰ سی‌سی با قیمت زیر ۵۰۰ میلیون | test | engine_origin | left | textSearch | false | true |


results: /home/pedrum/Dev/carshenas-cs99/packages/ai/results/query-understanding-2026-10-03T19-05-48.json
fresh calls 51, measured US$0.1010, p95 5207 ms

