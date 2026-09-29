---
id: CS-80
title: 'Phone sign-in with a one-time code, and password recovery through it'
status: To Do
assignee: []
created_date: '2026-09-29 16:10'
labels:
  - backend
  - frontend
milestone: m-7
dependencies:
  - CS-39
priority: medium
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner deferred phone numbers and one-time codes on 2026-09-29 (CS-39, ADR-0020 point 13): in Iran sign-in is usually a phone number and a code by SMS, and it is also the only way to give buyers password recovery. Phone numbers are personal data (ADR-0013 point 8). The SMS provider must work from inside Iran, with a fallback (AGENTS.md, Market).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An ADR records the SMS provider reachable from Iran with its fallback, how phone numbers are stored, and how a phone joins an existing username account
- [ ] #2 A buyer adds a phone number to their account and signs in with it and a one-time code, in Farsi; development and tests use a fake SMS sender, never the real provider
- [ ] #3 A buyer who forgot their password resets it through a code sent to their phone
- [ ] #4 Requests for a code and attempts to enter one are rate-limited per number and per client, and phone numbers never reach logs or other buyers
- [ ] #5 Playwright tests cover adding a phone, signing in with a code, a wrong or expired code and a password reset
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
