---
id: CS-100
title: >-
  Search understands engine volume and imported cars, tested against real
  queries
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-03 18:05'
updated_date: '2026-10-03 19:45'
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
Recorded 52 phrasings before any change (before.md: 2 of 52 as labelled; it even read «حجم موتور بالای ۲۵۰۰» as a price of 2.5 billion), then added engine_volume (range, cc) and origin (choice) to the shared definitions with info text, URL and stored forms, SQL, cases, a count of listings left out for an unknown value, chips, hero box; code reads volume (cc, litres, Latin and Persian digits, relations, ranges, five percent around a figure) and origin phrases, with the vague «تمیز» as the clean bundle; the AI task learned both behind its default-off switch. Labelled set 163 to 215: code only 95.8 percent (52 of 52 new), with the model 97.7 percent, model alone 61.5 percent of the 52; Metis spend US$0.1335 of 3. after.md 52 of 52. e2e engine-origin-search.spec.ts (phone and desktop) green.
<!-- SECTION:FINAL_SUMMARY:END -->
