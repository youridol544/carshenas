---
id: CS-66
title: 'Public data-status page: how fresh the index is'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 20:39'
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
- [ ] #1 A Farsi page shows, per source and for the whole index, the last successful read, active listings, new and gone listings in the last 24 hours, the median age of the last check of listings shown on results pages, and the date of the market values
- [ ] #2 A paused or blocked source is shown as not being updated, with the date of its latest data
- [ ] #3 Every number comes from the database, and the page answers within the search API's latency target
- [ ] #4 Playwright tests cover the page on phone and desktop with the RTL, overflow and axe checks, and it is added to `e2e/fixtures/app-pages.ts`
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
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
<!-- SECTION:NOTES:END -->
