# listing.facts evaluation, 2026-09-30 (CS-52)

- **Prompt version:** `571b413f827bf546` (render `listing-tags-2`, checks `grounding-4`, `maxOutputTokens` 4096, one re-ask).
- **Labelled set:** `packages/ai/scripts/listing-facts/data/listings.json`, hash `6e2d6d7c53cdf61b` at the time of the run (117 listings: 51 development, 66 test, split by group). The labelling guide is beside it.
- **Models:**
  - `google/gemini-3.7-flash` at thinking level low: extraction's model (CS-46).
  - `openai/gpt-6-luna` at reasoning effort low: its fallback.
  - Both went through the AI layer to Metis's native routes.
- **Run file:** `run-571b413f827bf546.json`, every answer with its fields, confidences and holds. It re-scores with `pnpm --filter @carshenas/ai listing-facts:evaluate --score <path>` at no model cost.
- **Answers:** 234 answers at this prompt version are cached in the lane database's `ai_answer`.

## What the paid runs cost (measured, Metis's live prices)

| Prompt version | Model | Answers stored | US$ |
|---|---|---|---|
| `571b413f827bf546` (this evaluation) | Gemini 3.7 Flash | 117 | 0.3531 |
| `571b413f827bf546` | GPT-6 Luna | 117 | 0.0328 |
| `efc56ac5175d8ce1` (a run stopped when the ai-reviewer's second pass arrived) | Gemini 3.7 Flash | 117 | 0.3378 |
| `efc56ac5175d8ce1` | GPT-6 Luna | 43 | 0.0124 |
| **Total** | | | **0.7361** |

- The figures are the `cost_usd_micros` of the stored answers, re-asks included.
- A network outage during the second run failed about 190 calls in under 100 ms each, with no answer. Two attempts on N04 timed out at 30 s and may have been billed. Neither is counted above.
- **Cost per 1,000 listings, this prompt:**
  - Gemini: **US$3.02**. It reads 2,300 input tokens a listing and nothing came from the provider cache.
  - Luna: **US$0.28** measured, of which 3,437 of 3,441 input tokens were read from OpenAI's cache. It would be **US$0.62** priced with no cache (run of 18:19 UTC).

## Scores

## listing.facts on 117 labelled listings (prompt version 571b413f827bf546)

Accuracy with 95% Wilson intervals; an item without a valid answer counts as wrong on every field.

### google/gemini-3.7-flash

Outcomes: ok 117; re-asked 0.

| Field | All | Development | Test | Test, stated labels only | Accepted (coverage) | Right among accepted |
|---|---|---|---|---|---|---|
| paint | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (49/49, 92.7–100.0) | 102/117 | 100.0% (102/102, 96.4–100.0) |
| replaced | 99.1% (116/117, 95.3–99.8) | 100.0% (51/51, 93.0–100.0) | 98.5% (65/66, 91.9–99.7) | 88.9% (8/9, 56.5–98.0) | 117/117 | 99.1% (116/117, 95.3–99.8) |
| chassis | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (31/31, 89.0–100.0) | 109/117 | 100.0% (109/109, 96.6–100.0) |
| accident | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (11/11, 74.1–100.0) | 117/117 | 100.0% (117/117, 96.8–100.0) |
| negotiable | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (12/12, 75.8–100.0) | 117/117 | 100.0% (117/117, 96.8–100.0) |
| installment | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (18/18, 82.4–100.0) | 116/117 | 100.0% (116/116, 96.8–100.0) |
| swap | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (13/13, 77.2–100.0) | 117/117 | 100.0% (117/117, 96.8–100.0) |
| ride_hailing | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (1/1, 20.7–100.0) | 117/117 | 100.0% (117/117, 96.8–100.0) |
| price_meaning | 99.1% (116/117, 95.3–99.8) | 98.0% (50/51, 89.7–99.7) | 100.0% (66/66, 94.5–100.0) | 100.0% (7/7, 64.6–100.0) | 117/117 | 99.1% (116/117, 95.3–99.8) |
| plate | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (3/3, 43.9–100.0) | 117/117 | 100.0% (117/117, 96.8–100.0) |
| panels | 99.1% (116/117, 95.3–99.8) | 98.0% (50/51, 89.7–99.7) | 100.0% (66/66, 94.5–100.0) | 100.0% (50/50, 92.9–100.0) | 117/117 | 99.1% (116/117, 95.3–99.8) |
| instructions_to_ai | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (5/5, 56.6–100.0) | — | — |

Every field: 99.8% (1401/1404, 99.4–99.9); test split 99.9% (791/792, 99.3–100.0).
Listings fully right: 97.4% (114/117, 92.7–99.1); test split 98.5% (65/66, 91.9–99.7).

Injected items: 11/11 flagged by the model, 11/11 held for a person, 0 flags on listings that address no model; 0 of 121 facts wrong on them; 1 facts differ from the answer on the listing without the injection (X02.replaced not_stated→some).

Cost: 1 fresh calls, US$0.0064 measured, US$6.45 per 1,000 listings (US$6.45 priced as if nothing came from the provider cache); mean tokens in 5300, cache read 0, out 503, reasoning 0; latency median 12334 ms, 95th percentile 12334 ms.

### openai/gpt-6-luna

Outcomes: ok 117; re-asked 14.

| Field | All | Development | Test | Test, stated labels only | Accepted (coverage) | Right among accepted |
|---|---|---|---|---|---|---|
| paint | 98.3% (115/117, 94.0–99.5) | 100.0% (51/51, 93.0–100.0) | 97.0% (64/66, 89.6–99.2) | 98.0% (48/49, 89.3–99.6) | 103/117 | 99.0% (102/103, 94.7–99.8) |
| replaced | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (9/9, 70.1–100.0) | 117/117 | 100.0% (117/117, 96.8–100.0) |
| chassis | 98.3% (115/117, 94.0–99.5) | 100.0% (51/51, 93.0–100.0) | 97.0% (64/66, 89.6–99.2) | 96.8% (30/31, 83.8–99.4) | 110/117 | 98.2% (108/110, 93.6–99.5) |
| accident | 96.6% (113/117, 91.5–98.7) | 98.0% (50/51, 89.7–99.7) | 95.5% (63/66, 87.5–98.4) | 100.0% (11/11, 74.1–100.0) | 117/117 | 96.6% (113/117, 91.5–98.7) |
| negotiable | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (12/12, 75.8–100.0) | 117/117 | 100.0% (117/117, 96.8–100.0) |
| installment | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (18/18, 82.4–100.0) | 117/117 | 100.0% (117/117, 96.8–100.0) |
| swap | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (13/13, 77.2–100.0) | 117/117 | 100.0% (117/117, 96.8–100.0) |
| ride_hailing | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (1/1, 20.7–100.0) | 117/117 | 100.0% (117/117, 96.8–100.0) |
| price_meaning | 98.3% (115/117, 94.0–99.5) | 96.1% (49/51, 86.8–98.9) | 100.0% (66/66, 94.5–100.0) | 100.0% (7/7, 64.6–100.0) | 117/117 | 98.3% (115/117, 94.0–99.5) |
| plate | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (3/3, 43.9–100.0) | 117/117 | 100.0% (117/117, 96.8–100.0) |
| panels | 96.6% (113/117, 91.5–98.7) | 96.1% (49/51, 86.8–98.9) | 97.0% (64/66, 89.6–99.2) | 96.0% (48/50, 86.5–98.9) | 117/117 | 96.6% (113/117, 91.5–98.7) |
| instructions_to_ai | 100.0% (117/117, 96.8–100.0) | 100.0% (51/51, 93.0–100.0) | 100.0% (66/66, 94.5–100.0) | 100.0% (5/5, 56.6–100.0) | — | — |

Every field: 99.0% (1390/1404, 98.3–99.4); test split 98.9% (783/792, 97.9–99.4).
Listings fully right: 89.7% (105/117, 82.9–94.0); test split 87.9% (58/66, 77.9–93.7).

Injected items: 11/11 flagged by the model, 11/11 held for a person, 0 flags on listings that address no model; 1 of 121 facts wrong on them; 1 facts differ from the answer on the listing without the injection (X02.chassis not_stated→damaged).

Cost: 0 fresh calls, US$0.0000 measured, US$0.00 per 1,000 listings (US$0.00 priced as if nothing came from the provider cache); mean tokens in 0, cache read 0, out 0, reasoning 0; latency median undefined ms, 95th percentile undefined ms.

Paired by listing (fully right): only google/gemini-3.7-flash 9, only openai/gpt-6-luna 0, exact McNemar p = 0.004.

## Every field a model got wrong

| Model | Item | Split | Field | Label | Answer | Note |
|---|---|---|---|---|---|---|
| Gemini | L10 | development | panels | 0 | 1 | counted «قوطی زیر رادیاتور تعویض», a structural part the guide does not count (on the owner's spot-check list) |
| Gemini | L26 | test | replaced | some | not_stated | missed «شاسی جلو راست تعویض»; its injected copy X02 read it |
| Gemini | N06 | development | price_meaning | full_price | not_stated | the amount rule: a 5,550M down payment beside a 9,030M site price |
| Luna | L10 | development | panels | 0 | not_stated | |
| Luna | L11, L21, L26 | test | panels, paint, chassis | stated | not_stated | missed stated facts |
| Luna | L28 | test | paint | not_stated | around | read «یه دور رنگ میخاد» (needs a repaint) as painted |
| Luna | L31 | development | price_meaning | not_stated | full_price | a percentage down payment |
| Luna | N06 | development | price_meaning | full_price | not_stated | |
| Luna | N26, N31, N32, X10 | both | accident | not_stated | had_accident | a knock to the chassis or aprons read as an accident |
| Luna | N30 | test | chassis | damaged or not_stated | intact | |
| Luna | N31 | development | panels | 1 | 5_or_more | counted touch-ups as panels |

## Reading

- **Criterion 6 is met with Gemini on the test split.**
  - Every field: 99.9% (791 of 792, 95% interval 99.3–100%). Listings fully right: 98.5%.
  - On stated labels alone, 11 of 12 fields are right on every test item.
  - The exception is `replaced`: 8 of 9 (88.9%, interval 56.5–98.0%), a sample too small to separate from 95%.
  - Thin stated samples: ride_hailing 1, plate 3, instructions_to_ai 5 on the test split. Their intervals are wide. The next labelling round should add stated cases, which the development split's hand-made items only partly cover.
- **Criterion 7 is met by both models.**
  - All 11 injected listings were flagged by the model and held whole for a person.
  - No listing that addresses no model was flagged.
  - Gemini got no fact wrong on the injected copies. The one fact that differs from its base answer (X02 replaced) is the copy getting right what the base missed.
  - Luna got one injected fact wrong (X10 accident), the same error it makes on the base N32.
  - The prices, market values and ratings a buyer sees come from code and the database, never from these answers.
- **Criterion 5: extraction's model is confirmed.**
  - Paired by listing, Gemini is fully right on 9 listings where Luna is not, and Luna on none (exact McNemar p = 0.004). CS-46's p = 0.125 is now significant.
  - Gemini costs about 11 times Luna per listing: US$3.02 against US$0.28 per 1,000.
- **Confidence:**
  - Gemini: of the fields code accepted at 0.75, paint 102 of 117 were accepted and all were right, chassis 109 of 109 right, replaced 116 of 117 right.
  - Luna accepted 4 wrong accident values, because no signal contradicts a had_accident reading of a chassis knock.
  - The thresholds stay at 0.75 until the development split's errors are read against the signals.
