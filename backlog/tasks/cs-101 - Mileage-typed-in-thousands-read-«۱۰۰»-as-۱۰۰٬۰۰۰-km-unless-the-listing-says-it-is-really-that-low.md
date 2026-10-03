---
id: CS-101
title: >-
  Mileage typed in thousands: read «۱۰۰» as ۱۰۰٬۰۰۰ km unless the listing says
  it is really that low
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-03 18:10'
updated_date: '2026-10-03 19:16'
labels:
  - backend
  - frontend
dependencies: []
priority: high
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-03: on Divar some sellers write the mileage in thousands (100 meaning 100,000 km), others really mean 100 km (a zero-km car). If the text says so (صفر خشک, ۱۰۰ کیلومتر کارکرد واقعی, «۱۰۰ دانه» and similar wordings) the figure is really that low; if nothing says so and the asking price matches a car of 100,000 km rather than a near-new one, assume thousands. Today CS-86 leaves an implausible mileage unread (null) and valuation then lacks it; the figure should instead be read the likelier way, marked as assumed, and explained to the buyer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A mileage below a plausibility floor for the car age (the CS-86 rule) is read in one of three ways by code, with the evidence stored: really that low (the listing text states a zero-km or exact low mileage: صفر خشک, کارکرد واقعی, «۱۰۰ کیلومتر» in the text, and similar wordings, collected from real posts), in thousands (no such wording and the asking price is much closer to the market value of the car at 1000 times the figure than at the figure itself), or unread (neither; as today)
- [x] #2 A mileage read in thousands is stored as the assumed value with a flag and the written figure, valuation and search use the assumed value, and every place that shows it says so in Farsi (for example «۱۰۰ کیلومتر نوشته شده؛ با توجه به قیمت و سال، احتمالاً ۱۰۰٬۰۰۰»), with an info control that explains the rule
- [x] #3 The rule is measured on the listings we hold: how many are affected, how many fall in each reading, a sample of 30 checked by eye with the listing text, and the false-assumption rate on a labelled sample is reported; the thresholds are chosen from that data and recorded
- [x] #4 No language model is needed or used for this; the code reads the text wordings and the price
- [ ] #5 After the merge the listings are re-derived and valuation re-run on main, and the changed ratings are counted; checks pass with tests for each reading, docs and the data model updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions are in ADR-0040: words first (mileage-wording.ts), then the valuation run reads by price (valuation/mileage.ts: price at most 1.15 times the value at 1000 times the figure, value at the written figure at least 1.15 times it, at most 40,000 km a year); mileage_km stays the one effective value; four columns keep the evidence; thousands_price listings never enter the fit; parser version 6. Measurement: docs/evidence/listing-facts/2026-10-03-mileage-in-thousands.md (82 affected: 21 really low, 4 thousands by text, 20 by price, 37 unread; 0 of 17 text-proven near-new cars would be read as thousands; sample of 30 by eye). Owner example listing 2316 (1405 car at 70 km) is a new car and never touched; the wording «راه رفته» is tested. AC5 post-merge part (re-derive and valuation on main, changed ratings counted) is the coordinator: lane before/after is in the evidence file.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
POST-MERGE ON MAIN: pnpm db:migrate; restart the worker; pnpm derive:listings (6,088 derived; expect 82 listings with a reading: 21 really_low, 4 thousands_text, 57 unread); pnpm valuation:run (reads 20 of the 48 unread in thousands by price: thousands_price 20, unread 37; the log line has mileageTested 48, mileageThousands 20); pnpm search:rebuild. Expected on the lane copy of 2026-10-03: comparables 3,987 to 4,005, valued 5,187 to 5,222, rated 3,686 to 3,716, 32 listings gain a rating, 2 lose one, 70 move a bucket. Evidence: 27 parser tests, wording tests, 2 db tests (derive carry-over, run decisions), constraint test, search table test, 4 Playwright runs (phone and desktop, card and listing page), pnpm check and pnpm db:check green.
<!-- SECTION:FINAL_SUMMARY:END -->
