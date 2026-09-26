---
id: CS-22
title: 'Set up CI to run lint, typecheck and tests on every push'
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
labels:
  - infra
  - dx
milestone: m-6
dependencies:
  - CS-21
priority: medium
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents verify locally, but a second, independent check on every push catches what a session forgot to run. The e2e and nightly gorilla workflows exist but have never run on GitHub.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A GitHub Actions workflow runs pnpm check on pushes and pull requests
- [ ] #2 A failing test turns the workflow red
- [ ] #3 The existing e2e workflow (.github/workflows/e2e.yml) completes green on a pull request, with the report artifact attached
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
