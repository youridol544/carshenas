---
id: CS-23
title: Deploy where reviewers inside Iran can open it
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-26 21:00'
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
- [ ] #2 The web app, PostgreSQL, Elasticsearch and the worker run there, with secrets outside the repository
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
<!-- SECTION:NOTES:END -->
