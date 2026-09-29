---
id: CS-40
title: Superadmin section in the web app
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-29 16:11'
labels:
  - frontend
  - backend
milestone: m-2
dependencies:
  - CS-3
  - CS-4
  - CS-39
references:
  - docs/decisions/0003-bare-minimum-nextjs-16-and-react-19.md
  - docs/decisions/0008-crawl-only-what-sources-allow.md
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
  - docs/design/data-model.md
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner wants control over what the crawler reads (2026-09-28: "a superadmin that can add new cars for crawler ... keep track of their sync"). Several planned jobs also need a human screen that nobody has built:
- resuming a source after a block (ADR-0008 point 6);
- the review queues of low-confidence extractions and duplicate pairs (CS-52, CS-55);
- labelling the evaluation sets (CS-48);
- removal requests (ADR-0008 point 8).

They become owner-only admin pages inside the Next.js app, in TypeScript like the rest (the owner's decision of 2026-09-28). Sign-in comes from the accounts task (CS-39), and only the superadmin role opens these pages.

This task stands the section up with the sources screen. The feature tasks add their own screens: tracked models in CS-53, labelling in CS-48.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Admin pages live in their own route group, are never linked from public pages, carry noindex, and answer 404 to anyone without the superadmin role
- [ ] #2 Sign-in is the accounts' sign-in (CS-39), and only accounts with the superadmin role can open the section
- [ ] #3 Sources can be paused and resumed, every change is recorded with who made it and when, and resuming a source stopped on a block clears its stop as the data model requires
- [ ] #4 Admin writes go through a database role that may change only curated rows (source state, tracked models, labels, review decisions), while public pages keep read-only access
- [ ] #5 Playwright tests cover signing in as the superadmin, the 404 for visitors and buyers, and pausing and resuming a source
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-39 (2026-09-29, ADR-0020): the section's route group app/(admin) exists with noindex metadata, and /admin is the superadmin's landing page after sign-in: a dashboard with account counts, each source's crawl state and what is coming. requireSuperadmin() in apps/web/src/server/auth/current-account.ts answers the not-found page to anyone else, and every admin page, action and query calls it itself (the dashboard's loadDashboard does). The owner asked on 2026-09-29 for navigation to the section: it is linked only from the signed-in superadmin's own account menu, never from what visitors and buyers see, so criterion 1's "never linked from public pages" holds in that sense. What remains here: the sources screen and the admin database role (open question 14).
<!-- SECTION:NOTES:END -->
