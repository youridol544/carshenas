---
id: CS-68
title: Notifications inbox for signed-in buyers
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 22:23'
labels:
  - backend
  - frontend
milestone: m-8
dependencies:
  - CS-39
references:
  - docs/decisions/0026-notifications-inbox-written-through-one-function.md
priority: high
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29: buyers are told, inside the product, about four things:
- a marked listing's price drops, or the car sells;
- a search file finds new cars;
- a crawl request they raised is approved;
- or it is declined.

This task builds the inbox, and the notification model that those features write to. Channels outside the site come after the demo (CS-76). It takes over the `alert` table planned in docs/design/data-model.md, layer 8.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A signed-in buyer has an inbox: notifications newest first, an unread count in the header, and marking one or all as read; each notification links to its listing or search file
- [x] #2 Notification kinds are declared in one place, with Farsi text built from stored facts; adding a kind is one definition and its test
- [x] #3 Each event notifies each buyer at most once, enforced by a unique constraint and written in the same transaction as the event that causes it
- [x] #4 A buyer can mute a kind, and muted notifications are not created.
- [x] #5 Playwright tests cover an unread notification, reading it, and muting a kind
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ADR-0026 (accepted by delegation): one notification table per buyer, written only through create_notification() (SECURITY DEFINER: mute check + ON CONFLICT DO NOTHING on (account_id, kind, event_key)), kinds as a curated code table mirrored by a TypeScript registry in a new package @carshenas/notifications (payload schema, event key, Farsi rendering, setting label per kind), read state and mutes written by the web role, retention by a daily worker job.
2. Migration: notification_kind (seeded with listing_price_drop, the first real kind; its producer is CS-69), notification, notification_mute, create_notification(); grants: web reads its rows, updates read_at, manages mutes; worker and admin execute the function; worker prunes. Schema tests, codegen, data-model.md, glossary.
3. Package: kinds registry + createNotification(executor, ...) helper shared by web and worker; unit tests for every kind (render and event key); a development-only CLI, pnpm notifications:sample <username>, that notifies an account of real recent price drops (demo and browser tests; never run on main).
4. Worker: notification.prune daily (read notifications 90 days after reading, any notification after 365 days), with a db test; db tests for dedup, mute, same-transaction rollback and grants.
5. Web: notifications feature: unread count in the account menu (badge on the trigger, menu item with count, no layout shift), inbox page /account/notifications grouped by Tehran day (Jalali), keyset pagination, mark one read / mark all read with useOptimistic and visible rollback, per-kind mute switches, empty/loading/error states; account page links to it. EXPLAIN (ANALYZE, BUFFERS) for every query.
6. Playwright: unread notification, reading it (one and all), muting a kind (the sample then creates nothing); phone and desktop screenshots, craft checks; pnpm check, pnpm db:check, pnpm e2e.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Slice 1 (schema): ADR-0026 accepted by delegation; migration 20260930201819_create_notifications (notification_kind seeded with listing_price_drop, notification, notification_mute, create_notification() SECURITY DEFINER, grants); four constraint tests in schema-constraints.test.ts (dedup, mute, formats, cascade on purge, role grants); data-model.md section "Added by CS-68"; glossary rows for notification and mute. ADR number 0026 may collide with another lane: renumber at merge if so.

Slice 2 (producers and upkeep): package @carshenas/notifications (kinds registry with listing_price_drop: payload schema, event key price_event:<id>, Farsi title/detail/price change from stored facts, mute label; createNotification() helper over create_notification(); retention constants; unit tests), development-only CLI pnpm notifications:sample <username> [--count] [--skip] that notifies an account of real recent price drops through the same helper (idempotent: second run {"created":0,"skipped":2}); worker job notification.prune nightly 03:40 Tehran with db tests (producer dedup and same-transaction rollback on the worker role; retention keeps exactly the right rows); formatTime in packages/locale. pnpm db:check passed (78 worker tests).

Slice 3 (web): header badge on the account button and an «اعلان‌ها» menu item with the count (the count is read in the account slot's own Suspense boundary, so it arrives with the slot and moves nothing; the route passes the counter into AccountSlot, since features never import each other); inbox page /account/notifications (heading prerenders, list streams behind a skeleton built from the row frame, catchError boundary with reference code and retry), grouped by Tehran day («امروز», «دیروز», weekday and date), keyset pagination (rowsBefore sql helper, tested), mark one / mark all read with useOptimistic and an overlay toast with retry on failure, per-kind mute switches (Base UI Switch, optimistic), empty state leading to search, account page card. Car names show standalone numbers in Persian digits (پژو ۲۰۶ SD V8). Playwright notifications.spec.ts: 6 tests x mobile and desktop, 12 passed against the dev server (with the e2e config's address limits).

EXPLAIN (ANALYZE, BUFFERS), second run, on the lane copy plus 204,955 generated notifications (2,000 buyers x 100 over 90 days, one buyer with 5,000, a third unread) inside a rolled-back transaction (script e2e/cs68-verify stays uncommitted): unread count for the 5,000-row buyer: Index Scan notification_inbox_idx, 174 buffers, 1.05 ms (a partial unread index was not needed: a typical buyer has hundreds of rows); inbox first page: Index Scan notification_inbox_idx 5 buffers + listing_pkey 93 buffers for 31 rows, 0.116 ms, no Sort; page after a cursor 3,000 deep: Index Cond ROW(created_at, id) < ROW(cursor), 103 buffers, 0.123 ms (keyset, not OFFSET); mute settings: notification_mute_once_unique, 1 buffer; mark one: notification_pkey, 5 buffers; mark all (1,666 rows, first run): notification_once_per_event_unique; prune batch of 1,000: Seq Scan 5,821 buffers, about 3 ms (nightly, batched; no index for it).
Visual verification (dev server, demo buyer with 9 notifications over three Tehran days, 4 read): .playwright-cli/cs68-inbox-mobile.png, -settings.png, -menu-mobile.png, -account-mobile.png, -empty-mobile.png, -inbox-desktop.png viewed: RTL, Persian digits in prices, times and years, blue unread dot on the icon, badge «۵» on the account button (top inline-end corner), menu item «اعلان‌ها» with its count, day groups «امروز» and «سه‌شنبه ۷ مهر ۱۴۰۵», switch on with the thumb at the left. Craft checks at 412 and 1440: overflow 0, layout shift 0 from navigation to the settled inbox, one hue bucket (the action blue), no alpha text, nothing animating under reduced motion; findings fixed: the switch hit area grown to 64 x 48, the 16 px external-link icon dropped from the 12 px meta line (stroke heavier than the stem); detail sentence shortened («۲۷ میلیون تومان (۳٪) ارزان‌تر از قیمت قبلی.») and text-pretty on title and detail to avoid one-word last lines.

Decision (2026-10-01): criterion 4 narrowed to muting a kind, because search files do not exist yet (CS-70); the search-file mute is designed (ADR-0026 point 4: a search_file_id column on notification_mute and one condition in create_notification()) and belongs to CS-70 or CS-72, which should carry it as a criterion. Links: a listing notification opens the listing on its source (the click-out) until CS-64 ships the listing page; switch linkOf() in notification-queries.ts then.

Merged main (CS-58) into the branch on 2026-10-01 and renamed the migration to 20261001003000_create_notifications so it follows main's 20260930202001_create_listing_filter_row; ADR number 0026 is free on main (CS-58 took 0027).

Final verification after merging main: pnpm check passed (27 web test files, 225 tests; lint, lint self-test, Squawk, typecheck, formatting); pnpm db:check passed (replay up, down, up; schema and types; 12 web db test files incl. notification-queries.db.test.ts: registry equals notification_kind, keyset paging and account isolation, read one/all through the shown id, mutes set not toggled; worker db tests incl. same-transaction rollback and retention); full pnpm e2e against a production build on port 3169: 204 passed, 26 skipped, 4 failed, all four admin-worker.spec.ts cases that expect «۲ ساعت پیش» for a process started two hours earlier, which reads «دیروز» between 00:00 and 02:00 Tehran (a clock-of-day bug in that test, unrelated to CS-68; not changed here). notifications.spec.ts 12 of 12 (mobile, desktop). accounts.spec.ts keyboard test updated: the menu now has «اعلان‌ها» between the account and signing out.

Review fixes (2026-10-01).
Design: every row slot now has a fixed height (title and detail reserve two lines with a new min-h-2lh utility in globals.css; price, the price before on its own line, and a last row holding the time with the mark-read button, 28 px drawn and 44 px to touch, which also gave the text the width a 320 px phone needs for a full price; numbers are never clamped). Measured on a production build (skeleton kept on screen with JavaScript off): real rows 211.8 px and skeleton rows 211.8 px at 412 and at 320 (last row 210.8 both, no bottom border), slots 48 / 44.8 / 24 / 18 / 28 in both; overflow none. Screenshot cs68-rows-320.png viewed: full prices «۹۴۸٬۰۰۰٬۰۰۰ تومان», «قیمت قبلی: ۲٬۳۰۰٬۰۰۰٬۰۰۰ تومان» fit. Transitions on the switch, its thumb, the unread dot and the check button are inside motion-safe. Day labels moved to inbox-days.ts with a unit test for «امروز», «دیروز» and an older day («سه‌شنبه ۷ مهر ۱۴۰۵»). Not changed (taste): the inbox column is the reading width centred like the account page, not the header width; the account page cards.
Database: migration rolled back, edited and migrated again: notification_listing_kind_has_listing CHECK (kind <> listing_price_drop OR listing_id IS NOT NULL) with a schema test; the web role no longer reads notification_kind (the registry names the kinds); mark-all-read documents that ids follow insert, not commit, order (a producer transaction open across the page load can be marked read unseen; accepted). Prune at a year's volume, in a rolled-back transaction on the lane: 1,000,000 notifications (2,000 buyers x 500 over 400 days, 70 % read), 570,000 expired: 571 batches in 52.6 s, slowest batch 369 ms; a night with nothing left to delete scans once in 288 ms. A normal night deletes about a 365th of a year, a few batches.
Task: criterion 4 reworded; CS-72 gained criterion 6 (mute one search file). notifications:sample refuses with NODE_ENV=production and otherwise unless the database is named *_dev, *_test or *_check or CARSHENAS_SAMPLE_NOTIFICATIONS=development is set (local and lane databases are all named carshenas); the e2e fixture sets it; docs say never on a production database; the runbook has the icon step and the listing CHECK step.
Re-verified: notifications, accounts and layout-stress e2e on a production build: 96 passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Buyers now have an inbox (ADR-0026). Data: notification_kind (seeded with listing_price_drop, the first real kind; CS-69 produces it), notification (UNIQUE account, kind, event_key; payload of facts; listing link cascading on purge; read_at), notification_mute, and create_notification(), a SECURITY DEFINER function that is the only way in: it skips muted kinds and deduplicates, is called in the producer's own transaction, and is executable by the worker and the superadmin section only. Code: @carshenas/notifications (kinds registry with payload schema, event key, Farsi rendering from stored facts, mute label; createNotification helper; retention), worker job notification.prune (nightly), web feature notifications (badge on the account button and menu item with the unread count, /account/notifications grouped by Tehran day with keyset paging, optimistic mark one/all read and mute switches with overlay rollback, empty/loading/error states, account page card), dev-only pnpm notifications:sample. Criterion 4 narrowed to kinds: the search-file mute arrives with search files (CS-70/CS-72) on the same table and function. Listing notifications open the listing on its source until CS-64. Verified: schema-constraints tests, web and worker db tests, pnpm check, pnpm db:check, notifications.spec.ts 12/12 on a production build, EXPLAIN (ANALYZE, BUFFERS) at 205k rows (inbox 0.12 ms, cursor 3,000 deep 0.12 ms, unread count 1 ms), screenshots at 412 and 1440 viewed, craft checks (overflow 0, CLS 0, one hue).
<!-- SECTION:FINAL_SUMMARY:END -->
