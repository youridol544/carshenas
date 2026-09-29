# AI layer lab (CS-44)

These scripts produced the measured findings in `../../2026-09-29-ai-layer-library.md`:

- what the AI SDK's provider packages put on the wire to Metis's native routes, and how each reports a refusal, a truncated answer and an empty answer (`wire.ts`, no network, no key);
- whether each route returns output that passes the schema and the grounding checks through the AI SDK, with the answering model, tokens, latency and cost at Metis's live prices, and whether Metis serves OpenAI's Responses API (`live.ts`);
- the CS-44 spike: a Metis model through the AI SDK, and a validation failure fed back to the model and corrected, with no network (`reask.test.ts`) and live (`spike.ts`);
- what the AI SDK's OpenTelemetry integration records, and how to keep listing text out of the spans (`telemetry.test.ts`).

Rerun them when the AI SDK moves to a new major version, when Metis changes its routes, and when CS-45 builds the layer.

## Run

```bash
cd docs/research/2026-09-29-ai-layer-library/lab
npm install --no-package-lock   # the versions pinned in package.json; node_modules/ is ignored by git
npm test                        # reask.test.ts and telemetry.test.ts: no network, no key
npm run typecheck               # the repository's TypeScript settings (tsconfig.json copies packages/db's)
npm run wire                    # no network, no key
npm run live                    # 13 calls to Metis: US$0.0054 for the 12 priced ones on 2026-09-29
npm run spike                   # 10 calls to Metis: US$0.0073 on 2026-09-29
```

The key is `METIS_API_KEY` in the repository's `.env`, which git ignores. `results.ts` loads it from there; the SDK puts it only in request headers, and no script prints it or writes it to a file (`summariseRequest` in `providers.ts` records which header carried the key, never its value).

Run `live` and `spike` from an Iranian network; the CS-42 note's reachability section says how that was established.

Each run writes `results-*.json` into this folder, and git ignores those files. The runs the note quotes are copied into `../evidence/`:

| Evidence | Run | What changed since |
|---|---|---|
| `wire-2026-09-29.json` | `npm run wire`, 16:53 UTC | nothing |
| `live-first-run-2026-09-29.json` | `npm run live`, 16:49 UTC | Its gpt-5.6-luna costs are null: Metis prices that model in tiers by context length, which `pricing.ts` learned before the second run. It also predates the network watch |
| `live-2026-09-29.json` | `npm run live`, 16:54 UTC | nothing |
| `spike-2026-09-29.json` | `npm run spike`, 16:51 UTC | nothing |
| `tests-2026-09-29.txt` | `npm test` and `npm run typecheck` | nothing |

## Files

| File | What it is |
|---|---|
| `listing.ts` | The task every script asks for: the zod schema in CS-43's portable profile (every field required, evidence before value, `not_stated` as an enum value), the instructions, the three synthetic listings of CS-42's lab (`samples.json`, copied byte for byte) with their expected facts, and the grounding check in code. |
| `reask.ts` | The spike of CS-45's core: `generateChecked` calls `generateText` with `Output.object`, runs the checks in code, feeds a failure back with each problem named (at most `maxReasks` times, with a fixed context, stopping when an answer repeats), and returns a typed outcome: ok, invalid, refusal, truncated or empty. Provider errors are thrown for the queue to retry. |
| `providers.ts` | The AI SDK's OpenAI (Chat Completions), Anthropic, Google and DeepSeek providers pointed at Metis's native routes, and `summariseRequest`, which records a request without its key or text. |
| `pricing.ts` | Metis's live prices (`/api/v1/meta/providers/pricing`, no key needed), including tiered prices, and the cost of a call's attempts from the SDK's token usage. |
| `netwatch.ts` | Records every HTTP request the process starts, through Node's diagnostics channels, so the wire check can show that the SDK made none of its own. |
| `results.ts` | Result files and the key. |
| `wire.ts`, `live.ts`, `spike.ts` | The runs above. |
| `reask.test.ts`, `telemetry.test.ts` | `node:test` tests with the AI SDK's `MockLanguageModelV4`. |
