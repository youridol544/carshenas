---
id: CS-58
title: >-
  Filters and catalogues as declarative definitions shared by search, the home
  page and search files
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 20:46'
labels:
  - backend
  - search
milestone: m-5
dependencies:
  - CS-50
  - CS-51
  - CS-52
priority: high
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29: the search page, the home page and search files share the same premade catalogues. «پیشنهاد کارشناس» comes first, followed by the others that matter in Iran's used-car market. A catalogue is nothing more than a named set of filters. Adding or removing a filter or a catalogue must take one descriptive definition in code, not changes across pages. Sources (Divar, Bama and any added later) and body type are filters as well.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each filter is one definition: id, Farsi label and description, value type, URL parameter, validation schema and database predicate; adding or removing one touches only its definition and its test
- [ ] #2 Each catalogue is a named preset of filter values and a sort with a Farsi title, a description and the reason it exists; «پیشنهاد کارشناس» (well-rated listings in good condition) comes first, and the task chooses and documents the others that matter most in Iran's used-car market
- [ ] #3 The source and body-type filters read their options from the database (the sources, the catalogue's body types), so a new source or body type needs no code change
- [ ] #4 The search API, the search page, the home page and search files read the same definitions, and a search round-trips through the URL, the API and a stored search file with one serialisation and one schema
- [ ] #5 Tests cover each filter's predicate and each catalogue's results on fixtures, and a test fails when a definition lacks a label, a description or a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. New shared package packages/search (@carshenas/search): client-safe declarative definitions (filters, sorts, catalogues) with zod value schemas, Farsi label, description, chip text, buyer words for CS-62, URL parameter and a declarative predicate; one Search schema (q, filters, sort, catalogue) with one URL codec and one JSON codec for API bodies and stored search files.
2. Server side of the package: compile a Search to a Kysely WHERE and ORDER BY through named, tested SQL helpers, against any table or view that follows the row contract; read the dynamic options (make, model, trim, body type, city, district, source) from the database, only values with active listings.
3. Migration: view listing_filter_row, one row per listing with every column a filter reads (catalogue keys, effective body type, latest succeeded deal rating, colour family, merged declared condition and accepted text facts of the current extraction, has_photo, model rank); CS-59 materialises it into search_document with the same column names. Grants SELECT to web, worker and admin.
4. Tests: unit tests for schemas and codecs (round trip URL to Search to JSON to Search to URL), a registry test that fails when a filter or catalogue lacks a label, description or test case; integration tests on fixtures for every filter predicate and every catalogue result set, run by pnpm db:check.
5. Docs: spec S02 (every filter and catalogue with reasons, the vague-request presets for CS-62), ADR-0027 (declarative definitions in one package, the row contract, one serialisation), data-model.md, EXPLAIN of the options query and the view.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (the owner delegated every decision on 2026-09-30; ADR-0027 accepted by delegation, spec S02 approved the same way):
- Where the definitions live: a new workspace package @carshenas/search (options: a web feature folder, which the worker and CS-72 cannot import; one file per filter with its own SQL, which ships Kysely to the browser). Chosen: definitions as data, client-safe, with a closed set of predicate kinds turned into SQL by named helpers in sql.ts.
- What the SQL runs on: a view listing_filter_row, one row per listing with every column a predicate names, merging declared condition with the accepted text facts of the current extraction (options: text-fact columns on listing written by the derivation, which the owner kept to the price on 2026-09-30 and which needs a migration on the hot table; predicates on base tables with joins per filter, which CS-59 would rewrite). CS-59 materialises the view into search_document with the same names.
- Values in URLs and stored searches are slugs (make, make.model, make.model.trim, city), codes and whole numbers, never ids, so a stored search survives a copy between databases.
- One schema (SearchSchema) for the URL, the API body, stored search files ({ v: 1 }, catalogues always expanded) and plain-Farsi search; a URL value that fails is dropped and named, a stored one is refused.
- Semantics of text facts: exclusion filters (no accident, no replaced part, not ride-hailing, no free-zone plate) keep a listing that says nothing; positive ones (no paint, chassis intact) need the seller or the text to say so. Described in each filter.
- Popular model = the 15 models with the most active listings; low mileage for its age = at most 12,000 km per year of age (S01 counts 20,000 as normal; Tehran median about 16,000 on 2026-09-30), a car under a year counted as half a year.
- Catalogues (in order): پیشنهاد کارشناس, معامله‌های عالی زیر ۱ میلیارد, تمیز و بی‌دردسر, خانوادگی, کم‌کارکرد, دنده‌اتوماتیک, مناسب کار در تاکسی اینترنتی, فروش قسطی, تازه‌های امروز; each with its reason in code and in S02. The owner vague request for CS-62 maps to تمیز و بی‌دردسر (clean + technically sound + low mileage for age + popular model).

Measured on the lane (23,364 active listings, 2026-10-01), results per catalogue: karshenas-pick 100, great-deals-under-1b 44, clean-and-easy 592, family 481, low-mileage 847, automatic 69, ride-hailing 1,183, installments 217, new-today 2,552. EXPLAIN (ANALYZE, BUFFERS) of each catalogue first page 2 to 55 ms (docs/evidence/search-filters/2026-10-01/catalogue-plans.txt); a make and price filter 4 ms with the facts, popularity and catalogue joins removed by the planner; the filter options 42 ms counted by ids (155 ms when grouped by the view keys, so the query was changed), about 100 ms wall clock. The first version of the view read the facts through a per-listing LEFT JOIN LATERAL: 518 ms for the installments catalogue; grouped once over the extractions it is 43 ms.
<!-- SECTION:NOTES:END -->
