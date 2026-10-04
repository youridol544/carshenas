---
id: CS-109
title: 'Copy rewrite D: the superadmin section'
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 10:33'
labels:
  - frontend
  - docs
dependencies:
  - CS-104
  - CS-105
priority: medium
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: rewrite the product copy to the voice guide (CS-104). Area D files are those listed for area D in docs/design/copy-rewrite-plan.md (CS-105): every superadmin screen (sources, tracked models and specs, model photos, crawl requests, search files, accounts, data status). The admin may use the operating words it needs (queue, lane, backfill) when the superadmin has to act on them, but it must still be native Farsi, short, free of filler and of repetition, and say what happened and what to do.
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
1. Read the voice guide, the copy-fa skill, the copy rule, the glossary, the rewrite plan (area D) and the inventory of every Area D string (593 strings, 14 files). 2. For each superadmin screen (dashboard, sources, worker and pipeline, search files, tracked models with its specs and country sections, model photos, crawl requests): write the screen strings as one set, give each idea one string, one word per idea, native plain Farsi, what happened and what to do. 3. Rewrite the six copy files and the separators and punctuation in the components; strings only, no copy constant renamed (a few unused keys removed, two shared sentence consts added inside admin-copy.ts, the stale coming-sections block of the dashboard removed). 4. Update the tests that match text: the unit test imports the constants; the Playwright specs of the admin screens carry their own retyped wording, updated to the new words (not run: lane rules of 2026-10-04). 5. Verify cheaply: copy lint on the admin folder (violations 58 to 0, warnings read), prettier, one tsc of apps/web, vitest on the two unit test files that import the constants. 6. Write docs/evidence/copy/area-d.md with the before and after table, counts, words settled and follow-ups for other areas; self-review with the copy-fa review scan; commit; merge main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (owner away, decided by the lane; all recorded in docs/evidence/copy/area-d.md): the badge of a source the crawler stopped is «توقف خودکار» and a source with no crawl is «بدون خزش» (the glossary crawl-state row is updated); each dashboard link says the act, not its card title; a source history line is named like its button; the stale dashboard block «sections that will be added» is removed; the popover headings are kept (they are structure); the glossary search-file row and section 4 of the guide are left for the coordinator after the merges so that no two lanes edit the same table. Strings only: three module-private shared-sentence constants in admin-copy.ts, four dead keys removed, numbers that were typed now come through the formatters (the 48 hours from SEARCH_FRESHNESS_HOURS), the glue strings of six components. The merge of main brought CS-115 strings into crawl-requests-admin-copy.ts (demandRow, demandRead, pasted): kept as built, with the heading, the lead and the parenthesis of the demand strip worded in the guide voice.

Validation (targeted, lane rules of 2026-10-04): pnpm copy:lint on the admin folder 58 violations to 0 and 96 warnings to 3 (read; the three are the word «هنوز» about data that will exist); pnpm copy:test 126 pass; whole-repo pnpm copy:lint nothing new or worse; prettier clean; vitest unit project on worker-format.test.ts (now imports WORKER_COPY) and source-state-form.test.tsx 5 pass; tsc of apps/web clean before the merge of main. Not run by the lane rules: Playwright (the seven admin specs carry the new wording and were checked against the copy by script), screenshots at 412 and 1440, whole-repo pnpm check and eslint, the copy-reviewer agent (a lane cannot spawn it), the baseline file D.json (the coordinator regenerates it once).

After the merge of main (CS-115 and later): tsc of apps/web clean again on the final strings, vitest on the two unit test files 5 pass again, pnpm copy:lint nothing new or worse than the baseline over the whole repository (Area D: 0 violations).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rewrote the copy of the whole superadmin section to the voice guide, screen by screen as one set (dashboard, sources, worker and pipeline, search files, tracked models, engine volume origin and country, model photos, crawl requests): of 600 strings (593 of the plan plus 7 that CS-115 added), 226 rewritten, 6 merged into 3 shared sentences, 6 deleted (a stale sections-to-come block, dead keys), 362 kept with a reason. No database, pg-boss or server words, no semicolons, no middle dot beside a digit, no typed numbers where a formatter exists; one word per idea (توقف خودکار, بدون خزش, رهاشده, تیپ, لینک, ارزیابی, برداشتن, سقف روزانه); the glossary crawl-state row follows. The unit test now imports WORKER_COPY and the seven Playwright specs of the admin screens carry the new wording. Verified with: pnpm copy:lint on the admin folder (58 violations to 0, 96 warnings to 3, read and kept), pnpm copy:test 126 pass, prettier, tsc of apps/web (before and after merging main), vitest on the two unit test files 5 pass. Evidence with every changed string old to new and its rule: docs/evidence/copy/area-d.md. Criteria 4 and 5 stay unchecked by the lane rules of 2026-10-04 (no Playwright, no screenshots, no whole-repo pnpm check, no copy-reviewer agent from a lane): the coordinator runs the copy-reviewer, the screenshots at 412 and 1440 and the admin specs once after the merges.
<!-- SECTION:FINAL_SUMMARY:END -->
