---
id: CS-120
title: >-
  Reviewer package: the README, the notes for the submission and the repository
  seen from outside
status: To Do
assignee: []
created_date: '2026-10-04 09:29'
updated_date: '2026-10-04 10:24'
labels:
  - docs
dependencies: []
priority: high
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
What reviewers open first: the repository (README), and the notes field. The owner did not ask for a demo script (2026-10-04): the video is designed from the research of CS-122 and the material of CS-123.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The root README is rewritten for a reviewer: what Carshenas is in one paragraph, screenshots (phone and desktop of the home, search, listing page, paste a link), an architecture picture of crawl, normalise, value, rank and explain, how it answers the four steps of the brief and Torob’s ten search problems in one short table with the measured numbers and links to their evidence, how to run it locally in a few commands, the stack, a tour of docs and the decision records, and the honest limits; no filler
- [ ] #2 The repository looks clean to outside eyes: no secrets or scratch files, .env.example complete, a documented decision on the licence, .gitignore checked, the docs index current; AGENTS.md stays under 150 lines
- [ ] #3 The notes text for «توضیحات تکمیلی» (Farsi and English, short) is written in docs/submission, every number the repository can quote is listed with the command that regenerates it, and docs/submission/open-items.md lists what waits for other work and the licence decision for the owner to take
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
