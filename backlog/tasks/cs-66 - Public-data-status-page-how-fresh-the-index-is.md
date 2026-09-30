---
id: CS-66
title: 'Public data-status page: how fresh the index is'
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 21:38'
labels:
  - frontend
  - backend
milestone: m-5
dependencies:
  - CS-35
  - CS-3
references:
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
  - docs/product/challenge.md
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Torob's careers page names price freshness («تازگی قیمت») among the three things every search is about, and price validity («اعتبار قیمت»: fresh, valid and reliable) among the ten problems behind a search. Carshenas shows its own freshness in Farsi, the way a status page shows uptime: which sources are being read, when each was last read, how many listings are active, new and gone, and how old the market values are. The same numbers are the demo's evidence that the index is live (ADR-0017 point 6). A paused or blocked source is shown as not being updated, without technical detail.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A Farsi page shows, per source and for the whole index, the last successful read, active listings, new and gone listings in the last 24 hours, the median age of the last check of listings shown on results pages, and the date of the market values
- [x] #2 A paused or blocked source is shown as not being updated, with the date of its latest data
- [x] #3 Every number comes from the database, and the page answers within the search API's latency target
- [x] #4 Playwright tests cover the page on phone and desktop with the RTL, overflow and axe checks, and it is added to `e2e/fixtures/app-pages.ts`
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Data: a migration granting carshenas_web SELECT on valuation_run and valuation_segment (the market values date, counts and per-model error); a migration creating ai_evaluation (one published evaluation of an AI step: task, prompt version, model, date, labelled items, fields right of fields scored, listings fully right, injected listings held), seeded with CS-52 2026-09-30 report, readable by the web role, so every number on the page comes from the database.
2. Queries in apps/web/src/features/data-status/server/data-status-queries.ts on readDatabase(), one use-cache function with a short cacheLife (stale 60 s, revalidate 60 s, expire 180 s: a dynamic hole, never baked into the build): sources (crawl only, never URLs, errors, traces or accounts), listing figures per source and for the whole index in one pass (GROUP BY ROLLUP), the median age of the last check over listings a results page may show (active, tracked model with its trims as freshness_measurement counts them, read within 48 hours), the latest freshness measurement per source (posting to first seen), the hourly median-age series for 48 hours, the latest succeeded valuation run with its segments, and the latest ai_evaluation. EXPLAIN (ANALYZE, BUFFERS) each; named sql helpers with db tests.
3. Page /status in (site): static shell (title, lead, how the index is kept) and the figures in a Suspense boundary with a skeleton built from the same frames. Sections: overall state and last read; key figures; the freshness targets of ADR-0017 point 6 against their measurements; per-source cards (a paused or blocked source says it is not being updated, with the date of its latest data, no reason); market values (date, valued and rated counts, per-model error bars); reading listing text (evaluation); how the index is kept (daily request budget from the database); hourly chart with a table fallback.
4. Tests: unit tests of the pure view logic (status, targets), component tests of the source card states, db tests for the helpers and the loader; Playwright spec on phone and desktop with RTL, overflow, axe, Persian digits; add to e2e/fixtures/app-pages.ts.
5. Docs: data-model.md (ai_evaluation, web grants), task notes with decisions; measure latency against 300 ms p95; verify-ui evidence (screenshots at 412 and 1440, craft checks).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-01: Data and reads. Decisions: (1) every number from the database, so CS-52's published scores live in a new append-only table ai_evaluation (seeded by its migration from docs/evidence/listing-facts/2026-09-30/report.md, test split 791 of 792 fields, 65 of 66 listings, 11 of 11 injected listings held), rather than typed into the page; valuation accuracy is read live from valuation_segment (leave-one-out error per model of the latest succeeded run), so it follows every daily run. (2) The web role gets SELECT on valuation_run and valuation_segment only; listing_valuation and comparables stay closed. (3) New in 24 hours means posted on the source in the last 24 hours (listed_at), not first stored: the index was filled on 2026-09-30, and first-stored counts would claim 23,000 new listings in a day. (4) Results pages draw on active listings of the tracked models (keys of the latest freshness measurement through catalogue_source_key, so trims count, as the admin screen does) read within 48 hours (CS-59 criterion 5); the page shows their median check age. (5) One use-cache loader, cacheLife stale 60 s, revalidate 60 s, expire 180 s: under five minutes of expiry Next.js leaves it out of the build prerender (a dynamic hole in Suspense), then serves it from cache for a minute. (6) A source is live when enabled and read within 60 minutes, delayed when enabled but silent longer, not updating when paused or stopped (no reason shown).

2026-10-01: Page /status built (apps/web/src/features/data-status, app/(site)/status/page.tsx). Shell (title, lead) prerenders; figures stream inside a catchError boundary from the cached loader; how the index is kept renders after the figures so nothing moves (CLS 0). Sections: overall state with last read and report time; four figures for the whole index; ADR-0017 targets against measurements (new listing within an hour: missed, median 3 h at the latest hourly measurement, shown as missed; results median under a day: met, 6 h; values daily: met); per-source card with state badge, a not-updating note with the date of its latest data (never the reason), budget and hourly chart with a table; market values (day, 919 valued, 663 rated, per-model leave-one-out error bars 4 to 11 percent); text reading (791 of 792 facts, 65 of 66 listings, 11 of 11 injected held). No URLs, errors, traces or accounts leave the loader.
EXPLAIN (ANALYZE, BUFFERS) on the lane copy (23,441 listings), twice each: listing figures with ROLLUP and the tracked CTE 36.2 and 38.7 ms (Index Scan listing_source_model_id_idx, Merge Left Join, GroupAggregate, shared hit 2,347); sources 0.03 ms; freshness series 0.03 ms (Seq Scan, 77 rows); latest valuation run 0.07 ms; segments with model 0.07 ms (model_pkey); ai_evaluation 0.03 ms. No new index: the figures pass is one scan the 60 s cache amortises.
Latency on the production build (next start, port 3266): 200 requests, median 13.5 ms, p95 19.6 ms, max 31.7 ms; first cold request 366 ms. Target 300 ms p95 (CS-59 criterion 4): met.
Evidence: pnpm check exit 0; pnpm db:check OK (data-status-queries.db.test.ts, 3 tests, and helper tests); vitest src/features/data-status 10 passed; E2E_BASE_URL=http://127.0.0.1:3266 pnpm e2e tests/app --workers=2: data-status.spec 12 passed (mobile, desktop), layout-stress for the page 16 passed; the whole app suite 171 passed, 4 failed in admin-worker.spec (not this task: its CS-41 expectations of ۲ ساعت پیش read دیروز after midnight Tehran, 00:30 on 1405-07-09). Craft checks at 412 and 1440 on the production build: overflow 0, layout shift 0, no small targets, no line-height findings, no alpha text, nothing animating under reduced motion; hues 150 (success) and 60 (warning) only as target and state colours, 262 the link. Screenshots .playwright-cli/cs66-final-mobile.png, cs66-final-mobile-2.png, cs66-final-desktop.png: Persian digits and Jalali dates throughout, badges wrap under titles, chart time runs left to right.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the public data-status page /status: whether listings are being updated and when a source was last read, four whole-index figures, ADR-0017's freshness targets against their measurements (a missed one shown as missed), a card per source (a paused or blocked source says it is not being updated with the date of its latest data, no reason), market values with their day and each model's leave-one-out error, and CS-52's extraction scores. Every number comes from the database through one use-cache loader (60 s, kept out of the build prerender): a new append-only ai_evaluation table seeded from CS-52's report, and SELECT for the web role on valuation_run and valuation_segment. Verified with pnpm check, pnpm db:check, 10 unit and component tests, 3 integration tests, data-status.spec and layout-stress on phone and desktop (all pass), EXPLAIN plans (figures query 36 to 39 ms) and a 200-request latency run on the production build (p95 19.6 ms).
<!-- SECTION:FINAL_SUMMARY:END -->
