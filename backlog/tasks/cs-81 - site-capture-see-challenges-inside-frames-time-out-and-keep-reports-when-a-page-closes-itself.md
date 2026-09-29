---
id: CS-81
title: >-
  site-capture: see challenges inside frames, time out, and keep reports when a
  page closes itself
status: To Do
assignee: []
created_date: '2026-09-29 16:10'
labels:
  - tooling
dependencies: []
priority: low
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three gaps found while capturing sign-in pages for CS-39 (docs/research/2026-09-29-sign-in-and-sign-up-teardown.md, "The capture tool"; docs/research/2026-09-29-iranian-sign-in-teardown.md): a Cloudflare challenge inside a cross-origin frame on Cal.com went unseen while a flow kept typing; a run on Namava hung after its last screenshot with no overall timeout and lost its reports; a page that closed itself (Proton, Stripe) ended the run with a generic error and lost the viewport already captured. The failed-requests table also printed raw URLs with path tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A challenge inside a cross-origin frame stops the capture and the flow, as one on the page itself does
- [ ] #2 A run stops after an overall time limit with the reports it has, and says so
- [ ] #3 A page that closes itself ends the run as a stop and keeps what was captured before it
- [ ] #4 The failed-requests table shows path patterns, never raw path tokens
- [ ] #5 pnpm capture:test covers each case against the local fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
