---
id: CS-85
title: Teach the Divar parser the condition wordings and rows real posts use
status: To Do
assignee: []
created_date: '2026-09-30 11:05'
updated_date: '2026-10-02 16:21'
labels:
  - backend
milestone: m-3
dependencies:
  - CS-34
references:
  - apps/worker/src/sources/divar/attributes.ts
  - docs/design/data-model.md
priority: high
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-34's parser took its condition vocabulary from Divar's own filter lists and from a survey of 4,720 listings whose seller condition scores were all of sound cars. Its first run over real posts, the 120 listings in the main database on 2026-09-30, read the model year, mileage, fuel, price and seller type of all of them, but kept 32 condition values unparsed in listing_unparsed_value (body_condition: رنگ‌شدگی در ۱ ناحیه: 11; chassis_condition: تعیین‌نشده: 9; engine_condition: تعیین‌نشده: 7; body_condition: رنگ‌شدگی در ۳ ناحیه: 2; body_condition: رنگ‌شدگی در ۲ ناحیه: 1; chassis_condition: ضربه‌خورده: 1; gearbox_condition: تعمیر شده: 1) and reported three rows it does not know (ارزیابی فروشنده: شاسی جلو: 6; ارزیابی فروشنده: شاسی عقب: 6; تخفیف بیمهٔ ثالث: 6). Until the parser reads them, those listings have no body, engine, gearbox or chassis condition, which comparables (CS-51) and the condition filters (CS-58) read. The raw texts are stored, so no new crawl is needed: pnpm derive:listings applies a parser change to every stored listing. The run is logged outside the repository, in ~/Dev/carshenas-lane-archive/2026-09-30/lane-e/cs34-measurements/derive-main-2.log.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each seller condition wording the parser left unread on 2026-09-30 («تعمیر شده», «تعیین‌نشده», «رنگ‌شدگی در ۱ ناحیه», «رنگ‌شدگی در ۲ ناحیه», «رنگ‌شدگی در ۳ ناحیه», «ضربه‌خورده») is read into its attribute or counted as a form meaning unknown, with the reading of each recorded in docs/design/data-model.md
- [ ] #2 A wording that fits none of an attribute's values is given a new value by a migration or stays unparsed, as decided and recorded; it is never read as the nearest existing value
- [ ] #3 The rows «ارزیابی فروشنده: شاسی جلو», «ارزیابی فروشنده: شاسی عقب», «تخفیف بیمهٔ ثالث» are read into attributes or listed as rows the parser leaves out on purpose, so the derive command no longer reports them as unknown
- [ ] #4 The parser's version is raised, and pnpm derive:listings on the main database reports none of these texts or rows, with its counts before and after recorded on the task
- [ ] #5 Tests cover each new wording and row with fixtures made from real snapshots with personal data removed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Raised to High on 2026-10-02 (coordinator, from the CS-86 lane and its review): on the copy of main of that day 1,005 of 6,088 derived listings have no body condition because Divar writes «رنگ‌شدگی در N ناحیه» without the comma the parser expects (areas 1 to 3 were the only ones surveyed; the data also has 4 areas (46 listings) and 5 areas (8)), 359 have no chassis and 269 no engine condition («تعیین‌نشده»), 54 gearbox «تعمیر شده» and 26 «نیاز به تعمیر جزئی/اساسی». Valuation treats an unread body as intact, so a partly repainted car is valued as an intact one and rates too cheap; the 32-of-120 figures above are out of date. Pulled forward into the CS-58 to CS-72 run because it changes ratings across a sixth of the index.
<!-- SECTION:NOTES:END -->
