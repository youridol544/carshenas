# Evidence

What was measured, where it is kept, and the command that measures it again. Every figure the README or the submission quotes links to a file here or to a command (`docs/submission/numbers.md` lists them one by one).

One folder per topic, dated files or dated subfolders inside. A report says what data and which commit it was measured on, what it does not show, and what it cost. A figure is never edited by hand: the report is rerun, or a new dated one is added beside the old. Nothing here holds a listing's text, a seller's name or a phone number: sources' content never goes into the repository (ADR-0017 point 7), only counts, ids, redacted fixtures and the words of the labelled sets.

| Folder | What it holds | Task | Measure again |
|---|---|---|---|
| [`valuation/`](valuation/) | The accuracy of market values: median error and the share within 10 %, by model, on a split by posting date and on a random split | CS-51 | `pnpm valuation:evaluate --as-of <date> --cut-days 7 --write` |
| [`listing-facts/`](listing-facts/) | Reading a listing's text into facts with a model: the report (accuracy by field with intervals, injected listings, cost per 1,000, latency), the saved run of every answer, and the measurement of mileage typed in thousands | CS-52, CS-101 | `pnpm --filter @carshenas/ai listing-facts:evaluate --score ../../docs/evidence/listing-facts/2026-09-30/run-571b413f827bf546.json` scores the saved answers again at no cost; `pnpm mileage:measure` |
| [`listing-page/`](listing-page/) | Whether the explanation's sentences match the stored facts (30 listings), and the query plans of the listing page | CS-64 | `EXPLANATION_SAMPLE=<report path> pnpm --filter @carshenas/web exec vitest run --config vitest.db.config.mts listing-explanation-sample` |
| [`query-understanding/`](query-understanding/) | Plain-Farsi search against labelled sentences, one folder per round: the report, the runs, the answers, the screenshots | CS-62, CS-99, CS-103, CS-111 | `pnpm --filter @carshenas/ai query-understanding:code-only` (free, offline); `query-understanding:evaluate --score <run>` scores a saved run again |
| [`search-api/`](search-api/) | The search table's query plans at 3,000, 25,000 and 100,000 listings, the load test, HOT updates, the typo fallback | CS-59 | `search-api/2026-10-02/README.md` has the steps |
| [`search-filters/`](search-filters/) | The plans of the catalogue queries | CS-58 | the file's own header |
| [`paste-link/`](paste-link/) | The plans of the pasted-link lookups | CS-65 | the file's own header |
| [`paste-link-coverage/`](paste-link-coverage/) | The car read from a link's title, on 6,802 real titles | CS-115 | the folder's own files |
| [`crawl-requests/`](crawl-requests/) | The plans of the crawl-request queues | CS-71 | `crawl-requests/2026-10-03/explain.sql` |
| [`range-filters/`](range-filters/) | Phone and desktop screenshots of the typed range filters | CS-102 | the browser spec `e2e/tests/app/range-filters.spec.ts` |
| [`copy/`](copy/) | The copy lint's baseline: what it found in the product's strings before the rewrite | CS-105 | `pnpm copy:lint --all --report docs/evidence/copy/lint-baseline.md` |

## Not here yet

- **CS-48**, the labelled evaluation set and its one-command harness for the parser and the model: its reports will sit in `listing-facts/` or a folder of their own, and `docs/submission/numbers.md` (`TODO-04`) changes to quote them.
- **CS-118**, latency of the pages at 100,000 listings: a folder `performance/` (`TODO-05`).
- **CS-73** and **CS-74**, ratings against what the market did next, and against published price tables: not done, and the README says so.
