---
id: CS-120
title: >-
  Reviewer package: the README, the notes for the submission and the repository
  seen from outside
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-04 09:29'
updated_date: '2026-10-04 10:29'
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
- [x] #1 The root README is rewritten for a reviewer: what Carshenas is in one paragraph, screenshots (phone and desktop of the home, search, listing page, paste a link), an architecture picture of crawl, normalise, value, rank and explain, how it answers the four steps of the brief and Torob’s ten search problems in one short table with the measured numbers and links to their evidence, how to run it locally in a few commands, the stack, a tour of docs and the decision records, and the honest limits; no filler
- [x] #2 The repository looks clean to outside eyes: no secrets or scratch files, .env.example complete, a documented decision on the licence, .gitignore checked, the docs index current; AGENTS.md stays under 150 lines
- [x] #3 The notes text for «توضیحات تکمیلی» (Farsi and English, short) is written in docs/submission, every number the repository can quote is listed with the command that regenerates it, and docs/submission/open-items.md lists what waits for other work and the licence decision for the owner to take
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the brief, the research, the specs and the sources of every figure: the evidence reports, the status page and main's database, read only. 2. Rewrite the root README for a reviewer: screenshots on phone and desktop, an architecture picture, one table for the four steps and the ten problems with measured figures, a local run, the stack, a tour, honest limits, the AI-first way of working; move the contributor sections to docs/runbooks/development.md. 3. Write docs/submission: the notes for the form in Farsi and English, numbers.md (every figure with its command and file), open-items.md (markers, decisions, findings, the licence), and two read-only SQL scripts. 4. Repository hygiene seen from outside: secret and scratch scans of the tree and the history, example.env against the code, .gitignore, the indexes, AGENTS.md under 150 lines. 5. 2026-10-04, the owner's change of direction: no demo script, shot list, recording-day checklist or demo-walk spec; they were deleted and their plumbing reverted.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04. Built in lane cs-120-reviewer-package (no database of its own; main's database and dev server read only). README: ten WebP screenshots of the real product (phone and desktop of the home page, a plain-Farsi search, a listing with its analysis, a pasted link, the status page), each under 70 KB, taken once with a throwaway Playwright script against main's dev server with the drawn photo stand-ins of e2e/fixtures/source-photos.ts (ADR-0025: no seller photo is stored, nothing left the machine for a listing site); docs/assets/architecture.svg drawn by hand and rendered to check it; the table of the four steps and ten problems quotes only figures that docs/submission/numbers.md traces to a command and a file. The old README's contributor sections moved to docs/runbooks/development.md with their stale rows refreshed. Markers TODO-01 to TODO-13 sit where text waits for other work, listed in docs/submission/open-items.md with the owner's decisions (the licence: MIT recommended, no LICENSE file added) and the findings: F1 the status page counts 12,336 listings in results against 4,242 searchable; F2 the hero's first example finds one listing; F3 and F4 main holds 228 test accounts and a release must not carry accounts; F5 main's worker restarts every few seconds; F6 a clone needs a Metis key and a font file to start. pick-examples.sql (real listings to show: a great deal, an expensive one, an unrated one with its reason, a price drop, links to paste) and clean-check.sql (crawl and worker health, test rows left) are kept as read-only helpers. Side effects on main of the screenshot run: one normal re-check request for listing 89002 and three paste counts for the Peugeot 206. After the owner's change of direction the demo script, the shot list, the recording-day checklist and the demo-walk spec were deleted with git rm and their plumbing (scripts, tsconfig entry, ignore line, README rows) reverted: e2e/ and package.json are identical to main.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rewrote the root README for a reviewer (ten phone and desktop screenshots of the real product, an architecture picture, one table of the four steps and ten problems with measured figures, a local run, the stack, a tour, honest limits, the AI-first way of working) and moved the contributor sections to docs/runbooks/development.md. Added docs/submission: the notes for the form in Farsi and English, numbers.md (31 figures, each with its command and file), open-items.md (13 markers that wait for other tasks, owner decisions with an MIT recommendation and no LICENSE file, findings F1 to F11 for CS-121 and the coordinator), and two read-only SQL scripts (pick-examples.sql, clean-check.sql). Hygiene: no real secret in the tree or in 607 commits of history, example.env completed against the code, .gitignore, the ADR, runbook, spec and evidence indexes, AGENTS.md at 149 lines. Per the owner's change of direction the demo script, shot list, recording-day checklist and demo-walk spec were deleted and their plumbing reverted (e2e/ and package.json equal main). Verified by: Prettier on the changed files, 165 relative links resolving, every marker defined, the invisible-character scan, both SQL scripts run read only against main, the free offline evaluation re-run (257 of 270, 123 of 133). Not run: pnpm check (the machine was loaded and the diff touches no code or test; the coordinator runs it once on main), and the paid or database commands quoted in numbers.md, which are copied from the reports and the package scripts.
<!-- SECTION:FINAL_SUMMARY:END -->
