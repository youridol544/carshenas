---
id: CS-106
title: >-
  Copy rewrite A: home, header and footer, check a link, model pages, status and
  error pages
status: To Do
assignee: []
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 09:42'
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
