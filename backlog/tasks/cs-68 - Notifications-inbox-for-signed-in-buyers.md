---
id: CS-68
title: Notifications inbox for signed-in buyers
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 20:34'
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
- [ ] #1 A signed-in buyer has an inbox: notifications newest first, an unread count in the header, and marking one or all as read; each notification links to its listing or search file
- [ ] #2 Notification kinds are declared in one place, with Farsi text built from stored facts; adding a kind is one definition and its test
- [ ] #3 Each event notifies each buyer at most once, enforced by a unique constraint and written in the same transaction as the event that causes it
- [ ] #4 A buyer can mute a kind or a search file, and muted notifications are not created
- [ ] #5 Playwright tests cover an unread notification, reading it, and muting a kind
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
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
<!-- SECTION:NOTES:END -->
