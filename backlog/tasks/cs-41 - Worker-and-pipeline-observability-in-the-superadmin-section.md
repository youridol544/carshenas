---
id: CS-41
title: Worker and pipeline observability in the superadmin section
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 15:38'
labels:
  - backend
  - frontend
  - infra
milestone: m-2
dependencies:
  - CS-40
  - CS-32
  - CS-33
  - CS-35
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29: the superadmin must see the worker without reading raw logs. That means whether it is alive, what its jobs are doing, what failed and why, what each source answered, how many listings came in and went out, and how fresh the index is. The crawler runs around the clock on a server in Iran from CS-37 on, so this comes right after the section exists. The numbers come from the database: pg-boss's job tables, crawl runs, the fetch log, listings and their price events.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The worker shows as alive or down, with its version, uptime and last heartbeat, and a stopped worker shows as down within a minute
- [ ] #2 Jobs show per queue and state (waiting, active, completed, failed, retrying, dead-lettered), with recent failures, their error and trace id, and the superadmin can retry or cancel a failed job
- [ ] #3 Crawl runs show per source with their state, duration, requests spent against the daily budget, and outcomes (ok, not modified, not found, gone, blocked, rate-limited, challenge, error)
- [ ] #4 Listings show per source and per tracked model: total, active, and new, changed and gone in the last hour, 24 hours, 7 days or a chosen window, with a chart over time and the median age of the last check
- [ ] #5 Source problems (blocks, rate limits, challenges and values the parser could not read) show with their time and evidence, and a stopped source links to resuming it (CS-40)
- [ ] #6 Every number comes from the database through measured queries, and each screen answers within one second at the demo's volume
- [ ] #7 Playwright tests cover the screens with seeded data
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research (done 2026-09-30): the section is /admin (dashboard) and /admin/sources (CS-40) on the carshenas_admin pool; the worker has no liveness row in the database, only GET /health on loopback; pg-boss 12 keeps jobs in pgboss.job (states created, retry, active, completed, cancelled, failed; dead letters are jobs of the dead-letter queue) and cached counts in pgboss.queue; crawl_run, fetch_log (outcomes), crawl_lane (budget_spent, cooldowns), source (stops), listing (created_at, delisted_at, last_checked_at, source_model_key), listing_price_event, snapshot, listing_unparsed_value and freshness_measurement hold the rest.
2. Grants migration: SELECT for carshenas_admin on what the screens read (crawl_run, fetch_log, crawl_lane, source_daily_spend, listing, listing_price_event, listing_unparsed_value, freshness_measurement, pgboss.job and pgboss.queue with USAGE on the schema), as ADR-0023's follow-up says; data-model.md updated.
3. Read queries in src/features/admin/server, one module per screen, each with a db test on seeded rows and EXPLAIN (ANALYZE, BUFFERS) on the lane's copy of main's data (target under one second): crawl runs per source with budget and outcomes (AC3), source problems with evidence (AC5), jobs per queue and state with recent failures (AC2 read side).
4. Owner decisions before the rest: how the web app learns the worker is alive (AC1), how retry and cancel are written and recorded (AC2), the screens' layout and charts, and what counts as a changed listing and a tracked model (AC4).
5. Then: heartbeat, retry/cancel function, listing counts and chart, the screens, Playwright tests with seeded data (AC7), verify-ui evidence, design, database and task reviewers.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-32 (2026-09-29): what the worker already records for this screen: pg-boss's pgboss.job (state, retry_count, output with counts or the serialised error, the shared dead-letter queue with source_name and source_output), crawl_lane (next_request_at, the lease, failure_streak, cooldown_until and its reason, rate_limited_at) and source (crawl_state, stop_reason, stopped_at); GET /health on the worker lists each lane's state. The web role has no grants on pgboss or crawl_lane yet: this task decides them (read-only role for the admin section, open question 14). Queries in docs/runbooks/worker.md, "Inspect the queue".

2026-09-30, slice 1 (reads): migration 20260930150616_grant_admin_pipeline_reads gives carshenas_admin SELECT on pgboss.job and pgboss.queue (USAGE on the schema), crawl_lane, crawl_run, fetch_log, source_daily_spend, listing, listing_price_event, listing_unparsed_value and freshness_measurement; still no write, no snapshot, no password hash (admin-database.db.test.ts, schema-constraints.test.ts). pg-boss's tables are typed by hand in src/server/db/pgboss-types.ts, compared with the installed schema and job_state enum by a test. The worker now stores the attempt's traceId with a failed or dead-lettered job's error (run-job.ts), so the jobs screen can show it (AC2). New sql helpers tehranToday() and averageSecondsBetween(), tested. src/features/admin/server/pipeline-queries.ts: loadJobs() (per queue and state, 20 latest failures and dead letters with error and trace id), loadCrawl(window 1h/24h/7d) (per crawled source: spent today against the daily budget, runs by kind and status with average duration, request outcomes, 20 latest runs with counts) and loadProblems() (stop, cooldown, last 429, 20 latest blocked/rate-limited/challenge requests with time, status, address and run kind, and unparsed values by count); pipeline-queries.db.test.ts covers each on seeded rows. EXPLAIN (ANALYZE, BUFFERS) on the lane's copy of main's data (27,432 jobs, 4,880 runs, 4,877 fetches, 18,449 listings): jobs per queue and state 18.3 ms (seq scan of job_common, 1,651 buffers), recent failures 5.7 ms (seq scan), dead letters 0.06 ms (job_common_pkey), source budget 0.3 ms, runs by kind 7 days 4.6 ms, outcomes 7 days 2.8 ms, latest runs 0.1 ms (crawl_run_source_started_idx, 20 rows), refused requests 1.4 ms (newest first over fetch_log; all rows read while fewer than 20 refusals exist), unparsed values 1.8 ms. All linear in the rows kept; at 12,000 requests a day for 30 days the fetch-log reads stay well under a second, and a partial index on refused outcomes is the lever if the refused-request read grows. pnpm check and pnpm db:check green.
<!-- SECTION:NOTES:END -->
