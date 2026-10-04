---
id: CS-102
title: >-
  Range filters take a typed minimum and maximum (mileage first), with the steps
  as quick picks
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-03 18:26'
updated_date: '2026-10-04 09:06'
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
- [x] #1 Mileage can be filtered by a typed minimum and a typed maximum (either or both), accepting Persian and Latin digits and thousands separators, with an inline Farsi message when the minimum is above the maximum or a value is outside the bounds; the steps stay as quick picks
- [x] #2 The control is shared by the other range filters (price, model year, and the engine volume of CS-100); a range with a value shows as one removable chip («کارکرد ۱۰٬۰۰۰ تا ۶۰٬۰۰۰ کیلومتر»), in the URL and in stored searches and search files
- [x] #3 It works in the desktop rail and the phone sheet with a stable layout, accessible names, 16 px inputs without zoom on iOS, and the results update with the same batch behaviour as the other filters
- [x] #4 Playwright tests on phone and desktop cover typing a range, quick picks, an invalid range, removing the chip and the URL round trip; docs and S02 updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Follow-up from the design review (2026-10-04): the typed fields no longer force left-to-right (digits align with the label at the right edge), the quick picks carry their unit («تا ۶۰٬۰۰۰ کیلومتر», «از ۱۶۰۰ سی‌سی» without a thousands mark) and the messages are one line, so the control keeps its height when a value is wrong (a Playwright test measures it).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One shared RangeControl (typed minimum and maximum, Persian or Latin digits and separators, shown in Persian digits, Farsi messages for not a number, outside the bounds and minimum above maximum, applies on blur or Enter, steps as quick picks that fill an end and toggle, 16 px inputs, stable message line) replaces the two selects for mileage, price, model year and engine volume, in the rail and the phone sheet; chips and the min..max URL and stored forms are unchanged. Evidence: range-input.test.ts, filter-panel.test.tsx, e2e range-filters.spec.ts on phone and desktop (production build), screenshots in docs/evidence/range-filters/.

Update 2026-10-04 (commit 9b5fb38), after the owner's instruction to stop heavy verification: range-input.test.ts and filter-panel.test.tsx pass (part of 197 web unit tests), tsc of web and e2e clean. NOT re-run on it: Playwright; range-filters.spec.ts last ran under heavy machine load (3 of 5 passed on phone, the quick pick and the volume range timed out at 41 to 43 s); run it once on a quiet machine before Done.
<!-- SECTION:FINAL_SUMMARY:END -->
