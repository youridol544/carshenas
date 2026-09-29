---
id: CS-65
title: Paste a listing link for an instant deal rating
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - frontend
  - backend
  - ai
milestone: m-5
dependencies:
  - CS-64
  - CS-53
references:
  - docs/decisions/0008-crawl-only-what-sources-allow.md
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
priority: high
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The demo's wow moment: a buyer pastes the link of a listing they are looking at and gets its rating and explanation in seconds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Links from crawled sources are rated from our data, or fetched once politely under ADR-0008 if we have not seen them
- [ ] #2 Divar links are read through the same public web API the Divar crawler uses (ADR-0008 point 3)
- [ ] #3 Unsupported or broken links get a clear Farsi message
- [ ] #4 The rating appears within five seconds for a link from a supported source
- [ ] #5 A link to a listing of an untracked model gets a clear Farsi answer and is counted as demand in the superadmin section's list of untracked models (CS-53)
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

2026-09-28: raised to high. It is the one feature every reviewer can try with their own input, a Divar link they are looking at, and it is ADR-0017 point 8, the only on-demand read besides the re-check on open. The web app enqueues the job with pg-boss and waits for its rows.

Renumbered on 2026-09-29: this task was CS-19 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-19; the archived CS-19 points here.

2026-09-29: once search files and crawl requests exist (CS-70, CS-71), the answer for an untracked model offers «بسپارش به کارشناس», which raises a crawl request.
<!-- SECTION:NOTES:END -->
