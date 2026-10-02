---
id: CS-87
title: Do not rate an instalment listing priced far below its market value
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-02 16:21'
updated_date: '2026-10-02 16:31'
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
- [ ] #1 A listing with accepts_installments true whose asking price lies 20 % or more below its market value gets its market value and price gap but no rating, with the reason installment_price, in valuation_rate_listing() so a pasted link and the daily run agree
- [ ] #2 A listing without that field, or with a smaller gap, keeps its rating: a cash listing at -45 % is not changed by this rule (the factor-of-three outlier rule still applies)
- [ ] #3 docs/specs/S01-deal-ratings.md states the rule and its threshold with the measurement behind it, and the data-status and listing pages can say why a listing is unrated through the existing reason
- [ ] #4 A database test seeds an instalment-accepting listing at -45 %, one at -15 %, and a cash listing at -45 %, and asserts the three outcomes; the numbers of rated listings and of «عالی» ratings before and after a run on a copy of main are recorded on the task
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
