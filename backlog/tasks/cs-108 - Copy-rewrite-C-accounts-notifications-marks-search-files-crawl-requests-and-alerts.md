---
id: CS-108
title: >-
  Copy rewrite C: accounts, notifications, marks, search files, crawl requests
  and alerts
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 10:29'
labels:
  - frontend
  - docs
dependencies:
  - CS-104
  - CS-105
priority: high
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: rewrite the product copy to the voice guide (CS-104). Area C files are those listed for area C in docs/design/copy-rewrite-plan.md (CS-105): sign in and sign up, account pages, the notifications inbox and every notification kind’s title and detail (these are rendered from the stored payload: keep the payloads and keys unchanged), marked listings, search files and their alerts, the crawl request card on a file page, the buyer-side messages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every string in the area’s files is reviewed against the product voice guide (CS-104) and either rewritten or kept with a recorded reason; a before and after table with the counts (reviewed, changed, kept) is written to docs/evidence/copy/ for the area
- [x] #2 No technical or internal detail is left in buyer-facing text (thresholds of the model, parser or version names, internal ids, English technical terms, how the data is stored); where a rule has to be explained, its info control says it in one or two plain sentences, and the rest is removed
- [x] #3 No repetition: the same fact is not said twice on one screen (title, lead, hint, button and notice are audited together), and one idea uses one word everywhere (the glossary); no filler, no marketing adjectives, no exclamation marks, no sentence that is not native Farsi
- [ ] #4 The copy lint (CS-105) passes with no new allowlist entry, a pass of the copy-reviewer agent leaves no blocking finding, and screenshots of the changed screens at 412 and 1440 are looked at and described
- [ ] #5 Tests that match text use the central copy constants or are updated without weakening an assertion; pnpm check and the affected Playwright specs pass on phone and desktop
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (2026-10-04, the owner away; each also in docs/evidence/copy/area-c.md and in the glossary or the guide's words table):
- A search file's state is فعال / متوقف / بسته (adjectives), not در حال پایش (guide appendix A.2); the toggle names the state it leads to (متوقف کردن / فعال کردن). Glossary row changed.
- The button is سپردن به کارشناس (guide E73); the glossary row and three docs that quoted the old name changed.
- اعلان, never هشدار, for what a file sends (R6); آخرین بازدید for the buyer's last visit; the site is دیوار, not سایت منبع; رد شد in the notification as on the badge.
- Strings only: 36 strings deleted (a repeat, an internal detail, or no component read it), 142 rewritten, 207 kept, of 385. A string deleted for repeating an idea took its one line of JSX with it (list in the evidence file); no component, prop or file added, no constant renamed, payloads, keys, event keys and stored forms untouched.
- A promise (خبرتان می‌کنیم) was in nine strings and is in two; the popovers keep only limits a buyer can meet (200 marks, 2 hours and 8 a day, 10 matches, 3 models, 10 requests); the paused and closed banners went (the badge, the toggle and the alert line say it); the 48-hour window left the file page.
Verification (targeted, lane rules of 2026-10-04): pnpm copy:lint on the 12 files 20 violations to 0 and 67 warnings to 9 (read, kept: six هنوز about the buyer's own state, three amount-with-share parentheses); pnpm copy:test 126 pass; whole-repo pnpm copy:lint nothing new or worse; eslint --max-warnings 0 on the changed web files and packages/notifications; tsc --noEmit for apps/web, packages/notifications and e2e; packages/notifications tests 14 pass (they render every kind); vitest of the area's folders 8 files 26 tests pass; prettier clean. Words with no other use in the repo (11) checked for half-spaces.
Not run, by the lane rules: Playwright (no e2e spec, no screenshots at 412 and 1440), db tests, pnpm check, a build; the copy-reviewer agent cannot be started from a lane. Tests changed to the new wording (none weakened; three re-pointed, see the evidence file): kinds.test.ts, two worker db tests, e2e fixtures marks and notifications and specs accounts, marks, notifications, search-files, search-file-alerts, crawl-requests, button-labels.
Follow-ups for others: area D follows the glossary for the file state (admin-copy.ts states.watching and the matching-runs heading, crawl-requests-admin-copy.ts stateOfFile) and then updates adminWatching in e2e search-files.spec.ts; comments in search-screen.tsx, search/page.tsx and catalogue-row.tsx still name the old button; the coordinator lowers tools/copy-lint/baseline/C.json once after the merges (13 entries above the code).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Area C rewritten to the voice guide, strings only. Of the 385 strings: 142 rewritten, 36 deleted (a repeat, an internal detail, or no component read it), 207 kept; the evidence file docs/evidence/copy/area-c.md has every one old and new by screen with its reason, the decisions, the lines of markup that went with deleted strings, the tests changed, the warnings kept and the follow-ups for other areas. Settled words: a file is فعال / متوقف / بسته (glossary), سپردن به کارشناس, اعلان (never هشدار), آخرین بازدید, the site is دیوار, رد شد; a promise to tell the buyer is in two strings, not nine; popovers keep only limits a buyer can meet; no database, queue, crawler, window or job schedule is named any more. Verified with: pnpm copy:lint on the 12 files 20 violations to 0 and 67 warnings to 9 (read and kept); copy:test 126 pass; whole-repo copy:lint nothing new; eslint and tsc (apps/web, packages/notifications, e2e) clean; notification package tests 14 and area vitest 26 pass; prettier clean. Criteria 4 and 5 stay open: the copy-reviewer agent, the screenshots at 412 and 1440, pnpm check and the Playwright specs were not run in this lane (the coordinator runs them once after the merges); the e2e specs and fixtures that retype the old words were updated to the new ones and not run.
<!-- SECTION:FINAL_SUMMARY:END -->
