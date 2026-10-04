# The numbers the video and the notes quote

Every figure the demo script (`demo-script.md`), the notes (`notes.md`) and the README say aloud or in print, each with the command that regenerates it and the file it comes from. On the recording day, run the commands again and say what they print, so the video matches the repository.

- **Measured on 2026-10-04** on main's database (the live index) unless a row says another date. Rows marked **varies** change by the hour: read them off the screen on the day. Rows marked **frozen** come from a committed report and do not change until someone reruns it.
- Database commands run from the main checkout as `pnpm db:psql -c "<sql>"` (a read-only session, `docs/runbooks/local-database.md`). Commands for a deployed database read the same tables.
- A figure with a `TODO-nn` marker waits for another task; `open-items.md` says which and what replaces it.
- Intervals are 95 % Wilson intervals as the reports print them.

## The index and its freshness (varies)

| # | Quoted as | Value | Regenerate | Comes from |
|---|---|---|---|---|
| N01 | Active Tehran car listings on the market | 26,231 (the page, 13:12 Tehran); 26,228 (SQL, 09:39 UTC) | open `/status`, figure «آگهی فعال»; or `pnpm db:psql -c "select count(*) from listing where status = 'active'"` | `listing`; the page's loader `apps/web/src/features/data-status/server/data-status-queries.ts` |
| N02 | New listings in the last 24 hours | 1,133 | `/status`, «آگهی تازه» | the same loader |
| N03 | Listings that left the market in the last 24 hours | 14 | `/status`, «رفته از بازار» | the same loader |
| N04 | Listings a buyer can search (details read, seen in the last 48 hours) | 4,236 | `pnpm db:psql -c "select count(*) from search_document"`; the home page shows it as «آگهی قابل‌جست‌وجو» | `search_document` (ADR-0028) |
| N05 | Median time from posting to storing, against a one-hour target | 3 hours; the target is **not met** and the page says so (`«هنوز نه»`) | `/status`, «تعهدهای تازگی» | `freshness_measurement`, hourly; ADR-0017 point 6 |
| N06 | Median age of the last check of a listing in the results | 8 hours; the target is under a day | `/status` | the same |
| N07 | The crawl's daily cap | 12,000 requests a day, one at a time, at least 3 seconds apart | `/status`, source card «سقف درخواست روزانه»; `pnpm db:psql -c "select daily_request_budget from source"` | `source`; ADR-0008 point 5, ADR-0018 |
| N08 | Models read in depth | 10 tracked models | `pnpm db:psql -c "select count(*) from tracked_model"` | `tracked_model` (ADR-0037) |
| N09 | Price changes seen since the index began | 30,210 events since 2026-09-30, among them 807 price drops in the last five days on 769 listings | `pnpm db:psql -c "select count(*) from listing_price_event"` | `listing_price_event` |
| N10 | Listings matched to a catalogue model | 26,242 of 26,254 active (99.95 %), 23,812 of them to a trim; the other 12 stay explicitly unmatched. This is coverage, not a measured accuracy | `pnpm db:psql -c "select coalesce(catalogue_match, 'none'), count(*) from listing where status = 'active' group by 1"` | `listing.catalogue_match` (CS-50) |

## Market values and ratings

| # | Quoted as | Value | Regenerate | Comes from |
|---|---|---|---|---|
| N11 | Listings valued, rated, and comparables behind them (varies) | 5,728 valued, 4,148 rated, 4,458 comparables, run 479 for 2026-10-04 | `/status`, section «ارزش بازار»; or `pnpm db:psql -c "select as_of_date, valued_count, rated_count, comparable_count from valuation_run where status = 'succeeded' order by as_of_date desc limit 1"` | `valuation_run` |
| N12 | Market-value error by model (varies) | median error 4 % to 8 % by model: 4 % for Quick manual, Peugeot 207i and Dena Plus, 5 % for Pars and 206, 6 % for Corolla, Pride 131, Samand LX and Soren, 8 % for 405 | `/status`, «دقت ارزش بازار، مدل به مدل» | `valuation_segment`: each comparable valued once without itself |
| N13 | Median error on listings posted after a cut, learned only from before it (**frozen**) | 6.77 % over 306 listings, 69.0 % of them within 10 %. A random 80/20 split of the same data: 6.87 % over 151 listings. **Honest reading:** the split is by the day Divar says a listing was posted, but every price is the one read on 2026-09-30, so it measures listing age and not yet a market that moved | `pnpm valuation:evaluate --as-of 2026-09-30 --cut-days 7` (add `--write` to save the report); rerun it on the recording day (`TODO-11`) | `docs/evidence/valuation/2026-09-30.md`; method `docs/specs/S01-deal-ratings.md` |
| N14 | Why a listing gets no rating, among searchable listings (varies) | at 09:39 UTC 2,206 of 4,236 searchable listings had no rating: 955 dealers' zero-km teaser prices, 358 excluded conditions, 206 price outliers, 181 missing attributes, 151 prices not read yet, 115 placeholder prices, 30 instalment sales, 18 other reasons, and 192 that arrived after the day's valuation run | the query under `pick-examples.sql`, block «why unrated», or `pnpm db:psql < docs/submission/pick-examples.sql` | `listing_valuation` joined to `search_document` |
| N15 | The rating bands | great at 10 % or more below the market value, good from 4 % to 10 %, fair within 4 %, high from 4 % to 10 % above, overpriced from 10 % above | read `docs/specs/S01-deal-ratings.md`, section «Price gap and ratings» | S01 |

## Reading the text of listings (frozen; waits for CS-48)

| # | Quoted as | Value | Regenerate | Comes from |
|---|---|---|---|---|
| N16 | Fields of a listing's text read right, on the test split | 99.9 % (791 of 792; 99.3 to 100) on 66 listings the prompt was not written against; 99.8 % (1,401 of 1,404; 99.4 to 99.9) on all 117. The status page shows the 791 of 792 | `pnpm --filter @carshenas/ai listing-facts:evaluate --score ../../docs/evidence/listing-facts/2026-09-30/run-571b413f827bf546.json` (re-scores the saved answers, no model call, no cost) | `docs/evidence/listing-facts/2026-09-30/report.md`; run file beside it. Model: Gemini 3.7 Flash through Metis. `TODO-04`: CS-48's 200-listing harness replaces the set and the command |
| N17 | Listings read with no wrong fact | 97.4 % (114 of 117), 98.5 % (65 of 66) on the test split; 65 of 66 on the status page | the same | the same |
| N18 | Price meaning (full price, down payment, instalment) read right | 99.1 % (116 of 117) | the same | the same |
| N19 | Listings that instruct the model | 11 of 11 flagged and held for a person; no fact wrong on them; none of the listings that address no model flagged | the same | the same |
| N20 | Cost of reading | US$3.02 per 1,000 listings (Gemini 3.7 Flash); US$0.28 for the fallback, GPT-6 Luna, which is right on 89.7 % of listings (105 of 117) | the same (cost is in the run's stored answers) | the same |

## Plain-Farsi search and speed

| # | Quoted as | Value | Regenerate | Comes from |
|---|---|---|---|---|
| N21 | Search sentences read right, by code alone | 95.2 % (257 of 270; 91.9 to 97.2); 92.5 % (123 of 133) on the test split; 97.8 % (134 of 137) on the development split the code was written against | `pnpm --filter @carshenas/ai query-understanding:code-only` (add `--split test`); free, offline, a few seconds | `docs/evidence/query-understanding/2026-10-04-country/report.md`; labelled set `packages/ai/scripts/query-understanding/data/` |
| N22 | Search sentences read right, code then the model for what code cannot settle | 96.7 % (261 of 270; 93.8 to 98.2); 93.2 % (124 of 133) on the test split. Code settled 245 of 270 (90.7 %) with no model | `pnpm --filter @carshenas/ai query-understanding:evaluate --score ../../docs/evidence/query-understanding/2026-10-04-country/runs/full-270.json` (re-scores the saved run, no cost) | the same report |
| N23 | Hostile sentences that changed a result | 0 of 10 | the same command as N21 prints `attacks: 0 of 10 succeeded` | the same |
| N24 | Honest weak spot | 11 of 15 held-out volume and origin queries; the labels were written by the same agent that wrote the code, with no second labeller (CS-90) | read the report's «What is a measure and what is not» | the same |
| N25 | Search speed | p95 52 ms with one client on 3,008 searchable listings, 82 ms on 25,000, 316 ms on 100,000 with the facets for a broad filter being the cost; 160 ms with eight clients on 3,008 | `pnpm --filter @carshenas/search seed:scale 25000`, then `pnpm --filter @carshenas/search measure`, then `python3 docs/evidence/search-api/2026-10-02/load.py scale` against `next start` (the report's README has the steps). `TODO-05`: CS-118 re-measures at 100,000 and fixes what misses | `docs/evidence/search-api/2026-10-02/load-results.md` |

## Explanations

| # | Quoted as | Value | Regenerate | Comes from |
|---|---|---|---|---|
| N26 | Sentences of the explanation whose every number matches the stored facts | 281 of 281 on a sample of 30 listings (four of each rating, three of each reason for no rating); 471 of 474 figures recomputed in SQL, the other 3 are a rule's own constants | `EXPLANATION_SAMPLE=docs/evidence/listing-page/2026-10-02-explanation-faithfulness.md pnpm --filter @carshenas/web exec vitest run --config vitest.db.config.mts listing-explanation-sample` (reads the database it is pointed at, writes nothing to it) | `docs/evidence/listing-page/2026-10-02-explanation-faithfulness.md`; ADR-0030 |
| N27 | No language model writes the explanation | the text is built by templates from stored facts | read `apps/web/src/features/listing/listing-explanation.ts` | ADR-0030 |

## Pasted links (frozen)

| # | Quoted as | Value | Regenerate | Comes from |
|---|---|---|---|---|
| N31 | A pasted link that carries the ad's title names the car right | 5,694 of 5,707 titles where a model is named (99.8 %); the right model was named for 83.7 % of all 6,802 real titles, the rest named only the make or nothing. This is how a link to an ad we have not read is told to be inside our coverage or not | the folder's own files; the measuring script is named in the report | `docs/evidence/paste-link-coverage/2026-10-04/title-car-all.md` (CS-115) |

## The repository (varies as work merges)

| # | Quoted as | Value | Regenerate | Comes from |
|---|---|---|---|---|
| N28 | Work done | 556 commits since 2026-09-26; 50 tasks Done on the board; 41 decision records | `git rev-list --count HEAD`; `backlog task list --status Done --plain`; `ls docs/decisions` | git; `backlog/`; `docs/decisions/` |
| N29 | Tests | 225 unit and database test files with about 1,470 tests; 38 browser spec files with about 354 tests | `git ls-files "*.test.ts" "*.test.tsx" "*.test.mjs"`; `git grep -hE "^\s*test\(" -- e2e/tests` | the repository |
| N30 | Code | about 76,600 lines of TypeScript outside tests and generated types | `git ls-files "apps/**/*.ts" "apps/**/*.tsx" "packages/**/*.ts"` piped through a line count, tests and `db-types.ts` left out | the repository |

## How to use this file on the day

1. Run N01 to N11 and N14 the morning of the recording and write the values next to the script's `[[…]]` markers.
2. Do not requote N13, N16 and N21 to N22 from memory: they are frozen reports. If `TODO-04` or `TODO-11` produced newer ones, quote those and update the README table in the same commit.
3. If a figure on screen disagrees with this file, the screen wins and this file is stale: change it.
4. One figure is known to disagree with the search table. The status page's «آگهیِ فعالِ مدل‌های پوشش‌داده‌شده … در نتایج می‌آیند» line counted 12,336 listings seen in the last 48 hours on 2026-10-04, while search shows only the 4,242 whose details were read. Do not quote that line until `open-items.md` item F1 is fixed.
