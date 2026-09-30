---
id: CS-35
title: >-
  Keep listings fresh: inventory sweeps, lifecycle and re-checks within a daily
  request budget
status: To Do
assignee: []
created_date: '2026-09-28 22:11'
updated_date: '2026-09-30 09:08'
labels:
  - crawler
  - backend
milestone: m-2
dependencies:
  - CS-33
references:
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
  - docs/research/2026-09-28-listing-data-and-freshness.md
  - docs/design/data-model.md
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0017 (2026-09-28): Carshenas keeps a live index, not a crawled sample, because a deal rating is only true of a car that is still for sale at the price shown, and Torob names price freshness («تازگی قیمت») as one of the three things every search is about. CS-33 brings new listings in; this task keeps the index current without reading every listing every day. At ADR-0008's floor of one request per three seconds, a host allows at most 28,800 requests a day, while one list page returns about 25 listings, so list pages carry the whole market and detail requests are spent only where they change what a buyer sees. Listings leave the market (sold, expired, gone) and must stop appearing; prices change and must become price events; freshness is measured and shown, not assumed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A daily sweep reads every Divar Tehran car listing from list pages only, refreshes when each was last seen, and records each model's count of active listings
- [ ] #2 A listing missing from a complete sweep is re-checked with one detail request and marked sold, expired or gone accordingly, and a listing past the source's own expiry is marked expired without any request
- [ ] #3 A price change seen in a list row or a detail becomes one price event, and a re-check that finds nothing changed stores no new snapshot
- [ ] #4 Each source has a configured daily request budget, spent in the priority order ADR-0017 sets, and each run reports what it spent on what
- [ ] #5 A re-check can be requested for one listing, as the listing page does when it is opened (CS-64); it goes through the same per-host queue and floor, and is skipped while the last check is younger than the freshness window
- [ ] #6 Freshness is measured per source and per tracked model: time from posting to first sighting, age of the last check of listings shown on results pages, and new and gone listings per day
- [ ] #7 Tests against a local stub prove the lifecycle transitions and the budget, and that no request bypasses the per-host floor
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-32 (2026-09-29, ADR-0018): the daily request budget belongs in the lane's lease, as one more condition of acquireLane in apps/worker/src/db/lane-store.ts (requests counted per source and Tehran day in the database), so no request is ever sent over budget whichever process sends it. ADR-0017's order (what comes last is dropped first) maps onto the lane's pg-boss priorities: when the budget left falls below a kind's reserve, the lane can stop claiming jobs under that priority (pg-boss work() takes minPriority) rather than claim and put them back. A job the budget refuses should end as LaneClosedError (closure waiting, until the next Tehran day), which puts it back without spending an attempt. Re-checks on open (criterion 5) are lane jobs of the source with a high priority.

Carried from CS-33 (2026-09-29; its research note, section 6, and data folder): (1) Divar's search reportedly stops at about 1,200 results (50 pages), and Tehran's largest models pass that within a day of sort times (Peugeot 206's 1,200 rows are about 21 hours), so a daily sweep of a tracked model must slice finer than brand_model (years or price ranges) or page by date, as torob-rental did; CS-33's measurement read 11 pages of the whole market and never reached the cap. (2) Queue a slice's next page ahead of new slices (depth-first), so Divar's paging cursors stay fresh and each count finishes within minutes; the runtime's enqueue has no priority option yet. (3) Publish the time from a listing's posting to its snapshot with the other freshness figures: CS-33 did not measure it live, since discovery had no tracked models until the measurement ended. (4) Runtime hardening from CS-33's reviews: a failure of stopSource or releaseLane after an answer arrives (runtime/lane-client.ts) leaves the request unlogged and may leave a block without its stop; crawlStep sets progress.succeeded inside the step's transaction; fetch_log_stops_on_block and openCrawlRun lock source and crawl_run in opposite orders (no deadlock while one lane job runs at a time). (5) Ten tracked models imply about 9,300 requests a day, within the 14,400 ceiling.

From CS-34 (2026-09-30): once CS-34 is on main, every detail the crawler stores derives the listing's attributes, photo addresses and unparsed values in the same transaction. After the first live discovery, run pnpm derive:listings for the snapshots stored before the merge, and send its value not read and row not known lines to the parser (apps/worker/src/sources/divar/attributes.ts): its vocabulary comes from 4,720 listings of 2026-09-17, three posts of 2026-09-29 and Divar's own filter lists, and the seller's scores were seen only on sound cars.
<!-- SECTION:NOTES:END -->
