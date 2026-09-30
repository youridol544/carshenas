---
id: CS-83
title: 'Site-capture: redact URL fragment values in reports'
status: To Do
assignee: []
created_date: '2026-09-30 08:16'
labels:
  - tooling
dependencies: []
priority: low
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in CS-56 (2026-09-30): pnpm capture of an Autolist listing opened as a URL fragment (#latitude=…&vin=…) printed the fragment's values (coordinates, a VIN) into tokens, tech and api reports, which --distill copies into the repository. Query values are already reduced to names; fragment values are not. Hand-reduced in docs/research/captures/autolist-listing-phone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A capture of a URL whose fragment holds name=value pairs writes only the names, never the values, into every report
- [ ] #2 pnpm capture:test plants a fragment value in the fixture and fails if it reaches a report
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
