# Evaluation of plain-Farsi search with the country of a make (CS-103), 2026-10-04

Task `query.filters`, prompt version `38cba78f3e912da3` (the instructions name the country filter, its closed list of codes and the rule «the brand's country, whoever assembled the car», and say that a country word in a search that is not about cars gets no reading), model `google/gemini-3.5-flash-lite` through Metis, as in `docs/evidence/query-understanding/2026-10-02/report.md` and `2026-10-03-engine-volume/report.md`. The labelled set is the 163 queries of CS-62, the 71 of CS-99/CS-100 (volume, origin, the owner's phrases) and 36 new country queries (category `country`, Q231 to Q266), 270 in all.

## The owner's phrases, before and after (lane copy of main's older data)

`before.md`: what main answered (the understanding of commit 0d740dd run from a checkout, then each search counted on the lane's database); `after.md`: what the lane answers, with the filters understood and the listings counted (`scripts/measure-phrases.ts`, `scripts/before-table.ts`).

| Phrase | Before (main) | After (this lane) |
|---|---|---|
| «ماشین خارجی تمیز» | no filter, text search of «خارجی تمیز»: 0 listings | origin imported and the clean bundle, 113 listings (the Toyota Corolla), chips, no text fallback |
| «ماشین ژاپنی» | no filter, text search of «ژاپنی»: 0 | country Japan, 117 listings (the Corolla), chip «کشور ژاپن» |
| «ماشین کره‌ای تمیز» | text search: 0 | country South Korea and the clean bundle, 0 listings, and the page says that no Korean car is listed |
| «آلمانی», «چینی» | text search: 0 | country Germany, China: 0 listings, said honestly |
| «فرانسوی» | text search: 30 (a word in the listings' text) | country France: 4,136 listings (Peugeot) |
| «ماشین فرانسوی کم‌کارکرد» | the country word dropped, every low-mileage car: 2,572 | France and low mileage: 1,451 |
| «ماشین ژاپنی زیر ۱ میلیارد» | the country word dropped, every car under a billion: 1,357 | Japan under a billion: 0 (the Corollas cost more) |

The last two rows were the worst of the old answers: the word was shown as unused, but the results were everything, so a buyer could think they were Japanese or French.

The lane's counts are listings that are searchable (details read, seen within 48 hours): Toyota has 1,724 active listings and 117 of them are searchable on this copy of the data, so main, which reads details continuously, will show more.

**What is a measure and what is not.**
- The 24 development country queries (Q231 to Q254) were labelled on 2026-10-04 by the rule «the country of the brand, whoever assembled the car», after the phrase table existed and a handful of phrases had been tried by hand. They are a development set: the code was made to read them, so 100 % on them says the phrasings listed work.
- The honest figure is the **12 held-out country queries** (Q255 to Q266), written after the country code was finished, from phrasings the code had not been shown (a noun form «کره جنوبی», «امریکایی» without the hamza, two countries joined by «و» and «یا», a volume or a price beside a country, Finglish with a car word), and scored once without tuning: **12 of 12 by code alone** (95 % interval 75.8 to 100 %). The interval is wide: 12 queries cannot show more than that the common forms work.
- The 15 held-out volume and origin queries of CS-100 (Q216 to Q230) are still the weakest spot: 11 of 15 by code alone now, 10 of 15 when they were first scored on 2026-10-03; «خارجی نباشه» (Q224) was repaired afterwards and four development queries (Q267 to Q270) were written for it, so it is no longer a held-out figure. The four that still miss are «۱۶۰۰ تا ۲۰۰۰» (a bare range read as a model year), «۲.۰T», «بزرگ‌تر از ۳ لیتر» and a volume range beside «کم‌کارکرد».
- A regression the country words caused in an older label was found and repaired by a rule, not by a label: Q153 «رستوران ایتالیایی» (nonsense) was read as the country Italy. Country phrases are now soft phrases that are read when the query names cars (a car word or another reading beside them) or when nothing else is left; and the model is told in the instructions that a country word in a search that is not about cars gets no reading. Q153 is right again by code and with the model; no label was changed.
- The labels were written by the same agent that wrote the code; there is no second labeller (CS-90).

**Spend.** US$0.1458 in all of this task's runs, of the US$3 allowed (and US$0.145 for CS-99 and CS-100 before it): US$0.0331 for the full run at an earlier prompt, US$0.0439 for the full run at the final prompt (24 model calls on the 25 queries code could not settle), US$0.0650 for the model alone on the 36 country queries (an ablation, not the product) and US$0.0038 for two probe calls. Every run is in `runs/`.

## Summary

| Mode | Fully right, all 270 | The 36 country queries |
|---|---|---|
| Code only (master switch off, the default) | 95.2 % (257), 91.9 to 97.2 | 100 % (36 of 36) |
| Code, then the model for what code cannot settle (switch on) | 96.7 % (261), 93.8 to 98.2 | 100 % (36 of 36; the model was asked about none of them) |
| The model reads every word (ablation, only the 36 country queries, not the product) | | 86.1 % (31 of 36), US$1.80 per 1,000 queries |

- On the data we hold the owner's phrases are answered (`owner-phrases` and `docs/evidence/query-understanding/2026-10-03-engine-volume/owner-after.md`): «ماشین ژاپنی» returns the Toyota Corolla listings with the chip «کشور ژاپن», «ماشین کره‌ای تمیز» keeps its chips and says that no Korean car is listed.
- The 9 queries not fully right with the model are the CS-62 misses (Q026, Q057, Q133, Q135, Q163, tracked in CS-90) and the four volume queries above; none is about a country.

Raw reports follow.

---

## query.filters on 270 labelled queries: full (google/gemini-3.5-flash-lite), prompt version 38cba78f3e912da3

Accuracy with 95% Wilson intervals. A query is right when every field of what the buyer gets is right: each filter, the order, the unused words, the text-search fallback and the notices. The bundle a wish named is reported beside, not part of it.

| Queries | All | Development | Test | Settled by code | Asked the model |
|---|---|---|---|---|---|
| fully right | 96.7% (261/270, 93.8–98.2) | 100.0% (137/137, 97.3–100.0) | 93.2% (124/133, 87.6–96.4) | 99.6% (244/245, 97.7–99.9) | 68.0% (17/25, 48.4–82.8) |

Code settled 245 of 270 queries without a model (90.7%); the model was asked about 25.

Labelled as needing no model: 235; of them 230 cost no model call.

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
| engine_origin | 71 | 94.4% (67/71, 86.4–97.8) | 4 |
| country | 36 | 100.0% (36/36, 90.4–100.0) | 0 |

| Field | Queries it appears in | Right | Precision | Recall |
|---|---|---|---|---|
| filter:age | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:body_type | 10 | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) |
| filter:chassis | 14 | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) |
| filter:city | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:colour | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:country | 36 | 100.0% (36/36, 90.4–100.0) | 100.0% (36/36, 90.4–100.0) | 100.0% (36/36, 90.4–100.0) |
| filter:deal | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:district | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:engine_condition | 18 | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) |
| filter:engine_volume | 51 | 96.1% (49/51, 86.8–98.9) | 100.0% (49/49, 92.7–100.0) | 96.1% (49/51, 86.8–98.9) |
| filter:fuel | 5 | 100.0% (5/5, 56.6–100.0) | 100.0% (5/5, 56.6–100.0) | 100.0% (5/5, 56.6–100.0) |
| filter:gearbox | 13 | 100.0% (13/13, 77.2–100.0) | 100.0% (13/13, 77.2–100.0) | 100.0% (13/13, 77.2–100.0) |
| filter:gearbox_condition | 18 | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) | 100.0% (18/18, 82.4–100.0) |
| filter:has_photo | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:installments | 4 | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) | 100.0% (4/4, 51.0–100.0) |
| filter:insurance | 3 | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) |
| filter:low_mileage_for_age | 14 | 92.9% (13/14, 68.5–98.7) | 100.0% (13/13, 77.2–100.0) | 92.9% (13/14, 68.5–98.7) |
| filter:make | 14 | 92.9% (13/14, 68.5–98.7) | 92.9% (13/14, 68.5–98.7) | 100.0% (13/13, 77.2–100.0) |
| filter:mileage | 13 | 84.6% (11/13, 57.8–95.7) | 84.6% (11/13, 57.8–95.7) | 100.0% (11/11, 74.1–100.0) |
| filter:model | 126 | 97.6% (123/126, 93.2–99.2) | 99.2% (123/124, 95.6–99.9) | 97.6% (123/126, 93.2–99.2) |
| filter:no_accident | 23 | 100.0% (23/23, 85.7–100.0) | 100.0% (23/23, 85.7–100.0) | 100.0% (23/23, 85.7–100.0) |
| filter:no_replaced_parts | 19 | 100.0% (19/19, 83.2–100.0) | 100.0% (19/19, 83.2–100.0) | 100.0% (19/19, 83.2–100.0) |
| filter:not_ride_hailing | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:origin | 30 | 100.0% (30/30, 88.6–100.0) | 100.0% (30/30, 88.6–100.0) | 100.0% (30/30, 88.6–100.0) |
| filter:paint_free | 36 | 100.0% (36/36, 90.4–100.0) | 100.0% (36/36, 90.4–100.0) | 100.0% (36/36, 90.4–100.0) |
| filter:popular_model | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:posted_within | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:price | 35 | 100.0% (35/35, 90.1–100.0) | 100.0% (35/35, 90.1–100.0) | 100.0% (35/35, 90.1–100.0) |
| filter:seller | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:swap | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:trim | 10 | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) |
| filter:year | 17 | 94.1% (16/17, 73.0–99.0) | 94.1% (16/17, 73.0–99.0) | 100.0% (16/16, 80.6–100.0) |
| intents | 28 | 60.7% (17/28, 42.4–76.4) | 60.7% (17/28, 42.4–76.4) | 89.5% (17/19, 68.6–97.1) |
| notes | 19 | 94.7% (18/19, 75.4–99.1) | 94.7% (18/19, 75.4–99.1) | 100.0% (18/18, 82.4–100.0) |
| sort | 6 | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) |
| textSearch | 6 | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) |
| unused | 23 | 78.3% (18/23, 58.1–90.3) | 78.3% (18/23, 58.1–90.3) | 94.7% (18/19, 75.4–99.1) |

Where each applied filter came from, and how often it was right (S04 "Confidence": a weak reading is only a suggestion):

| Who read it | Filters shown | Right |
|---|---|---|
| code inferred | 142 | 100.0% (142/142, 97.4–100.0) |
| code stated | 428 | 99.3% (425/428, 98.0–99.8) |
| model inferred | 6 | 100.0% (6/6, 61.0–100.0) |
| model stated | 8 | 62.5% (5/8, 30.6–86.3) |
| model weak (a suggestion, not applied) | 1 | 100.0% (1/1, 20.7–100.0) |

Injected instructions: 0 of 10 witness values appeared in the answer, over 9 queries; 7 of those queries were told to the buyer as addressed or hidden. A polite request that is an ordinary wish (Q161) was understood, not flagged.

Model calls: 25 (24 fresh, 0 from the answer cache); outcomes: ok 22, error 1, invalid 2; re-asked 2.
Cost: US$0.0439 measured for 24 fresh calls = US$1.83 per 1,000 model calls and US$0.16 per 1,000 queries (code settles the rest at no cost); mean tokens in 4886, cache read 281, out 79, reasoning 0.
Latency: model call p50 1457 ms, p95 3167 ms; a query that asked the model, whole pipeline, p50 1495 ms, p95 4862 ms; a query code settled, p50 0 ms, p95 2 ms (cached answers are not in the first).

### Every query that was not fully right (9)

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
| Q220 ۱۶۰۰ تا ۲۰۰۰ | test | engine_origin | left | filter:year | (none) | {"max":1379} |
| Q220 ۱۶۰۰ تا ۲۰۰۰ | test | engine_origin | left | unused | 1600 2000 | 1600 |
| Q222 کرولا ۲.۰T | test | engine_origin | left | filter:engine_volume | {"max":2100,"min":1900} | (none) |
| Q222 کرولا ۲.۰T | test | engine_origin | left | unused | (none) | 2.0 t |
| Q226 موتور بزرگ‌تر از ۳ لیتر | test | engine_origin | left | unused | (none) | بزرگ تر موتور |
| Q230 ماشین ایرانی کم‌کارکرد حجم موتور ۱۳۰۰ تا ۱۶۰۰ | test | engine_origin | left | filter:low_mileage_for_age | true | (none) |
| Q230 ماشین ایرانی کم‌کارکرد حجم موتور ۱۳۰۰ تا ۱۶۰۰ | test | engine_origin | left | filter:engine_volume | {"max":1600,"min":1300} | (none) |
| Q230 ماشین ایرانی کم‌کارکرد حجم موتور ۱۳۰۰ تا ۱۶۰۰ | test | engine_origin | left | filter:mileage | (none) | {"max":1600,"min":1300} |


results: /home/pedrum/Dev/carshenas-cs99/packages/ai/results/query-understanding-2026-10-04T06-57-08.json
fresh calls 24, measured US$0.0439, p95 3167 ms


---

## The model alone on the 36 country queries (ablation)

## query.filters on 36 labelled queries: model-only (google/gemini-3.5-flash-lite), prompt version 38cba78f3e912da3

Accuracy with 95% Wilson intervals. A query is right when every field of what the buyer gets is right: each filter, the order, the unused words, the text-search fallback and the notices. The bundle a wish named is reported beside, not part of it.

| Queries | All | Development | Test | Settled by code | Asked the model |
|---|---|---|---|---|---|
| fully right | 86.1% (31/36, 71.3–93.9) | 87.5% (21/24, 69.0–95.7) | 83.3% (10/12, 55.2–95.3) | 0.0% (0/0, 0.0–100.0) | 86.1% (31/36, 71.3–93.9) |

Code settled 0 of 36 queries without a model (0.0%); the model was asked about 36.

Labelled as needing no model: 36; of them 0 cost no model call.

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
| engine_origin | 0 | 0.0% (0/0, 0.0–100.0) | 0 |
| country | 36 | 86.1% (31/36, 71.3–93.9) | 36 |

| Field | Queries it appears in | Right | Precision | Recall |
|---|---|---|---|---|
| filter:chassis | 5 | 0.0% (0/5, 0.0–43.4) | 0.0% (0/5, 0.0–43.4) | — |
| filter:country | 36 | 100.0% (36/36, 90.4–100.0) | 100.0% (36/36, 90.4–100.0) | 100.0% (36/36, 90.4–100.0) |
| filter:engine_condition | 5 | 0.0% (0/5, 0.0–43.4) | 0.0% (0/5, 0.0–43.4) | — |
| filter:engine_volume | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:fuel | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:gearbox | 2 | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) | 100.0% (2/2, 34.2–100.0) |
| filter:gearbox_condition | 5 | 0.0% (0/5, 0.0–43.4) | 0.0% (0/5, 0.0–43.4) | — |
| filter:low_mileage_for_age | 7 | 28.6% (2/7, 8.2–64.1) | 28.6% (2/7, 8.2–64.1) | 100.0% (2/2, 34.2–100.0) |
| filter:model | 1 | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) | 100.0% (1/1, 20.7–100.0) |
| filter:no_accident | 5 | 100.0% (5/5, 56.6–100.0) | 100.0% (5/5, 56.6–100.0) | 100.0% (5/5, 56.6–100.0) |
| filter:no_replaced_parts | 5 | 100.0% (5/5, 56.6–100.0) | 100.0% (5/5, 56.6–100.0) | 100.0% (5/5, 56.6–100.0) |
| filter:paint_free | 6 | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) | 100.0% (6/6, 61.0–100.0) |
| filter:popular_model | 5 | 0.0% (0/5, 0.0–43.4) | 0.0% (0/5, 0.0–43.4) | — |
| filter:price | 3 | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) | 100.0% (3/3, 43.9–100.0) |
| intents | 5 | 0.0% (0/5, 0.0–43.4) | 0.0% (0/5, 0.0–43.4) | — |

Where each applied filter came from, and how often it was right (S04 "Confidence": a weak reading is only a suggestion):

| Who read it | Filters shown | Right |
|---|---|---|
| model inferred | 40 | 37.5% (15/40, 24.2–53.0) |
| model stated | 51 | 100.0% (51/51, 93.0–100.0) |

Injected instructions: 0 of 0 witness values appeared in the answer, over 0 queries; 0 of those queries were told to the buyer as addressed or hidden. A polite request that is an ordinary wish (Q161) was understood, not flagged.

Model calls: 36 (36 fresh, 0 from the answer cache); outcomes: ok 36; re-asked 0.
Cost: US$0.0650 measured for 36 fresh calls = US$1.80 per 1,000 model calls and US$1.80 per 1,000 queries (code settles the rest at no cost); mean tokens in 4212, cache read 0, out 151, reasoning 0.
Latency: model call p50 1617 ms, p95 1945 ms; a query that asked the model, whole pipeline, p50 1619 ms, p95 1954 ms; a query code settled, p50 undefined ms, p95 undefined ms (cached answers are not in the first).

### Every query that was not fully right (5)

| Query | Split | Category | Asked | Field | Expected | Got |
|---|---|---|---|---|---|---|
| Q234 کره‌ای تمیز | development | country | left | filter:low_mileage_for_age | (none) | true |
| Q234 کره‌ای تمیز | development | country | left | filter:popular_model | (none) | true |
| Q234 کره‌ای تمیز | development | country | left | filter:engine_condition | (none) | ["sound"] |
| Q234 کره‌ای تمیز | development | country | left | filter:gearbox_condition | (none) | ["sound"] |
| Q234 کره‌ای تمیز | development | country | left | filter:chassis | (none) | ["intact"] |
| Q245 ماشین ژاپنی تمیز | development | country | left | filter:low_mileage_for_age | (none) | true |
| Q245 ماشین ژاپنی تمیز | development | country | left | filter:popular_model | (none) | true |
| Q245 ماشین ژاپنی تمیز | development | country | left | filter:engine_condition | (none) | ["sound"] |
| Q245 ماشین ژاپنی تمیز | development | country | left | filter:gearbox_condition | (none) | ["sound"] |
| Q245 ماشین ژاپنی تمیز | development | country | left | filter:chassis | (none) | ["intact"] |
| Q248 almani tamiz | development | country | left | filter:low_mileage_for_age | (none) | true |
| Q248 almani tamiz | development | country | left | filter:popular_model | (none) | true |
| Q248 almani tamiz | development | country | left | filter:engine_condition | (none) | ["sound"] |
| Q248 almani tamiz | development | country | left | filter:gearbox_condition | (none) | ["sound"] |
| Q248 almani tamiz | development | country | left | filter:chassis | (none) | ["intact"] |
| Q261 ماشین ژاپنی یا آلمانی تمیز | test | country | left | filter:low_mileage_for_age | (none) | true |
| Q261 ماشین ژاپنی یا آلمانی تمیز | test | country | left | filter:popular_model | (none) | true |
| Q261 ماشین ژاپنی یا آلمانی تمیز | test | country | left | filter:engine_condition | (none) | ["sound"] |
| Q261 ماشین ژاپنی یا آلمانی تمیز | test | country | left | filter:gearbox_condition | (none) | ["sound"] |
| Q261 ماشین ژاپنی یا آلمانی تمیز | test | country | left | filter:chassis | (none) | ["intact"] |
| Q265 mashin japoni tamiz | test | country | left | filter:low_mileage_for_age | (none) | true |
| Q265 mashin japoni tamiz | test | country | left | filter:popular_model | (none) | true |
| Q265 mashin japoni tamiz | test | country | left | filter:engine_condition | (none) | ["sound"] |
| Q265 mashin japoni tamiz | test | country | left | filter:gearbox_condition | (none) | ["sound"] |
| Q265 mashin japoni tamiz | test | country | left | filter:chassis | (none) | ["intact"] |


results: /home/pedrum/Dev/carshenas-cs99/packages/ai/results/query-understanding-2026-10-04T06-58-14.json
fresh calls 36, measured US$0.0650, p95 1945 ms


---

## Code only, all 270 (summary)

## query.filters on 270 labelled queries: code only (switch off), prompt version 38cba78f3e912da3

Accuracy with 95% Wilson intervals. A query is right when every field of what the buyer gets is right: each filter, the order, the unused words, the text-search fallback and the notices. The bundle a wish named is reported beside, not part of it.

| Queries | All | Development | Test | Settled by code | Asked the model |
|---|---|---|---|---|---|
| fully right | 95.2% (257/270, 91.9–97.2) | 97.8% (134/137, 93.8–99.3) | 92.5% (123/133, 86.7–95.9) | 99.6% (244/245, 97.7–99.9) | 52.0% (13/25, 33.5–70.0) |

Code settled 245 of 270 queries without a model (90.7%); the model was asked about 25.

Labelled as needing no model: 235; of them 230 cost no model call.

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
| engine_origin | 71 | 94.4% (67/71, 86.4–97.8) | 4 |
| country | 36 | 100.0% (36/36, 90.4–100.0) | 0 |

| Field | Queries it appears in | Right | Precision | Recall |
|---|---|---|---|---|
| filter:age | 9 | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) | 100.0% (9/9, 70.1–100.0) |
| filter:body_type | 10 | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) | 100.0% (10/10, 72.2–100.0) |
| filter:chassis | 14 | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) | 100.0% (14/14, 78.5–100.0) |
