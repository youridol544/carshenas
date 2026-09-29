---
id: CS-36
title: Create the GitHub repository and push main
status: To Do
assignee: []
created_date: '2026-09-28 22:11'
labels:
  - infra
milestone: m-6
dependencies: []
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The submission form asks for a GitHub or project link. On 2026-09-26 the owner chose to keep the repository local for now; this task creates the remote when the owner is ready and records whether it is public or private.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The owner has chosen public or private, and the repository exists under their account
- [ ] #2 main is pushed and the remote is recorded in the README
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-28: reviewers can only judge a repository they can open, so recommend public at submission time, not before. Before it goes public, check that no source data is committed beyond the redacted evaluation fixtures (CS-48), that releases (CS-49) and the licensed font (ADR-0015) are absent, and that the README maps the repository for a reviewer in one screen.

2026-09-28, from the field survey: one car entry committed a data snapshot that exposes the coordinates of 14,528 listings. Before going public, confirm that no snapshot, release, coordinate or contact detail is in the history, not only in the last commit.

Placed before the deploy on 2026-09-29: deploying from a remote and running CI (CS-38) both need it. Keep it private until the submission (CS-75), then make it public after the checks above.

Renumbered on 2026-09-29: this task was CS-21 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-21; the archived CS-21 points here.
<!-- SECTION:NOTES:END -->
