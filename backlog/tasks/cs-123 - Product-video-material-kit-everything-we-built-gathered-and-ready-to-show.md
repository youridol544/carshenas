---
id: CS-123
title: 'Product video material kit: everything we built, gathered and ready to show'
status: To Do
assignee: []
created_date: '2026-10-04 10:24'
labels:
  - docs
dependencies: []
priority: high
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner request 2026-10-04: the video must show everything: the product, the technical side, the evaluations, tests and end-to-end coverage, how the code is production grade, and the Claude Code configuration, very short, with the same material available in more depth after the demo. Gather it: facts, numbers, code excerpts, screens and configuration, each with its source and a command that regenerates it, so a video can be built from data rather than from memory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A material inventory, docs/submission/material/README.md, organised by what a viewer should feel: the product (the screens and flows with the exact routes, queries and listing ids to show, picked from real data), the data pipeline (crawl, normalise, value, rank, explain with real numbers), AI and evaluations (what is measured, the accuracy numbers with dates and set sizes, the cost, why AI is used where it is), tests and end-to-end coverage (counts of unit, database and browser tests, the page and viewport matrix, accessibility and layout-stress checks, the evaluation gates), production-grade code (concrete excerpts with file and line: database constraints and named errors, typed schemas, lint rules that enforce the structure, observability, the decision records, migrations), the Claude Code configuration (skills, rules, subagents, hooks, plugins, the lane workflow with reviewers and the task board, the memory), and the process (tasks, parallel lanes, reviews, commits)
- [ ] #2 One command (pnpm material:stats) prints and writes a JSON file of every number the video could quote (tasks done, decision records, migrations and named constraints, tests by kind, end-to-end specs and the project matrix, lint rules, skills, agents, rules, hooks, lines of code by package, commits and the time span, evaluation accuracies from the stored reports, listings and models in the index, valuation error), computed from the repository and the stored reports without running any suite, so the numbers can drive counters in an animation
- [ ] #3 Excerpts are chosen for show, not for completeness: at least 12 short code or config snippets (each 6 to 14 lines, a file path and a line range, with a one-line reason they impress a senior engineer), the Claude Code configuration is shown as a map (a diagram source and the file list), and a set of clean screenshots of the real product on phone and desktop (the home, search results with a plain-Farsi query, a listing page with its price analysis, the paste-a-link answer, the status page) is captured once with one small Playwright script run a single time and stored small under docs/assets with a manifest
- [ ] #4 A short deep-dive outline for each area (product, data, AI and evaluations, tests, production code, Claude configuration) says what could be shown in two minutes after the demo, with the files and commands to open; no personal data appears in any asset; no demo script is written (the owner did not ask for one)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
