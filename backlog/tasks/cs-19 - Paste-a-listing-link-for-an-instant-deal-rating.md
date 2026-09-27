---
id: CS-19
title: Paste a listing link for an instant deal rating
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 09:23'
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
- [ ] #2 Divar links are read through the same public web API the Divar crawler uses (ADR-0008 point 3)
- [ ] #3 Unsupported or broken links get a clear Farsi message
- [ ] #4 The rating appears within five seconds for a link from a supported source
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-4 (2026-09-27): Divar is a source with access_method official_api and listing_visibility requester_only; a constraint already stops it from ever being switched to crawling. Open questions routed here (docs/design/data-model.md): how long a pasted listing is kept, and a guarantee that it never enters search. fetch_log then gains paste_request_id, and its cause becomes a crawl run or a paste request.

Changed on 2026-09-27: Divar is now crawled (ADR-0008 point 3), so pasted Divar links no longer wait for Kenar access; they are read like any crawled source.
<!-- SECTION:NOTES:END -->
