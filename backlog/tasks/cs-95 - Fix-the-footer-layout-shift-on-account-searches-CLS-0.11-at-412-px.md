---
id: CS-95
title: Fix the footer layout shift on /account/searches (CLS 0.11 at 412 px)
status: To Do
assignee: []
created_date: '2026-10-03 03:11'
labels:
  - frontend
dependencies: []
priority: low
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design review of CS-72 measured a cumulative layout shift of 0.11 at 412 px on /account/searches: the site footer grows from 0 to about 677 px at 1.5 s, when the page body arrives. Probably pre-existing (the footer credits mount late). Reserve the footer height or stop it mounting late; re-measure with craft-checks.js.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The footer does not change height after first paint on /account/searches and the page's CLS at 412 px is under 0.1
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
