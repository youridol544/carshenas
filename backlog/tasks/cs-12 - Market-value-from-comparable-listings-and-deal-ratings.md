---
id: CS-12
title: Market value from comparable listings and deal ratings
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 11:55'
labels:
  - backend
  - ai
milestone: m-4
dependencies:
  - CS-10
  - CS-11
references:
  - docs/decisions/0006-used-cars-modeled-on-cargurus.md
  - docs/research/2026-09-26-us-vertical-search-analogs.md
priority: high
ordinal: 12000
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
- [ ] #5 Accuracy on held-out listings is reported as median absolute percentage error
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
<!-- SECTION:NOTES:END -->
