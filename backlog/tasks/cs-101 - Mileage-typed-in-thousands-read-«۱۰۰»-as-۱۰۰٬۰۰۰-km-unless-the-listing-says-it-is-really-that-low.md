---
id: CS-101
title: >-
  Mileage typed in thousands: read «۱۰۰» as ۱۰۰٬۰۰۰ km unless the listing says
  it is really that low
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-03 18:10'
updated_date: '2026-10-03 18:11'
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
- [ ] #1 A mileage below a plausibility floor for the car age (the CS-86 rule) is read in one of three ways by code, with the evidence stored: really that low (the listing text states a zero-km or exact low mileage: صفر خشک, کارکرد واقعی, «۱۰۰ کیلومتر» in the text, and similar wordings, collected from real posts), in thousands (no such wording and the asking price is much closer to the market value of the car at 1000 times the figure than at the figure itself), or unread (neither; as today)
- [ ] #2 A mileage read in thousands is stored as the assumed value with a flag and the written figure, valuation and search use the assumed value, and every place that shows it says so in Farsi (for example «۱۰۰ کیلومتر نوشته شده؛ با توجه به قیمت و سال، احتمالاً ۱۰۰٬۰۰۰»), with an info control that explains the rule
- [ ] #3 The rule is measured on the listings we hold: how many are affected, how many fall in each reading, a sample of 30 checked by eye with the listing text, and the false-assumption rate on a labelled sample is reported; the thresholds are chosen from that data and recorded
- [ ] #4 No language model is needed or used for this; the code reads the text wordings and the price
- [ ] #5 After the merge the listings are re-derived and valuation re-run on main, and the changed ratings are counted; checks pass with tests for each reading, docs and the data model updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
