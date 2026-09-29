---
id: CS-58
title: >-
  Filters and catalogues as declarative definitions shared by search, the home
  page and search files
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
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
