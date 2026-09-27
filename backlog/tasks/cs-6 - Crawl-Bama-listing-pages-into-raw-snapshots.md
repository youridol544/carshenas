---
id: CS-6
title: Crawl Bama listing pages into raw snapshots
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 08:58'
labels:
  - crawler
  - backend
milestone: m-2
dependencies:
  - CS-4
  - CS-5
references:
  - docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md
  - docs/decisions/0008-crawl-only-what-sources-allow.md
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bama allows crawling of its car pages and embeds listing data in them, so it is the first source. Everything later (extraction, duplicates, valuation) is derived from raw snapshots, so snapshots must be complete, dated and immutable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A crawl of Tehran listings for the ten most-listed models stores one immutable snapshot per listing with URL, fetch time, content hash and raw data
- [ ] #2 The crawler enforces ADR-0008 in code: one request at a time per host with a configurable delay, a descriptive User-Agent, and a stop on any 403, 429 or challenge page, proven by tests against a local stub
- [ ] #3 Re-running the crawl stores a new snapshot only when the content changed and records price changes
- [ ] #4 Each crawl run reports counts, errors and duration
- [ ] #5 A health check proves the worker reaches PostgreSQL through its own pool and role (carried over from CS-4, whose original criterion covered the web app and the worker)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-28 (owner, 2026-09-27; ADR-0010): where a source's robots.txt and recorded terms allow it, the crawler also downloads the listing's photos, within the same politeness limits (one request at a time per host, the configured delay, a stop on 403, 429 or a challenge), and hands them to the ArvanCloud store that CS-29 builds. Record the photo URLs in the snapshot either way.

CS-4 (2026-09-27) prepared the tables: source, source_policy_check and the source_current_policy view, crawl_run, fetch_log, snapshot and the listing identity (db/migrations 20260927060001 to 04; docs/design/data-model.md). CS-6 adds: (1) the worker process and pg-boss 12 (ADR-0011): one crawl queue with localGroupConcurrency per source, follow-up jobs enqueued in the same transaction through Kysely, dead letters, schedules in Asia/Tehran, a short backstop poll with notify, a typed send helper, and no reliance on singletonKey outside singleton or throttled queues; (2) the carshenas_worker role with its own timeouts and table grants; (3) the cross-row backstop triggers from the research lab: a crawl run must cite its source's newest policy check, no older than policy_max_age_days and not not_allowed, on an enabled source; a fetch with outcome blocked, rate_limited or challenge stops the source (stopped_at, stop_reason) and the run in the same transaction (ADR-0008 point 6); no fetch is logged for a source that is not enabled; (4) upserts on listing_source_key_unique with a change guard, and snapshots deduplicated by (listing_id, content_sha256) with personal data removed before storage; (5) a fetch_log retention or partitioning decision before it grows; (6) moving src/server/db to packages/db when the worker imports it (ADR-0003 trigger); (7) a health check for the worker.

CS-4 review (2026-09-27): the worker role (carshenas_worker) needs SELECT on listing_status_transition, because listing_status_guard runs with the caller's rights, and it gets no TEMPORARY privilege (only carshenas_migrate may create temporary tables). The lifecycle guard checks inserts AFTER INSERT, so an upsert that finds a known listing sold (INSERT … ON CONFLICT ON CONSTRAINT listing_source_key_unique DO UPDATE SET status = excluded.status, delisted_at = excluded.delisted_at) works; fetch_log rows reference their listing as (listing_id, source_id), so a fetch of one source cannot point at another source's listing.

CS-4 review round 2 (2026-09-27): an expired or gone listing seen again must return to active in the same write (listing_gone_not_seen_since; the upsert in the database skill's kysely.md does it). Open for this task: whether a listing first seen already sold may be recorded (new to sold is not an allowed transition yet; sold listings would be useful comparables). TRUNCATE is refused on the append-only tables outside a purge.
<!-- SECTION:NOTES:END -->
