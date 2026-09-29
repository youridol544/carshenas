---
id: CS-40
title: Superadmin section in the web app
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-29 18:32'
labels:
  - frontend
  - backend
milestone: m-2
dependencies:
  - CS-3
  - CS-4
  - CS-39
references:
  - docs/decisions/0003-bare-minimum-nextjs-16-and-react-19.md
  - docs/decisions/0008-crawl-only-what-sources-allow.md
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
  - docs/design/data-model.md
  - docs/decisions/0023-superadmin-section-database-role.md
  - docs/decisions/0020-username-and-password-accounts.md
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner wants control over what the crawler reads (2026-09-28: "a superadmin that can add new cars for crawler ... keep track of their sync"). Several planned jobs also need a human screen that nobody has built:
- resuming a source after a block (ADR-0008 point 6);
- the review queues of low-confidence extractions and duplicate pairs (CS-52, CS-55);
- labelling the evaluation sets (CS-48);
- removal requests (ADR-0008 point 8).

They become owner-only admin pages inside the Next.js app, in TypeScript like the rest (the owner's decision of 2026-09-28). Sign-in comes from the accounts task (CS-39), and only the superadmin role opens these pages.

This task stands the section up with the sources screen. The feature tasks add their own screens: tracked models in CS-53, labelling in CS-48.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admin pages live in their own route group, are never linked from public pages, carry noindex, and answer 404 to anyone without the superadmin role
- [ ] #2 Sign-in is the accounts' sign-in (CS-39), and only accounts with the superadmin role can open the section
- [ ] #3 Sources can be paused and resumed, every change is recorded with who made it and when, and resuming a source stopped on a block clears its stop as the data model requires
- [ ] #4 Admin writes go through a database role that may change only curated rows (source state, tracked models, labels, review decisions), while public pages keep read-only access
- [ ] #5 Playwright tests cover signing in as the superadmin, the 404 for visitors and buyers, and pausing and resuming a source
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Decisions, taken on the recommendation on 2026-09-29 by the owner's standing instruction (recorded in ADR-0023):
- The superadmin section gets its own login role, carshenas_admin (data model open question 14): its own pool in the web process (2 connections, application_name carshenas-admin), imported only from src/features/admin (lint). The section's queries and actions both use it, so the role of public pages never sees what only the section shows; requireSuperadmin() still reads the session through carshenas_web.
- The role holds no INSERT, UPDATE or DELETE on a mutable curated table. It changes one only through a SECURITY DEFINER function that locks the row, compares it with what the person saw, applies the change and appends a history row naming the superadmin account, in one transaction. First function: change_source_state(source, seen state, seen stop, new state, account).
- source_state_change, append-only: source, from and to state, the superadmin account, changed_at, and the stop a resume cleared (its stopped_at and stop_reason). source_stop_recorded requires a resume to clear both on the source row; the history keeps them.
- Allowed changes: enabled to paused, paused to enabled, stopped_on_block to enabled. A page that no longer matches the row gets 'stale' and shows the current state, so nobody clears a stop they have not seen; a repeated press is 'unchanged'. A source that is not crawled cannot be enabled (source_only_crawled_sources_run), and the page offers it no control.
- The crawler's stops are not separate history rows: they are on the source row and in fetch_log, and each resume keeps the stop it cleared. A trigger on source would also fire inside the worker's stop_source(), which CS-33 (lane A) is changing, and in its tests.
- The evidence of a stop (fetch_log) and the lanes stay with CS-41, whose criterion #5 links a stopped source to this resume. CS-40 shows when and why a source stopped.
- The dashboard reads through the admin role too, with the new screen.

1. Role and tooling: carshenas_admin in db/bootstrap/10-roles.sql (the web role's timeouts), CONNECT in create-database.psql, its password in 20-local-database.sh and pnpm db:roles, ADMIN_DATABASE_URL for pnpm db:check, example.env, this lane's env file; pnpm db:roles.
2. Migration create_source_state_change: the table, its append-only triggers and index, change_source_state(), the admin role's grants (EXECUTE; SELECT on source and source_state_change; SELECT of id, username, role and created_at on account). Codegen overrides, pnpm db:migrate, schema tests: constraints, every transition, stale and unchanged, the superadmin check, and what each role may and may not do.
3. Web database layer: env.adminDatabaseUrl; src/server/db/admin-database.ts with a lint rule that only the admin feature imports it; the function call and the exact-instant helper in src/server/db; integration tests through the admin pool.
4. The admin feature: loadSources and loadDashboard on the admin role; the changeSourceState mutation; admin schemas; changeSourceStateAction (same-origin check, parse, requireSuperadmin, mutate, one log line, refresh); /admin/sources with each source's state, its stop, pause and resume, and its recent history; the dashboard links to it. Unit and component tests.
5. Browser tests: e2e/fixtures/sources.ts (sources of a test's own, written as the migration role and purged after it), e2e/tests/app/admin-sources.spec.ts (superadmin sign-in, pause and resume recorded with who and when, a stopped source resumed with its stop cleared, a stale page, the 404 for visitors and buyers, noindex), fixtures/app-pages.ts; /verify-ui at 412 and 1440 px; design-reviewer.
6. Docs: ADR-0023; docs/design/data-model.md (roles, grants, what CS-40 added, open question 14); runbooks (worker.md 'Act on a source', local-database.md, accounts.md); glossary terms for crawl states; database-reviewer and task-reviewer; finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-39 (2026-09-29, ADR-0020): the section's route group app/(admin) exists with noindex metadata, and /admin is the superadmin's landing page after sign-in: a dashboard with account counts, each source's crawl state and what is coming. requireSuperadmin() in apps/web/src/server/auth/current-account.ts answers the not-found page to anyone else, and every admin page, action and query calls it itself (the dashboard's loadDashboard does). The owner asked on 2026-09-29 for navigation to the section: it is linked only from the signed-in superadmin's own account menu, never from what visitors and buyers see, so criterion 1's "never linked from public pages" holds in that sense. What remains here: the sources screen and the admin database role (open question 14).

Slice 1 (2026-09-29): the role carshenas_admin (db/bootstrap/10-roles.sql with the web role's timeouts; CONNECT in create-database.psql; its password in 20-local-database.sh and pnpm db:roles; ADMIN_DATABASE_URL in example.env, this lane's env file and pnpm db:check) and the migration 20260929181603_create_source_state_change: the append-only table source_state_change, change_source_state() (SECURITY DEFINER; answers changed, unchanged or stale; refuses a non-superadmin and any state but enabled or paused), and the role's grants (EXECUTE; SELECT on source and source_state_change; SELECT of id, username, role and created_at on account). Six schema tests prove every constraint, each transition, stale and unchanged, the superadmin check and what the admin, web, worker and read-only roles may do. ADR-0023 accepted on the recommendation; data-model.md (roles, grants, what CS-40 added, open question 14 decided), local-database.md, the database rule and craft reference updated. Checks: pnpm db:lint 0 issues; pnpm db:check OK (replay up, down, up; schema and types match; integration tests pass); pnpm check passes (182 unit and schema tests).

Slice 2 (2026-09-29): env.adminDatabaseUrl (ADMIN_DATABASE_URL) and src/server/db/admin-database.ts, the section's own pool (2 connections, application_name carshenas-admin); a lint rule lets only src/features/admin import it, proved by two lint self-test samples (a query file elsewhere is refused; one in the admin feature lints clean). admin-database.db.test.ts: the pool connects as carshenas_admin with the web role's limits and cannot create temporary tables or update a source. Change from the plan: the function call and the stop's exact text need no sql helper, because Kysely's builder expresses both (selectNoFrom with eb.fn, and eb.cast to text), so they live in the feature's server files. Checks: pnpm check passes (lint self-test 26 samples, 182 tests).
<!-- SECTION:NOTES:END -->
