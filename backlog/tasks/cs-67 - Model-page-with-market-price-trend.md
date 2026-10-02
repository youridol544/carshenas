---
id: CS-67
title: Model page with market price trend
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-02 23:28'
labels:
  - frontend
milestone: m-5
dependencies:
  - CS-64
priority: medium
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Torob's product page applied to cars: one page per make, model, trim and year, with the market's direction and every listing ranked by deal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The page shows today's market value and range, a weekly trend with Jalali dates, and all listings of the model ranked by deal
- [ ] #2 Playwright tests cover the page on phone and desktop, and it is added to e2e/fixtures/app-pages.ts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
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
<!-- SECTION:NOTES:END -->
