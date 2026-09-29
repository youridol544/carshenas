---
id: CS-69
title: Marked listings («نشان کردن») with price-drop and sold notifications
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
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
- [ ] #1 A signed-in buyer marks and unmarks a listing on the search page and the listing page, with an optimistic toggle that rolls back visibly on failure; a visitor is asked to sign in and returns to the same listing
- [ ] #2 The profile lists the buyer's marked listings with their current price, rating and status
- [ ] #3 A price drop, a sale or disappearance, and a relisting of a marked listing each create one inbox notification (CS-68)
- [ ] #4 Playwright tests cover marking as a visitor and as a buyer, and a price drop reaching the inbox
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
