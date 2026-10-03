---
id: CS-102
title: >-
  Range filters take a typed minimum and maximum (mileage first), with the steps
  as quick picks
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-03 18:26'
updated_date: '2026-10-03 18:34'
labels:
  - frontend
dependencies: []
priority: high
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-03: for the mileage filter add a range with a minimum and a maximum the buyer can type. Today a range filter offers fixed steps. The same control should serve every range filter (mileage, price, model year, and the engine volume range of CS-100): two numeric fields (Persian or Latin digits accepted, shown in Persian digits and thousands separators), validated against the filter bounds, with the existing steps kept as quick picks, in the filter rail, the phone sheet, the URL and stored forms, the active chips and the plain-Farsi chips.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Mileage can be filtered by a typed minimum and a typed maximum (either or both), accepting Persian and Latin digits and thousands separators, with an inline Farsi message when the minimum is above the maximum or a value is outside the bounds; the steps stay as quick picks
- [ ] #2 The control is shared by the other range filters (price, model year, and the engine volume of CS-100); a range with a value shows as one removable chip («کارکرد ۱۰٬۰۰۰ تا ۶۰٬۰۰۰ کیلومتر»), in the URL and in stored searches and search files
- [ ] #3 It works in the desktop rail and the phone sheet with a stable layout, accessible names, 16 px inputs without zoom on iOS, and the results update with the same batch behaviour as the other filters
- [ ] #4 Playwright tests on phone and desktop cover typing a range, quick picks, an invalid range, removing the chip and the URL round trip; docs and S02 updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
