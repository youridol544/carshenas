---
id: CS-86
title: 'Read an implausible mileage as unknown, never as a low mileage'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-02 15:01'
updated_date: '2026-10-02 15:23'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. @carshenas/locale: add jalaliYearOf(instant), the Solar Hijri year of the Tehran day an instant falls on, through @internationalized/date (ADR-0014, no second implementation); test it at the Nowruz boundary; the valuation run helper delegates to it.
2. sources/attributes.ts: the shared rule isImplausibleMileage(km, modelYearSh, fetchedYearSh) (under 1,000 km on a car three or more model years old) and UnparsedValue.reason, so a figure the parser read but does not believe is kept as text with its reason.
3. Divar parser: deriveDivarListing(payload, fetchedAt) takes the snapshot own fetch date (snapshot.first_fetched_at, never the clock); an implausible mileage leaves mileage_km null and is kept in listing_unparsed_value (field mileage_km, the stated text); DIVAR_PARSER_VERSION 3. Callers pass the snapshot date: the crawler (storeSnapshot returns it), pnpm derive:listings and the extraction job (latestSnapshots returns it).
4. Derive report: an implausible count per field and the reason in the value-not-read lines.
5. Tests on four real redacted snapshots (a 1397 car at 109, a 1402 car at 0, a 1403 car at 40, a 1405 car at 88) plus the existing three, the Nowruz boundary and determinism, the derive command and the crawler path.
6. Docs: parser header, data-model.md, worker runbook, S01.
7. Verify in the lane: pnpm derive:listings and pnpm valuation:run before and after (listings that lost a mileage, ratings and comparables that change), pnpm check, pnpm db:check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Slice 1 (locale): jalaliYearOf(instant) added to @carshenas/locale/jalali, by @internationalized/date in Asia/Tehran (ADR-0014: no second implementation); tested at the Nowruz boundary (2026-03-20T20:30:00Z opens 1405) and against the platform Intl for every Nowruz 1399 to 1420. The valuation run helper jalaliYearOf(isoDate) in apps/worker/src/valuation/run.ts, which was an Intl copy of the same idea, now delegates to it (noon UTC of the day, 15:30 in Tehran), so there is one implementation.
<!-- SECTION:NOTES:END -->
