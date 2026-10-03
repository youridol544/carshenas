---
id: CS-69
title: Marked listings («نشان کردن») with price-drop and sold notifications
status: In Review
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-10-03 01:18'
labels:
  - frontend
  - backend
milestone: m-8
dependencies:
  - CS-39
  - CS-68
  - CS-35
  - CS-61
  - CS-64
priority: high
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29: a buyer marks listings to follow, which needs an account. The inbox then says when a marked car's price drops, when it sells or leaves, and when it comes back. Price events come from the freshness work (CS-35).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A signed-in buyer marks and unmarks a listing on the search page and the listing page, with an optimistic toggle that rolls back visibly on failure; a visitor is asked to sign in and returns to the same listing
- [x] #2 The profile lists the buyer's marked listings with their current price, rating and status
- [x] #3 A price drop, a sale or disappearance, and a relisting of a marked listing each create one inbox notification (CS-68)
- [x] #4 Playwright tests cover marking as a visitor and as a buyer, and a price drop reaching the inbox
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Migrations: listing_mark (PK account+listing, cap trigger 200, grants), two notification kinds. 2. Worker job marks.notify (price drops by per-mark event watermark, status changes by seen_status) through createNotification, plus pnpm marks:notify. 3. Web: marks feature (provider, bookmark control on card, listing page and bar, visitor popover with return), marked-listings page with filters, account card and menu item; notifications lead to the listing page. 4. Tests: kinds, worker db, web db, unit, Playwright phone and desktop. 5. ADR-0032, data model, runbook.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (owner delegation): cap 200 per account in the database; marks read at request time apart from the shell (a promise made during prerender would bake the visitor answer in); producer is a 2-minute queue job with per-mark per-listing watermarks, not triggers on crawl tables; off-market and relisted are separate kinds with their own mute; visitor wish kept in sessionStorage for 30 minutes and honoured only on the same page; notification links now lead to /listings/id. EXPLAIN: marked page query 0.8 ms (nested loops on listing_pkey, listing_valuation_listing_idx, listing_photo_pkey), marks snapshot 0.13 ms, worker queries 0.2-0.3 ms on the lane. Validation: pnpm check passed, pnpm db:check passed (one earlier run had load-related failures in divar-freshness tests that pass alone and on rerun), Playwright marks.spec and notifications.spec 38 of 38 on a production build, phone and desktop.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Marked listings built: listing_mark table with database cap and grants, off-market and relisted notification kinds, worker job marks.notify (and pnpm marks:notify), bookmark control on result cards and the listing page (sticky bar on phones), visitor sign-in popover that returns with the listing marked, marked-listings page with price now vs when marked, change badges, status and filters, account card and menu item, notifications now open the listing page. Evidence: pnpm check, pnpm db:check, worker marks.db tests, web mark db tests, unit tests, Playwright marks.spec and notifications.spec on phone and desktop, screenshots opened and described, EXPLAIN in notes. ADR-0032.
<!-- SECTION:FINAL_SUMMARY:END -->
