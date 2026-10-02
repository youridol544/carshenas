---
id: CS-70
title: 'Search files («پرونده‌ی جست‌وجوی خودرو»): hand a search to Karshenas'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-10-02 17:29'
labels:
  - frontend
  - backend
milestone: m-8
dependencies:
  - CS-39
  - CS-40
  - CS-58
  - CS-61
  - CS-63
priority: high
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29: on the search page or the home page, «بسپارش به کارشناس» turns the current search into a search file, which Karshenas keeps watching for the buyer.
- It needs an account.
- A file stores its search in the shared definitions (CS-58), so it finds exactly what the search page shows.
- When the cars it asks for are not tracked, the file raises crawl requests for the superadmin (CS-71); it never adds crawling by itself.

It takes over the `saved_search` table planned in docs/design/data-model.md, layer 8.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 «بسپارش به کارشناس» on the search page and the home page turns the current search into a search file for a signed-in buyer; a visitor signs up first and returns with the same search
- [ ] #2 A file has a name, its search and a state (watching, paused, closed), and the buyer can rename, pause, resume and delete it
- [ ] #3 A file's page shows its current matches ranked by deal, marks what is new since the buyer last looked, and shows the state of any crawl request it raised
- [ ] #4 The profile lists the buyer's files
- [ ] #5 The superadmin section lists every search file with its buyer, identified without the full phone number, its search, its match count and the crawl requests it raised
- [ ] #6 Playwright tests cover creating a file as a visitor and as a buyer, pausing it, and the superadmin's list
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner, 2026-10-01: every catalogue, and every filter whose meaning is a rule (low mileage for its age, popular model, clean and trouble-free, best deal, and so on), shows a small info control beside its title: tapped on a phone, hovered or focused on desktop, it explains in Farsi exactly what it measures, with the numbers (for example «کم‌کارکرد: حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو»). The text comes from the definition in @carshenas/search (CS-58), never written twice; accessible (a button with a Farsi name, a popover or toggletip, Escape closes, not a hover-only title attribute).

From CS-59 (2026-10-02): match listings with searchableWhere from @carshenas/search/sql over search_document (filters, the 48 hour freshness window and the words in one function, the same one the search page and API use), as the worker role or for a stored search, instead of composing filters, freshness or text yourself.
<!-- SECTION:NOTES:END -->
