---
id: CS-119
title: >-
  Deployment kit: production images, compose, proxy, unlisted site, backups and
  restore, runbook and CI
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-04 09:29'
updated_date: '2026-10-04 10:38'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. App, behind CARSHENAS_UNLISTED (default on in production): response headers for every page (X-Robots-Tag noindex, security headers, HSTS only over https) applied by proxy.ts through a pure module with unit tests; /robots.txt that disallows everything while unlisted; GET /api/probe reporting site, worker and data freshness from the existing status data; output standalone only when CARSHENAS_STANDALONE=1 (Docker build), so pnpm e2e is unchanged.
2. Images: .dockerignore, deploy/docker/web.Dockerfile (standalone, non-root, licensed font from the build context, browser source maps copied next to .next/static) and worker.Dockerfile (workspace TypeScript run by node, dbmate and the migrations inside, pnpm for the CLIs), no secrets baked in; built once at the end.
3. deploy/: production compose (PostgreSQL 18 image pinned as in dev, web, worker, Caddy, backup loop, tools), Caddyfile modes (domain with automatic HTTPS, manual certificate, IP-only internal CA), example.production.env with every variable, server CLI (deploy, rollback, migrate, release cut and restore, backup, logs, status), ops script run in the postgres image (pg_dump custom format, manifest, retention, restore).
4. scripts/deploy.sh (owner machine: build, docker save | ssh docker load, no pulls on the server, first setup, update with pre-deploy release and migration, health gate with automatic rollback) and scripts/release.sh for the local database.
5. CI: .github/workflows/ci.yml runs pnpm check on push and pull request with pnpm and Next caches; e2e.yml and gorilla-nightly.yml reviewed and fixed (typeface, database, gating); all validated with actionlint.
6. docs/runbooks/deploy.md, draft ADR 0051 (three Iranian hosting options, sourced), indices, learnings, notes on CS-37, CS-38 and CS-49.
7. Verify cheaply: unit tests of the changed files, tsc once, prettier, shellcheck and actionlint, docker compose config, caddy validate, ONE restore test on a scratch database in the scratch project carshenas-nodb119 (tmpfs, no volumes), ONE image build at the end; pnpm check once if the machine allows.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Slice 1 (app, behind CARSHENAS_UNLISTED): src/lib/exposure.ts (pure: switch, headers, robots rules), src/server/response-exposure.ts applied by src/proxy.ts to every response (matcher widened from the guarded places to every path but _next/static, _next/image and the favicon; the old guard logic runs only for the old paths, isGuardedPath), src/app/robots.ts read per request, GET /api/probe (site, worker, data and market values from the data-status figures; 200 only when healthy; the worker is judged from the hourly freshness measurement and the newest crawl read, since carshenas_web cannot read worker_heartbeat and a migration was not worth it), output standalone only when CARSHENAS_STANDALONE=1, poweredByHeader off. 43 unit tests pass; tsc and eslint on the touched files are clean.
<!-- SECTION:NOTES:END -->
