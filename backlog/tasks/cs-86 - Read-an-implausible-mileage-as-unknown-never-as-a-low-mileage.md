---
id: CS-86
title: 'Read an implausible mileage as unknown, never as a low mileage'
status: To Do
assignee: []
created_date: '2026-10-02 15:01'
labels:
  - backend
milestone: m-3
dependencies: []
references:
  - apps/worker/src/sources/divar/attributes.ts
  - docs/specs/S01-deal-ratings.md
priority: high
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Sellers often type their mileage in thousands of kilometres: the post says «۱۰۹» for a car that has run 109,000 km. The parser stores it as 109 km, so the car looks nearly new: it enters the comparables, passes the «کم‌کارکرد» catalogue, and on 2026-10-02 three of the 75 «معامله‌ی عالی» ratings, among them the default first search result (listing 4958), belonged to cars of three or more years showing under 1,000 km (the CS-59 review). A wrong number behind a «عالی» badge costs the product its credibility. Guessing the thousands is a reading we cannot prove, and the project never reads a value as the nearest one it knows, so the value is kept as text the parser could not read, like the one-million-kilometre sentinel it already treats as unknown; every later step (valuation, filters, sorts) then sees a missing mileage with no code of its own.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A mileage under 1,000 km on a car whose model year is three or more Jalali years before the year the snapshot was fetched is not stored as mileage_km: the listing has no mileage, and the stated text is kept in listing_unparsed_value with the reason
- [ ] #2 The rule uses the snapshot own fetch date as the reference year, never the clock, so deriving the same snapshot twice gives the same listing
- [ ] #3 A car of the current or the previous two model years with under 1,000 km, and any car with 1,000 km or more, keeps its mileage
- [ ] #4 The parser version is raised and pnpm derive:listings on a copy of the main database re-derives every listing, with the number of listings that lost a mileage, and how many ratings and comparables change at the next valuation run, recorded on the task
- [ ] #5 Tests cover each case with fixtures made from real snapshots with personal data removed, and docs/design/data-model.md and the parser header say what the rule reads and why
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
