---
id: CS-4
title: Accept the data stack and run PostgreSQL and Elasticsearch locally
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
labels:
  - database
  - search
  - infra
milestone: m-1
dependencies: []
references:
  - docs/decisions/0007-data-search-and-ingestion-stack.md
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0007 proposes PostgreSQL as the record, Elasticsearch as the index, a separate ingestion worker with a job queue, and evaluated LLM steps. Nothing from it may be installed until the owner accepts or amends it, and every later milestone depends on it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ADR-0007 is accepted, amended or superseded by the owner, with the job queue and the migration tool chosen and the reasons recorded
- [ ] #2 One command starts PostgreSQL (with pgvector) and Elasticsearch locally, and a runbook in docs/runbooks describes it
- [ ] #3 A first migration creates the sources and snapshots tables, and a health check proves the web app and the worker can reach both services
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
