---
id: CS-57
title: Body-type icons drawn from iconic Iranian cars
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - design
  - frontend
milestone: m-5
dependencies:
  - CS-3
  - CS-50
priority: medium
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29: the home page has a clickable body-type selector (hatchback, sedan, crossover, SUV, pickup …) whose icons are real, iconic cars in Iran, not generic shapes. The same icons can stand in for a missing photo on listing cards, as CS-60 recommends. They are drawn for Carshenas in the design language (docs/design/design-language.md), never traced from photos or brand material.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 There is one icon for each body type in the catalogue's list (CS-50), each drawn from a car Iranian buyers recognise as that type, and the source names the car behind each icon
- [ ] #2 The icons share one grid and stroke weight from the design language, stay crisp at the selector's and the card's sizes, and work in light and dark themes
- [ ] #3 Each icon is a component with a Farsi accessible name, and the /design page shows the set
- [ ] #4 The design reviewer passes the set, and no brand logo or copied artwork is used
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
