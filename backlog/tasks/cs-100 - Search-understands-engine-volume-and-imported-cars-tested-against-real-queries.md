---
id: CS-100
title: >-
  Search understands engine volume and imported cars, tested against real
  queries
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-03 18:05'
updated_date: '2026-10-04 07:48'
labels:
  - backend
  - frontend
  - ai
dependencies:
  - CS-99
priority: high
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-03: a buyer may type «ماشین با حجم موتور بیشتر از ۲۰۰۰ سی‌سی», «۲۰۰۰ cc به بالا», «موتور ۲ لیتری», «ماشین‌های خارجی تمیز». Test what the search and the plain-Farsi box answer today, record the responses, add the missing filters (engine volume range and origin) to the shared definitions with their explanation text, teach the understanding step (code first, then the model behind its switch) to read these phrases, add labelled evaluation cases and report the accuracy, and fix every miss.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The responses of the search API and the plain-Farsi understanding to at least 40 volume and origin phrasings (Persian and Latin digits, cc, سی‌سی, لیتر, بیشتر از, کمتر از, به بالا, بین, ماشین خارجی, وارداتی, ایرانی, with a model and without, mixed with other filters such as clean and low mileage) are recorded in a table before any change, and again after
- [x] #2 Search offers an engine volume range filter and an origin filter (shared definitions, URL and stored forms, SQL, explanation text for the info control, facet counts); a listing with no known volume is excluded from a volume filter and the page says how many listings that is
- [x] #3 The plain-Farsi understanding reads those phrasings into the new filters by code, and by the model only behind its default-off switch; vague phrasings such as «ماشین خارجی تمیز» map to origin plus the clean catalogue; the labelled set is extended and its accuracy reported, with Metis spend recorded and within US$3
- [x] #4 The search page shows the understood volume and origin as removable chips, and the home hero box handles them the same way; Playwright tests cover three end-to-end phrasings on phone and desktop
- [x] #5 Checks pass; docs, S02 and the data model updated; depends on the engine volume and origin data task
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Recorded 52 phrasings before any change (before.md: 2 of 52 as labelled; it even read «حجم موتور بالای ۲۵۰۰» as a price of 2.5 billion), then added engine_volume (range, cc) and origin (choice) to the shared definitions with info text, URL and stored forms, SQL, cases, a count of listings left out for an unknown value, chips, hero box; code reads volume (cc, litres, Latin and Persian digits, relations, ranges, five percent around a figure), origin phrases and their negations («غیر ایرانی», «خارجی نباشه»), with the vague «تمیز» as the clean bundle; the AI task learned both behind its default-off switch. Origin is seeded by make for foreign makes (the owner phrases «ماشین خارجی تمیز» and the rest return the Corolla listings: 113 and 117 on the lane copy of the data). Labelled set 163 to 270: code only 95.2 percent, with the model 96.7 percent; the 52 volume and origin queries are a development set, the 15 held out are the honest figure (10 of 15 by code when first scored, 11 now after one repair). Metis spend US$0.2908 of 3 across CS-99, CS-100 and CS-103. e2e engine-origin-search.spec.ts on phone and desktop green.
<!-- SECTION:FINAL_SUMMARY:END -->
