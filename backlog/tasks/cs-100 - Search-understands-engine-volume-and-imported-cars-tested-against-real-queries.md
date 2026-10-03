---
id: CS-100
title: >-
  Search understands engine volume and imported cars, tested against real
  queries
status: To Do
assignee: []
created_date: '2026-10-03 18:05'
updated_date: '2026-10-03 18:05'
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
- [ ] #1 The responses of the search API and the plain-Farsi understanding to at least 40 volume and origin phrasings (Persian and Latin digits, cc, سی‌سی, لیتر, بیشتر از, کمتر از, به بالا, بین, ماشین خارجی, وارداتی, ایرانی, with a model and without, mixed with other filters such as clean and low mileage) are recorded in a table before any change, and again after
- [ ] #2 Search offers an engine volume range filter and an origin filter (shared definitions, URL and stored forms, SQL, explanation text for the info control, facet counts); a listing with no known volume is excluded from a volume filter and the page says how many listings that is
- [ ] #3 The plain-Farsi understanding reads those phrasings into the new filters by code, and by the model only behind its default-off switch; vague phrasings such as «ماشین خارجی تمیز» map to origin plus the clean catalogue; the labelled set is extended and its accuracy reported, with Metis spend recorded and within US$3
- [ ] #4 The search page shows the understood volume and origin as removable chips, and the home hero box handles them the same way; Playwright tests cover three end-to-end phrasings on phone and desktop
- [ ] #5 Checks pass; docs, S02 and the data model updated; depends on the engine volume and origin data task
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
