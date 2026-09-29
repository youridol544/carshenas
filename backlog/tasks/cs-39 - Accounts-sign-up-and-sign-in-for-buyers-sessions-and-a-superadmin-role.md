---
id: CS-39
title: 'Accounts: sign-up and sign-in for buyers, sessions, and a superadmin role'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-29 16:08'
labels:
  - backend
  - frontend
milestone: m-8
dependencies:
  - CS-3
  - CS-4
references:
  - docs/decisions/0020-username-and-password-accounts.md
  - docs/research/2026-09-29-password-accounts-and-sessions.md
  - docs/research/2026-09-29-sign-in-and-sign-up-ux.md
  - docs/research/2026-09-29-sign-in-and-sign-up-teardown.md
  - docs/research/2026-09-29-iranian-sign-in-teardown.md
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29 needs accounts. A buyer signs up to hand a search to Karshenas («بسپارش به کارشناس»), to mark listings («نشان کردن») and to receive notifications, and the superadmin section needs a real sign-in. This is the trigger ADR-0003 names for authentication, so the mechanism is decided once, here, for both.

On 2026-09-29 the owner narrowed it: for now an account is a username and a password only (no phone number, no one-time code, no SMS provider; phone sign-in, which also brings recovery, comes later with its own task); the first superadmin is `pedram`, seeded with a strong password; a superadmin lands on the superadmin dashboard after signing in; and the app's navigation links to sign-in and, for the superadmin, to the dashboard. Usernames are not personal data like phone numbers, but typed usernames can hold a mistyped password, so they stay out of logs (ADR-0016).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ADR-0020 records the sign-in mechanism (username and password), password storage and policy, the session design, throttling, and how the superadmin role is granted, which is never through the product's own screens; the owner accepted it
- [ ] #2 A visitor signs up and signs in with a username and a password, in Farsi and right to left, and signs out; a taken username, a common password and a wrong username or password each get a Farsi message that says how to go on
- [ ] #3 Sessions live in PostgreSQL behind an httpOnly cookie (Secure over https), expire (a buyer after 30 days, the superadmin after 12 hours) and end on sign-out; failed sign-ins are throttled per username, per device and per client address, and sign-ups per client address
- [ ] #4 Accounts have roles, buyer and superadmin, checked on the server for every protected page and action; the database refuses a role change from the web app, and the superadmin pedram exists, created by a command that records every role grant
- [ ] #5 After signing in, a superadmin lands on the superadmin dashboard, which answers 404 to visitors and buyers, and a buyer returns to the page they came from; the header links visitors to sign-in, signed-in people to their account and the superadmin to the dashboard
- [ ] #6 A minimal account page shows the username and signs out; later tasks add their sections to it
- [ ] #7 Passwords, typed usernames, session tokens and client addresses never reach logs or other buyers, proven by tests of the sign-in flow's log lines and responses
- [ ] #8 Playwright tests cover sign-up, sign-in, a wrong password, throttling, sign-out, a visitor returned to the page they came from, and the superadmin landing on the dashboard
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decide: ADR-0020, accepted by the owner on 2026-09-29 through four questions (8-character minimum, no recovery yet, Latin usernames, 12-hour superadmin sessions); commit it with the four research notes and their distilled captures.
2. Database, one migration: account (username format CHECK and UNIQUE, Argon2id PHC hash CHECK, role buyer or superadmin, default buyer), account_session (SHA-256 of a 32-byte token, UNIQUE; FK CASCADE, indexed; lifetime bounded by a CHECK), auth_throttle (scope, HMAC subject, failures, window start, next attempt; UNIQUE per scope and subject) and account_role_change (append-only record of role grants). Column privileges: the web role inserts only username and password_hash and never touches role. Schema tests, data-model.md.
3. packages/accounts, shared by the web app and the command: username and password rules (normalisation, reserved names, NCSC blocklist of 8+ characters, Persian-layout mapping), Argon2id through the argon2 package (PHC strings, rehash check, dummy hash, two hashes at a time), generated passwords. Then pnpm account:superadmin <username>, run as carshenas_migrate: password generated and printed once or read from stdin, one transaction that upserts, records the role change and deletes sessions.
4. apps/web/src/server/auth: session tokens and the cookie chosen per request (__Host-session over https, session on loopback http), currentAccount with React cache, requireAccount and requireSuperadmin, the same-origin check, throttling per username, device cookie and address, the client address, the safe next path; CARSHENAS_AUTH_KEY and the address limits in env.ts and example.env.
5. features/accounts: Zod 4 schemas with Farsi messages, signUpAction, signInAction and signOutAction, the username availability Route Handler; forms as client leaves with useActionState (password field with show and hide, Persian keyboard and Caps Lock hints, a live count, the username check, an error summary).
6. Pages: a (site) route group with the header (brand, and an account slot in Suspense: the visitor link, or the account menu on Base UI with DirectionProvider); /sign-in and /sign-up (redirect when signed in), /account, and /admin as the dashboard shell (404 unless superadmin, noindex); app-pages.ts.
7. Seed pedram in lane B's database and hand the password to the owner.
8. Verify: pnpm check, pnpm db:check, Playwright (sign-up, sign-in, wrong password, throttling, sign-out, return to the page, superadmin to /admin, /admin 404 for visitors and buyers, header, RTL, axe), /verify-ui screenshots at 412 and 1440 px, then the design, database and task reviewers; runbook, glossary and learnings; follow-up tasks; In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The buyer tables planned in docs/design/data-model.md, layer 8, start here: the account, holding the phone number as personal data, its sessions and roles. CS-40, the superadmin section, admits the superadmin role instead of an owner account from the environment.

2026-09-29, research and decision: four notes (password-accounts-and-sessions, sign-in-and-sign-up-ux, sign-in-and-sign-up-teardown, iranian-sign-in-teardown). No auth library: Better Auth 1.7 needs an email per account until v2, checks usernames read-then-insert and skips its limiter for Server Actions; Auth.js has no database sessions for passwords; SaaS excludes Iran. Argon2id through the argon2 package (prebuilt, works under pnpm without build scripts, about 37 ms per hash here on Node 22.14); Node 24's crypto.argon2 later with the same strings. Playwright's WebKit refuses Secure cookies over http, so the cookie is plain on loopback http. The owner asked (2026-09-29) for a superadmin to land on the dashboard and for navigation to it: the dashboard shell and its gate are built here, and the link appears only in the signed-in superadmin's own menu. Research slips, reported to the owner: a UX sub-agent fetched four pages robots.txt disallows (facts from them removed); on Cal.com a Cloudflare challenge inside a frame went unseen by the capture tool while a flow typed (nothing submitted).

Slice 1 (database): migration 20260929150523_create_accounts: account, account_session, auth_throttle, account_role_change (append-only), with column privileges so the web role inserts only username and password_hash and updates only password_hash; the read-only role reads accounts without password_hash. Seven constraint and privilege tests in schema-constraints.test.ts (31 pass); Squawk clean; data-model.md section 3 and section 5 updated.

Slice 2 (packages/accounts): username and password rules (normalisation: digits folded, NFC, other spaces, Arabic yeh and kaf; reserved names; the NCSC 100k list kept at 8+ printable characters, lowercased, 46,453 entries, matched also through the Persian layout map), Argon2id through argon2 0.45.1 with at most two hashes at a time (createTurns), a dummy verification for unknown usernames, generated 24-symbol passwords, keyed hashes, and pnpm account:superadmin (set-superadmin.ts, one transaction: insert-first upsert, role change record, sessions ended, sign-in waits cleared). 20 unit tests and 3 integration tests; pnpm db:check green (web 9, worker 19, accounts 3). CARSHENAS_AUTH_KEY added to example.env and lane B's .env.

Slice 3 (server auth, apps/web/src/server/auth): session tokens (32 bytes, SHA-256 kept), cookies chosen per request (__Host- and Secure except plain http on a loopback host), the same-origin check, the client address (last X-Forwarded-For entry; IPv6 by /56), signed device tokens, sessions with fixed lifetimes (buyer 30 days, superadmin 12 hours), throttling (streaks with a 15-second lease so one attempt per name runs at a time; hourly address windows), currentAccount with React cache, requireAccount and requireSuperadmin; safe return paths and landing rules in src/lib/return-path.ts; time helpers in src/server/db/sql-helpers.ts. 16 unit tests, 9 integration tests (a concurrency test: ten simultaneous claims on one name, one gets the turn); pnpm db:check green.

Slice 4 (pages and header): /sign-up and /sign-in (route group (auth), header without the account slot), /account and the home page in (site) with the header's account slot streamed in its own Suspense boundary inside a fixed frame, /admin in (admin) with noindex; each gated page reads the session first (instant = false) so a visitor gets a real 307 and anyone but the superadmin a real 404. Forms: useActionState, noValidate, an error summary that takes focus and prefixes the title with «خطا:», username availability through POST /api/accounts/username-availability (debounced 400 ms, aborted when stale, counted per address), password show and hide, Persian keyboard and Caps Lock warnings, a live count. The account menu is Base UI's Menu (@base-ui/react 1.8.0, DirectionProvider rtl in the root layout; ADR-0005's first primitive, used directly with our tokens rather than through shadcn init) with lucide-react 1.48.0 icons (one Icon wrapper, 1.5 px non-scaling stroke). A spin animation token for the pending indicator. Two findings fixed on the way: Next.js keeps the page just left in the document, hidden, so form field ids are now unique per form (sign-in-username, sign-up-username…); a taken name is now also reported when the password was refused (an advisory read; the insert still decides). Evidence: pnpm check green (web 176 unit tests); pnpm db:check green (web 21 integration tests, including the actions' log and response privacy test); Playwright accounts.spec 20 of 20 on mobile and desktop against the dev server.

Measured 2026-09-29 on lane B's database with 20,000 load accounts, 60,000 sessions and 20,000 throttle rows (added, measured twice, deleted): session lookup Index Scan on account_session_token_sha256_unique then account_pkey, 0.018 ms, 7 buffers; account by username Index Scan account_username_unique 0.011 ms; availability 0.008 ms; throttle claim upsert 0.058 ms and window count 0.059 ms on auth_throttle_subject_unique; expired sessions of an account Index Scan account_session_account_idx 0.013 ms; sign-out delete 0.021 ms; dashboard count by role Seq Scan plus HashAggregate 3.97 ms over 20,037 rows (acceptable for one superadmin page; no index added).
Visual pass with the Playwright CLI on the dev server: sign-in at 412 and 1440 px, sign-up empty, typing (free name with a check, «۵ کاراکتر دیگر») and after a refused submit (title «خطا: ثبت‌نام | کارشناس», focus on the summary, name refilled, password emptied with a red border), the open account menu (buyer: no «پنل مدیریت»; superadmin: with it), the account page («۷ مهر ۱۴۰۵»), the dashboard at 412 and 1440 px. craft-checks.js on each: no overflow, no control under 44 px (the brand link's probes miss only while Base UI's modal menu is open), every line height its role's, icon stroke 1.5 px, one action hue plus red only in the error state, nothing moving under reduced motion. Layout shift 0 on every fresh load; 0.0038 once after a client navigation in dev mode that compiled the page on demand more than 500 ms after the tap.
<!-- SECTION:NOTES:END -->
