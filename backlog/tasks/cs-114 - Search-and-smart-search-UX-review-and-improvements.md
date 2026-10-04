---
id: CS-114
title: Search and smart search UX review and improvements
status: To Do
assignee: []
created_date: '2026-10-04 07:05'
labels:
  - frontend
dependencies:
  - CS-111
priority: high
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: review the UI and UX of the search page and the smart search and make sure the buyer has a great experience; the two-click flow bothered the owner, and other friction probably exists. Do an expert review with measurements, compare with CarGurus, Autolist, Divar, Bama, Torob and Jabama, fix the most valuable findings and file the rest.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A written review of the search page and the smart box, with measured numbers for five typical intents (a model and a budget, a vague need in words, a country or origin, low mileage, a pasted link): the number of taps and typed characters to a first result and to a result worth opening, time to first result on a throttled phone, with the comparison to the reference products from the teardown note
- [ ] #2 The ten most valuable findings are fixed or filed with a reason, and the fixes include at least: suggestions while typing for models and catalogues (code only, from the catalogue, an accessible combobox that never blocks Enter), recent searches on this device, a clear result header that says what is shown and how many, zero-result recovery that relaxes filters with explanation, and filter ergonomics on the phone sheet
- [ ] #3 A fresh-context design-reviewer pass leaves no blocking finding; Playwright tests assert the tap counts of the five intents on phone and desktop; the product voice guide is followed; docs and the search spec are updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
