---
id: CS-76
title: 'Notifications outside the site: a Bale or Telegram bot'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - backend
  - frontend
milestone: m-7
dependencies:
  - CS-68
priority: low
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After the demo. The inbox (CS-68) is the first channel; a bot delivers the same notifications to a buyer's chat. Telegram is filtered in Iran and its API may be unreachable from the worker's host, while Bale's bot API, which follows Telegram's, works inside Iran. Search files replaced the saved searches this task first planned (CS-70).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A buyer links a Bale or Telegram chat to their account in one short flow, and unlinks it from the chat or from the profile
- [ ] #2 Each inbox notification the buyer has not muted is also sent to the linked chat, once
- [ ] #3 The bot's API is reachable from where the worker runs, or the fallback is recorded in an ADR
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-4 (2026-09-27): alerts are sent at most once: one alert row per saved search and price event under a unique constraint, written in the transaction and sent after commit; Telegram chat ids are personal data under ADR-0013 point 8 (docs/design/data-model.md).

2026-09-28: moved after the demo (ADR-0017). Price events from CS-35 are the input, so the feature is cheap later, but it earns a few seconds of a five-minute video. api.telegram.org is filtered in Iran, where the worker runs; Bale's bot API, which follows Telegram's, is the in-Iran option for criterion 4.

Renumbered on 2026-09-29: this task was CS-20 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-20; the archived CS-20 points here.
<!-- SECTION:NOTES:END -->
