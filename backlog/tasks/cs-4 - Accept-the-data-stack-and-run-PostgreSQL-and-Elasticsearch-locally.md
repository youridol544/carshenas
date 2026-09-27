---
id: CS-4
title: Accept the data stack and run PostgreSQL locally
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 09:00'
labels:
  - database
  - search
  - infra
milestone: m-1
dependencies: []
references:
  - docs/decisions/0007-data-search-and-ingestion-stack.md
  - docs/decisions/0011-postgresql-for-records-search-vectors-and-jobs.md
  - docs/decisions/0012-kysely-and-sql-migrations.md
  - docs/decisions/0013-data-modeling-rules.md
  - docs/design/data-model.md
  - docs/runbooks/local-database.md
  - docs/research/2026-09-27-postgresql-only-data-stack.md
  - docs/research/2026-09-27-database-craft.md
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0007 proposed PostgreSQL as the record, Elasticsearch as the index, a separate ingestion worker with a job queue, and evaluated LLM steps. On 2026-09-27 the owner questioned Elasticsearch (complexity, deployment cost, polyglot persistence), asked for the best database access layer, for a data model ready for native listings later, and for a database harness as thorough as the UI craft work. Every later milestone depends on this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ADR-0007 is superseded by accepted ADRs that record the owner's choices of 2026-09-27 with their reasons: PostgreSQL 18 as the only data service for records, search, vectors and the pg-boss job queue; Kysely with plain SQL migrations under dbmate; and the data-modeling rules
- [x] #2 One command starts PostgreSQL 18 with pgvector locally, and docs/runbooks/local-database.md describes starting, migrating, connecting, measuring, resetting and bootstrapping it
- [x] #3 The first migrations create sources with their policy checks, listings, crawl runs, the fetch log and snapshots; they replay up, down and up on a scratch database and match the committed db/schema.sql and generated types
- [x] #4 A health check proves the web app reaches PostgreSQL through its own pool and role, and answers 503 without details when the database is down (the worker's check arrives with the worker in CS-6)
- [x] #5 A database skill, a path-scoped rule, a read-only database reviewer and mechanical checks (migration lint, SQL lint, schema tests, integration tests, a guard against destructive commands) hold future schema changes and queries to the recorded craft rules, and each check is proven to fail on a planted defect
- [x] #6 The research notes, the data-model design document and every doc and task that assumed Elasticsearch are updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Owner's brief (2026-09-27): research whether PostgreSQL alone can replace Elasticsearch (the owner thinks Elasticsearch adds complexity, deployment cost and polyglot-persistence problems, and does not want it just because Torob uses it); pick the database access layer (raw SQL, Prisma, Drizzle or another) with a clear winner; build Claude Code rules, skills and review for database design and data modeling, with the same depth as the UI craft work (constraints versus in-app checks, error-driven inserts versus pre-checks, when and how to index, measuring performance, pgvector configuration, how senior engineers work with databases); design the data model for crawled listings now and native listings later (Carshenas as a trading hub); update all docs.

1. Research in parallel passes, each cited and with hands-on Postgres labs in Docker where claims can be measured: (a) search in PostgreSQL versus Elasticsearch for Persian listing search at our scale, cost and operations included; (b) the access layer, migrations and a PostgreSQL job queue; (c) modeling, integrity and concurrency craft; (d) indexing, performance measurement, query patterns and pgvector; (e) existing skills, agents, MCP servers and linters for database work, and which practitioners match the owner's view; (f) the Carshenas data model.
2. Write the research notes with a recommendation and a winner for each question, and present the decisions to the owner for approval.
3. After approval: a superseding ADR for ADR-0007, the data-model design doc, a database skill with a sourced craft checklist, a path-scoped rule, a read-only database reviewer and mechanical checks (lint, migration linting); update AGENTS.md, README, ADR-0003, the product docs and the tasks that assume Elasticsearch (CS-14, CS-15, CS-16, CS-23, and others the notes reveal).
4. Implement CS-4's criteria as amended: one command starts PostgreSQL with pgvector locally, a runbook, the chosen migration tool with a first migration for sources and snapshots, and a health check.
5. Verify, run the task-reviewer, finish at In Review.

6. After the owner's nine decisions of 2026-09-27: PostgreSQL 18 only (ADR-0011), Kysely with dbmate SQL migrations (ADR-0012), the modeling rules (ADR-0013); the local container, four migrations, the data layer and health route; the database skill, rule, reviewer agent and guard hook; mechanical checks (Squawk, SQL lint, schema tests in PGlite, integration tests in db:check); docs and tasks updated.

7. Review with database-reviewer and task-reviewer, fix every finding, review again, then finalize at In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation (2026-09-27), after the owner's nine decisions:
- Local PostgreSQL 18.6 with pgvector 0.8.6: compose.yaml (loopback port 5418, shm 1 GB, limits of a 4 GB/2-core VPS), db/postgresql.conf (4 GB column, pg_stat_statements and auto_explain preloaded, jit off, no bind parameters in logs), db/bootstrap (roles owner/migrate/web/readonly with per-role timeouts; database with the builtin C.UTF-8 locale; TEMPORARY only for carshenas_migrate). scripts/db.sh behind pnpm db:*. Settings template example.env (the Write tool refuses .env.example under the Read(./.env.*) deny).
- Four migrations: foundations (default privileges for the read-only role, jsonb_sha256, refuse_change_unless_purge); sources and policy checks (+ source_current_policy); listings with listing_status_transition and the lifecycle guard; crawl runs, the fetch log and content-addressed snapshots. Row-local rules are constraints; the cross-row crawl-policy backstops are CS-6's (notes there).
- Data layer apps/web/src/server/db: database() and readDatabase() (one pool per process, int8 as number with a safe-integer guard), constraintViolation() (SQLSTATE and constraint name; NOT NULL by column), GET /api/health (connection() first, so never prerendered).
- Harness: the database skill (craft.md, kysely.md, search.md, vectors.md, review.md, vendored pgvector guide at a pinned commit), .claude/rules/database.md, the database-reviewer agent, the guard-database hook with tests, ADR-0011 to ADR-0013, docs/design/data-model.md, docs/runbooks/local-database.md, two research notes with the six-pass appendix and lab SQL.

Evidence that each check fails on a planted defect (criterion #5):
- Squawk: a planted CREATE INDEX without CONCURRENTLY or timeouts gave 3 findings; pnpm db:lint now repeats this self-check on every run.
- ESLint SQL rules: lint:selftest samples bad-sql.ts (concatenation, interpolation, sql.raw) and bad-driver-import.ts (pg and kysely outside src/server/db) fire; clean-sql.ts, with English prose such as "Update failed:", lints clean.
- Schema catalog tests: a planted migration (serial key, timestamp, varchar(10), auto-named CHECK and FK, unindexed FK) failed 6 checks; the suite now keeps a permanent test that plants objects breaking every rule and fails unless each check finds them.
- Schema constraint tests: 16 tests, each bad row rejected with its SQLSTATE and constraint name (column for NOT NULL).
- pnpm db:check: a planted edit to db/schema.sql and a stale db-types.ts each failed it; a planted application_name in database.ts failed the health integration test.
- Migration immutability: in a scratch repository a merged migration renamed and edited passed the old diff filter and is caught with --no-renames.
- Guard hook: 18 destructive commands refused and 12 harmless ones allowed (pnpm hooks:test, part of pnpm check).
- Health: on a dev server 200 with the newest migration, as carshenas_web with application_name carshenas-web; with the container stopped 503 {"status":"unavailable"} and the cause in the server log; the pool recovered after a restart.

Review round 1 (database-reviewer and task-reviewer), all fixed:
- source_crawl_interval_floor accepted a NULL interval (a CHECK passes on NULL): IS NOT NULL spelled out, with a test.
- listed_at is NOT NULL (every status implied it; listing_active_is_listed became redundant and went); external listings must have last_seen_at (listing_external_was_seen).
- The lifecycle guard fired on an upsert's proposed row: inserts are checked AFTER INSERT, updates BEFORE UPDATE; a re-crawl upserting a listing straight to sold is tested.
- A fetch could point at another source's listing: fetch_log references (listing_id, source_id) through listing_id_source_unique.
- NOT NULL violations carry no constraint name on PostgreSQL 18: constraintViolation() maps them by column.
- db:lint missed renamed merged migrations: --no-renames.
- The web and read-only roles had TEMPORARY, and a temporary table could stand in for listing_status_transition: only carshenas_migrate keeps it (bootstrap and the running database), the guard reads public.listing_status_transition with a pinned search path, both tested.
- Bind parameters were logged in full: log_parameter_max_length and auto_explain.log_parameter_max_length are 0, asserted by an integration test with lz4 compression.
- Blank policy conditions were accepted: source_policy_check_conditions_not_blank.
- crawl_run_one_running_per_source broke the naming rule: crawl_run_running_per_source_unique, and the catalog test now requires _unique on unique indexes.
- The guard hook missed dropdb, DROP OWNED, removing the data directory, docker-compose, and commands behind bash -c or timeout: all refused now, with tests.
- Stale docs: AGENTS.md search-engine wording, vision.md, ADR-0003's status line, compose.yaml messages, the migration headers; db:top-queries and db:unused-indexes run as the read-only role, which pg_read_all_stats now serves.
- The worker health check is CS-6 criterion #5 (carried over from this task's original criterion).
- The documentation fork that wrote the skill stalled after writing its files; its Kysely snippets were type-checked, linted and run against a scratch database (7 probe tests, removed afterwards), which caught an upsert example that would never refresh last_seen_at; fixed in kysely.md and craft.md.

Checks after the fixes: pnpm check (lint, 11 lint samples, Squawk with its self-check, hook tests, typecheck, 34 unit and schema tests, formatting); pnpm db:check (replay up, down, up; schema and types match; 8 integration tests); pnpm e2e 56 passed with the 4 intentional self-check skips; pnpm build lists /api/health as dynamic.

Review round 2 (2026-09-27), all fixed; no third round, at the owner's "move on":
- An expired or gone listing seen again stayed out of search: listing_gone_not_seen_since forbids a sighting after delisting, and the upsert in kysely.md reactivates such a listing (run on a scratch database).
- TRUNCATE bypassed the append-only row triggers: each append-only table also has a BEFORE TRUNCATE statement trigger (constraint name <table>_append_only), tested inside and outside a purge.
- PostgreSQL 18 reports a delete blocked by ON DELETE RESTRICT as 23001, not 23503: mapped and tested on 18.6.
- source_stop_recorded now requires stopped_at and stop_reason to each match the stopped state; transition rows accept only real statuses (listing_status_transition_statuses_valid).
- Logging: log_error_verbosity is terse (a constraint error's DETAIL prints the failing row); the config no longer claims plans hide constants (auto_explain plans show them; production decides in CS-23).
- The read-only psql (pnpm db:psql and the reports) runs as the OS user nobody inside the container, so a shell escape cannot touch the data directory; piped input now reaches it. The guard also refuses psql shell escapes and pipes, rm of the data directory through docker exec, and pnpm dbmate drop (22 refused, 12 allowed), and its refusal now explains how to pass text that only mentions such a command.
- The catalog planted-defect test asserts the expected name for every clause; with the _unique clause deleted it fails naming planted_code.
- !.env.example is back in .gitignore (e2e/.env.example is tracked); db:check uses a scratch database per run (carshenas_<pid>_check); the expiry snippet locks FOR NO KEY UPDATE.
- Left for the owner: whether snapshot_content_unique should include canonical_version (today identical JSON is one snapshot whatever the version; the column comment now says so); new to sold for a first sighting (noted on CS-6); SELECT on source and listing is granted to the web role before any page reads them.
Final checks: pnpm check (38 unit and schema tests, 11 lint samples, Squawk and its self-check, hook tests), pnpm db:check (migrations up, down, up; schema and types match; 9 integration tests), pnpm e2e 56 passed with the 4 intentional skips.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PostgreSQL 18 is now the only data service (ADR-0011, superseding ADR-0007: no Elasticsearch, whose download terms exclude Iran and which CS-14's criteria do not need, as the research measured), reached through Kysely with plain SQL migrations under dbmate (ADR-0012) and modelled by ADR-0013 and docs/design/data-model.md, with all nine owner decisions of 2026-09-27 recorded. Built: pnpm db:up (PostgreSQL 18.6 with pgvector 0.8.6, tuned for a 4 GB VPS, least-privilege roles, builtin C.UTF-8 locale) and docs/runbooks/local-database.md; four migrations (sources and policy checks, listings with a guarded lifecycle, crawl runs, the fetch log and content-addressed snapshots), append-only and purge-aware; the Kysely data layer and GET /api/health. The harness: the database skill, a path-scoped rule, the database-reviewer agent, a guard hook against destructive commands, and mechanical checks (Squawk with a self-check, SQL-injection lint, schema tests in PGlite with a planted-defect proof for every rule, integration tests on real PostgreSQL). Research notes with the six-pass appendix; ADR-0008 point 7 now says keyed HMAC; tasks that assumed Elasticsearch updated; the worker health check carried to CS-6. Verified with pnpm check, pnpm db:check, pnpm e2e (56 passed, 4 intentional skips) and pnpm build, after two review rounds by task-reviewer and database-reviewer with every finding fixed.
<!-- SECTION:FINAL_SUMMARY:END -->
