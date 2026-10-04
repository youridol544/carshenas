---
id: CS-109
title: 'Copy rewrite D: the superadmin section'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 10:11'
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
1. Read the voice guide, the copy-fa skill, the copy rule, the glossary, the rewrite plan (area D) and the inventory of every Area D string (593 strings, 14 files). 2. For each superadmin screen (dashboard, sources, worker and pipeline, search files, tracked models with its specs and country sections, model photos, crawl requests): write the screen strings as one set, give each idea one string, one word per idea, native plain Farsi, what happened and what to do. 3. Rewrite the six copy files and the separators and punctuation in the components; strings only, no copy constant renamed (a few unused keys removed, two shared sentence consts added inside admin-copy.ts, the stale coming-sections block of the dashboard removed). 4. Update the tests that match text: the unit test imports the constants; the Playwright specs of the admin screens carry their own retyped wording, updated to the new words (not run: lane rules of 2026-10-04). 5. Verify cheaply: copy lint on the admin folder (violations 58 to 0, warnings read), prettier, one tsc of apps/web, vitest on the two unit test files that import the constants. 6. Write docs/evidence/copy/area-d.md with the before and after table, counts, words settled and follow-ups for other areas; self-review with the copy-fa review scan; commit; merge main.
<!-- SECTION:PLAN:END -->
