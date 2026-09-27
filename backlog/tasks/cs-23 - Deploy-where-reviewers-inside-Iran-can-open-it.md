---
id: CS-23
title: Deploy where reviewers inside Iran can open it
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 16:00'
labels:
  - infra
milestone: m-6
dependencies:
  - CS-4
priority: high
ordinal: 23000
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
<!-- SECTION:NOTES:END -->
