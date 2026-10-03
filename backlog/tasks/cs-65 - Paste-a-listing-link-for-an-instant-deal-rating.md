---
id: CS-65
title: Paste a listing link for an instant deal rating
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-03 01:57'
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
  - docs/decisions/0033-pasted-links-answered-from-our-own-data.md
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Lane cs-65-paste-link (2026-10-03, owner away; coordinator reviews). Decisions in ADR-0031. 1) Migration create_paste_link_demand: wanted_link, model_demand, SECURITY DEFINER paste_rate_listing(id) (the wrapper CS-64 asked for) and record_paste_request(source, token) with caps; web role can only call them. 2) Parser readPastedLink (features/check-link): token from short and long Divar links, other site, not a link, Divar non-listing; runs in browser and server. 3) Loader: answerPastedToken reuses readListingPage; readListingPage now rates a listing with no stored valuation through the wrapper. 4) UI: PasteLinkForm (hero, search, /check), /check?link= answer page with rated card, unread, not found, off market, problems, skeleton, error. 5) Tests: unit (parser), schema constraints, db test against the scratch database, Playwright phone and desktop, stress matrix entries. No request to Divar from this lane or from the feature; no model call, no Metis credit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-4 (2026-09-27): Divar is a source with access_method official_api and listing_visibility requester_only; a constraint already stops it from ever being switched to crawling. Open questions routed here (docs/design/data-model.md): how long a pasted listing is kept, and a guarantee that it never enters search. fetch_log then gains paste_request_id, and its cause becomes a crawl run or a paste request.

Changed on 2026-09-27: Divar is now crawled (ADR-0008 point 3), so pasted Divar links no longer wait for Kenar access; they are read like any crawled source.

2026-09-28: raised to high. It is the one feature every reviewer can try with their own input, a Divar link they are looking at, and it is ADR-0017 point 8, the only on-demand read besides the re-check on open. The web app enqueues the job with pg-boss and waits for its rows.

Renumbered on 2026-09-29: this task was CS-19 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-19; the archived CS-19 points here.

2026-09-29: once search files and crawl requests exist (CS-70, CS-71), the answer for an untracked model offers «بسپارش به کارشناس», which raises a crawl request.

Owner, 2026-09-30: the user entry point must be built in the front end too (a visible place to paste a link, e.g. on the home page and search page), not only the backend.
<!-- SECTION:NOTES:END -->
