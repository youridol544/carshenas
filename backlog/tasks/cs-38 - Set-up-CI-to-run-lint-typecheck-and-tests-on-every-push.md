---
id: CS-38
title: 'Set up CI to run lint, typecheck and tests on every push'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-29 14:38'
labels:
  - infra
  - dx
milestone: m-6
dependencies:
  - CS-36
priority: medium
ordinal: 7000
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-4 (2026-09-27): pnpm check now also runs Squawk on migrations, the guard hook tests and the schema tests in PGlite, so a CI job running pnpm check covers them without Docker; the edited-migration check needs main fetched (fetch-depth 0). pnpm db:check (migration replay, schema and type drift, integration tests) needs PostgreSQL: a pgvector/pgvector:0.8.6-pg18 service container. Running it in CI would be a new criterion, the owner's call.

CS-3 (2026-09-27): the app builds only with the licensed Yekan Bakh file, which is gitignored and may never be committed or uploaded where others can download it (ADR-0015). pnpm e2e builds the app, so the e2e and gorilla jobs of .github/workflows/e2e.yml (and gorilla-nightly.yml) stop at the build until the workflow fetches the file from private storage with a CI secret; docs/runbooks/licensed-font.md, section "Continuous integration and deployment", says how. Playwright traces record the font response, so in a public repository the uploaded traces must leave it out. pnpm check needs no font.

Renumbered on 2026-09-29: this task was CS-22 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-22; the archived CS-22 points here.

2026-09-29, from CS-36: the repository is on GitHub (PedramRZM/carshenas, private), and GitHub Actions is switched off for it (Settings, Actions, or gh api -X PUT repos/PedramRZM/carshenas/actions/permissions -F enabled=false), because e2e.yml and gorilla-nightly.yml build the app and a build without the licensed typeface fails. Switch it on here, once CI provides the typeface and the database; until then nothing runs on push, on pull requests or at night.

To switch Actions on: gh api -X PUT repos/PedramRZM/carshenas/actions/permissions -F enabled=true (or Settings, Actions, General). From then on e2e.yml runs on every push to main and every pull request, and gorilla-nightly.yml runs every night at 02:00 Tehran time again.
<!-- SECTION:NOTES:END -->
