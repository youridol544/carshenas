---
id: CS-66
title: 'Public data-status page: how fresh the index is'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 20:16'
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
