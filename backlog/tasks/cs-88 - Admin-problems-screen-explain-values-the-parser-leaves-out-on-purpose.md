---
id: CS-88
title: 'Admin problems screen: explain values the parser leaves out on purpose'
status: To Do
assignee: []
created_date: '2026-10-02 16:21'
labels:
  - frontend
milestone: m-2
dependencies: []
references:
  - apps/web/src/features/admin/components/problems-section.tsx
priority: low
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-86 keeps a stated mileage under 1,000 km on an old car as text the parser did not read, so the superadmin problems screen lists «کارکرد: ۱۰۹» among the values not read, with no explanation; six of its twenty rows are of this kind and cannot be taught to the parser. A reason on the unparsed value and a Farsi label on the screen would tell the superadmin which rows to act on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An unparsed value kept by a rule (an implausible mileage) shows a short Farsi explanation on the problems screen and is not offered as a wording to teach the parser
- [ ] #2 The screen test covers a rule row and an ordinary unread wording
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
