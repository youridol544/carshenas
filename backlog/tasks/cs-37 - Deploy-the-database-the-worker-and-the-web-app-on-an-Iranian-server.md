---
id: CS-37
title: 'Deploy the database, the worker and the web app on an Iranian server'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
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
<!-- SECTION:NOTES:END -->
