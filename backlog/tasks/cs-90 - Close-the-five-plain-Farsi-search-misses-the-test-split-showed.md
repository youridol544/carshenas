---
id: CS-90
title: Close the five plain-Farsi search misses the test split showed
status: To Do
assignee: []
created_date: '2026-10-02 18:24'
labels:
  - ai
milestone: m-3
dependencies: []
references:
  - docs/evidence/query-understanding/2026-10-02/report.md
priority: low
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-62 (plain-Farsi search into filters) scored 93.8 % fully right on its test split of 80 queries, run once. The five misses (Q026, Q057, Q133, Q135, Q163) were left as they are so the measure stayed honest; each is a different shape of wording and together they say where the code pass and the model still guess. The labelled set (163 queries) lives in packages/ai/scripts/query-understanding/ and was written by the agent that wrote the code, so a second labeller would also make the figure more trustworthy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each of the five misses is read, its cause is recorded in the evaluation report (a missing word, a wrong unit, a model slip), and a fix is made where one generalises beyond the query, otherwise the query is kept as a documented limit
- [ ] #2 A fresh evaluation at the new prompt version reports the development and the test split, with the test split read once more only after the fixes are final, and the registry pin is updated
- [ ] #3 A second person (the owner, or a labeller the owner names) labels at least 40 queries blind to the system output, and agreement with the existing labels is reported
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
