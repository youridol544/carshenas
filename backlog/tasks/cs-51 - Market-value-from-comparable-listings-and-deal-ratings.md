---
id: CS-51
title: Market value from comparable listings and deal ratings
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - backend
  - ai
milestone: m-4
dependencies:
  - CS-50
  - CS-49
references:
  - docs/decisions/0006-used-cars-modeled-on-cargurus.md
  - docs/research/2026-09-26-us-vertical-search-analogs.md
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
  - docs/research/2026-09-28-torob-challenge-expectations-and-field.md
priority: high
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The product's core promise is telling a buyer whether a price is fair. CarGurus computes a daily market value from comparable listings and rates each listing from Great to Overpriced; Carshenas does the same, adjusted for Iran's condition vocabulary and for inflation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A spec, docs/specs/S01-deal-ratings.md, defines comparables, adjustments for mileage and condition, the thresholds of the five ratings and the 'no rating' rule
- [ ] #2 Market values are recomputed daily per segment and stored with their date and the comparables used
- [ ] #3 Negotiable, installment and placeholder prices never enter a market value
- [ ] #4 Every listing with enough comparables gets a deal rating and a price gap; the rest get 'no rating'
- [ ] #5 Accuracy is reported as median absolute percentage error per tracked model, on listings posted after a release's cut date (CS-49)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-2 (2026-09-27, ADR-0014, proposed): round aggregates of amounts to whole tomans in SQL before a DTO reads them (round(avg(x))::bigint; percentile_cont returns double precision, exact for these integers); store estimates as whole tomans in bigint _toman columns with their range CHECK. Valuation segments read model_year_sh. Rounding to three significant digits is display only (CS-3 formatter).

CS-2 review (2026-09-27): a stated (1399, 2021) and a Gregorian-only 2021, stored as model_year_sh 1400, land in different solar years. Let comparables take a year either side where model_year_written differs, or adjust for it.

Planning session of 2026-09-28 (ADR-0017):
- No longer waits for CS-55. Leave duplicate groups out of the comparables once CS-55 lands, and same-source reposts before that.
- Condition: Divar's structured seller scores (CS-34) come first, and the model's paint and body facts once CS-52 lands.
- A listing that has left the market stays a comparable at its last asking price, within the window: market values do not need removals detected, only the pages do.
- Estimate in the worker and store the parameters per segment, so the rating of any listing, a pasted one included, is applied in SQL from stored numbers, and search sorts on it.
- The backtest is time-based: learn before a release's cut, test after it.
- CS-73 checks the ratings against what the market did next.

2026-09-28, from the field survey: the best-measured valuation among other entrants (Capot, a gradient-boosted model on log price) reports a median error of 7.6 % on a random 20 % hold-out. Report ours on the time split of criterion 5 and on a random split, so the two can be compared honestly; the time split is harder. Capot also prices negotiable («توافقی») listings: show a market value, but no rating, on a listing without an asking price.

Renumbered on 2026-09-29: this task was CS-12 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-12; the archived CS-12 points here.
<!-- SECTION:NOTES:END -->
