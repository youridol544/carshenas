---
id: CS-106
title: >-
  Copy rewrite A: home, header and footer, check a link, model pages, status and
  error pages
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 10:30'
labels:
  - frontend
  - docs
dependencies:
  - CS-104
  - CS-105
priority: high
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: rewrite the product copy to the voice guide (CS-104). Area A files are those listed for area A in docs/design/copy-rewrite-plan.md (CS-105): the home page and hero, the shell (header, footer, credits), the models index and model pages, the status page, not-found and error pages. The check-a-link feature is NOT in this area: CS-115 owns it, copy included. Examples to start from: the hero intro should say what the product does in one short line («… می‌خوانیم و ارزش‌گذاری می‌کنیم»), and the example chips and section titles should sound like a person.
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
1. Read the voice guide, the copy-fa skill and rules, the glossary, the rewrite plan (Area A) and the inventory (383 strings in 18 files, 21 with the separator-only ones). 2. Per screen (home, header/footer/credits, models index, model page, status page, error and not-found pages, hero photo alt texts) list every string with its element and idea, cut repeats (R5) and internals (R7), one word per idea (R6). 3. Apply the rewrite with a script that writes the half-space from a placeholder and asserts every replaced text exists exactly once; delete dead keys and the strings of deleted ideas together with their one rendering line. 4. Keep every constant name; update tests only by constant or new wording. 5. Targeted checks only: copy:lint on the 21 files, prettier, vitest of the touched folders, tsc once. 6. Write docs/evidence/copy/area-a.md (before/after by screen, counts, kept reasons, follow-ups). 7. Self-review with the copy-fa scan, final summary, In Review, commit, merge main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (owner away, decided here). (1) Strings only, plus the least code a deleted string needs: its one rendering line goes with it; StatusScreen description and the Empty body of the model page became optional; SectionBoundary takes a title alone; one key added, MODEL_COPY.trims.error.title, because the trims section was showing the deals failure title. No constant renamed, nothing moved. (2) 17 unused copy strings deleted, found by a script that resolves aliases (an alias definition must not count as a use). (3) Status page: what describes the crawler or an attack on the reader is gone (request budget, the figure of listings held back for hidden instructions, 3 of 5 how-steps); the two steps a buyer can use stay. (4) The three hero chips are what a buyer types; each was read whole by understandQuery with fixtureLexicon (same filters, or a superset for the spoken one). (5) The closing call body and the footer credits lead are deleted, not shortened (R5). (6) A page or section that fails to load says «بارگذاری نشد», not «خوانده نشد»: reading is how we read the sites. Verification: copy:lint over the 21 files 24 violations to 0 and 50 warnings to 8 (all kept on purpose, evidence section 4); copy:test 126 of 126; vitest on the touched folders 16 files, 63 tests pass; typecheck of apps/web exit 0; prettier clean on 40 files. E2E specs were updated as code and not run (rules of 2026-10-04); the not-found visual baseline must be re-made; no copy-reviewer pass and no screenshots at 412 and 1440 (a lane cannot spawn a reviewer and runs no browser): the coordinator. Everything is in docs/evidence/copy/area-a.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rewrote the Farsi of area A (home page, header, footer and credits, models index and model pages, status page, error and not-found pages, hero photo alt texts) to the voice guide. 383 strings reviewed: 216 kept (reason per string in the evidence), 122 rewritten, 45 deleted (17 of them were rendered nowhere), 1 key added. copy:lint over the 21 files: 24 violations to 0, 50 warnings to 8 (all about data that will exist, kept on purpose). Gone from buyer text: database, model and crawler talk (request budget, held-back-for-hidden-instructions figure, tiers, thresholds, method names), the repeats (a retry sentence beside a retry button on 7 failures, the hero line again in step 1, instruction lines beside links and tiles) and the words of two registers; one word per idea now (the failure of a page is «بارگذاری نشد», a goal is «هدف», the body type is «نوع بدنه»). Code touched only where a deleted string needs its rendering line gone (list in evidence section 5); no constant renamed. Verification: copy:lint, copy:test 126 of 126, vitest on the touched folders 16 files and 63 tests, typecheck of apps/web exit 0, prettier clean; main merged (CS-115 and others, no conflict in the area). Browser specs were updated as code and NOT run (rules of 2026-10-04); the not-found visual baseline must be re-made; criteria 4 (copy-reviewer pass, screenshots at 412 and 1440) and 5 (pnpm check, Playwright on phone and desktop) stay open for the coordinator. The popovers of the model page belong to CS-110. Evidence: docs/evidence/copy/area-a.md.
<!-- SECTION:FINAL_SUMMARY:END -->
