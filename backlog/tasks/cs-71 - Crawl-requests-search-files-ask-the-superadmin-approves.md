---
id: CS-71
title: 'Crawl requests: search files ask, the superadmin approves'
status: In Review
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-10-03 03:03'
labels:
  - backend
  - frontend
  - crawler
milestone: m-8
dependencies:
  - CS-53
  - CS-70
  - CS-68
  - CS-40
priority: high
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29 keeps two things apart:
- what Carshenas crawls: the tracked models (CS-53), chosen by the superadmin;
- what buyers ask for: search files (CS-70).

A search file for a model that is not tracked raises a crawl request. Only the superadmin turns a request into crawling, because capacity is limited by the request budget of ADR-0017. For each tracked model and each request, the superadmin sees the search files that depend on it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A search file for a make and model, optionally a trim, that is not tracked raises a crawl request; when a request or a tracked model already exists for it, the file is linked to that one, decided by a unique constraint, never by a check before the insert
- [x] #2 The superadmin sees, for every tracked model and every request, the search files that depend on it, and for every search file, the requests and tracked models it depends on
- [x] #3 The approval or decline of a request notifies each buyer whose file raised it, once (CS-68)
- [x] #4 Tests cover a request raised by two buyers becoming one request, an approval and a decline
- [x] #5 The superadmin approves a request, which queues the model for tracking (CS-53 starts its backfill), or declines it with a reason; nothing else creates a tracked model from a buyer's search
- [x] #6 Every approved request records who approved it and when
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Data: migrations create_crawl_request (crawl_request per catalogue model/trim scope, unique; crawl_request_file links a search file; append-only crawl_request_decision; per-file and per-account caps by trigger), tracked_model_scope view (what is read in depth until CS-53), decide_crawl_request() (superadmin-only, records who and when) and the notification kind crawl_request_decided.
2. Web: feature crawl-requests: shared rule (few matches, caps) with info control, ask action (INSERT ON CONFLICT, link), state on the file page, list card and a quiet card.
3. Admin: /admin/crawl-requests screen: filter by state, chips, buyer usernames, demand per model, approve/decline with reason; decision notifies buyers via createNotification in the same transaction.
4. Admin search-files list gets the requests of each file (small additive column).
5. Tests: schema constraints, db test of the decision, Playwright phone+desktop buyer and superadmin; EXPLAIN of new queries; docs (data-model, ADR-0036, glossary).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (2026-10-03, lane, owner delegation; ADR-0036). The buyer asks on purpose (a press on the card), a file never raises demand by being saved; one crawl_request per catalogue model or trim (UNIQUE NULLS NOT DISTINCT), files linked through crawl_request_file, demand = distinct accounts. Approved means queued for CS-53 (nothing is crawled; the pages say so while no source is enabled); decisions go through decide_crawl_request() (records who and when, append-only crawl_request_decision, approve and decline may follow each other); each linked buyer is told once through createNotification() inside the decision transaction (kind crawl_request_decided; payload carries the file id, the inbox links to it). Caps by trigger: 3 requests a file, 10 waiting an account, no joining a declined request. Tracked = view tracked_model_scope (latest freshness keys) until CS-53 replaces it. Rule «few matches» (10) is one definition in apps/web/src/lib/crawl-requests-rules.ts shared by the card, the action and the info control. Features may not import each other (ADR-0004), so shared pure parts are in src/lib, shared reads in src/server/db, the buyer side in features/search-files, the superadmin side in features/admin. Also fixed on the way: main failed typecheck (listing code imported nameOnScreen from search-labels; now from @carshenas/locale/names), the file page chip row scroll region got tabIndex (axe), the notifications db test assumed one kind. EXPLAIN (ANALYZE, BUFFERS) at 2,000 buyers, 6,000 files, 1,500 requests: docs/evidence/crawl-requests/2026-10-03/explain.txt (scope states 0.09 ms, account files requests 0.11 ms, limit counts 0.05 and 0.14 ms, admin list 17 ms, dependent files 2 ms, demand 12 ms).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built crawl requests. Migrations create_crawl_request (crawl_request one per model or trim by UNIQUE NULLS NOT DISTINCT, crawl_request_file links, append-only crawl_request_decision, caps by trigger), decide_crawl_request (superadmin-only, records who and when), tracked_model_scope view, notification kind crawl_request_decided, grant of make and trim names to the admin role; ADR-0036; data-model section and glossary. Buyer side: a quiet card on the file page «از کارشناس بخواهید بیشتر بگردد» (rule in one shared definition with the info control), ask action, state on the file page and the list card (در انتظار تأیید، تأیید شد، رد شد), inbox notice per decision. Superadmin: /admin/crawl-requests (filter by state, demand per model, files and buyers behind each request, approve or decline with a reason, the models read in depth with how each came to be) and the requests of each file on /admin/search-files. An approval queues the model for CS-53 and crawls nothing; the pages say so while no source is enabled. Evidence: pnpm check (468 unit and schema tests plus lint, typecheck, format; one unrelated filter-panel test timed out under machine load and passed alone), pnpm db:check 113 db tests including two buyers asking at once making one request and a decision notifying each buyer once, Playwright crawl-requests.spec.ts 14/14 on phone and desktop plus search-files, notifications and admin-sources specs 54 passed in all, EXPLAIN plans in docs/evidence/crawl-requests/2026-10-03. AC#1 and AC#2 text says approval makes the model tracked and starts its backfill: CS-53 is not built, so approval queues it (decision recorded in ADR-0036).
<!-- SECTION:FINAL_SUMMARY:END -->
