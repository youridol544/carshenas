---
id: CS-32
title: 'Worker foundation: process, job queue, logs, database role and health check'
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:11'
updated_date: '2026-09-29 09:54'
labels:
  - backend
  - infra
  - dx
milestone: m-2
dependencies:
  - CS-4
  - CS-30
references:
  - docs/decisions/0011-postgresql-for-records-search-vectors-and-jobs.md
  - docs/decisions/0016-structured-logs-and-error-reporting.md
  - docs/runbooks/logs-and-errors.md
  - docs/design/data-model.md
  - docs/decisions/0018-source-lanes-request-pacing-and-rate-limits.md
  - docs/research/2026-09-29-crawl-scheduling-rate-limits-and-backoff.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The crawler and the rest of the pipeline run in a worker process outside Next.js (ADR-0011 point 5), in TypeScript like the web app. The owner confirmed on 2026-09-28 that everything stays in TypeScript. The worker shares the database access and `packages/observability` (ADR-0016, CS-30) with the web app.

Before the crawler (CS-33) is written, the worker needs its own footing:
- a workspace package that `pnpm check` covers;
- pg-boss 12 on the shared PostgreSQL;
- logs through the shared package;
- its own database role, with the grants and backstops CS-4 planned for it.

Items 1, 2, 6 and 7 of the CS-4 note on CS-33 move here, and so does CS-33's old criterion 5, the worker's health check, which CS-4 carried over.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The worker is a TypeScript workspace package that `pnpm check` lints, type-checks and tests with the rest, and its stacks point at TypeScript through source maps (ADR-0016)
- [x] #2 The worker connects as `carshenas_worker` through its own pool with its own timeouts, and a health check proves it reaches PostgreSQL and the job queue
- [x] #3 pg-boss 12 runs on the same database with one queue per job kind for pipeline work and one lane per crawled source, a singleton queue holding all of that source's crawl jobs in priority order; follow-up jobs are enqueued in the same transaction as the rows they need; tests prove that two jobs of one source never run at once, even from two worker processes, and that sources run in parallel (ADR-0018)
- [x] #4 The worker logs through `packages/observability`: trace ids per job, one completion line per job with its counts, the process error handlers, and never `console`
- [x] #5 An unexpected error in a job is logged once with its stack and trace id, and the job is retried or dead-lettered, never swallowed
- [x] #6 A runbook explains how to start, stop and inspect the worker and its queue locally
- [x] #7 Every request to a source passes its lane's pacing in PostgreSQL: one request in flight at a time, each starting no sooner than the source's interval after the previous one ended, a longer gap after slow responses, and nothing sent while the source is not enabled, whichever worker process sends it
- [x] #8 A job waits inside its handler for at most one request gap: while a source is stopped, paused or cooling down, its lane claims no jobs, queued jobs keep their attempts, and the job that met the condition is put back without spending one
- [x] #9 Timeouts, server errors and dropped connections cool a lane down after three in a row, with jittered exponential backoff, until one probe request succeeds, while other sources keep running; proven by tests against a local stub server
- [x] #10 A 403, or a challenge or empty answer its source reports, stops the source until a human resumes it; a 429 cools the lane down for its Retry-After or 15 minutes and doubles its gap for 24 hours, and a second 429 within 24 hours stops the source (ADR-0018); proven by tests against a local stub server
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Approved by the owner on 2026-09-29: 429 cools down and stops on repeat, pacing belongs to CS-32, one lane per crawled source (ADR-0018).

1. packages/db: move the generated types, the connection factory (int8 parser, application_name, query-log hook) and the constraint-error mapping out of apps/web/src/server/db (ADR-0012 follow-up); the web app keeps its own pool and health route; kysely-codegen writes into packages/db and reads only the public schema.
2. Database: the carshenas_worker role with its own timeouts (bootstrap, create-database, a db:roles command for servers that already exist); a migration that installs pg-boss 12.35 from its exported SQL, owned by carshenas_owner, DML-only for the worker and SELECT for the read-only role; a migration for crawl_lane (next request time, lease, breaker, last 429) and stop_source() as the only way the worker changes a source; grants; data-model doc.
3. apps/worker: env, logger, tracing, process handlers, the worker pool, pg-boss with migrate off, a loopback health endpoint (database and queue), drain on SIGTERM, pnpm worker and pnpm worker:health; lint (no console, env only in env.ts, jobs never import pg-boss or pg); unit tests in pnpm check, pg-boss tests in pnpm db:check.
4. Runtime: defineJob (name, payload schema, run, retry, priority, lane), job envelope, typed enqueue (fromKysely inside a transaction), runJob (log context, span, one completion line with counts, failures sorted: own failure retried then dead-lettered, invalid payload dead-lettered at once, host problems put back without spending an attempt), queues per kind and a dead-letter queue, schedules in Asia/Tehran.
5. Lanes: a singleton queue per crawled source, a supervisor that follows source.crawl_state and each lane's cool-down, pause by offWork and resume by work, atomic requeue (complete and resend in one transaction); tests for one-at-a-time across two instances, parallel lanes, priority order, paused lanes keeping attempts.
6. Pacing: acquire and release on crawl_lane (lease, gap from the end of the last response, 5x the response time up to 30 s, never below the source interval), the breaker (three transient failures in a row, jittered exponential cool-down, one probe), the 429 policy (Retry-After or 15 min, doubled gap for 24 h, second 429 stops), stop on 403 or a reported challenge or empty answer; a polite HTTP client (User-Agent, timeouts, classification); tests against a local stub server.
7. Docs: ADR-0018 (lanes, pacing, 429; makes ADR-0011 point 5 concrete, supersedes ADR-0008 point 6 for 429), research note on crawler scheduling and backoff, docs/runbooks/worker.md, logs runbook, AGENTS.md map; notes on CS-33 and CS-35.
8. Verify: pnpm check, pnpm db:check, database-reviewer on the migrations and queries, task-reviewer; finalize at In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From the planning session of 2026-09-28:
- **Setup and logging.** The worker's setup is described in `docs/runbooks/logs-and-errors.md` ("The crawler worker", written in CS-30): createLogger, installProcessHandlers with drain-then-exit on SIGTERM, registerTracing, withSpan per job and withLogContext per run, and node --enable-source-maps.
- **Where the database code lives.** Move `src/server/db` to `packages/db` when the worker imports it (ADR-0003's trigger, ADR-0004).
- **pg-boss guardrails** from the CS-4 research: schedules in Asia/Tehran, a short backstop poll with notify, a typed send helper, dead letters, and no reliance on singletonKey outside singleton or throttled queues.
- **The worker's role.** It needs SELECT on `listing_status_transition`, because `listing_status_guard` runs with the caller's rights, and gets no TEMPORARY privilege (CS-33 notes).

2026-09-29: research (two agents: crawler frontiers in Scrapy, Crawlee, Colly, Heritrix, Nutch and the IIR/Mercator design; job-queue limits in BullMQ, Sidekiq, Oban, Hatchet and pg-boss 12.35 source; backoff doctrine) written up in docs/research/2026-09-29-crawl-scheduling-rate-limits-and-backoff.md. Lab: two pg-boss instances on singleton queues, 40 jobs, no lane ever ran two jobs, priorities honoured, lanes parallel, offWork left queued jobs untouched. Owner chose lanes per source, pacing in CS-32, and 429 cool-down then stop on repeat: ADR-0018 (accepted), which makes ADR-0011 point 5 concrete and supersedes ADR-0008 point 6 for 429 only.

Slice 1 (packages/db): moved db-types.ts, database-errors.ts and .kysely-codegenrc.json from apps/web into packages/db (git mv, history kept); new createDatabase() (int8 parser, application_name, pool size, idle-error hook) and createQueryLog() shared by both processes; the web app keeps database()/readDatabase() and its health route on top of them. Codegen reads only the public schema (includePattern public.*) so pg-boss tables never reach the types. Lint: only src/server/db may import @carshenas/db/database (sample bad-pool-import.ts). Schema tests stay in apps/web for now, reading the codegen config from its new path. Evidence: packages/db lint, typecheck, 6 node tests; web typecheck, lint, 147 vitest tests; kysely-codegen --verify from packages/db; lint self-test 24 samples.

Slice 2 (database): carshenas_worker role (statement 30 s, lock 5 s, idle-in-transaction 30 s, transaction 2 min, slow-statement log from 1 s); 10-roles.sql now skips existing roles so `pnpm db:roles` adds a later role and sets every password from .env (compose passes the worker password optionally, so a .env from before still starts). Migrations 20260929082446 (worker grants: reads sources and policy, writes listing and crawl_run, INSERT-only on fetch_log and snapshot), 082447 (pg-boss 12.35 schema v43 from `pgboss:sql install`, owned by carshenas_owner, DML for the worker, SELECT for read-only, default privileges for later pg-boss tables; its date-named queue_stats partitions left out because they would change schema.sql daily and serve only persistQueueStats) and 082449 (crawl_lane with lease, gap, breaker and last-429 columns; stop_source() SECURITY DEFINER, EXECUTE for the worker only). Evidence: Squawk clean (two pg-boss findings ignored for that file with the reason); schema tests 41 passed incl. new lane constraints, stop_source and role privileges (identity inserts need no sequence grant); pnpm db:check OK (up, down, up; schema.sql and types match; web integration tests).

Slices 3 to 6 (apps/worker): jobs are definitions (defineJob, defineLaneJob: name, zod payload, run, retry, priority, timeout, retention, schedules) in src/jobs/, which lint forbids from importing pg-boss, pg or the pool factory; the runtime (src/runtime/) owns pg-boss (migrate off, reindex off, errors throttled), a typed enqueue that parses the payload first and can join a Kysely transaction (fromKysely), per-kind queues plus a shared dead-letter queue, one singleton lane per crawled source kept open or closed by a supervisor that follows source.crawl_state and the cool-downs, runAttempt (log context and span per attempt, one completion line with counts, failures sorted: own failure retried then dead-lettered, invalid data dead-lettered at once, host refusals and closed lanes put back in one transaction without spending an attempt, capped at 25), the lane client (lease in PostgreSQL, wait at most one gap, stop_source on a block, cool-down on 429 and after three transient failures) and the HTTP edge (User-Agent that jobs cannot change, no redirects followed, body read inside the lease with a size limit, 401/403 block, 429 throttled with Retry-After, 408 and 5xx and network failures and timeouts unavailable, detectBlock hook for challenge pages and empty answers). Process: env.ts, observability (release from CARSHENAS_RELEASE or git), worker pool as carshenas_worker (max 4), health check (database via the role, pg-boss schema version, runtime running, lanes reported) on 127.0.0.1:WORKER_HEALTH_PORT (3101) with `pnpm worker:health`, drain on SIGTERM/SIGINT with a 30 s grace. Evidence: 35 node tests (pacing rules, HTTP edge against a local stub, attempt dispositions and lines with trace ids, crash stack at apps/worker/src/...ts:line, lane turns, health endpoint); pnpm check green except formatting, then fixed; a manual run started as carshenas_worker, /health answered ok with schema 43, SIGTERM stopped it in 18 ms.

Integration tests (pnpm db:check, fresh scratch database; 17 tests): two runtimes (two processes) ran 24 lane jobs on two sources with no overlap within a source and overlap across sources; priority order inside a lane; a paused lane left its jobs created with retry_count 0 and drained on resume; the lease is exclusive and the next request waits its gap; two processes sending to one source took turns with gaps of at least 3 s after each answer and 4 s after an 800 ms answer; nothing sent to a paused source; first 429 cooled the lane for one doubled gap (6 s), the job went back unspent, another source answered meanwhile, the gap stayed doubled and a second 429 stopped the source (rate_limited); a 403 stopped the source at once with stopped_at equal to the blocked request start and three queued jobs untouched; three 5xx in a row cooled the lane, the probe closed the breaker; enqueue inside a rolled-back transaction left no job; a bad payload was refused before the queue; a failing job ran twice then was dead-lettered with its error; a PermanentJobError dead-lettered after one run; follow-up jobs carry parentJobId and parentTraceId; schedules stored with Asia/Tehran and removed when undeclared; the real process started on carshenas_worker, /health answered with the newest migration and schema 43, SIGTERM exited 0; the role has its timeouts and application_name and cannot create temp tables or update sources. Found and fixed while testing: a worker of another version claiming a job of a kind it does not know used to dead-letter it; now it puts it back for a minute (dead-lettered after 25 put-backs). Two test races fixed at their cause (asserting before the put-back or failure had been settled), confirmed by six repeated runs and two full runs.

EXPLAIN (ANALYZE, BUFFERS) as carshenas_worker on the scratch database with 50 lanes: acquireLane 0.21 ms, 8 shared buffers (lane row locked FOR NO KEY UPDATE, source by its unique index, a one-page sequential scan of crawl_lane, which holds one row per source); releaseLane 0.16 ms, 4 buffers. Run once per request, at most one request every 3 s per source.

Review round (2026-09-29). database-reviewer: (1) blocking, crawl_lane.next_request_at DEFAULT -infinity came back from node-postgres as the number -Infinity, so turnOf threw TypeError for a second worker on a lane whose first request was in flight, and the job spent an attempt; fixed by rolling back the unmerged migration and defaulting to now(), with a test on that state; (2) CHECK crawl_lane_lease_bounded added (lease within 15 minutes of last_request_at); (3) pgboss:sql upgrade put CREATE INDEX CONCURRENTLY inside the transactional body: it now refuses and, with --split, prints ordered parts; (4) worker rights on pgboss.version narrowed to SELECT, UPDATE and on pgboss.bam to SELECT; (5) two stale path comments fixed. Left as is: pg-boss reindex stays off, because pg-boss decides it may reindex by owner-role membership (pg_has_role on relowner), not the MAINTAIN privilege; the runbook says how to rebuild when it warns. Lease tokens are now unique per request. task-reviewer: (1) blocking, a failing put-back escaped runAttempt unlogged and spent the attempt; now logged once (job could not be put back) and failed for pg-boss to retry, with a unit test; (2) jobs could import the pool factory and runtime internals: regex restriction plus an ESLint-driven test (job-boundaries.test.ts); (4) put-back renewed a job retries: putBackOptions keeps the remaining limit, unit tested; (5) the failure that opens the breaker, and a failed probe, now put their job back, so outages do not dead-letter queued work (ADR-0018 point 5 wording updated, not yet on main); (6) runbook says superuser locally, explains rate_limited_at on resume and index maintenance; (7) job finishing after its claim was lost logs a warning, draining a running job on stop is tested, cross-process exclusivity is now proven deterministically (a second process fetching a lane while its job runs gets nothing five times), since two pollers at the same interval phase-lock and one process may run a whole lane. (3) was mistaken: exported migration plans already inline async index builds, which is why they are CONCURRENTLY statements (point 3 above). Final validation: pnpm check exit 0 (worker 45, web 151, observability 97, db 6, hooks 2 tests; lint self-test 24 samples in 4 packages; formatting); WORKER_DATABASE_URL=... pnpm db:check exit 0 (migrations up, down, up; schema.sql and types match; web 9 and worker 19 integration tests; the worker suite also passed twice more on a separate scratch database).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the worker and everything it stands on, as the owner asked on 2026-09-29 (ADR-0018, accepted): packages/db shared by the web app and the worker; the carshenas_worker role with its own limits and least-privilege grants, and pnpm db:roles for servers that predate it; pg-boss 12.35 installed by a migration generated from its own SQL (owner-owned, the worker has row access, migrate off); apps/worker, where jobs are plain definitions that cannot import the queue, the driver, the pool or the runtime (lint, tested) and a runtime runs each attempt in its own trace with one completion line, retries its own failures with backoff, dead-letters input that can never work, and puts back without spending an attempt any job whose source refused it, whose lane was closed, or whose failure opened the breaker. Each crawled source has one pg-boss singleton lane (one job at a time across processes, priorities inside, lanes side by side), and every request passes the lane lease in crawl_lane: one in flight, the next no sooner than the source interval after the previous one ended and five times a slow answer (up to 30 s), a breaker after three transient failures (jittered 1 to 60 minute cool-downs, one probe), a 429 cool-down for Retry-After or 15 minutes with the gap doubled for a day and a stop on the second, a stop via stop_source() on 401, 403 or a reported challenge or empty answer. HTTP edge with a fixed User-Agent, no redirects, answers read inside the lease; health endpoint and pnpm worker:health; drain on SIGTERM. Research note, ADR-0018, runbook, rule pack, data model and AGENTS.md updated; notes left on CS-33 (criterion 2 reworded for ADR-0018), CS-35, CS-37 and CS-41. Verified with pnpm check (45 worker unit tests) and pnpm db:check (19 worker integration tests against a local stub and real PostgreSQL: two processes, 429, 403, breaker, drain, health and shutdown of the real process), EXPLAIN plans for the lease statements, and a database and a task review whose blocking findings were fixed and tested.
<!-- SECTION:FINAL_SUMMARY:END -->
