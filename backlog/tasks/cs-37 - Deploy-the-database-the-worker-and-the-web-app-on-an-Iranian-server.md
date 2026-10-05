---
id: CS-37
title: 'Deploy the database, the worker and the web app on an Iranian server'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-05 06:48'
labels:
  - infra
milestone: m-6
dependencies:
  - CS-4
  - CS-35
  - CS-36
references:
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Torob's reviewers are in Iran; US hosts may need a VPN from there, and sanctioned services may not work at all. The project link must open for them without effort.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An ADR records the host, for example an Iranian PaaS or VPS, with a fallback
- [ ] #2 The web app, PostgreSQL 18 with pgvector and the worker run there, with secrets outside the repository
- [ ] #3 The deployed site opens from an Iranian network without a VPN, verified and recorded
- [ ] #4 A runbook in docs/runbooks describes deploying and rolling back
- [ ] #5 The deployment is unlisted: every page answers with noindex, robots.txt disallows everything, and the link is shared only through the submission (ADR-0017 point 10)
- [ ] #6 The worker runs there without pause within its daily budgets and restarts after a crash
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-28 (owner, 2026-09-27; ADR-0010): listing photos live in an ArvanCloud Object Storage bucket (regions: Tehran, Simin, s3.ir-thr-at1.arvanstorage.ir; Tabriz, Shahriar, s3.ir-tbz-sh1.arvanstorage.ir). Choose the host with the bucket's region in mind, and keep the bucket credentials in the host's secrets, never in the repository.

CS-4 (2026-09-27): Elasticsearch is gone (ADR-0011): the host needs PostgreSQL 18 with pgvector, no search service. Bootstrap a new server with docs/runbooks/local-database.md ("Bootstrapping a new server"): roles from db/bootstrap/10-roles.sql, passwords from the secret store, the database from create-database.psql, pg_stat_statements in the postgres database, then dbmate as carshenas_migrate. Re-derive db/postgresql.conf for the real memory and cores (the database skill's configuration table) and check that the pgvector image or package and the npm registry are reachable from the host.

Recommendation from CS-4, not a criterion unless the owner adds it: database backups with one restore actually tested.

CS-3 (2026-09-27): the build needs the licensed Yekan Bakh file, which is gitignored (ADR-0015, docs/runbooks/licensed-font.md), so the deploy provides it at build time from private storage. Before the site is reachable by anyone else, the owner registers a web licence for it in their Fontiran account (the personal-site licence, 400,000 tomans on 2026-09-27, or the free non-commercial registration the Fontiran FAQ mentions).

From CS-30 (2026-09-28): browser source maps are moved at build time to apps/web/.next/browser-source-maps, which the server reads to map browser stacks and never serves. A standalone deployment (output: standalone) must copy that folder next to .next/static, or browser error stacks stay unmapped. The browser error intake rate-limits per server process until this task decides which forwarded-for header can be trusted (docs/runbooks/logs-and-errors.md).

2026-09-28 (ADR-0017): the host must be on an Iranian network, since the worker crawls from it, and it runs the worker next to the web app. Keep the worker's queue and budgets running while the submission is under review, because the demo link is judged days or weeks after it is sent.

2026-09-28 (ADR-0017): deploy the database and the worker as soon as CS-33 and CS-35 work, well before the web app is finished. Price histories, days on market and CS-73's check of ratings against what the market did next all need weeks of continuous crawling from an Iranian network, and a laptop is not always on. The web app joins the same host later.

2026-09-28, from the field survey (unverified): khodrobin's decision record says Vercel is unreachable from Iran, and two home entries host there. Verify reachability from an Iranian network for whichever host is chosen, as criterion 3 requires.

Order of work, 2026-09-29: this task is the fifth step, right after the crawler and its freshness work (CS-33, CS-35). Put the server, the database, the worker and the web app as it stands then on one Iranian host, and check early that it opens from Iran without a VPN. Every later task redeploys through the runbook, and CS-75 records on the latest deploy.

Renumbered on 2026-09-29: this task was CS-23 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-23; the archived CS-23 points here.

From CS-32 (2026-09-29): the worker runs as `pnpm worker` (node with --experimental-strip-types on Node 22.14, no flag from 22.18) with WORKER_DATABASE_URL for carshenas_worker, WORKER_HEALTH_PORT (GET /health on 127.0.0.1, `pnpm worker:health` for a supervisor check) and CRAWLER_USER_AGENT. Give it a stop timeout above 30 seconds (it drains jobs for up to 30 s on SIGTERM) and a restart policy (it exits 1 on an uncaught error). On a new server run db/bootstrap/10-roles.sql (it skips existing roles) and set the worker password. A deployment that copies packages into node_modules (pnpm deploy) must compile the TypeScript first. pg-boss upgrades are migrations (docs/runbooks/worker.md).

From CS-39 (2026-09-29): the server needs CARSHENAS_AUTH_KEY (openssl rand -base64 32), kept with the other secrets; one reverse proxy in front of Next.js, which listens on loopback only, with proxy_set_header Host $host, X-Forwarded-For $remote_addr (replace, never append) and X-Forwarded-Proto $scheme, since sign-in throttling counts the last X-Forwarded-For entry and cookies and the Server Action origin check read the host; HSTS on the host. After pnpm db:migrate, run pnpm account:superadmin <owner> once (docs/runbooks/accounts.md).

2026-09-30 (ADR-0025): no ArvanCloud bucket is needed for listing photos; pages load them from the sources' own addresses.

CS-119 (2026-10-04) prepared this task; the deploy itself is the owner's, on a server of their choice. Delivered: ADR-0051 (proposed: three Iranian options with sourced prices, a recommendation and a fallback, for the owner to choose; research note 2026-10-04-iranian-hosting-for-the-demo.md); the deployment kit (deploy/, scripts/deploy.sh: images built on the owner's computer and shipped with docker save over ssh, nothing pulled on the server; compose with PostgreSQL 18 pgvector image as in dev, web, worker with restart policy and healthchecks, Caddy HTTPS in four certificate modes, nightly backup, log rotation); docs/runbooks/deploy.md (deploy, update, roll back, restore, rotate secrets, health, first-day checklist, crawler blocked); the unlisted site in the app (noindex header on every response and robots.txt behind CARSHENAS_UNLISTED, security headers, HSTS over https, /api/probe) with unit tests. By criterion: #1 draft ADR waits for the owner; #2 the kit runs the three there (verified in a scratch compose project, see CS-119), the server is the owner's; #3 procedure written (check-host.net nodes ir1 to ir8, phone on mobile data, nslookup not 10.10.34.x), result needs the real server; #4 done (deploy.md); #5 done and tested (src/lib/exposure.ts, src/proxy.ts, src/app/robots.ts); #6 compose restart: unless-stopped and healthchecks, the pause is the owner enabling Divar on the server. Remaining: the owner's server, domain, secrets, the typeface web licence, a first deploy, the reachability check from an Iranian network. pgvector: no migration creates the vector extension (only fuzzystrmatch), so the image carries it unused; images.env says how to use a plain postgres:18.

2026-10-05: deployed to ArvanCloud. Server: abrak c6-medium2 class (4 vCPU, 8 GB, 70 GB), Ubuntu 26.04, 85.198.52.87, user deploy (uid 1000, docker group), root for setup only. Domain carshenas.app on ArvanCloud DNS with the CDN in front: the CDN makes the certificate and forwards plain http to port 80 (new kit mode CARSHENAS_TLS_MODE=cdn, CARSHENAS_TRUSTED_PROXIES = ArvanCloud's ranges, visitor address from X-Forwarded-For checked: client_ip differs from the edge's remote_ip). Built on the server (DEPLOY_BUILD=server, NODE_IMAGE from docker.arvancloud.ir, NPM_REGISTRY package-mirror.liara.ir) because the owner's upload ran at 30 KB/s. Data: release 20261005T053424Z-launch restored live (25,939 active listings, valuation 2026-10-05); every restored account locked (unusable password hash, role buyer, sessions deleted) and the superadmin pedrum made fresh. Divar enabled; fetches answer 200 from the server; /api/probe ok. Web ports filtered in DOCKER-USER to ArvanCloud's edges (deploy/host/carshenas-edge-firewall), direct access to the address times out. Open: the CDN's HTTPS certificate (owner, in ArvanCloud's panel), criterion 3 (open from an Iranian phone and home line), the typeface's web licence, ADR-0051 still names ParsPack.
<!-- SECTION:NOTES:END -->
