---
id: CS-67
title: Model page with market price trend
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-03 01:53'
labels:
  - frontend
milestone: m-5
dependencies:
  - CS-64
references:
  - >-
    docs/decisions/0032-model-pages-and-a-trend-from-our-own-valuation-history.md
priority: medium
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Torob's product page applied to cars: one page per make, model, trim and year, with the market's direction and every listing ranked by deal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The page shows today's market value and range, a weekly trend with Jalali dates, and all listings of the model ranked by deal
- [x] #2 Playwright tests cover the page on phone and desktop, and it is added to e2e/fixtures/app-pages.ts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Data: no new tables. Current-market figures (count, range, medians, by year, by trim) from search_document (same 48 h freshness as search); the trend from our own daily valuation runs (listing_valuation per run date: median asking price of rated listings of one model year, p25-p75 band, count per point), because posting dates of listings are survivor-biased (measured: 61-136 posts/day before the crawl against 370-500/day after). Weekly points (last run of each Saturday-week) once the history spans 3+ weeks, daily points before; fewer than 3 points or 8 listings per point means a designed "not enough history yet" state. Change over 30/90 days only when the history reaches back that far.
2. Routes: /models (index, popular models first, makes with their models) and /models/[make]/[model] (slugs, optional ?year=); proxy answers a real 404 for an unknown model; blocking page with the hero read at the top, trend and deals in own Suspense with their errors.
3. UI: hero (name, body-type sample photo with credit, count, median, middle-80% range, typical mileage), year chips, market value and range, trend chart (SVG, text table alternative, info controls), by-year and by-trim tables, best deals with the CS-61 card, link to all listings of the model.
4. Entry points: home (popular models), search result cards and the search page when one model is chosen, listing page.
5. Tests: unit (view logic), db test for the queries, Playwright phone+desktop with seeded model and multi-run history (rtl, overflow, axe, no-data, 404), app-pages.ts. EXPLAIN every query.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Renumbered on 2026-09-29: this task was CS-18 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-18; the archived CS-18 points here.

Decisions (lane run, owner away):
- Address /models and /models/<make>/<model>?year= by catalogue slugs (src/lib/model-address.ts is shared so search cards, listing page and home link without importing the feature); the proxy answers a real 404; ADR-0031.
- The trend is built only from the valuation's own daily runs (median asking price and middle half of rated listings of one model year per run date). A trend by posting week was measured and rejected: 61-136 listings posted a day before the crawl began against 370-500 after it, so older weeks show only unsold cars. Points need 8 listings, a chart 3 points, days up to 21 days of history then Saturday-weeks, 30/90-day change only when a point lies within 4 days of that distance. Short history is a designed state (table of the days it has), not a line.
- Current figures come from search_document inside the 48 h window, so the count equals the search's. Best deals are the search API's best_deal order shown with the CS-61 card (no model link on the model's own page).
- New index listing_model_year_idx (model_id, model_year_sh): the trend query 35 ms with 3 runs, growing with every run, became 6.5 ms driven from one model year's listings.
- Chart: one stretched SVG (line and band) plus HTML dots and labels by percentage, left to right (charts do not mirror), table as text alternative; tokens --color-chart-line/band/grid with contrast tests.

Later decisions and findings:
- A model link in every result card was built and removed from the default: it doubled the Tab stops (layout-stress keyboard walk holds 80 stops; the home and search pages failed it). ListingCard keeps an opt-in modelLink prop (tested); the routes in are the home page popular models (8 tiles), the models index, the search page notice for a one-model search, the listing page links («صفحه‌ی … : قیمت و روند», «بقیه‌ی آگهی‌های این مدل»), the footer and the breadcrumb.
- Layout-stress findings fixed: a visually hidden h2 is reported as clipped text (made visible); chart axis labels clip inside their own rows; index rows wrap their counts.
- The model queries are cached 2 minutes, so a browser test cannot assert a freshly seeded model in the cached index or popular list; the db test (model-queries.db.test.ts, 6 tests, run by pnpm db:check) asserts the figures of a seeded model.

Query plans (EXPLAIN (ANALYZE, BUFFERS), lane copy of main, 3,230 searchable listings, 24k listings, 3 valuation runs):
- overview/years/trims/ratings on search_document where model_key = X and last_seen_at in the 48 h window: Bitmap Index Scan search_document_model_key_idx, 229 rows, 1.2 ms, 156 buffers.
- trend (listing_valuation join listing join valuation_run, one model year, last run of each day): before listing_model_year_idx the plan drove from every listing_valuation row of every run (6,911 rows probed, 35 ms with 3 runs, growing per run); with it, Index Scan listing_model_year_idx on listing (93 rows per run) then listing_valuation_pkey: 6.6 ms, 1,355 buffers, and the cost follows one model year, not the market.
- popular models and the index (group by model over the window, 3,227 rows): Seq Scan on search_document + hash joins to model and make, 10 ms; cached for two minutes.
- Not new: the best deals are the search API's own page query (docs/evidence/search-api).

Correction: the ADR of this task is ADR-0032 (docs/decisions/0032-model-pages-and-a-trend-from-our-own-valuation-history.md); the ADR-0031 named in the notes above is renumbered because main took 0031 for search files (CS-70). The migration 20261002233131_index_listings_by_model_and_year is the only one.

Home budget: main (CS-70) added a save button to every catalogue row, which already put the home page over the layout-stress keyboard walk (83 controls on a desktop against 80). This lane takes the page to 80: the popular models row replaced the fifth catalogue row (ROW_COUNT 4, home.spec follows, its «low-mileage» info test uses «clean-and-easy», the row whose rule is a number) and shows four tiles. Main needs its own cut when it merges another home row.
Found on main: apps/web/src/features/listing/listing-explanation.ts and listing-view.ts import nameOnScreen from search-labels, which no longer exports it (it moved to @carshenas/locale/names in CS-70): typecheck of main fails; this branch points both imports at @carshenas/locale/names.

Review round: y-axis labels no longer clipped; chosen year chip scrolled into view (client CurrentIntoView); short history is one card with its days; range stacked under median on phones; default-year label and the scope note (top figures: all priced fresh listings; trend: rated ones of one model year); sample badge on tiles; no weight change or tabular figures on static numbers; stat label rows min-h-11 (info hit area); hero stats in a full-width row (no dead space); generic 404 links models and search; proxy caps slugs at 80; ANALYZE listing run in the lane (run it on main after migrating).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the model page and its routes. /models/<make>/<model>?year= shows the model (hero with name, body-type sample photo and its credit, four figures: median asking price, middle 80 percent range, market value with its date, usual mileage), model-year chips, the weekly/daily price trend, the best deals with the CS-61 card, the rating split, price by year, trims and what the listings state (paint, gearbox, seller); /models is the index. Entry points: home popular models (4 tiles), models index, one-model search notice, listing page links, footer, breadcrumb.

The trend is built only from the valuation's own daily runs (ADR-0032): a posting-date trend was measured and rejected as survivor-biased. A short history (three days today) is a designed state, with a 30/90-day change only when the history reaches back.

Evidence: unit tests (view logic, address, locale formatDayMonth, contrast of the chart tokens, card link), pnpm db:check 110 tests incl. model-queries.db.test.ts, db:lint, tsc, eslint on all changed files, prettier. Playwright on a production build, phone and desktop: tests/app/model-page.spec.ts 48 tests (hero, years, weekly trend with 30-day change and no 90-day change, table alternative, short and no-trend states, deals, info controls, empty model and year, real 404s, entry points, layout shift under 0.05, overflow, axe), plus layout-stress for the two new pages (/models, /models/peugeot/206 in e2e/fixtures/app-pages.ts), home, search and listing specs: 204 passed in the last run of layout-stress/model-page/home, search and listing passed in the run before. Craft checks at 412 and 1440: no overflow, layout shift 0, no alpha text. Query plans (EXPLAIN ANALYZE) in the notes; new index listing_model_year_idx takes the trend query from 35 ms (growing per run) to 6.6 ms. All listings of the model, ranked by deal, are one tap from the page: the six best are on it and «دیدن همه‌ی آگهی‌ها» opens the search for the model in the best-deal order.
<!-- SECTION:FINAL_SUMMARY:END -->
