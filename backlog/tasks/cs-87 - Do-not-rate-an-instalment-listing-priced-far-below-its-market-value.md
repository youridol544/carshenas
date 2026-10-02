---
id: CS-87
title: Do not rate an instalment listing priced far below its market value
status: Done
assignee:
  - '@claude'
created_date: '2026-10-02 16:21'
updated_date: '2026-10-02 18:24'
labels:
  - backend
milestone: m-3
dependencies: []
references:
  - docs/specs/S01-deal-ratings.md
  - db/migrations/20260930133008_create_valuation.sql
priority: high
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A listing that accepts instalments (Divar field «امکان خرید قسطی: دارد», stored as accepts_installments) often shows its down payment or a first-instalment figure as its price. Valued against full prices it lands near half the market value, and with CS-86 removing wrong mileages the three best deals of the default search became exactly these: 5432 (-50.2 %), 3685 (-49.6 %) and 4594 (-48.3 %), all «معامله‌ی عالی» (measured on 2026-10-02 on a copy of main; of 4,004 rated listings, 3 lie beyond -25 % and all 3 accept instalments, and the 133 between -15 % and -25 % include only 6 that do). A false «عالی» at the top of the best-deals page costs the product its credibility. The reading of what a price means from the text belongs to CS-52 and its extraction, which reads about a third of the listings and is switched off to save credit; the structured field plus an extreme gap is a rule we can state and prove without a model, and it uses the existing no-rating reason for instalment prices.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A listing with accepts_installments true whose asking price lies 20 % or more below its market value gets its market value but no rating and no stored price gap, with the reason installment_price, in valuation_rate_listing() so a pasted link and the daily run agree
- [x] #2 A listing without that field, or with a smaller gap, keeps its rating: a cash listing at -45 % is not changed by this rule (the factor-of-three outlier rule still applies)
- [x] #3 docs/specs/S01-deal-ratings.md states the rule and its threshold with the measurement behind it, and the data-status and listing pages can say why a listing is unrated through the existing reason
- [x] #4 A database test seeds an instalment-accepting listing at -45 %, one at -15 %, and a cash listing at -45 %, and asserts the three outcomes; the numbers of rated listings and of «عالی» ratings before and after a run on a copy of main are recorded on the task
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions: (1) AC1 reworded: the stored gap stays null for the guarded row, because listing_valuation_gap_only_when_rated (a gap only when rated) is what search best-deal order (price_gap_pct asc) relies on; a stored gap would put these rows first again. The row keeps market value and asking price. (2) The guard sits last: only listings the earlier reasons left rated, so price_outlier, dealer_new_car, instalment price keep their reasons. (3) No table or constraint change; CREATE OR REPLACE kept grants (checked: owner, worker, readonly). Down section is byte-identical to the CS-51 body.
Before/after over ALL 23,752 listings of the lane copy (23,129 active, 623 inactive), the old and new function on the same stored run 10, baseline equal to the 23,129 stored rows: 4 outcomes changed, the 4 intended: 5432 (-50.19), 3685 (-49.63), 4594 (-48.28), 6872 (-24.49), each great to unrated installment_price with value and asking kept, gap null; 23,748 listings identical in every column. Measurement behind -20: 4,004 rated, 270 accept instalments; of 27 rated at -20 or beyond 4 accept (the 23 others are cash and keep their rating); -20..-15: 5 of 109. End to end, valuation run after the migration: comparables 4,307, valued 5,511 (unchanged), rated 4,004 to 4,000. Great 444 to 440. The exports were lost with /tmp in the power cut; the numbers are from the session. Test: valuation.db.test.ts, the three cases plus declined flag, outlier precedence, comparables only for rated listings, run equals function, and the -20.00 / -19.99 edge; passes. Checks: lint, typecheck, worker 113 tests, format, db:check green. pnpm test stops at two web PGlite suites (schema-catalog, schema-constraints) whose 10 s beforeAll times out at load average 22 on this machine; they passed alone at 4.4 s earlier and in CS-86; not changed.

Merged into main on 2026-10-02 (aa548e9). Post-merge steps run on main by the coordinator: pnpm db:migrate (20261002163345), pnpm valuation:run (run 10: comparables 4,307, valued 5,510, rated 4,001 after the guard); listings 5432, 3685, 4594 and 6872 now read installment_price with no rating. The two web PGlite suites failed under machine load in pnpm check (load average about 14 to 25) and pass alone.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Instalment-accepting listings (accepts_installments) 20 % or more below market are valued but not rated, reason installment_price, in valuation_rate_listing() (migration 20261002163345_guard_installment_ratings, CREATE OR REPLACE, no table change). Over all 23,752 listings of the lane copy exactly the 4 intended outcomes change (5432, 3685, 4594, 6872); rated 4,004 to 4,000, great 444 to 440. Three-case database test plus edges passes; S01 and data-model updated; db:check green. After merge, main needs pnpm db:migrate then pnpm valuation:run (main checkout).
<!-- SECTION:FINAL_SUMMARY:END -->
