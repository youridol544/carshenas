# Cost, caching and latency

Sources: CS-43's note (section 7, patterns 8 to 10) and its appendix `injection-cost.md` (B.1 to B.7); the Metis note (`docs/research/2026-09-29-metis-ai.md`, findings 6 and 9); CS-46's measurements (`docs/research/2026-09-30-model-per-ai-step.md`); ADR-0019 point 3 and ADR-0021 point 2.5; `packages/ai/src/pricing.ts`.

## What a call costs

- **Price it at Metis's live list**, not its published catalogue: `GET https://api.metisai.ir/api/v1/meta/providers/pricing` (no key) lists about 1.1 times the makers' prices, while `models.json` lagged it (gpt-5.6-luna at less than half its live price on 2026-09-29). The layer's `createMetisPriceBook` loads it at start and daily; an unpriced model logs a null cost, never a guess. Which price Metis bills is checked against the rial invoice each month.
- **The model family moves cost more than the price list shows.** Persian costs 1.06 to 2.58 times its English tokens depending on the tokenizer (`references/prompting.md`), so compare models per listing, not per million tokens.
- **Output and reasoning tokens drive both cost and time**: 30 to 92% of each measured call's cost. Cutting output cuts latency far more than cutting the prompt. A reasoning setting is chosen on the labelled set (CS-46 measured each step's) and the output budget leaves room for it.
- **What the steps cost today** (CS-46, per 1,000 calls at list prices, re-asks included): extraction on Gemini 3.7 Flash US$1.64 (its fallback GPT-6 Luna US$0.16), query understanding on Gemini 3.5 Flash-Lite US$0.90, explanations on GPT-6 Luna US$0.13. About 3,000 new tracked listings a day come to about US$5 a day for extraction, and cached by input hash after that.

## Caching

Two different caches, both keyed exactly:

- **The answer cache** (`ai_answer`, ADR-0021 point 2.4): the SHA-256 of the task, the prompt version, the model with its options and the rendered input. A hit makes no request and costs nothing; only validated answers are stored. No semantic cache: its precision was 0.52 in its recommended setup (M), and «زیر ۷۰۰» and «زیر ۸۰۰» must not share an answer. Normalise text before `render`, so text that differs only in invisible marks or digit scripts is one question.
- **The providers' prompt caches**, for the stable prefix. They need a byte-identical prefix (the schema, the effort setting and any tools are part of it) above a minimum: 1,024 tokens for GPT-5.6 and Sonnet 5, 4,096 for Claude Haiku 4.5; Gemini 3.1 Flash-Lite lists no minimum and no cached rate at Metis; DeepSeek caches on its own. Metis's own `cache` body parameter is refused by OpenAI, Anthropic and Gemini; each provider's own mechanism passes through with its usage fields (the Metis note, finding 9). Set `promptCache: '5m'` or `'1h'` on a task only when its prefix passes the family's minimum: the layer then puts `cache_control` on Claude's instructions and a prompt cache key on OpenAI's request.
- **A longer, useful, cached prefix can cost less than a short one.** At gpt-5.6-luna's live prices, per 1,000 calls: a 700-token uncached prompt US$0.28, a 1,450-token one US$0.44, the same 1,450 tokens with a cached 1,200-token prefix US$0.20. So grow the prefix past the minimum only with content the evaluation shows is useful, such as the glossary and examples. Carshenas's English rules plus the glossary come to about 1,900 to 2,400 tokens by family: above GPT-5.6's minimum, below Haiku 4.5's.

## Batch, and the request path

- **Batch halves the cost** at OpenAI, Anthropic and Gemini, and DeepSeek halves its price off-peak; through Metis, batch works on OpenAI's route only (measured 2026-09-29). Use it for backfills (the first extraction of a crawl, re-extraction after a prompt or model change), never for CS-62 or CS-65. Choose the model and the reasoning setting first: the model moved cost about eight times (Claude Haiku 4.5 against gpt-5.6-luna) and reasoning about three (an estimate for DeepSeek, on against off).
- **A buyer waiting** (CS-62's search, CS-65's pasted link in 5 seconds): a small model with no or minimal reasoning and a capped output; independent work in parallel (fetch, parse, then the database's valuation beside the model's extraction); a second, hedged request to another provider after the measured 95th percentile, which costs about 5% more calls, taking the first valid answer; and a deadline after which the step answers without the model (the filters, the code-derived rating with «هنوز بررسی نشده»). The layer makes one attempt within `timeoutMs` on the web path.

## The per-call line and the run report (pattern 10)

Each call writes one `model call completed` line (`info`, or `warn` for anything but ok): `task`, `promptVersion`, `provider`, `model`, `answeringModel`, `requestId`, `outcome`, `cached`, `attempts`, `latencyMs`, `inputTokens` (uncached), `cacheReadTokens`, `cacheWriteTokens`, `outputTokens` (reasoning included), `reasoningTokens`, `costUsd`, and `problemPaths` or `errorReason` with `status`. Never the prompt, the input, the answer or a problem's message, which quotes the listing. `answeringModel` different from `model` means Metis routed the request to another model.

A run's report sums the lines per task, prompt version and model: calls, calls answered from the cache, requests (first answers and re-asks), outcomes, tokens by price, the share of input read from the provider's cache, cost, cost per 1,000 calls and per 1,000 listings, latency at the median and the 95th percentile. Next to accuracy and attack success, always: a cost without its accuracy, or an accuracy without its cost, is half an answer (Kapoor et al., M). From production logs (`docs/runbooks/logs-and-errors.md` has `logs()`):

```bash
logs | jq -R -s -c '[split("\n")[] | fromjson? // empty | select(.msg == "model call completed")]
  | group_by([.task, .promptVersion, .provider, .model])[]
  | {task: .[0].task, promptVersion: .[0].promptVersion, model: "\(.[0].provider)/\(.[0].model)",
     calls: length, cached: (map(select(.cached)) | length), requests: (map(.attempts) | add),
     outcomes: (group_by(.outcome) | map({(.[0].outcome): length}) | add),
     tokensIn: (map(.inputTokens + .cacheReadTokens + .cacheWriteTokens) | add), tokensOut: (map(.outputTokens) | add),
     costUsd: (if any(.[]; .costUsd == null) then null else (map(.costUsd) | add) end)}'
```

## Worked example 5: a cost report

`packages/ai/src/examples/cost-report.ts` and `cost-report.test.ts`: four calls through the layer with the process's real JSON logger (L1 answered, L1 again from the cache, L3 re-asked once, L2 invalid after its re-ask) give one row: 4 calls, 1 from the cache, 5 requests, ok 3 and invalid 1, 1,565 tokens in and 830 out, US$0.004714875 at Gemini 3.7 Flash's list price, US$1.18 per 1,000 calls. No line holds the listing or the answer. The jq recipe above was checked on the layer's lines for the same task on 2026-09-30.
