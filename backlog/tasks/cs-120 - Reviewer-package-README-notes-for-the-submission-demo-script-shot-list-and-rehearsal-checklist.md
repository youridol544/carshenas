---
id: CS-120
title: >-
  Reviewer package: README, notes for the submission, demo script, shot list and
  rehearsal checklist
status: To Do
assignee: []
created_date: '2026-10-04 09:29'
labels:
  - docs
dependencies: []
priority: high
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
What the reviewers open: the repository (README first), the video and the notes field. Prepare everything except the recording itself, so the owner records once. The script covers the Divar-only scope (no second source, no cross-site duplicates) and quotes only numbers that a command regenerates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The root README is rewritten for a reviewer: what Carshenas is in one paragraph, screenshots (phone and desktop of the home, search, listing page, paste a link), an architecture picture of crawl, normalise, value, rank and explain, how it answers the four steps of the brief and Torob’s ten search problems in one short table with the measured numbers and links to their evidence, how to run it locally in a few commands, the stack, a tour of docs and the decision records, and the honest limits; no filler
- [ ] #2 A docs/submission folder holds the notes text for «توضیحات تکمیلی» (Farsi and English), a timed five-minute demo script of what is on screen and what is said, a shot list with the exact queries, links and listing ids to use, which decisions to mention and in what order (the data decision first), a pre-recording checklist (data state, accounts, browser profile and window size, network, noindex) and a recovery plan for the recording day
- [ ] #3 Every number the script quotes is listed with the command that regenerates it and the file it comes from, so the video matches the repository on the day; CS-75’s script criterion is reworded to the Divar-only scope (no second source, no cross-site duplicates) through the backlog CLI
- [ ] #4 One Playwright file walks the demo path with the exact queries and writes screenshots, so the final rehearsal is one command; it is written but not run until the owner asks
- [ ] #5 The repository looks clean to outside eyes: no secrets or scratch files, .env.example complete, a documented decision on the licence, .gitignore checked, the docs index current; AGENTS.md stays under 150 lines
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
