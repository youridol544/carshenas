---
id: CS-56
title: >-
  Teardown of CarGurus, Autolist and Jabama: home, search, listing and valuation
  pages
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-28 22:12'
labels:
  - research
  - design
milestone: m-5
dependencies: []
references:
  - docs/decisions/0006-used-cars-modeled-on-cargurus.md
  - .claude/skills/capture-site/SKILL.md
priority: medium
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0006 clones the flows of CarGurus and Autolist. Cloning well needs a written teardown of what they actually do, screen by screen, before the UI tasks in m-5 start, adapted for a Farsi, right-to-left, phone-first product.

The owner's product plan of 2026-09-29: the home page (CS-63) follows the home pages of CarGurus, Autolist and Jabama (jabama.com). The owner likes Jabama's big hero, its catalogues and its category selector with icons.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A teardown note in docs/research covers CarGurus's home page, search results, listing page, deal-rating explanation and price-trend pages, with measurements and patterns and no copied assets
- [ ] #2 Autolist's equivalent pages, its home page included, are compared wherever they differ
- [ ] #3 Jabama's home page is captured for its hero, its catalogues and its category selector with icons
- [ ] #4 Each pattern is marked keep, change or drop for Iran, with the reason
- [ ] #5 Capture stops on any robots refusal or challenge and falls back to public help pages and manual notes, as the capture-site skill requires
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Renumbered on 2026-09-29: this task was CS-25 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-25; the archived CS-25 points here.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-09-28 22:12
---
(First posted on CS-25 at 2026-09-26 10:04 UTC.) Found while verifying the capture tool in CS-1 on 2026-09-26. CarGurus robots.txt disallows, for generic agents, the listing pages (/details, /Cars/inventorylisting/), /Cars/search and the valuation tool (/Cars/carWorthStep, /Cars/priceCalculator), so pnpm capture refuses them: study those pages by hand. Allowed: the home page, results landing pages such as /Cars/l-Used-Toyota-Camry-d292 (first page only; ?page= is disallowed) and /research/price-trends. From this machine (a UK datacenter IP), DataDome challenged the phone capture of that results page right after load, while the desktop capture 8 s later got through. Per ADR-0008 and AC #4 that page is not captured again from here; the tool now detects such a late challenge and stops by itself. The home page and the desktop results page were captured without a challenge.
---

author: @claude
created: 2026-09-28 22:12
---
(First posted on CS-25 at 2026-09-26 10:26 UTC.) Correction to the comment above: the desktop capture of the results page was taken 8 s after DataDome had already challenged the phone capture of the same page, and exists only because the tool then missed the challenge. It has been discarded (ADR-0008 rule 6). Treat CarGurus as a source that challenged automated capture from this machine: study its pages by hand for this teardown, or ask the human before any further capture. The home page capture (taken before the challenge) is still in .captures/cargurus-home/.
---
<!-- COMMENTS:END -->
