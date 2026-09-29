---
id: CS-71
title: 'Crawl requests: search files ask, the superadmin approves'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - backend
  - frontend
  - crawler
milestone: m-8
dependencies:
  - CS-53
  - CS-70
  - CS-68
  - CS-40
priority: high
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29 keeps two things apart:
- what Carshenas crawls: the tracked models (CS-53), chosen by the superadmin;
- what buyers ask for: search files (CS-70).

A search file for a model that is not tracked raises a crawl request. Only the superadmin turns a request into crawling, because capacity is limited by the request budget of ADR-0017. For each tracked model and each request, the superadmin sees the search files that depend on it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A search file for a make and model, optionally a trim, that is not tracked raises a crawl request; when a request or a tracked model already exists for it, the file is linked to that one, decided by a unique constraint, never by a check before the insert
- [ ] #2 The superadmin approves a request, which makes the model tracked and starts its backfill (CS-53), or declines it with a reason; nothing else creates a tracked model from a buyer's search
- [ ] #3 Every tracked model shows how it was created, by the owner or from an approved request, with who approved it and when
- [ ] #4 The superadmin sees, for every tracked model and every request, the search files that depend on it, and for every search file, the requests and tracked models it depends on
- [ ] #5 The approval or decline of a request notifies each buyer whose file raised it, once (CS-68)
- [ ] #6 Tests cover a request raised by two buyers becoming one request, an approval and a decline
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
