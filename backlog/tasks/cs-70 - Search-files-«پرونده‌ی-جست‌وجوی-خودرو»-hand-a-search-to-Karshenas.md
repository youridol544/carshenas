---
id: CS-70
title: 'Search files («پرونده‌ی جست‌وجوی خودرو»): hand a search to Karshenas'
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-03 00:38'
labels:
  - frontend
  - backend
milestone: m-8
dependencies:
  - CS-39
  - CS-40
  - CS-58
  - CS-61
  - CS-63
priority: high
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29: on the search page or the home page, «بسپارش به کارشناس» turns the current search into a search file, which Karshenas keeps watching for the buyer.
- It needs an account.
- A file stores its search in the shared definitions (CS-58), so it finds exactly what the search page shows.
- When the cars it asks for are not tracked, the file raises crawl requests for the superadmin (CS-71); it never adds crawling by itself.

It takes over the `saved_search` table planned in docs/design/data-model.md, layer 8.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 «بسپارش به کارشناس» on the search page and the home page turns the current search into a search file for a signed-in buyer; a visitor signs up first and returns with the same search
- [x] #2 A file has a name, its search and a state (watching, paused, closed), and the buyer can rename, pause, resume and delete it
- [x] #3 A file's page shows its current matches ranked by deal, marks what is new since the buyer last looked, and shows the state of any crawl request it raised
- [x] #4 The profile lists the buyer's files
- [x] #5 The superadmin section lists every search file with its buyer, identified without the full phone number, its search, its match count and the crawl requests it raised
- [x] #6 Playwright tests cover creating a file as a visitor and as a buyer, pausing it, and the superadmin's list
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Data: migrations create_search_file (table, constraints, grants) and limit_search_files_per_account (trigger); schema tests; data-model.md; ADR-0030.
2. Feature search-files: stored search + name suggestion, queries (list, one file, matches ranked by deal, new since viewed_at via listing.created_at), mutations (create with unique/limit mapped, rename, state, viewed, delete), actions.
3. Entry points: «بسپارش به کارشناس» button + banner on /search (slot from the page), on each home catalogue row; dialog for visitors (sign in/up with return to the same search, auto reopen) and buyers.
4. Account: /account/searches list, /account/searches/[id] file page, card on /account, menu link.
5. Superadmin: /admin/search-files list (buyer username, search, match count).
6. e2e tests phone+desktop, app-pages, docs, glossary, task notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner, 2026-10-01: every catalogue, and every filter whose meaning is a rule (low mileage for its age, popular model, clean and trouble-free, best deal, and so on), shows a small info control beside its title: tapped on a phone, hovered or focused on desktop, it explains in Farsi exactly what it measures, with the numbers (for example «کم‌کارکرد: حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو»). The text comes from the definition in @carshenas/search (CS-58), never written twice; accessible (a button with a Farsi name, a popover or toggletip, Escape closes, not a hover-only title attribute).

From CS-59 (2026-10-02): match listings with searchableWhere from @carshenas/search/sql over search_document (filters, the 48 hour freshness window and the words in one function, the same one the search page and API use), as the worker role or for a stored search, instead of composing filters, freshness or text yourself.

Decisions (2026-10-03, lane, owner delegation): ADR-0030. One table search_file (name, stored search jsonb, status watching/paused/closed, viewed_at); unique (account, search) so the same search is one file; at most 30 files an account by trigger; matches never stored, read with searchableWhere over search_document; new = listing.created_at after viewed_at, look recorded 2 s after the file page is on screen. Visitor flow: dialog says sign in or up, returns with ?save=1 and the dialog reopens (URL consumed with the native replaceState, because Next patches replaceState and re-reads the page). Banner after the 4th card (teardown 24), button beside the count, button on each home row. Crawl requests (AC3 second half) belong to CS-71: there is no table yet, so the file page shows none; CS-71 adds its section. Moved nameOnScreen into @carshenas/locale/names and added describeSearch to @carshenas/search. EXPLAIN (ANALYZE, BUFFERS) of the count read (capped at 1001, make filter, 6k searchable rows): 4.3 ms, 2,306 buffers, merge join of search_document and listing by primary key; the account list reads the unique index.

Review fixes 2026-10-03: ADR renamed 0031 (links fixed; the earlier note says 0030). previous_viewed_at added to search_file (visit = looks within 5 minutes); look recorded by a beacon on leaving the file page (POST /api/search-files/viewed).

EXPLAIN (ANALYZE, BUFFERS), count of new matches (created_at > baseline), broad file: few new, before listing_created_at_idx: seq scan on listing 9.8 ms, 1,452 buffers; after: index scan, 0.0 ms, 2 buffers. Many new (3 days): unchanged, 1,886 buffers, stopped at the cap.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built search files. Migrations create_search_file and limit_search_files_per_account (table, named constraints, grants, 30-file trigger), ADR-0030, data-model section for CS-71/CS-72. Feature search-files: save dialog (visitor signs in or up and returns with the dialog open; buyer names and makes the file; the same search finds the existing file; limit message), entry points on /search (button beside the count and a banner after the fourth card) and on every home catalogue row; /account/searches list, /account/searches/[id] page (matches ranked by deal, new marked on the photo and counted since the last look, pause, resume, rename, close, reopen, delete), card on /account and a menu item; superadmin /admin/search-files (buyer by username, search chips, match count, state). Crawl-request state (second half of #3) has no table until CS-71 and is left to it. Evidence: pnpm check and pnpm db:check pass; schema tests for every constraint and the grants; Playwright tests/app/search-files.spec.ts 16/16 on phone and desktop against a production build (visitor and buyer flows, pause, rename, delete, new markers, superadmin list, home entry); search, home, layout-stress and admin specs 204 pass; EXPLAIN of the count read 4.3 ms. Not run: the coordinator reviews. Two existing tests fail independently of this task (accounts focus on the home page, notifications empty inbox: the footer duplicates the search link).
<!-- SECTION:FINAL_SUMMARY:END -->
