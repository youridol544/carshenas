---
id: CS-2
title: 'Decide money, currency and calendar handling'
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
labels:
  - i18n
  - backend
  - frontend
milestone: m-1
dependencies: []
references:
  - docs/research/2026-09-18-styling-system-and-component-primitives.md
  - .claude/skills/ui-design/references/persian-type-formatting.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Car prices run to billions of toman and move weekly, and model years appear in two calendars (۱۴۰۰ and 2021). Rial versus Toman, integer storage, readable large amounts and Jalali dates touch every listing, valuation and chart, and are expensive to change later.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An ADR records the storage unit (Rial or Toman), the integer type and its safe range for the largest plausible car price, and the display rules
- [ ] #2 The ADR states how large amounts are shown (for example «۱٫۲ میلیارد تومان») and when full digits are shown instead
- [ ] #3 The ADR records Jalali display with ISO/UTC storage and how model years are stored in both calendars
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
