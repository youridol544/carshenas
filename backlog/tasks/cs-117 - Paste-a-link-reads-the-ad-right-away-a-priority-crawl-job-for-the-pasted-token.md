---
id: CS-117
title: >-
  Paste a link reads the ad right away: a priority crawl job for the pasted
  token
status: To Do
assignee: []
created_date: '2026-10-04 09:29'
labels:
  - backend
  - frontend
dependencies:
  - CS-115
priority: high
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-65 and CS-115 answer a pasted link from our own data, and an ad we have not read is only queued. With the crawl running, the buyer should get the rating in seconds: the page asks the worker to read that one ad at top priority through the source’s lane (paced, within the budget), and shows the answer when it arrives. The challenge video shows a pasted live link, and a reviewer will paste a link of their own.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A pasted Divar token that is not in our data and whose car is covered becomes a top-priority job in the source’s lane, read once through the public post endpoint, at most once per token per day, with the lane’s pacing, the budget reserve for buyers’ requests and the stop-on-block rules unchanged; the web app never sends a request to the source itself (it records the wish, the worker reads)
- [ ] #2 The answer page shows an honest waiting state that says what is happening and replaces itself with the rating when the ad has been read and valued, or says plainly why not after about a minute (the ad is gone, the car is outside our coverage, the crawl is stopped), without a manual reload
- [ ] #3 The newly read ad gets its attributes, its valuation (through the existing on-the-spot rating) and appears in search after the normal refresh; a car outside our coverage is never read (the CS-115 answer applies)
- [ ] #4 Abuse limits: per-address and global caps, one pending job per token, junk tokens cost one lookup; worker database tests with the stub source cover priority, once per token, pacing, the block stop and the caps; copy follows the product voice guide; no end-to-end run is needed per change
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
