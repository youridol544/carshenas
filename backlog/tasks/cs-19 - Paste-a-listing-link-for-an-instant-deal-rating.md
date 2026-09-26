---
id: CS-19
title: Paste a listing link for an instant deal rating
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
labels:
  - frontend
  - backend
  - ai
milestone: m-5
dependencies:
  - CS-17
references:
  - docs/decisions/0008-crawl-only-what-sources-allow.md
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The demo's wow moment: a buyer pastes the link of an ad they are looking at and gets its rating and explanation in seconds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Links from crawled sources are rated from our data, or fetched once politely under ADR-0008 if we have not seen them
- [ ] #2 Divar links are read only through the Kenar API once access is granted; until then the page says Divar links are not supported yet
- [ ] #3 Unsupported or broken links get a clear Farsi message
- [ ] #4 The rating appears within five seconds for a link from a supported source
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
