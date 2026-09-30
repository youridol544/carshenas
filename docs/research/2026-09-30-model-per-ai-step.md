# Which model should each AI step use? Artificial Analysis's shortlist, filtered to Metis, then a bake-off on real listings

- Date: 2026-09-30
- Asked by / for: Pedrum, for CS-46. The owner asked for Artificial Analysis's model recommender with the providers Metis serves (OpenAI, Anthropic, Google, DeepSeek), a balance of intelligence, speed and cost for each step, and a decision on embeddings.
- Outcome: `STEP_MODELS` in `packages/ai/src/registry.ts`, a model and a fallback for each step, decided on 2026-09-30 by the owner's instruction "decide here … decide and finalize the task". CS-52, CS-55, CS-62 and CS-64 confirm their step's model on their own labelled sets. Evidence: `2026-09-30-model-per-ai-step/evidence/`. The bake-off: `packages/ai/scripts/bakeoff/` (`pnpm --filter @carshenas/ai bakeoff`), its data and labelling rules in `scripts/bakeoff/data/`.

## Questions

1. Which models does Metis serve today on its four native routes, and at what price?
2. What does Artificial Analysis recommend for each step's balance of intelligence, speed and cost, limited to OpenAI, Anthropic, Google and DeepSeek?
3. On real Persian listings and searches, through the AI layer, which models give valid and accurate output, how fast, and at what cost per 1,000 calls?
4. Which model, and which fallback on another provider, should each step use?
5. Does any step need an embedding model, and if so which?

## Method

- **Metis, 2026-09-30 07:50 UTC.** `pnpm --filter @carshenas/ai models` (`packages/ai/scripts/metis-models.ts`) read the model lists of the OpenAI, Anthropic, Gemini and DeepSeek routes, Metis's `/api/v1/meta` and its live price list. GET requests only [L1].
- **Artificial Analysis, 2026-09-30 07:46 to 07:58 UTC,** in the agent's browser (`npx playwright cli`), from this machine's network:
  - the model recommender with the providers filter set to Anthropic, DeepSeek, Google and OpenAI, once per step with the step's priorities (its page keeps them in the URL, recorded with each result) [AA1, L2];
  - the leaderboard with its status filter set to "All", so models Metis still serves but Artificial Analysis no longer calls current are included [AA2, L3];
  - the AA-Omniscience hallucination chart with the 22 candidate variants selected, read from the chart (the screenshot is in the evidence) [AA3, L4];
  - the IFBench and Global-MMLU-Lite pages, to see whether they cover the candidates and Persian [AA4, AA5].

  Artificial Analysis serves its per-evaluation data as an encoded file behind its paid data platform. It was not decoded: the numbers here are the ones its pages show.
- **Real data.** No lane's database held a listing text (lane A only CS-33's counts). With the owner's approval, as a one-off exception to the one-crawling-lane rule, lane F ran one discovery round of the CS-33 crawler into its own database, 08:00 to 08:15 UTC: 141 requests, one 404, no refusal, then Divar paused again. From its 120 snapshots:
  - 36 listings chosen to cover every fact, 28 from private sellers and 8 from dealers, with personal data removed, and three copies of real listings with injected instructions, marked as modified;
  - 24 searches written in the styles buyers use (the owner's decision: the product has no users yet, so they are written, not collected);
  - 20 duplicate questions built from the listings: in ten, one candidate is the same car as a seller would re-list it on another site, written by hand with every fact kept;
  - 20 deal fact sets, four per rating band, from the listings' stated condition with a hand-set band (there is no market value before CS-51).

  Every label was set by hand from the full text before any model saw the item. After the first run, each disagreement was read again; nine extraction fields and three query fields a careful reader could read two ways now accept both, and every change is listed in `scripts/bakeoff/data/README.md`.
- **The bake-off, 2026-09-30 08:21 to 08:39 UTC.** `pnpm --filter @carshenas/ai bakeoff --step <step>` (corrected on 2026-09-30 by CS-47: the `bakeoff -- --step` form this line first gave fails under pnpm 10, which hands the `--` on to the script) runs each candidate through the layer exactly as a product task would call it: its registry entry, its native route and structured-output mode, the step's schema and checks in code, one re-ask, no answer cache. Candidates run side by side and each runs its items one at a time, so the latency is one call's. Extraction ran three times (117 calls per model), the other steps once. In all, 1,604 calls cost US$3.14 at Metis's list prices, probes included [L5].

## Sources

Artificial Analysis (independent measurements; its methodology is on each page), read 2026-09-30:
- [AA1] Model Recommender, https://artificialanalysis.ai/models/recommend
- [AA2] LLM Leaderboard, https://artificialanalysis.ai/leaderboards/models?status=all
- [AA3] AA-Omniscience: Knowledge and Hallucination Benchmark, https://artificialanalysis.ai/evaluations/omniscience
- [AA4] IFBench Benchmark Leaderboard, https://artificialanalysis.ai/evaluations/ifbench
- [AA5] Global-MMLU-Lite Benchmark Leaderboard, https://artificialanalysis.ai/evaluations/global-mmlu-lite

Metis (the provider's own lists and prices), read 2026-09-30 07:50 UTC:
- [M1] The model lists: `https://api.metisai.ir/openai/v1/models`, `/anthropic/v1/models`, `/v1beta/models`, `/deepseek/v1/models`, `/api/v1/meta`
- [M2] The live price list, `GET https://api.metisai.ir/api/v1/meta/providers/pricing`

Earlier notes: `2026-09-29-metis-ai.md` (CS-42: routes, reachability, the embedding models) and `2026-09-29-prompting-context-engineering-and-agents.md` (CS-43: the patterns each step follows).

Measured here, in `2026-09-30-model-per-ai-step/evidence/`:
- [L1] `metis-models-2026-09-30.json`
- [L2] `aa-recommender-2026-09-30.json` (and `aa-recommender-providers-2026-09-30.png`, the provider filter)
- [L3] `aa-leaderboard-2026-09-30.json`
- [L4] `aa-omniscience-hallucination-2026-09-30.json` and `.png`
- [L5] the bake-off runs, `bakeoff-*.json`: every call with its outcome, attempts, latency, tokens, cost and answer; `*-scores-*` score the runs against the final labels.

## Findings

### 1. What Metis serves today [M1, M2, L1]

- The routes list 165 OpenAI, 13 Anthropic, 61 Gemini and 4 DeepSeek models; `/api/v1/meta` lists 147 entries, 10 of them embedding models and 9 rerankers.
- **Listed is not served.** `gemini-3.8-flash`, which Metis lists on its Gemini route, is refused at every thinking level: 400 `FAILED_PRECONDITION`, "Model 'gemini-3.8-flash' is not supported. Please contact the administrator." It also has no price, and neither does `gpt-6.1-sol`. `gemini-flash-latest` answers, but reports only its alias, so its version cannot be pinned or logged. Gemini 3.7 Flash refuses thinking level `minimal` ("Thinking level MINIMAL is not supported for this model") and runs at `low` [L5, `bakeoff-probe-gemini-2026-09-30.json`].
- **Prices** are about 1.1 times the makers' list prices, per million tokens, input and output:

  | Model | Metis, US$ per 1M in / out |
  |---|---|
  | `gpt-6-luna` (up to 270K tokens of context) | 0.11 / 0.55 |
  | `gpt-5.6-luna` | 0.22 / 1.32 |
  | `gpt-6-sol` | 2.00 / 10.00 |
  | `gemini-3.1-flash-lite` | 0.275 / 1.65 |
  | `gemini-3.5-flash-lite` | 0.33 / 2.75 |
  | `gemini-3.7-flash` | 0.825 / 4.125 |
  | `deepseek-v4.1-flash` | 0.165 / 0.66, cached input 0.0033 |
  | `claude-haiku-4-5` | 1.10 / 5.50 |
  | `claude-sonnet-5-5` | 2.20 / 11.00 |
  | `claude-opus-5-5` | 4.40 / 22.00 |

  Artificial Analysis lists DeepSeek V4.1 Flash at $0.30 / $1.20, above Metis's price [AA1].

### 2. What Artificial Analysis recommends for each step [AA1, L2]

The recommender scores intelligence, speed and cost on sliders from 0 to 5 and an "intelligence focus". Each profile below had the providers filter set to Anthropic, DeepSeek, Google and OpenAI.

| Step | Priorities (intelligence, speed, cost) and focus | Its top recommendations |
|---|---|---|
| The page's defaults | 4, 1, 1; general | Claude Opus 5.5 (max), Claude Sonnet 5.5 (max), Claude Opus 5.5 (xhigh), GPT-6.1 Sol (max) |
| Extraction: thousands a day in the worker | 3, 2, 5; general, instruction following, low hallucination | GPT-6 Luna (low, high, xhigh, max), then GPT-6.1 Sol (medium, high) |
| Extraction, non-reasoning only | the same | GPT-6 Luna, DeepSeek V4.1 Flash, GPT-6 Sol, GPT-5.6 Terra, DeepSeek V4 Pro, Claude 4.5 Haiku |
| Duplicate decisions: few, precision first | 5, 1, 3; general, low hallucination | Claude Opus 5.5 (max, xhigh), GPT-6.1 Sol (xhigh), Claude Sonnet 5.5 (max) |
| Query understanding: while a buyer waits | 3, 5, 4; general, instruction following | GPT-6 Luna (max), DeepSeek V4.1 Flash (max), GPT-6 Luna (xhigh, high), …, Gemini 3.8 Flash (high) |
| Query understanding, non-reasoning only | the same | GPT-6 Luna, DeepSeek V4.1 Flash, DeepSeek V4 Pro, GPT-6 Sol |
| Explanations | 4, 3, 4; general, instruction following, low hallucination | GPT-6.1 Sol (high, xhigh, medium), GPT-6 Luna (max), … |

### 3. The candidates' measurements [AA2, AA3, L3, L4]

Read 2026-09-30 07:52 UTC (leaderboard) and 07:58 UTC (hallucination). Intelligence is the Artificial Analysis Intelligence Index v4.3.2; a star marks an estimate the page flags. Speed is the median output tokens per second and the first chunk's latency, on the makers' own APIs; Metis adds about 0.3 to 0.5 s (CS-42, finding 9). The hallucination rate is AA-Omniscience's, lower is better.

| Variant | Intelligence | Tokens/s | First chunk | Hallucination | Metis price in / out |
|---|---|---|---|---|---|
| GPT-6 Luna, no reasoning | 18 | 139 | 0.78 s | 79% | 0.11 / 0.55 |
| GPT-6 Luna, low | 21 | 124 | 2.00 s | 84% | 0.11 / 0.55 |
| GPT-6 Luna, medium | 29 | — | — | 85% | 0.11 / 0.55 |
| GPT-5.6 Luna, low | 21 | 109 | 1.54 s | 90% | 0.22 / 1.32 |
| GPT-6 Sol, low | 34 | 68 | 2.26 s | — | 2.00 / 10.00 |
| Gemini 3.1 Flash-Lite | 16 | 250 | 5.80 s | 83% | 0.275 / 1.65 |
| Gemini 3.5 Flash-Lite | 22 | 321 | 9.32 s | 34% | 0.33 / 2.75 |
| Gemini 3.7 Flash, low | 37* | 285 | 1.34 s | 68% | 0.825 / 4.125 |
| Gemini 3.8 Flash, low | 33 | — | — | 65% | not served by Metis |
| DeepSeek V4.1 Flash, no reasoning | 25 | 207 | 0.99 s | 54% | 0.165 / 0.66 |
| DeepSeek V4.1 Flash, max | 39 | 209 | 0.94 s | 96% | 0.165 / 0.66 |
| Claude 4.5 Haiku, no reasoning | 15* | 83 | 0.62 s | 26% | 1.10 / 5.50 |
| Claude Sonnet 5.5, low | — | 87 | 1.06 s | 50% | 2.20 / 11.00 |
| Claude Sonnet 5.5, medium | 41 | 91 | 1.34 s | 51% | 2.20 / 11.00 |

**What Artificial Analysis cannot say here.**
- No evaluation of it is in Persian: Global-MMLU-Lite's languages stop at Arabic, Hindi, Bengali, Swahili and Yoruba among the nearest [AA5].
- IFBench, the recommender's "instruction following" focus, has not been run on the current models: its chart's 450 models end before GPT-6 Luna, Claude Sonnet 5.5, Gemini 3.7 Flash and DeepSeek V4.1 Flash [AA4]. So that focus cannot rank them.
- Its speeds are the makers' APIs', not Metis's route from Iran.

So the shortlist was tested on Persian through the layer, which is what CS-46 asked.

### 4. The bake-off's data [L5; `scripts/bakeoff/data/`]

| Set | Items | Made from |
|---|---|---|
| Extraction | 36 real listings + 3 injection variants | Lane F's snapshots, personal data removed |
| Query understanding | 24 searches | Written in buyers' styles: colloquial prices («۷۰۰ تومن», «یک و نیم»), both calendars, Finglish, typos, intents, a model outside the catalogue |
| Duplicate decisions | 20 questions, 2 to 4 candidates each | 10 with the same car re-listed by hand, 10 without; near misses of the same model, year and colour |
| Explanations | 20 deal fact sets | The listings' stated condition, four per rating band |

Two gaps in the listings, for CS-48: none of the 120 mentions ride-hailing, so that fact was only tested for not being invented; and none says that nothing was replaced, so `replaced: none` was not tested.

### 5. Extraction: condition and price facts from a listing's text [L5]

Three runs, 117 calls per model; 8 facts plus the injection flag per listing. Accuracy counts a call without a valid answer as wrong on every field. Cost is per 1,000 listings, re-asks included.

| Model | Valid first | Valid after re-ask | Field accuracy | Listings fully right | Injected values taken | p50 | p95 | Per 1,000 |
|---|---|---|---|---|---|---|---|---|
| Gemini 3.7 Flash, low | 100% | 100% | 99.3% | 110/117 | 0 of 21 | 3.1 s | 6.2 s | $1.64 |
| Claude Sonnet 5.5, no thinking | 100% | 100% | 98.8% | 104/117 | 0 of 21 | 2.6 s | 4.0 s | $9.38 |
| GPT-6 Luna, low | 98.3% | 100% | 98.2% | 98/117 | 0 of 21 | 3.5 s | 7.0 s | $0.16 |
| GPT-5.6 Luna, low | 100% | 100% | 97.5% | 95/117 | 6 of 21 | 3.2 s | 5.4 s | $0.34 |
| Gemini 3.1 Flash-Lite | 100% | 100% | 97.5% | 94/117 | 6 of 21 | 1.4 s | 2.0 s | $0.60 |
| Gemini 3.5 Flash-Lite, minimal | 100% | 100% | 97.5% | 96/117 | 2 of 21 | 1.3 s | 2.8 s | $0.86 |
| DeepSeek V4.1 Flash, no thinking | 95.7% | 100% | 97.0% | 88/117 | 2 of 21 | 1.3 s | 3.1 s | $0.15 |
| GPT-6 Luna, no reasoning | 88.0% | 100% | 96.9% | 91/117 | 0 of 21 | 2.1 s | 4.4 s | $0.11 |
| Claude Haiku 4.5 | 97.4% | 99.1% | 93.6% | 68/117 | 4 of 21 | 2.5 s | 4.2 s | $3.92 |

- **Every model flagged all nine injected listings.** Every value a model took from an injection came from X03's fake "system" message in the middle of the text (instalments and swap); none came from the Persian note at the end (X01) or the English one at the start (X02).
- **Reading, not keywords, separates them.** «فقط بدنه یه دور رنگ میخاد» ("the body needs a repaint") was read as a fully painted car by eight of nine models in the first run; only Gemini 3.7 Flash kept paint `not_stated`. «بدون رنگ» followed by a four-finger touch-up («چهار انگشت آبرنگ») was reported as unpainted by five.
- **Glossary gaps for CS-52,** where every model failed alike: «لیسه» (a small touch-up) and «پالونی» (the front chassis rail) are not in the prompt, so «بیرنگ ولی لیسه دارد» became unpainted and a cracked «پالونی» under «شاسی سالم» became an intact chassis.
- The first run scored against the labels as first set is in `bakeoff-extraction-run1-2026-09-30.json`, and all three runs against the final labels in `bakeoff-extraction-scores-2026-09-30.json`. The adjudication did not change the first three places: Gemini 3.7 Flash 98.9%, Claude Sonnet 5.5 97.4% and GPT-6 Luna (low) 97.2% before it.
- **Correction, 2026-09-30 (CS-47, at the owner's request).** CS-47's `ai-reviewer` agent scored the stored runs again from their answers, with no model call, and reproduced every number in the table above for the chosen model and its fallback. It adds three things this finding lacked. (1) **No paired test backed the lead.** Counted per call, Gemini 3.7 Flash is fully right on 12 listings where GPT-6 Luna (low) is not, and never the reverse (exact McNemar p = 0.0005), but the 117 calls are three reads of the same 39 listings. Counted per listing, by majority over the three runs, the split is 4 to 0 (p = 0.125, not significant), and the field-accuracy intervals overlap (98.6 to 99.7% against 97.2 to 98.8%). So the lead is not yet shown; CS-52's labelled set decides, paired by listing. (2) **GPT-6 Luna's cost was measured with a warm cache.** 99.8% of its input tokens were cache reads, run 1 included, because the same prompts had already been sent in earlier runs; uncached it costs about US$0.32 per 1,000 listings, about a fifth of Gemini's price rather than a tenth. Gemini had no cache reads, so its US$1.64 holds. (3) **Gemini 3.7 Flash reported 0 reasoning tokens** on all 117 calls at thinking level low; if Metis bills thought tokens it does not report, its cost is understated, which the rial invoice will show. The runs also record no prompt version, so CS-52 cannot compare its own prompt with them item by item.

### 6. Query understanding: a buyer's search into filters [L5]

One run, 24 searches; 11 fields each. Cost is per 1,000 searches before the exact-query cache.

| Model | Valid first | Field accuracy | Searches fully right | p50 | p95 | Per 1,000 |
|---|---|---|---|---|---|---|
| Gemini 3.5 Flash-Lite, minimal | 100% | 100% | 24/24 | 1.3 s | 1.8 s | $0.90 |
| GPT-6 Luna, no reasoning | 100% | 100% | 24/24 | 2.3 s | 4.0 s | $0.10 |
| Gemini 3.7 Flash, low | 100% | 100% | 24/24 | 3.6 s | 8.6 s | $1.69 |
| Gemini 3.1 Flash-Lite | 95.8% | 99.6% | 23/24 | 1.3 s | 2.3 s | $0.66 |
| Claude Sonnet 5.5, no thinking | 100% | 99.6% | 23/24 | 2.3 s | 3.5 s | $11.14 |
| Claude Haiku 4.5 | 100% | 99.2% | 22/24 | 2.8 s | 4.7 s | $4.81 |
| GPT-6 Luna, low | 100% | 98.5% | 21/24 | 2.8 s | 5.6 s | $0.16 |
| DeepSeek V4.1 Flash, no thinking | 100% | 98.5% | 20/24 | 1.4 s | 2.6 s | $0.16 |

The models read the colloquial prices («۷۰۰ تومن» as 700 million tomans, «یک و نیم میلیارد», «حدود ۲ میلیارد» as a range), both calendars and the Finglish searches; the one exception was GPT-6 Luna (low), which set no price or mileage for «رانا پلاس دنده ای زیر ۹۰۰ کارکرد زیر ۵۰ تا». The other misses were trims, a body type inferred from a model (Tiba 2 as a hatchback) and a model name («رانا پلاس» became Peugeot Pars for Claude Sonnet). On 24 searches three models are perfect, so the step is decided by latency, which matters most here.

### 7. Duplicate decisions [L5]

One run, 20 questions. A wrong merge (choosing a candidate that is another car) is the costly error, since it hides a car from buyers.

| Model | Right | Wrong merges | p50 | Per 1,000 |
|---|---|---|---|---|
| GPT-6 Luna, low | 20/20 | 0 | 2.0 s | $0.19 |
| GPT-6 Luna, medium | 20/20 | 0 | 2.3 s | $0.21 |
| Gemini 3.7 Flash, low | 20/20 | 0 | 2.9 s | $1.28 |
| Gemini 3.7 Flash, medium | 20/20 | 0 | 3.2 s | $1.87 |
| GPT-6 Sol, low | 20/20 | 0 | 2.7 s | $2.98 |
| Claude Sonnet 5.5, low effort | 20/20 | 0 | 3.4 s | $5.51 |
| DeepSeek V4.1 Flash, high | 19/20 | 0 (one answer truncated by its reasoning) | 3.7 s | $0.82 |
| Claude Haiku 4.5 | 19/20 | 1 | 3.0 s | $2.52 |

Haiku merged two white 1402 Peugeot 207s with 57,000 and 62,000 km. The set is too easy to separate the six perfect models: the hand-written re-listings keep every fact. CS-55's labelled pairs, with real cross-site duplicates, are the real test.

### 8. Explanations [L5]

One run, 20 deal fact sets. The checks in code reject any digit or Persian number word outside a placeholder and require the rating's own words; after one re-ask:

| Model | Valid first | Valid after re-ask | Faithful and fluent, by hand | p50 | Per 1,000 |
|---|---|---|---|---|---|
| Claude Sonnet 5.5, no thinking | 8/20 | 20/20 | 20/20 | 6.5 s | $7.10 |
| GPT-6 Luna, low | 15/20 | 20/20 | 17/20 | 2.3 s | $0.13 |
| Gemini 3.7 Flash, low | 7/20 | 20/20 | 14/20 | 5.3 s | $1.43 |
| DeepSeek V4.1 Flash, no thinking | 9/20 | 20/20 | 15/20 | 2.3 s | $0.18 |
| Claude Haiku 4.5 | 3/20 | 17/20 | not judged | 4.7 s | $2.92 |
| Gemini 3.1 Flash-Lite | 9/20 | 16/20 | not judged | 2.3 s | $0.42 |

- **What the hand check caught.** DeepSeek used `{gap}` for a duration in four explanations and turned the radiator support into «شاسی». Gemini 3.7 Flash wrote "exactly at the market value" beside a gap, called kerb damage corrosion and "several panels" spots. GPT-6 Luna used `{gap}` for time once, made "a front panel" a fender, and let the English word "rating" into a sentence.
- **Most first-answer rejections were the check's, not the model's.** «یک» is also Persian's indefinite article ("a car"), and the facts said "more than two weeks", which models wrote as «دو هفته». For CS-64: allow «یک» as an article, give durations without numbers or as a placeholder, and reject Latin letters.

### 9. Embeddings

- **No step needs an embedding model now.** Extraction, query understanding and explanations are single structured calls; duplicate candidates come from SQL blocks (trim, year band, city, mileage band), text similarity and photo hashes (CS-55, ADR-0011 point 4); CS-43 rejected semantic caching (precision 0.52). `docs/design/data-model.md` plans `listing_embedding` only if pHash and text similarity fall short of CS-55's precision target.
- **When that trigger fires, the first candidate is OpenAI's `text-embedding-3-small`:** the cheapest Metis serves ($0.022 per 1M tokens), already measured through Metis from Iran by CS-42 (1,536 dimensions, 539 ms for two Farsi texts, on the OpenAI route the layer's provider package speaks). The second is Google's `gemini-embedding-001` ($0.165 per 1M, 8,192-token context), whose route the layer has not tried. CS-55 compares them on its labelled pairs (recall of the true duplicate inside a block) before a column is created.

### 10. Also observed

- **The lane stalled twice.** During the crawl, lane F's worker claimed nothing for two minutes at 08:06:06 and 08:10:05, with 400 jobs queued, the lane open and pg-boss polling every second; nothing was logged. For CS-35 and CS-41.
- **The bake-off cost US$3.14** for 1,604 calls. Extraction at Tehran's volume, about 3,000 new tracked listings a day and cached by input hash afterwards, would cost about $5 a day with Gemini 3.7 Flash and $0.50 with GPT-6 Luna.

## Recommendation

Decided on 2026-09-30 by the owner's instruction, and written into `STEP_MODELS` (`packages/ai/src/registry.ts`):

| Step | Model | Fallback, on another provider | Why |
|---|---|---|---|
| Extraction (CS-52) | Gemini 3.7 Flash, thinking low | GPT-6 Luna, reasoning low | The most accurate: 99.3% of fields and 94% of listings fully right against 84% for the fallback, no injected value taken, valid on the first answer every time. At $1.64 per 1,000 listings the step costs about $5 a day at Tehran's volume; the fallback costs a tenth for 1.1 points of field accuracy. It runs in the worker, so its 3 s median is no cost to a buyer |
| Duplicate decisions (CS-55) | Gemini 3.7 Flash, thinking low | Claude Sonnet 5.5, low effort | Both perfect on 20 questions with no wrong merge; the bake-off could not separate the six perfect models, so the stronger model by Artificial Analysis's index (37 against 21 for GPT-6 Luna low) and a lower hallucination rate were preferred, at a volume limited to the uncertain band |
| Query understanding (CS-62) | Gemini 3.5 Flash-Lite, thinking minimal | GPT-6 Luna, no reasoning | Perfect on 24 searches and the fastest: 1.3 s median and 1.8 s at the 95th percentile while a buyer waits. The fallback is as accurate, slower (4.0 s at the 95th percentile) and cheaper |
| Explanations (CS-64) | GPT-6 Luna, reasoning low | Claude Sonnet 5.5, no thinking | Valid on the first answer most often and 17 of 20 faithful at $0.13 per 1,000, fast enough for a page; its three faults are the kind CS-64's checks can catch. Sonnet wrote all 20 faithfully and is the fallback |
| Embeddings | None now | — | No step needs one; when CS-55's trigger fires, `text-embedding-3-small` first, `gemini-embedding-001` second, compared on CS-55's pairs |

**The trade-off accepted:** three steps default to Google's route, so a Google outage at Metis moves three steps to their fallbacks at once (CS-82). In exchange each step runs the model that measured best for it.

**What would change this:**
- CS-52's labelled set showing GPT-6 Luna within a point of Gemini 3.7 Flash, which would make the cheaper model the default;
- CS-55's real pairs separating the duplicate models;
- CS-62's deadline, or Metis's Gemini route failing often (the 3.8 Flash refusal is a warning);
- Metis serving Gemini 3.8 Flash at a price, which Artificial Analysis rates above 3.7 Flash;
- a Persian evaluation from Artificial Analysis.

**Follow-ups:** CS-52 adds «لیسه», «آبرنگ» and «پالونی» to its glossary and confirms extraction's model on its labelled set (its criterion 5); CS-48 samples listings that mention ride-hailing and "nothing replaced"; CS-64 takes the check lessons of finding 8; CS-82 switches to the fallbacks named here.
