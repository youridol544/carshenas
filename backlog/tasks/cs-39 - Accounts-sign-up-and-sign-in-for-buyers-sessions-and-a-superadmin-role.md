---
id: CS-39
title: 'Accounts: sign-up and sign-in for buyers, sessions, and a superadmin role'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - backend
  - frontend
milestone: m-8
dependencies:
  - CS-3
  - CS-4
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29 needs accounts. A buyer signs up to hand a search to Karshenas («بسپارش به کارشناس»), to mark listings («نشان کردن») and to receive notifications, and the superadmin section needs a real sign-in. This is the trigger ADR-0003 names for authentication, so the mechanism is decided once, here, for both. In Iran, sign-in is usually a phone number and a one-time code by SMS. The SMS provider must work from inside Iran (AGENTS.md, Market), with a fallback. Phone numbers are personal data (ADR-0013 point 8).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An ADR records the sign-in mechanism, the session design, the SMS provider reachable from Iran with its fallback, and how the superadmin role is granted, which is never through the product's own screens
- [ ] #2 A visitor signs up and signs in with a phone number and a one-time code, in Farsi, and signs out; development and tests use a fake SMS sender, never the real provider
- [ ] #3 Sessions live on the server behind an httpOnly, secure cookie, expire, and end on sign-out; requests for a code and attempts to enter one are rate-limited per number and per client
- [ ] #4 Accounts have roles, buyer and superadmin, checked on the server for every page and action; the owner is the first superadmin
- [ ] #5 A minimal profile page shows the buyer's masked phone number and signs out; later tasks add their sections to it
- [ ] #6 Phone numbers never reach logs or other buyers, proven by tests of the sign-in flow's log lines and responses
- [ ] #7 Playwright tests cover sign-up, sign-in, a wrong or expired code, sign-out, and a visitor returned to the page they came from
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The buyer tables planned in docs/design/data-model.md, layer 8, start here: the account, holding the phone number as personal data, its sessions and roles. CS-40, the superadmin section, admits the superadmin role instead of an owner account from the environment.
<!-- SECTION:NOTES:END -->
