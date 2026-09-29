---
id: CS-78
title: 'Account settings: change the password and sign out everywhere'
status: To Do
assignee: []
created_date: '2026-09-29 16:10'
labels:
  - backend
  - frontend
milestone: m-8
dependencies:
  - CS-39
priority: medium
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-39 left buyers without a way to change their password or end their sessions on other devices (ADR-0020 follow-ups; OWASP ASVS 5.0 6.2.2 and 6.2.3 at level 1 once a change exists). The account page is where later sections go, and a password manager looks for /.well-known/change-password.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A signed-in buyer changes their password on the account page by giving the current password and a new one that passes the same rules as sign-up, in Farsi, and every other session of the account ends
- [ ] #2 «خروج از همه‌ی دستگاه‌ها» on the account page ends every session of the account, this one included
- [ ] #3 /.well-known/change-password redirects to the password form
- [ ] #4 Playwright tests cover a change, a wrong current password and signing out everywhere
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
