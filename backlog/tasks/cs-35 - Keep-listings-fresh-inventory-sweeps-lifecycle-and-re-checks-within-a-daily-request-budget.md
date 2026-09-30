---
id: CS-35
title: >-
  Keep listings fresh: inventory sweeps, lifecycle and re-checks within a daily
  request budget
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:11'
updated_date: '2026-09-30 09:00'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Owner decisions, 2026-09-30 (asked with recommendations, all recommended options chosen): a list-row price change is its own evidence (a price event cites a snapshot or the list fetch, exactly one); lane G is the only lane that crawls Divar live (the owner pauses Divar in lane F first); Divar's daily budget is 12,000 requests; buyers' re-checks arrive through a request table the web app writes and a worker job drains every minute; CS-33's three runtime hardening items are fixed here.
1. Migration: crawl_run.kind + sweep, recheck, expire; listing.expires_at and last_checked_at; source.daily_request_budget (CHECK: at most half of what the interval allows a day; Divar 12,000); a per-Tehran-day request counter on crawl_lane; listing_price_event evidence (snapshot or fetch_log, exactly one); listing_recheck_request (one pending row per listing) with grants; data-model.md and codegen updated; database-reviewer pass.
2. Budget in the lane lease: acquireLane counts each request against the Tehran day and refuses a kind whose reserve the remaining budget no longer covers (ADR-0017 order: discovery, re-checks, new details, tracked sweep and its checks, backfill, untracked sweep); a refused job waits for the next Tehran day without spending an attempt or a put-back; the closure is read from the database.
3. Sweep job: daily for tracked models, weekly for the rest, list rows only, sliced below the ~1,200-row search cap, next page ahead of new slices; refreshes last_seen_at, records list-row price events and model_volume; a complete sweep queues one detail check per missing listing.
4. Lifecycle: parse unavailable_after into expires_at; a request-free job marks listings past expiry expired; a detail check marks sold, expired or gone from Divar's answer (learned live) and sets last_checked_at; an unchanged answer stores no snapshot.
5. Re-check: request table drained every minute into high-priority lane jobs, skipped while the last check is younger than 6 hours.
6. Reports: each run records its spend by kind; SQL views for freshness per source and tracked model (posting to first sighting, age of last check of active listings, new and gone per day); runbook updated.
7. Hardening: stopSource/releaseLane failure after an answer, succeeded set outside the step transaction, one lock order.
8. Tests against the stub for lifecycle, budget across a Tehran day, and the floor across every kind; pnpm check and db:check.
9. Live: one full sweep of Divar Tehran within the budget from lane G, with the evidence in the notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-32 (2026-09-29, ADR-0018): the daily request budget belongs in the lane's lease, as one more condition of acquireLane in apps/worker/src/db/lane-store.ts (requests counted per source and Tehran day in the database), so no request is ever sent over budget whichever process sends it. ADR-0017's order (what comes last is dropped first) maps onto the lane's pg-boss priorities: when the budget left falls below a kind's reserve, the lane can stop claiming jobs under that priority (pg-boss work() takes minPriority) rather than claim and put them back. A job the budget refuses should end as LaneClosedError (closure waiting, until the next Tehran day), which puts it back without spending an attempt. Re-checks on open (criterion 5) are lane jobs of the source with a high priority.

Carried from CS-33 (2026-09-29; its research note, section 6, and data folder): (1) Divar's search reportedly stops at about 1,200 results (50 pages), and Tehran's largest models pass that within a day of sort times (Peugeot 206's 1,200 rows are about 21 hours), so a daily sweep of a tracked model must slice finer than brand_model (years or price ranges) or page by date, as torob-rental did; CS-33's measurement read 11 pages of the whole market and never reached the cap. (2) Queue a slice's next page ahead of new slices (depth-first), so Divar's paging cursors stay fresh and each count finishes within minutes; the runtime's enqueue has no priority option yet. (3) Publish the time from a listing's posting to its snapshot with the other freshness figures: CS-33 did not measure it live, since discovery had no tracked models until the measurement ended. (4) Runtime hardening from CS-33's reviews: a failure of stopSource or releaseLane after an answer arrives (runtime/lane-client.ts) leaves the request unlogged and may leave a block without its stop; crawlStep sets progress.succeeded inside the step's transaction; fetch_log_stops_on_block and openCrawlRun lock source and crawl_run in opposite orders (no deadlock while one lane job runs at a time). (5) Ten tracked models imply about 9,300 requests a day, within the 14,400 ceiling.

Slice 1 (schema), 2026-09-30: seven migrations 20260930083111..083313: crawl_run.kind + sweep, check, recheck; listing.expires_at, last_checked_at; source.daily_request_budget (range CHECK against the interval, required when crawled; Divar 12,000) and crawl_lane.budget_day/budget_spent; listing_price_event.fetch_log_id with exactly-one-evidence CHECK (snapshot_id nullable, intentional Squawk ignore); listing_recheck_request with one pending row per listing (web inserts listing_id only, worker handles). New constraints NOT VALID then validated; FK index built concurrently. Schema tests added (84 pass); test sources in web, worker and e2e fixtures now carry a budget; two existing tests adjusted (backfill is the invalid kind example; TRUNCATE fetch_log needs CASCADE now that price events reference it). pnpm check and pnpm db:check pass. data-model.md section 3 updated.

Slice 2 (budget in the lease): runtime/budget.ts sets six tiers in ADR-0017's order by job priority (discovery >=60 reserve 0; buyer re-checks >=50 2 %; new listings >=40 5 %; tracked sweep and its checks >=30 10 %; backfill >=20 20 %; untracked sweep and measurements 30 %). acquireLane counts each lease against the Tehran day in crawl_lane (budget_day, budget_spent) in the same statement and refuses a lease that would eat a higher tier's reserve. The supervisor reads the day's spend from the database and subscribes with pg-boss minPriority, so dropped kinds stay queued untouched; a spent day closes the lane (over_budget) until Tehran midnight. A job refused for budget in a race is put back without an attempt and is exempt from maxPutBacks. Tests: budget.test.ts (tiers), lane-client.test.ts (turnOf), budget.db.test.ts (budget 4 with 2 spent: discovery spends the last two, the sweep stays queued with its attempts, the lane closes over_budget, a new Tehran day runs the sweep). Runtime db tests 17/17 and unit 71/71 pass.
<!-- SECTION:NOTES:END -->
