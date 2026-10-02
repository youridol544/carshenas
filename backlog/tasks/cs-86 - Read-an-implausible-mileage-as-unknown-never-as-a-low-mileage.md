---
id: CS-86
title: 'Read an implausible mileage as unknown, never as a low mileage'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-02 15:01'
updated_date: '2026-10-02 15:31'
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
1. @carshenas/locale: add jalaliYearOf(instant), the Solar Hijri year of the Tehran day an instant falls on, through @internationalized/date (ADR-0014, no second implementation); test it at the Nowruz boundary; the valuation run helper delegates to it. [done]
2. sources/attributes.ts: the shared rule isImplausibleMileage(km, ageInModelYears) (under 1,000 km on a car three or more model years old, only when the age is known) and UnparsedValue.reason, so a figure the parser read but does not believe is kept as text with its reason. [done]
3. Divar parser: deriveDivarListing(payload, fetchedAt) takes the snapshot own fetch date (snapshot.first_fetched_at, never the clock); an implausible mileage leaves mileage_km null and is kept in listing_unparsed_value (field mileage_km, the stated text); DIVAR_PARSER_VERSION 3; no migration (the reason needs no column). Callers pass the snapshot date: the crawler (storeSnapshot returns it), pnpm derive:listings and the extraction job (latestSnapshots returns it). [done]
4. Derive report: an implausible count per field and the reason in the value-not-read lines. [done]
5. Tests on four real redacted snapshots (a 1397 car at 109, a 1402 car at 0, a 1403 car at 40, a 1405 car at 88) plus the existing three, the Nowruz boundary and determinism with a mocked clock, the derive command and the crawler path. [done]
6. Docs: parser header, data-model.md, worker runbook, S01, glossary. [done]
7. Verify in the lane: pnpm derive:listings and pnpm valuation:run before and after (listings that lost a mileage, ratings and comparables that change), pnpm check, pnpm db:check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Slice 1 (locale): jalaliYearOf(instant) added to @carshenas/locale/jalali, by @internationalized/date in Asia/Tehran (ADR-0014: no second implementation); tested at the Nowruz boundary (2026-03-20T20:30:00Z opens 1405) and against the platform Intl for every Nowruz 1399 to 1420. The valuation run helper jalaliYearOf(isoDate) in apps/worker/src/valuation/run.ts, which was an Intl copy of the same idea, now delegates to it (noon UTC of the day, 15:30 in Tehran), so there is one implementation.

Slice 2 (parser, report, fixtures, docs). Decisions: (1) the reference date is snapshot.first_fetched_at (a column of the snapshot row itself, append-only), so a snapshot gives the same listing whenever it is derived and a later fetch of the same content, or the crawler clock, cannot move it; storeSnapshot now returns it (this fetch time for new content, the earlier one for content stored before) and latestSnapshots returns it for pnpm derive:listings and the extraction job; Parser is now (payload, fetchedAt). (2) NO migration: listing_unparsed_value already allows field mileage_km, and the reason needs no column, because a mileage_km row whose text is a whole number under 1,000 can only come from this rule (every such number is read as a mileage otherwise; the other mileage rows are text or a figure above 9,999,999); the reason travels on the parse result (UnparsedValue.reason = implausible), is counted apart in the derive report (implausible beside unparsed per field) and shown after the text in the value-not-read lines; a second kind of reason would add a column then. (3) The rule lives in sources/attributes.ts (isImplausibleMileage) so Bama parser (CS-54) shares it; Divar oldest model year choice (before 1366) counts as older than any age; a car whose model year is missing or unreadable keeps its mileage (no age to judge by). (4) A 0 is under 1,000, so an old car stating 0 loses it too, as the task says; some of these really are unused stock (listing 5221 says unused since its 1402 delivery): flagged for the owner, a one-line exemption if wanted. Tests: four real redacted snapshots (1397 at 109, 1402 at 0, 1403 at 40, 1405 at 88) with their real fetch dates; boundary and determinism tests incl. a mocked clock; the derive command and crawler DB tests (mutation-checked: a parser that reads the clock or the fetch time fails them). Docs: parser header, data-model.md (new section Added by CS-86), worker runbook, S01.

Verification on real data (lane database, a copy of main of 2026-10-02, 23,752 listings; no request to Divar). pnpm derive:listings with parser 3: 6,088 listings derived (17,664 have no snapshot), 6,088 attributes rewritten (parser_version 3), 82 unparsed rows written, 0 refused, 0 unreadable; a second run wrote nothing (0 attributes, 0 unparsed): the same snapshots give the same listings. Field mileage_km: read 6,004, stated unknown 2, unparsed 0, implausible 82 (before: read 6,086). The 82 that lost a mileage: 79 active and 3 gone; by model year 1402: 17, 1401: 10, 1400: 11, 1399: 4, 1398 to 1393: 13, older: 27; 23 stated 0 (13 of them also say zero in the title). Valuation run before (run 9) and after (run 10), both of 2026-10-02: comparables 4,371 to 4,307 (minus 64), outliers 311 to 302, valued 5,578 to 5,511 (minus 67), rated 4,058 to 4,004 (minus 54); great 457 to 444, good 748 to 752, fair 1,698 to 1,682, high 733 to 717, overpriced 422 to 409; unrated for missing attributes 202 to 275. Of the 79 active listings that lost the mileage, 51 had a rating (14 great, 15 good, 10 fair, 2 high, 10 overpriced), among them listing 4958 (the Peugeot 405 of 1397 that read 109 km and led the default search), and 28 were unrated already for another reason; all 79 are now missing_attributes. 153 other listings moved one rating bucket because the fit learned without the 64 comparables (median market value of the rest plus 0.16 %, from minus 6.1 % to plus 2.3 %, 12 of them by more than 2 %).
<!-- SECTION:NOTES:END -->
