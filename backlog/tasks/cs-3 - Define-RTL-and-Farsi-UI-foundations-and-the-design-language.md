---
id: CS-3
title: Define RTL and Farsi UI foundations and the design language
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
labels:
  - design
  - i18n
  - frontend
milestone: m-1
dependencies:
  - CS-2
references:
  - docs/decisions/0005-styling-and-component-primitives.md
  - .claude/skills/ui-design/SKILL.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every screen is Farsi and right-to-left. Font, digit and date rendering, logical CSS, bidi handling of mixed content (VINs, URLs, Latin model names) and a base layout must be settled once so feature tasks do not each reinvent them. The ui-design skill refuses to invent a palette until docs/design/design-language.md exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Font choice and loading strategy are decided and documented, and the font is self-hosted
- [ ] #2 A number and date formatting utility renders Persian digits and Jalali dates in the UI and Latin digits in data, following CS-2
- [ ] #3 docs/design/design-language.md defines the tokens the ui-design skill reads (colour pairs with recorded contrast ratios, type roles with Persian line heights, spacing, radii, motion durations and the five deal-rating colours), and the token lint is switched on with those names
- [ ] #4 The not-found and error pages render Farsi copy with Persian digits in right-to-left layout and link back to the home page
- [ ] #5 A sample page renders correctly right to left on a phone-sized viewport, with visual baselines regenerated in the official container
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
