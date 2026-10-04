---
id: CS-110
title: 'Copy rewrite E: shared definitions and info popovers without technical detail'
status: To Do
assignee: []
created_date: '2026-10-04 07:04'
labels:
  - frontend
  - docs
dependencies:
  - CS-104
priority: high
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: there is too much technical information in the copy. Area E covers the shared texts in packages and libs that feed many screens: the filter and catalogue definitions in @carshenas/search (labels, descriptions, rule texts, option names, explanation text for info controls), the info popover content builders (mileage reading, deal rating bands, market value, valuation segments, crawl rules), notification kind settings, and the locale-derived phrases. An info control should answer one question in one or two plain sentences, with numbers only when they help a buyer decide, never thresholds of the model, error margins, version names or internal vocabulary. Keep ids, keys and stored forms unchanged.
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
