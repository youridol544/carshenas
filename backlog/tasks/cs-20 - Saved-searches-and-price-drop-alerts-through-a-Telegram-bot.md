---
id: CS-20
title: Saved searches and price-drop alerts through a Telegram bot
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
labels:
  - backend
  - frontend
milestone: m-5
dependencies:
  - CS-16
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Buyers come back through alerts, which is the metric that matters. A Telegram bot avoids building accounts before they are needed (ADR-0003).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A buyer can save the current search and link it to a Telegram chat in one short flow
- [ ] #2 New listings rated good or better and price drops on matching listings trigger one message each, never duplicates
- [ ] #3 Alerts can be stopped from Telegram and from the site
- [ ] #4 The Telegram API is reachable from where the worker runs, or the fallback is recorded in an ADR
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
