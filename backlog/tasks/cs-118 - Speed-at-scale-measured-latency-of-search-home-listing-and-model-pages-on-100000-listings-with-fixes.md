---
id: CS-118
title: >-
  Speed at scale: measured latency of search, home, listing and model pages on
  100,000 listings, with fixes
status: To Do
assignee: []
created_date: '2026-10-04 09:29'
labels:
  - backend
dependencies: []
priority: high
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The challenge lists low-latency answers as one of the ten search problems, and our claim is a search API under 300 ms at the 95th percentile. Today it is measured on a few thousand searchable listings. The live index can grow to tens of thousands; measure at 100,000, fix what misses, and record the numbers. This absorbs CS-89 (facets of a broad filter past 30,000 matching rows).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A repeatable benchmark (a pnpm script) builds a scratch database of about 100,000 searchable listings by multiplying the real distributions of makes, models, years, prices, mileages and ratings, runs the search API (plain, filtered, catalogue, each sort, facets, deep pages with the cursor), the home page data, the listing page data and the model page data, and writes p50, p95 and p99 per case to a report committed in docs/evidence/performance
- [ ] #2 Targets at 100,000 listings: search API p95 under 300 ms, home, listing and model page data p95 under 150 ms; every case that misses is fixed (indexes, query shapes, a cached or sampled facet count past 30,000 matching rows, the cache lifetimes) with EXPLAIN (ANALYZE, BUFFERS) before and after, and the report is rerun
- [ ] #3 The measured numbers are available to the status page as a short quiet line (the latest benchmark’s p95), or the task records why not; docs and the data model are updated and CS-89 is closed by this work
- [ ] #4 Only database tests and the benchmark are run, never a browser suite; the scratch database is local and is not committed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
