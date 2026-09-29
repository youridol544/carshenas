# Metis AI lab (CS-42)

These scripts produced the measured findings in `../../2026-09-29-metis-ai.md`:

- what Metis serves now, according to its own listing endpoints, compared with the catalogue it publishes;
- whether each route returns output that is valid against a JSON Schema, with the latency, tokens and list-price cost of every call;
- whether the providers' official SDKs work against Metis when only the base URL and the key change.

Rerun them when a model is chosen for each AI step (CS-46), when Metis changes its routes or prices, and once before the demo.

## Run

```bash
cd docs/research/2026-09-29-metis-ai/lab
npm install --no-package-lock   # the versions pinned in package.json; node_modules/ is ignored by git
node catalogue.mjs              # GET requests only, not billed
node probe.mjs                  # RUNS=2 by default; ONLY=openai,jev runs some targets only
node sdk-check.mjs
```

The key is `METIS_API_KEY` in the repository's `.env`, which git ignores. The scripts load it from there and never print it or write it to a file.

Run the lab from an Iranian network. The note's reachability section says how that was established.

Each run writes `results-*.json` into this folder, and git ignores those files. The note quotes three runs, and those are copied into `../evidence/`. A full probe cost US$0.044 at Metis's list prices on 2026-09-29, for 36 priced calls. Six more calls went to a model that Metis's catalogue does not price.

## Files

| File | What it is |
|---|---|
| `listing.mjs` | The extraction every probe asks for. It holds the zod schema and the JSON Schema that the providers receive (with numeric bounds removed), the versioned system prompt, and three synthetic listings with their expected facts. The third listing carries an instruction aimed at the model. The file also holds the same listings as jev questions, and the checks used on the answers. |
| `lib.mjs` | Shared helpers: the key from `.env`, timed requests that record only the answer's status, time and chosen headers, list prices from `www.metisai.ir/models.json`, and result files. |
| `catalogue.mjs` | The live model lists: `/openai/v1/models`, `/api/v1/meta`, `/anthropic/v1/models`, `/v1beta/models` and `/deepseek/v1/models`. |
| `probe.mjs` | The structured-output call on every route, one call at a time. It validates each answer with zod and records latency, tokens, cost at list price, the answering model and rate-limit headers. When a route refuses `json_schema`, the probe records the refusal and retries with the route's JSON mode or with the schema in the prompt. It also calls TypeSafe's jev, both embedding endpoints and three error cases. |
| `sdk-check.mjs` | One structured call each through `openai`, `@anthropic-ai/sdk` (with `apiKey` and with `authToken`) and `@google/genai`, using Metis's base URLs. |
