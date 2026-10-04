---
id: CS-108
title: >-
  Copy rewrite C: accounts, notifications, marks, search files, crawl requests
  and alerts
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 10:02'
labels:
  - frontend
  - docs
dependencies:
  - CS-104
priority: high
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: rewrite the product copy to the voice guide (CS-104). Area C files are those listed for area C in docs/design/copy-rewrite-plan.md (CS-105): sign in and sign up, account pages, the notifications inbox and every notification kind’s title and detail (these are rendered from the stored payload: keep the payloads and keys unchanged), marked listings, search files and their alerts, the crawl request card on a file page, the buyer-side messages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every string in the area’s files is reviewed against the product voice guide (CS-104) and either rewritten or kept with a recorded reason; a before and after table with the counts (reviewed, changed, kept) is written to docs/evidence/copy/ for the area
- [ ] #2 No technical or internal detail is left in buyer-facing text (thresholds of the model, parser or version names, internal ids, English technical terms, how the data is stored); where a rule has to be explained, its info control says it in one or two plain sentences, and the rest is removed
- [ ] #3 No repetition: the same fact is not said twice on one screen (title, lead, hint, button and notice are audited together), and one idea uses one word everywhere (the glossary); no filler, no marketing adjectives, no exclamation marks, no sentence that is not native Farsi
- [ ] #4 The copy lint (CS-105) passes with no new allowlist entry, a pass of the copy-reviewer agent leaves no blocking finding, and screenshots of the changed screens at 412 and 1440 are looked at and described
- [ ] #5 Tests that match text use the central copy constants or are updated without weakening an assertion; pnpm check and the affected Playwright specs pass on phone and desktop
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the voice guide, the copy-fa skill, the glossary and the area C plan; print every string of area C (pnpm copy:inventory --strings C) as the before.
2. Per screen, list every string with its element and its one idea; delete or merge repeats (R5), cut internals a buyer cannot check or act on (R7), one word per idea (R6), plain native Farsi in the voice (R3 R4 R8 R9), typography (R10).
3. Screens: sign in and sign up; account menu and page; the mark control; the marked page; the inbox, its settings and every notification kind (packages/notifications/src/kinds.ts: only the words, payloads and keys unchanged); search files (list, save dialog and banner, file page, alerts); the crawl request card.
4. Strings only: no new component, prop or file, no copy constant renamed; a string deleted for repeating an idea is deleted with its one line of JSX, and every such edit is listed in the evidence file.
5. Tests that match text are updated to the new wording or the constant, never weakened; run the notification package tests and vitest for the copy files only; no browser, no database, no build.
6. Verify: pnpm copy:lint on the area files (violations fixed, warnings read), prettier on changed files, tsc for apps/web and packages/notifications once.
7. Evidence in docs/evidence/copy/area-c.md: counts and every changed string old to new, by screen, with a few words of why; follow-ups for other areas.
<!-- SECTION:PLAN:END -->
