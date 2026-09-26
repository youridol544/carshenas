---
id: CS-6
title: Crawl Bama listing pages into raw snapshots
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-26 21:00'
labels:
  - crawler
  - backend
milestone: m-2
dependencies:
  - CS-4
  - CS-5
references:
  - docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md
  - docs/decisions/0008-crawl-only-what-sources-allow.md
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bama allows crawling of its car pages and embeds listing data in them, so it is the first source. Everything later (extraction, duplicates, valuation) is derived from raw snapshots, so snapshots must be complete, dated and immutable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A crawl of Tehran listings for the ten most-listed models stores one immutable snapshot per listing with URL, fetch time, content hash and raw data
- [ ] #2 The crawler enforces ADR-0008 in code: one request at a time per host with a configurable delay, a descriptive User-Agent, and a stop on any 403, 429 or challenge page, proven by tests against a local stub
- [ ] #3 Re-running the crawl stores a new snapshot only when the content changed and records price changes
- [ ] #4 Each crawl run reports counts, errors and duration
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-28 (owner, 2026-09-27; ADR-0010): where a source's robots.txt and recorded terms allow it, the crawler also downloads the listing's photos, within the same politeness limits (one request at a time per host, the configured delay, a stop on 403, 429 or a challenge), and hands them to the ArvanCloud store that CS-29 builds. Record the photo URLs in the snapshot either way.
<!-- SECTION:NOTES:END -->
