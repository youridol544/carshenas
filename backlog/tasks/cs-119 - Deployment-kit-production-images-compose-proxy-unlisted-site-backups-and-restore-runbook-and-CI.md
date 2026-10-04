---
id: CS-119
title: >-
  Deployment kit: production images, compose, proxy, unlisted site, backups and
  restore, runbook and CI
status: To Do
assignee: []
created_date: '2026-10-04 09:29'
labels:
  - infra
  - docs
dependencies: []
priority: high
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-37 needs a server the owner chooses. Everything else can be ready, so that the deploy is an afternoon: images, a production compose file, HTTPS proxy, secrets outside the repository, an unlisted site (noindex, robots disallow), a worker that restarts, backups and a restore that works, a runbook, and the CI that CS-38 asks for. This also delivers CS-49 in its useful minimum: a named, dated release of the data that can be cut and restored.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Production images for the web app and the worker (multi-stage, non-root, no secrets baked in) and a production compose file with PostgreSQL 18 with pgvector, the web app, the worker and a reverse proxy with HTTPS, environment templates that list every variable and what it is, and a deploy script over SSH for any Linux VPS with Docker that runs migrations safely and can roll back to the previous images; the images are built once to prove they build
- [ ] #2 The deployment is unlisted: every page answers with noindex, robots.txt disallows everything, the admin section is not linked from public pages, security headers and cookie flags are set for HTTPS, and secrets live only in the server’s environment; a test covers the response headers (CS-37 criterion 5, ADR-0017 point 10)
- [ ] #3 The worker restarts after a crash and on boot and runs without a pause within its daily budgets; compose healthchecks and one external probe URL tell whether the site, the worker and the data are healthy; logs rotate
- [ ] #4 One command cuts a named, dated release of the data (a dump with a manifest of counts per source and model and the versions of the parser, prompts and valuation) and one restores it into an empty database where the web app runs without crawling; a nightly backup with retention uses the same command; the restore is tested once on a scratch database; releases are stored outside the repository (CS-49)
- [ ] #5 A runbook docs/runbooks/deploy.md says how to deploy, update, roll back, restore, rotate secrets and check health, with a first-day checklist (first sweep, first valuation run, search table), and a draft ADR compares three Iranian hosting options (a VPS and two PaaS) with cost, how to verify the site opens from an Iranian network without a VPN, and a fallback, for the owner to choose
- [ ] #6 A GitHub Actions workflow runs lint, typecheck and unit tests on every push and pull request (CS-38) with caches, the existing e2e workflow is checked for correctness, and the workflow files are validated with actionlint or an equivalent; nothing is run locally beyond that
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
