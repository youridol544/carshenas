---
id: CS-32
title: 'Worker foundation: process, job queue, logs, database role and health check'
status: To Do
assignee: []
created_date: '2026-09-28 22:11'
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
- [ ] #1 The worker is a TypeScript workspace package that `pnpm check` lints, type-checks and tests with the rest, and its stacks point at TypeScript through source maps (ADR-0016)
- [ ] #2 The worker connects as `carshenas_worker` through its own pool with its own timeouts, and a health check proves it reaches PostgreSQL and the job queue
- [ ] #3 pg-boss 12 runs on the same database with one queue per job kind, a per-source concurrency limit, and follow-up jobs enqueued in the same transaction as the rows they need, and a test proves that two jobs of one source never run at once
- [ ] #4 The worker logs through `packages/observability`: trace ids per job, one completion line per job with its counts, the process error handlers, and never `console`
- [ ] #5 An unexpected error in a job is logged once with its stack and trace id, and the job is retried or dead-lettered, never swallowed
- [ ] #6 A runbook explains how to start, stop and inspect the worker and its queue locally
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From the planning session of 2026-09-28:
- **Setup and logging.** The worker's setup is described in `docs/runbooks/logs-and-errors.md` ("The crawler worker", written in CS-30): createLogger, installProcessHandlers with drain-then-exit on SIGTERM, registerTracing, withSpan per job and withLogContext per run, and node --enable-source-maps.
- **Where the database code lives.** Move `src/server/db` to `packages/db` when the worker imports it (ADR-0003's trigger, ADR-0004).
- **pg-boss guardrails** from the CS-4 research: schedules in Asia/Tehran, a short backstop poll with notify, a typed send helper, dead letters, and no reliance on singletonKey outside singleton or throttled queues.
- **The worker's role.** It needs SELECT on `listing_status_transition`, because `listing_status_guard` runs with the caller's rights, and gets no TEMPORARY privilege (CS-33 notes).
<!-- SECTION:NOTES:END -->
