---
id: CS-103
title: >-
  Country of origin of a make: ژاپنی, کره‌ای, آلمانی, چینی, فرانسوی, آمریکایی,
  with the search and the plain-Farsi box knowing them
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-04 06:25'
updated_date: '2026-10-04 06:26'
labels:
  - backend
  - frontend
  - ai
dependencies: []
priority: high
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: besides domestic or imported, the search must know the country a car comes from, so a phrase such as «ماشین ژاپنی», «کره‌ای», «آلمانی», «چینی», «فرانسوی», «آمریکایی», «ماشین ژاپنی تمیز» works. The country belongs to the make (Toyota: Japan, Kia and Hyundai: South Korea, BMW and Mercedes-Benz: Germany, Chery and MVM: China, Renault, Peugeot and Citroen: France, Ford and Chevrolet: United States, Iranian designs: Iran), optionally corrected per model, and is edited by the superadmin in the same specs screen as the engine volume (CS-99). Where the car was built or sold from (domestic, joint-venture, imported) stays a separate attribute.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every make in the catalogue has a country (a short list: Japan, South Korea, Germany, China, France, Italy, United States, United Kingdom, Sweden, Czechia, Spain, Romania, Malaysia, India, Iran, and others as found), seeded by us for the makes present in listings, editable by the superadmin per make and per model with who and when recorded, with the makes that still lack one listed in the screen
- [ ] #2 Search offers a country filter (one or several countries) with its explanation text, URL and stored forms, facet counts and a removable chip; search_document carries the country with the same inheritance (model over make) and the refresh path
- [ ] #3 The plain-Farsi understanding reads the country adjectives and nouns by code (ژاپنی, ژاپن, کره‌ای, کره جنوبی, آلمانی, چینی, فرانسوی, ایتالیایی, آمریکایی, انگلیسی, سوئدی and Latin and Finglish spellings such as japoni, koreie, almani, chini), alone and combined with other filters (تمیز, زیر ۱ میلیارد, خارجی), and the model path behind its default-off switch knows them too; the labelled set gets at least 30 country queries with a held-out part scored once
- [ ] #4 On the data we hold, «ماشین ژاپنی», «ماشین کره‌ای تمیز», «آلمانی», «چینی» and «ماشین خارجی تمیز» each return the matching listings with chips and no text-search fallback, with the counts recorded; a country with no listings says so honestly
- [ ] #5 Playwright tests on phone and desktop cover three of these phrasings from the home hero and the search page; checks pass; docs, S02 and the data model updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
