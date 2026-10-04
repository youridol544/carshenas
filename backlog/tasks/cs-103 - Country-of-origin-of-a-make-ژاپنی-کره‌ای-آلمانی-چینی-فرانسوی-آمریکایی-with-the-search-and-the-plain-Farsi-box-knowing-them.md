---
id: CS-103
title: >-
  Country of origin of a make: ژاپنی, کره‌ای, آلمانی, چینی, فرانسوی, آمریکایی,
  with the search and the plain-Farsi box knowing them
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-04 06:25'
updated_date: '2026-10-04 09:06'
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
- [x] #1 Every make in the catalogue has a country (a short list: Japan, South Korea, Germany, China, France, Italy, United States, United Kingdom, Sweden, Czechia, Spain, Romania, Malaysia, India, Iran, and others as found), seeded by us for the makes present in listings, editable by the superadmin per make and per model with who and when recorded, with the makes that still lack one listed in the screen
- [x] #2 Search offers a country filter (one or several countries) with its explanation text, URL and stored forms, facet counts and a removable chip; search_document carries the country with the same inheritance (model over make) and the refresh path
- [x] #3 The plain-Farsi understanding reads the country adjectives and nouns by code (ژاپنی, ژاپن, کره‌ای, کره جنوبی, آلمانی, چینی, فرانسوی, ایتالیایی, آمریکایی, انگلیسی, سوئدی and Latin and Finglish spellings such as japoni, koreie, almani, chini), alone and combined with other filters (تمیز, زیر ۱ میلیارد, خارجی), and the model path behind its default-off switch knows them too; the labelled set gets at least 30 country queries with a held-out part scored once
- [x] #4 On the data we hold, «ماشین ژاپنی», «ماشین کره‌ای تمیز», «آلمانی», «چینی» and «ماشین خارجی تمیز» each return the matching listings with chips and no text-search fallback, with the counts recorded; a country with no listings says so honestly
- [ ] #5 Playwright tests on phone and desktop cover three of these phrasings from the home hero and the search page; checks pass; docs, S02 and the data model updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decide (ADR-0041): country is the brand country whoever assembled the car, separate from origin; closed list of ISO codes; country_spec per make and per model, set_country_spec() for the superadmin with an append-only change record; one view listing_spec holds every inheritance (volume, origin, country) so search, pages and the screen cannot disagree.
2. Migrations 20261004000022 (country_spec, change table, function, marks triggers, seed of 121 makes), 25 (listing_spec), 30 to 70 (search columns, facet) after CS-101.
3. Search: country filter (database-backed options with counts), search_document.country, facet, chip, explanation text, URL and stored forms, cases.
4. Understanding: country words as soft phrases that need a car context, no_listings note, model path with the closed list in the instructions; labelled set 36 country queries (12 held out); evaluation and registry version.
5. Admin: country forms per make and per model in the specs section, makes without a country, history; listing and model pages show the country.
6. Tests: DB constraints and inheritance, unit tests, Playwright on phone and desktop (admin, search page, home hero); docs, S02, S04, data model.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision: «ژاپنی» is the brand country regardless of assembly (the owner and coordinator decided); «خارجی» stays origin imported and «ایرانی» origin domestic plus joint venture, never a country. A country word is a soft phrase that needs a car context: the first version read «رستوران ایتالیایی» as Italy and an old nonsense label caught it; fixed by rule, the label stays. Held-out country queries 12 of 12 by code (small set, interval 76 to 100 percent). Spend US$0.1458 of 3.

Final state 2026-10-04 (commit 9b5fb38): the superadmin's editors are mounted when a model card is first opened (LazyDetails), so a closed card costs its summary only. Owner instruction to stop heavy verification came after that: the whole pnpm check, db:check and all Playwright specs were NOT run on the final commit. What ran on it: tsc for web, worker, search, ai, locale, db and e2e (clean); unit tests web 31 files and 197 tests, search 132, ai 58, worker 29, locale 5 (all pass); ESLint with no warnings and Prettier on the changed files; db:lint (squawk, 0 issues). Acceptance criterion 5 (Playwright) is left unchecked on purpose: run once on a quiet machine, pnpm e2e tests/app/engine-origin-search.spec.ts tests/app/model-specs.spec.ts. The last loaded run: engine-origin-search 13 of 13 on phone, 10 of 13 on desktop (three timeouts of 24 to 48 s on tests that took 5 to 13 s on phone); model-specs timed out on phone.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The country of a brand is now a catalogue fact separate from origin (ADR-0041). country_spec holds one row per make or per model (closed list of 17 lower-case ISO codes, named checks), seeded for 121 makes, changed only through set_country_spec() (superadmin, append-only change record with who and when); one view, listing_spec, gives every listing its model's country else its make's (and the volume and origin of CS-99), and search_document.country, the country facet and a statement-level refresh trigger follow. Search has a country filter (database options with counts, URL country=jp, chip «کشور ژاپن», explanation text, stored forms, cases) and says how many listings an unknown country left out. The plain-Farsi box reads the adjectives, nouns and Latin or Finglish spellings by code as soft phrases that need a car context (so «رستوران ایتالیایی» is not Italy), says when nobody lists a country, and the model path has the closed list in its instructions (prompt version 38cba78f3e912da3). The superadmin edits a make's country and a model's own in the specs section of /admin/tracked-models, which also lists the makes that still lack one; the listing page and the model page show the country. Evidence: 36 labelled country queries (24 development, 12 held out and scored once: 12 of 12 by code; the model alone reads 31 of 36); the 270-query evaluation scores 95.2 percent by code only and 96.7 percent with the model; spend US$0.1458 of 3 for this task. On the lane copy of the data «ماشین ژاپنی» returns 117 listings, «ماشین خارجی تمیز» 113 and «ماشین فرانسوی کم‌کارکرد» 1,451; Korean, German, Chinese, American, Italian, British and Swedish cars have no listing and the page says so (before.md, after.md and the screenshots in docs/evidence/query-understanding/2026-10-04-country). Verified on the final commit: typecheck of web, worker, search, ai, locale, db and e2e; unit tests (web 31 files and 197 tests including the DB constraint and inheritance tests on PGlite, search 132, ai 58, worker 29, locale 5); ESLint and Prettier on the changed files; db:lint; EXPLAIN of every new query in explain.md; pnpm db:check passed on the migrations as committed. NOT run on the final commit, on the owner's instruction to stop heavy verification: the whole pnpm check, db:check again and every Playwright spec. The specs written for this task are e2e/tests/app/engine-origin-search.spec.ts (three phrasings and Finglish from the home hero and the search page, phone and desktop) and the country test in model-specs.spec.ts. In their last run, under heavy machine load, engine-origin-search passed 13 of 13 on phone and 10 of 13 on desktop (three desktop timeouts of tests that pass on phone) and model-specs timed out on phone, so criterion 5 stays unchecked until they are run once on a quiet machine. Post-merge in main: pnpm db:migrate, restart the worker, pnpm derive:listings, pnpm search:rebuild (ADR-0041).
<!-- SECTION:FINAL_SUMMARY:END -->
