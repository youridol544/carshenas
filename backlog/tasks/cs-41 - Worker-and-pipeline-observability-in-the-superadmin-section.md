---
id: CS-41
title: Worker and pipeline observability in the superadmin section
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 19:35'
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
- [x] #1 The worker shows as alive or down, with its version, uptime and last heartbeat, and a stopped worker shows as down within a minute
- [x] #2 Jobs show per queue and state (waiting, active, completed, failed, retrying, dead-lettered), with recent failures, their error and trace id, and the superadmin can retry or cancel a failed job
- [x] #3 Crawl runs show per source with their state, duration, requests spent against the daily budget, and outcomes (ok, not modified, not found, gone, blocked, rate-limited, challenge, error)
- [x] #4 Listings show per source and per tracked model: total, active, and new, changed and gone in the last hour, 24 hours, 7 days or a chosen window, with a chart over time and the median age of the last check
- [x] #5 Source problems (blocks, rate limits, challenges and values the parser could not read) show with their time and evidence, and a stopped source links to resuming it (CS-40)
- [x] #6 Every number comes from the database through measured queries, and each screen answers within one second at the demo's volume
- [x] #7 Playwright tests cover the screens with seeded data
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research the section, the worker, pg-boss and the pipeline tables (done).
2. Grants for carshenas_admin's reads; hand-written pg-boss types checked against the schema; trace id stored with a failed job's error.
3. Owner's decisions of 2026-09-30 (all as recommended): heartbeat table; retry and cancel through change_job_state() with job_state_change; one /admin/worker page with a 1 h / 24 h / 7 d switcher and five sections; charts of new and gone listings and the median time since the last check from freshness_measurement, drawn in inline SVG; changed = re-priced; tracked models = keys of the latest freshness measurement (until CS-53).
4. worker_heartbeat written by the worker; change_job_state(); loaders for worker, jobs, crawl, listings, problems; measured with EXPLAIN; indexes fetch_log_refused_idx and listing_source_model_id_idx.
5. The screen, linked from the dashboard, refreshed every 15 s; Playwright tests on seeded data; verify-ui evidence at 412 and 1440 px.
6. Reviews by the coordinator (database, design, task reviewers); fix findings; then criteria and In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-32 (2026-09-29): what the worker already records for this screen: pg-boss's pgboss.job (state, retry_count, output with counts or the serialised error, the shared dead-letter queue with source_name and source_output), crawl_lane (next_request_at, the lease, failure_streak, cooldown_until and its reason, rate_limited_at) and source (crawl_state, stop_reason, stopped_at); GET /health on the worker lists each lane's state. The web role has no grants on pgboss or crawl_lane yet: this task decides them (read-only role for the admin section, open question 14). Queries in docs/runbooks/worker.md, "Inspect the queue".

2026-09-30, slice 1 (reads): migration 20260930150616_grant_admin_pipeline_reads gives carshenas_admin SELECT on pgboss.job and pgboss.queue (USAGE on the schema), crawl_lane, crawl_run, fetch_log, source_daily_spend, listing, listing_price_event, listing_unparsed_value and freshness_measurement; still no write, no snapshot, no password hash (admin-database.db.test.ts, schema-constraints.test.ts). pg-boss's tables are typed by hand in src/server/db/pgboss-types.ts, compared with the installed schema and job_state enum by a test. The worker now stores the attempt's traceId with a failed or dead-lettered job's error (run-job.ts), so the jobs screen can show it (AC2). New sql helpers tehranToday() and averageSecondsBetween(), tested. src/features/admin/server/pipeline-queries.ts: loadJobs() (per queue and state, 20 latest failures and dead letters with error and trace id), loadCrawl(window 1h/24h/7d) (per crawled source: spent today against the daily budget, runs by kind and status with average duration, request outcomes, 20 latest runs with counts) and loadProblems() (stop, cooldown, last 429, 20 latest blocked/rate-limited/challenge requests with time, status, address and run kind, and unparsed values by count); pipeline-queries.db.test.ts covers each on seeded rows. EXPLAIN (ANALYZE, BUFFERS) on the lane's copy of main's data (27,432 jobs, 4,880 runs, 4,877 fetches, 18,449 listings): jobs per queue and state 18.3 ms (seq scan of job_common, 1,651 buffers), recent failures 5.7 ms (seq scan), dead letters 0.06 ms (job_common_pkey), source budget 0.3 ms, runs by kind 7 days 4.6 ms, outcomes 7 days 2.8 ms, latest runs 0.1 ms (crawl_run_source_started_idx, 20 rows), refused requests 1.4 ms (newest first over fetch_log; all rows read while fewer than 20 refusals exist), unparsed values 1.8 ms. All linear in the rows kept; at 12,000 requests a day for 30 days the fetch-log reads stay well under a second, and a partial index on refused outcomes is the lever if the refused-request read grows. pnpm check and pnpm db:check green.

2026-09-30: stopped at the owner's decisions (liveness signal, retry and cancel, screens and charts, what a changed listing and a tracked model are); the reads above do not depend on them. db:check green after the test helpers moved to src/server/db/pipeline-test-database.ts.

Owner's decisions of 2026-09-30 (all as recommended): 1. liveness: a table the worker writes every 15 s (instance, version, start time, last beat), shown as down after 45 s; 2. retry and cancel: SQL functions that check the superadmin, apply pg-boss's retry or cancel in SQL and append a history row (ADR-0023's pattern); 3. layout: one /admin/worker page with a window switcher (1 h, 24 h, 7 d) and sections for worker, jobs, crawl, listings and problems; 4. charts: hourly new and gone listings and the median age of the last check, from freshness_measurement rows, as hand-made inline SVG; 5. a changed listing is one that got a listing_price_event in the window; 6. tracked models are the model keys in the latest freshness measurement, until CS-53.

2026-09-30, slices 2 and 3. Database-review fixes applied: fetch_log_refused_idx (partial, CONCURRENTLY) with the outcome list sent as literals (inLiterals helper): before, Seq Scan on fetch_log, 4,876 rows removed by filter, 87 buffers, 0.94 ms; after, Index Scan using fetch_log_refused_idx under the Limit, 5 buffers, 0.095 ms. Unparsed values limited per source in a lateral. Unread grants on pgboss.queue and source_daily_spend dropped (migration edited before main, rolled back and reapplied). Runbook note that a pg-boss upgrade recreating pgboss.job drops the admin grant. New: worker_heartbeat (worker beats every 15 s, marks a clean stop, prunes a week), job_state_change + change_job_state() (pg-boss's retry, plus start now and keep_until slid, which pg-boss's own retry forgets; cancel from created or retry), grants on catalogue_source_key and model, listing_source_model_id_idx. Tracked models are counted through their catalogue model (the join on source_model_key prefixes cost 189 ms on 18k listings; by model_id 36 ms). A listing's first price event is not a change: changed counts events with a previous price. Measured (lane copy: 18,449 listings, 27k jobs): listings whole source 7 d 22.8 ms, tracked models 7 d 36.1 ms (Index Scan listing_source_model_id_idx), heartbeat 0.04 ms, failures 15 ms, job changes 0.08 ms; whole page on the production build 71 to 89 ms server response, 155 to 173 ms to render, for 1 h, 24 h and 7 d. Evidence: pnpm check green; pnpm db:check green (web 50 tests incl. pipeline-queries.db.test.ts, worker db tests incl. heartbeat.db.test.ts and worker-process.db.test.ts with the heartbeat row and its clean stop); schema-constraints tests for worker_heartbeat and change_job_state; e2e tests/app/admin-worker.spec.ts 8 tests x mobile and desktop green with admin-sources against a production build (26 passed); full pnpm e2e 173 passed, 1 harness a11y timing failure on the fixture site under machine load 15 to 18 that passed alone (6 passed). verify-ui: craft-checks at 412 and 1440: overflow 0, layout shift 0, no target under 44 px, no alpha text, line heights from roles; hues: the action blue (links, selected window), red and amber only while a failure, silence or stop holds; legend swatches drawn 1.5 px like the chart lines (the checker compares them with the 12 px label stem, 0.99 px: kept, they depict the lines). Screenshots viewed: phone worker, jobs, failures, crawl, listings, chart, problems; desktop top, jobs, listings, chart. Fixed from looking: window links wrap at 320 px with long text (overflow 105 px before), stats align their figures across a row, queue and listing stats in three columns.

2026-09-30, review round 1 fixes. Design (blocking): the failures keep the order first seen (stable-failure-list.tsx); failures that arrive meanwhile wait behind a «n خطای تازه» button in the card's heading line, and the 15 s refresh holds while the pointer or focus is in the failures card (data-refresh-hold); an answered job control stays answered for the visit (no cancel appears after a retry), a cancel asks «این کار لغو شود؟» with «بله، لغو شود» and «نه، بماند» (focus moves to the answer and back), and a job cancelled in the last ten minutes stays in place, marked لغوشده. Design: chart axes at border-control (3:1), zero drawn two units above its axis, «۰» and the value at the top beside each plot, time labels under each plot, every hourly point in a <details> table; run counts in Farsi with Persian digits; running runs no longer say running twice; an error without a message reads «پیامی ثبت نشده» in muted; queues by state and listings per tracked model each in one table from 640 px (a phone gives each row its lines); a summary under the window counts stopped sources and links to #problems-heading; process headings are h4; the chosen window shows a check (label centred, indicator out of flow); content width 5xl like the header. Phone page with one seeded source: 8,390 px (was 14,275), the problems at 7,119. DB: change_job_state() keeps a retried job its queue's retention from pgboss.job_now() (GREATEST with keep_until), uses pgboss.job_now() for its times, and refuses pg-boss's own queues (job_state_change_queue_not_internal, also a CHECK on the table; the screen offers no control there); migrations rolled back and reapplied. Criterion 1 margin: silence ends at 40 s (15 s refresh: down within 55 s); db test at 39 s and 41 s. Worker db test: a failed job retried through change_job_state() is claimed again and completes. Evidence: pnpm check green; pnpm db:check green (web 51, worker 62 + 3); schema tests for the internal-queue refusal and the retention; e2e full suite 176 passed against a production build (admin-worker 10 tests x mobile and desktop, incl. rows staying in place across a refresh, the hold while hovering, the answered retry, the confirmed cancel, the chart's table row); craft-checks at 412 and 1440: overflow 0, layout shift 0, no target under 44 px, no alpha text. Screenshots viewed: phone top with summary and switcher, queues list, failures, chart, listings; desktop top, queues table, listings table. The e2e_723052 and e2e_801842 sources the design reviewer saw were already gone when I looked; lane DB now holds no e2e_ source, e2e. queue or heartbeat. Owner-facing open point, not decided: whether cancelling a job in retry state during pg-boss's backoff should be allowed (today it is).

2026-09-30, review round 2. Design blocker fixed: the last beat reads to the second under a minute (formatSecondsAgo in packages/locale/src/format-date.ts, unit-tested: اکنون, ۴۵ ثانیه پیش, ۵۹ ثانیه پیش, then as formatTimeAgo), so the card never says «اکنون» beside «بی‌پاسخ»; e2e test with a beat 45 s old: the process says «بی‌پاسخ» and «۴۵ ثانیه پیش» (up to ۴۹ for the page load). After a job is answered, focus moves to the answer (tabIndex -1), tested. The release is truncated with its full text on hover, aligned with the other values. Owner's decision of 2026-09-30: cancelling a job waiting out pg-boss's backoff stays allowed, with the confirmation, and is recorded in job_state_change. Reviews: task-reviewer ready, no blocking gaps; database-reviewer ready (second pass: db:check green, change_job_state security and pg-boss mirroring, heartbeat HOT updates, indexes built concurrently); design-reviewer: both earlier blockers verified fixed in the second review, and its one new blocker (seconds under a minute) fixed here; evidence .playwright-cli/final-worker-mobile.png at 412 px: badge «بی‌پاسخ», last beat «۴۸ ثانیه پیش», release whole on one line. Final checks: pnpm check green; pnpm db:check green (web 51, worker suites 0 failures); e2e admin-worker and admin-sources 32 passed (mobile and desktop) against a production build; the full suite passed 176 of 176 in round 1 and only the worker screen changed since. Lane DB left with no e2e source or queue.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the superadmin section's worker screen, /admin/worker (owner's decisions of 2026-09-30), linked from the dashboard and refreshed every 15 s. It shows each worker process's heartbeat (worker_heartbeat; down after 40 s of silence, so within a minute) with release, uptime and last beat to the second. It shows jobs per queue and state, and the latest failures with their error and trace id (now stored by the worker); a failed job can be retried and a waiting one cancelled after a confirmation, through change_job_state(), which records the superadmin in job_state_change. Each source's crawl runs, requests against its daily budget and outcomes; listings in and out per tracked model, with a hand-drawn freshness chart and its table; each source's refused requests, stops (linked to /admin/sources) and unread values. Failures keep their order across refreshes. carshenas_admin only reads, through measured queries (fetch_log_refused_idx, listing_source_model_id_idx; whole page 71 to 89 ms on the production build). Verified with pnpm check, pnpm db:check (schema, function, heartbeat and retry-through-pg-boss tests), the full Playwright suite with 10 worker-screen tests on phone and desktop, craft checks at 412 and 1440 px, and task, database and design reviews (all ready).
<!-- SECTION:FINAL_SUMMARY:END -->
