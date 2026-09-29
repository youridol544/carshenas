---
id: CS-79
title: Sweep expired sessions and spent sign-in throttle rows every day
status: To Do
assignee: []
created_date: '2026-09-29 16:10'
updated_date: '2026-09-29 16:31'
labels:
  - backend
milestone: m-8
dependencies:
  - CS-39
  - CS-32
priority: medium
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-39 removes an account's expired sessions only when it signs in again, and nothing removes auth_throttle rows whose waits and windows are over (docs/runbooks/accounts.md). Left alone, both tables grow with every visitor who ever signed in or failed to.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A daily worker job deletes sessions that expired more than a day ago and throttle rows whose wait and window ended more than a day ago, in batches
- [ ] #2 The worker role gets exactly the grants the job needs, in a migration
- [ ] #3 An integration test proves live sessions and live throttle rows are kept
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-29, from CS-39's database review: every unknown username typed at sign-in leaves a sign_in_account row for good until this sweep exists, so it is medium, not low.
<!-- SECTION:NOTES:END -->
