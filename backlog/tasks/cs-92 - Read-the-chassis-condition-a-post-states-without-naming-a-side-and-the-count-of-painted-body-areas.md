---
id: CS-92
title: >-
  Read the chassis condition a post states without naming a side, and the count
  of painted body areas
status: To Do
assignee: []
created_date: '2026-10-02 18:46'
labels:
  - backend
milestone: m-3
dependencies: []
references:
  - apps/worker/src/sources/divar/attributes.ts
  - docs/design/data-model.md
priority: medium
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-85 left two readings undone on purpose (docs/design/data-model.md, Added by CS-85). (1) In 96 of 6,088 derived listings Divar scores the whole chassis «ضربه‌خورده» (94) or «رنگ‌شده» (2) without naming a side; of the 385 posts that score each side, 299 have exactly one side damaged or repainted and the other sound, so the word cannot be stored as both sides, and no value of front_chassis_condition and rear_chassis_condition says a side not named. Valuation therefore reads these 96 as sound although S01 excludes a damaged chassis. (2) «رنگ‌شدگی در N ناحیه» is stored as partly_repainted for every N from 1 to 8, so the painted coefficient is one average over 1 to 8 areas: on 2026-10-02 the median price gap to the fit was +1.0 % for 1 area, -1.4 % for 2 and -4.5 % for 3 (350, 246 and 116 rated listings). Also: search offers no filter option for the new gearbox and engine value repaired.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A listing whose post scores the whole chassis damaged or repainted without a side carries that fact in the database (a column or a value decided and recorded in data-model.md) and valuation treats a damaged one as S01 does, an excluded condition
- [ ] #2 The number of painted areas a post states is stored, and valuation either uses it (one term per area, or buckets with a measured cut) or records why the one painted bucket stays, with the median gap by area count before and after
- [ ] #3 The engine and gearbox filters of the search offer the value repaired, or the decision not to is recorded
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
