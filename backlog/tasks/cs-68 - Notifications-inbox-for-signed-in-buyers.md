---
id: CS-68
title: Notifications inbox for signed-in buyers
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - backend
  - frontend
milestone: m-8
dependencies:
  - CS-39
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
