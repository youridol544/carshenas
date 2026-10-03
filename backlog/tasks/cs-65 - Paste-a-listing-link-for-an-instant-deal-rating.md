---
id: CS-65
title: Paste a listing link for an instant deal rating
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-03 02:21'
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
- [x] #1 A pasted Divar link whose listing is in our database is answered on the page with the same price, deal rating, market value and explanation as the listing page (numbers from the database); a listing the daily run did not rate is rated on the spot by the database from the run stored numbers
- [x] #2 The link is read by code into the listing token (short form, long form with the title, with or without scheme, www or m, inside a message), in the browser and on the server, with no model and no request to Divar or any listing site; a link whose listing we have not seen is not fetched (the crawl is paused, ADR-0033), is kept as a wanted link for the crawler and the buyer is told so honestly
- [x] #3 Unsupported or broken links get a clear Farsi message: another site is named and only Divar is supported, text that is not a link, a Divar address that is not one listing
- [x] #4 The rating appears within five seconds for a link whose listing we have
- [x] #5 A link to a listing whose model we do not read in depth gets a clear Farsi answer, similar rated listings, and is counted as demand for its model in model_demand, which the superadmin list of untracked models (CS-53) reads
- [x] #6 The user entry point exists in the front end: a prominent box for the link in the home page hero and on the search page, and its own route /check, phone first, with designed states (waiting, rated, unrated, unread, not found, left the market, wrong link, error)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Lane cs-65-paste-link (2026-10-03, owner away; coordinator reviews). Decisions in ADR-0033. 1) Migration create_paste_link_demand: wanted_link, model_demand, SECURITY DEFINER paste_rate_listing(id) (the wrapper CS-64 asked for) and record_paste_request(source, token) with caps; the web role can only call them. 2) Parser readPastedLink (features/check-link): token from short and long Divar links, other site, not a link, Divar non-listing; runs in the browser and on the server. 3) Loader: answerPastedToken reuses readListingPage; readListingPage now rates a listing with no stored valuation through the wrapper. 4) UI: PasteLinkForm (home hero, search page, /check), /check?link= answer page with the rated card, unread, not found, off market, problems, skeleton and error. 5) Tests: unit (parser), schema constraints, db test on the scratch database, Playwright phone and desktop, stress matrix entries. No request to Divar from the lane or the feature; no model call, no Metis credit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-4 (2026-09-27): Divar is a source with access_method official_api and listing_visibility requester_only; a constraint already stops it from ever being switched to crawling. Open questions routed here (docs/design/data-model.md): how long a pasted listing is kept, and a guarantee that it never enters search. fetch_log then gains paste_request_id, and its cause becomes a crawl run or a paste request.

Changed on 2026-09-27: Divar is now crawled (ADR-0008 point 3), so pasted Divar links no longer wait for Kenar access; they are read like any crawled source.

2026-09-28: raised to high. It is the one feature every reviewer can try with their own input, a Divar link they are looking at, and it is ADR-0017 point 8, the only on-demand read besides the re-check on open. The web app enqueues the job with pg-boss and waits for its rows.

Renumbered on 2026-09-29: this task was CS-19 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-19; the archived CS-19 points here.

2026-09-29: once search files and crawl requests exist (CS-70, CS-71), the answer for an untracked model offers «بسپارش به کارشناس», which raises a crawl request.

Owner, 2026-09-30: the user entry point must be built in the front end too (a visible place to paste a link, e.g. on the home page and search page), not only the backend.

2026-10-03 decisions (owner away, decided in the lane; ADR-0033): (1) The crawl is paused, so a link whose listing is not in our database is NOT fetched (the task original criteria 1 and 2 planned a polite fetch); it is kept in wanted_link (source, token, count, at most 5,000) for the crawler once the owner resumes it, and the buyer is told plainly. Criteria were reworded to match; options considered: fetch once (breaks the pause), refuse without keeping (loses the demand signal). (2) No model: the token is in the address, the label ai is left unused and no Metis credit was spent. (3) The data model planned paste_request; it was not built (the log line pasted link answered carries outcome and milliseconds); model_demand (layer 7) was built here, wanted_link is new. (4) readListingPage now rates an active listing with no stored valuation through paste_rate_listing, so a listing crawled after the last run has an analysis on its page too. (5) A listing seen on a list page only (price_type null) is the unread answer: it is counted for its model and offers rated listings of the same model; no model, no count. (6) Header: the /check link shows from 640 px only (a phone has the boxes on home and search; a third word wrapped the account button). (7) e2e keyboard walk cap raised from 80 to 100 stops: the home page (85 controls) and the CS-67 model page exceed 80 (a cost cap, not a quality bar). Follow-ups: the crawler reads wanted_link first when a source resumes; CS-53 reads model_demand; CS-70/71 may add the keep-this-for-me action to the not-found answer; a sign-up rate limit of this machine (58 minutes after repeated runs) fails the desktop accounts tests until it expires; main tests found stale/failing before this task: notifications.spec 115 and accounts.spec 337 (strict-mode matches on the footer and catalogue links).

Correction (2026-10-03, after merging main): the two tests named above as failing (notifications.spec 115, accounts.spec 337) pass on the merged code, mobile; they were fixed by main. The desktop accounts and notifications failures seen earlier were the machine sign-up limit (a message on the sign-up page said 58 minutes) and are not caused by this task.
<!-- SECTION:NOTES:END -->
