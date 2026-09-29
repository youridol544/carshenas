---
id: CS-40
title: Superadmin section in the web app
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-29 19:47'
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
- [x] #1 Admin pages live in their own route group, are never linked from public pages, carry noindex, and answer 404 to anyone without the superadmin role
- [x] #2 Sign-in is the accounts' sign-in (CS-39), and only accounts with the superadmin role can open the section
- [x] #3 Sources can be paused and resumed, every change is recorded with who made it and when, and resuming a source stopped on a block clears its stop as the data model requires
- [x] #4 Admin writes go through a database role that may change only curated rows (source state, tracked models, labels, review decisions), while public pages keep read-only access
- [x] #5 Playwright tests cover signing in as the superadmin, the 404 for visitors and buyers, and pausing and resuming a source
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
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

Slice 3 (2026-09-29): the sources screen, /admin/sources, in the (admin) route group: each source with its crawl state (green while crawled, amber while stopped, neutral while paused), the crawler's stop (when, in Tehran time, and why), one control (pause an enabled source, resume a paused or stopped one; the same button element in every state, so focus survives the refresh) with a polite status line, and its five latest changes with the superadmin's username and the time. changeSourceStateAction checks the origin and the superadmin, parses the whole form (the stop only as the database's own text), calls change_source_state() through the admin pool, logs one line (source, seen state, choice, outcome, account id) and refreshes the page. The dashboard reads through the admin role too and links to the screen. Change from the plan: no 'keep it paused' button for a stopped source (a second button would take focus with it when it disappears); the function still allows it, and the history labels it. EXPLAIN (ANALYZE, BUFFERS) on 3,000 changes over 5 sources, 60 percent on one, as carshenas_admin: the sources read is a 1-buffer scan (0.03 ms); the latest changes use source_state_change_source_changed_idx, one index range per source with limit 5, 18 buffers, 0.11 ms cold and 0.30 ms warm. Tests: admin-schemas.test.ts (what the form may send), admin-actions.db.test.ts (7 tests end to end through the admin pool: pause and resume with who and when, a stop cleared only when the page showed that stop to the microsecond, stale and unchanged, a source that is not crawled, cross-site and non-superadmin refusals, the one log line, the latest five newest first). Checks: pnpm check passes (185 tests); pnpm db:check OK (37 integration tests).

Slice 4 (2026-09-29): browser tests. e2e/tests/app/admin-sources.spec.ts (5 tests): the superadmin signs in with the accounts' sign-in, follows the dashboard's link, sees noindex, pauses and resumes a source from the keyboard (focus stays on the one button), and each change is listed with the username and a Jalali time that survive a reload; a stopped source shows when and why, and resuming it moves the stop into its history; a stop that arrived after the page opened is not cleared (stale); the screen keeps a 320 px phone without sideways scroll, clipped text, small targets or broken words, also with every string long Farsi; a visitor (raw request and page) and a buyer get a real 404, and a buyer's pages link nowhere under /admin. e2e/fixtures/sources.ts writes each test's own sources as the migration role and purges them with their changes afterwards (pg 8.23.0 added to e2e). Found and fixed by the tests: a state badge inside a shrink-0 wrapper ran 632 px past a 320 px phone with long text, and the inspector read the hidden «وضعیت خزش:» prefix as clipped text (the badge now wraps and follows the heading without a hidden prefix); the status line is now role=status, a polite live region. /admin/sources is not in fixtures/app-pages.ts, as /admin and /account are not: the stress matrix and the gorilla visit signed out, where the page is a 404; the spec's 320 px test covers its layout. Runs against the dev server on 3200: admin-sources 5 of 5 on mobile and on desktop; accounts.spec and admin-sources together 46 of 46. Visual pass with the Playwright CLI (seeded three sources, a throwaway superadmin): 412 and 1440 px screenshots viewed; craft-checks.js at both widths: overflow 0, layout shift 0, no target under 44 px, every line height its role's, no alpha text, icon stroke 1.5 px beside a 1.70 px stem, hues amber (stopped), green (enabled) and the action blue only, nothing moving under reduced motion. Docs: worker.md 'Act on a source or a job' now points to the section, with change_source_state() as the fallback without the web app; accounts.md; the glossary's crawl state, crawler and pause and resume. pnpm check passes.

Reviews (2026-09-29), fixed. Design review: (blocking) a press whose answer never arrived replaced the whole screen with the 500 page: the action now reports a failed database call once (captureError) and answers 'failed' in the status line, and each card's form sits in a catchError boundary (source-state-boundary.tsx) that keeps a dropped connection inside the card with a reference code and a way to see the current state; e2e 'a press whose answer never arrives' aborts the POST and checks both. Also: every region and resume button named or described by its source; every status answer fits one line at 320 px (measured, all nine at 22.4 px); FieldMessage takes role=status instead of a copied colour map; the card keeps to two weights (title 600); the host lines up with the name; copy corrected where it was untrue (a source that is not crawled reads «خزیده نمی‌شود», not «متوقف»; a stop reads «متوقف به دست خزنده» whatever its reason; the cleared stop reads as when it began; the advice names the worker's log, not a screen that does not exist; the empty state says sources arrive with their crawler). Database review (verdict ready): change_source_state() now stamps changed_at with clock_timestamp() once it holds the source's lock, so a call that waited is listed after the change it waited behind (reproduced by the reviewer with two superadmins); the admin role no longer reads account.created_at. Both are edits of a migration not yet on main (pnpm db:rollback, edit, pnpm db:migrate). The reviewer measured no conflict with lane A's CS-33 migrations in either order, no deadlock with its run guard, and the latest-changes query at 100,006 changes at 27 buffers and 0.16 ms. Decided on the recommendation: the e2e fixture keeps purging its own sources and their changes, since a test source left behind would be an enabled crawled source in a development database. Task review (verdict ready): signIn waits for hydration (a dev-server race sent an empty username); comments no longer say a paused source can be stopped on main; a component test proves a second press while pending sends nothing; worker.md shows keeping a stopped source paused; CS-38 notes what these tests need in CI; the AGENTS.md Gotcha on quoting says what a worktree session refuses. Checks: pnpm check passes (190 tests, run three times); pnpm db:check OK (37 web integration tests); admin-sources.spec 12 of 12 on mobile and desktop.

Evidence per criterion (2026-09-29), on commit 568b72f:
#1 e2e admin-sources.spec 'gets a real 404 from the sources screen, as a visitor and as a buyer, and no link to it' (a raw request answers 404 on the production build, a page visit shows «این صفحه پیدا نشد», a buyer's home page has no link under /admin and the buyer's menu no «پنل مدیریت»), and 'pauses and resumes a source…' (meta robots noindex, nofollow on /admin/sources, reached only through the dashboard's link); the page is app/(admin)/admin/sources/page.tsx; the task review also got 404 as a visitor for GET, HEAD, RSC and a plain POST.
#2 e2e signs in through /sign-in with pnpm account:superadmin's superadmins and lands on /admin; a buyer gets 404 (e2e); admin-actions.db.test.ts 'only a superadmin, and only from a page of this site, changes a source' refuses a buyer's session and a cross-site request; the schema tests refuse any account but a superadmin inside change_source_state() (source_state_change_by_superadmin).
#3 e2e 'pauses and resumes a source, and each change is listed with who made it and when' (username and a Jalali time in Persian digits, still there after a reload) and 'sees why the crawler stopped a source, resumes it, and the stop moves into its history'; admin-actions.db.test.ts 7 tests (stopped_at and stop_reason null after the resume, the cleared stop in the change, a stop cleared only when the page showed it to the microsecond, stale, unchanged); schema-constraints.test.ts 6 tests (every constraint of source_state_change, each transition, source_stop_recorded kept).
#4 schema-constraints.test.ts: carshenas_admin reads sources, their changes and account names, and is refused (42501) an UPDATE of source, an INSERT into source_state_change, a password hash, sessions, fetch_log, listing writes and stop_source(); the web, worker and read-only roles cannot call change_source_state(), and the web role cannot read the history or update a source; admin-database.db.test.ts proves the pool runs as carshenas_admin; lint lets only src/features/admin import the pool (two lint self-test samples). Tracked models, labels and review decisions do not exist yet: their tasks extend the role (ADR-0023).
#5 pnpm e2e on a production build: 158 passed, 0 failed, 26 skipped (visual and browser-specific tests, as in CS-39's run); admin-sources.spec 6 tests on mobile and desktop, 12 of 12.
DoD: pnpm check exit 0 (lint, lint self-test 26 samples, migration lint, typecheck, 190 unit and schema tests, formatting); pnpm db:check exit 0 (migrations replay up, down and up; schema and types match; 37 web integration tests and the worker's and accounts' suites); docs: ADR-0023, data-model.md, runbooks (worker, accounts, local-database), glossary, learnings, AGENTS.md Gotcha, the database rule and craft reference; no secrets: only example.env and e2e/.env.example are tracked, and the admin password in example.env is a local container's, like the others.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the superadmin section's sources screen, /admin/sources. It shows each source's crawl state, the crawler's stop (when, in Tehran time, and why), one control to pause or resume the source, and its five latest changes with the superadmin's username and the time. A page that no longer matches the source changes nothing and says so, so nobody clears a stop they have not seen; a press whose answer never arrives stays inside its card. The section works through its own database role, carshenas_admin (ADR-0023, data model open question 14). The role changes a source only through change_source_state(), which checks the superadmin, compares the source with what the page showed, clears a stop it leaves, and records the change in the append-only source_state_change, stamped when it took effect. Public pages keep SELECT on source only. Verified with pnpm check (190 tests), pnpm db:check (migration replay, 37 web integration tests) and pnpm e2e on a production build (158 passed, 0 failed, the new spec 12 of 12). EXPLAIN (ANALYZE, BUFFERS) on 3,000 and 100,006 changes kept the history read under a third of a millisecond. The design, database and task reviews found nothing blocking, and their findings are fixed. Decided on the recommendation, by the owner's standing instruction: the role and its function-only writes; the crawler's own stops not repeated in the history; one button per card; the stop's evidence left to CS-41; the e2e fixture purging its own test sources. Before migrating, lanes A, C and D need CARSHENAS_ADMIN_PASSWORD and ADMIN_DATABASE_URL in their env files on their own port, then pnpm db:roles.
<!-- SECTION:FINAL_SUMMARY:END -->
