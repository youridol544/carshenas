---
id: CS-36
title: Create the GitHub repository and push main
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:11'
updated_date: '2026-09-29 14:41'
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
- [x] #1 The owner has chosen public or private, and the repository exists under their account
- [x] #2 main is pushed and the remote is recorded in the README
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Lane D: worktree ~/Dev/carshenas-d on cs-36-github-repo with its own Compose project carshenas-d (PostgreSQL 5421, worker health 3131, e2e app 3400); scripts/init.sh green there.
2. Before anything leaves the machine, scan every version of every file reachable from main (not only the tip) for keys, tokens, passwords, env files, the licensed font, captures, snapshots, phone numbers and oversized blobs.
3. Create PedramRZM/carshenas as a private repository: the owner's choice recorded on 2026-09-29 is private until the submission (CS-75), public only after the checks in these notes.
4. Disable GitHub Actions on the repository before the first push: e2e.yml and gorilla-nightly.yml build the app, and a build without the licensed font fails (docs/runbooks/licensed-font.md), so every push and every night would fail and spend the private repository's minutes. CS-38 provides the font and the database in CI and switches Actions on; say so on CS-38.
5. Add the remote origin over SSH, push main with upstream tracking, and check that the remote main is the local commit.
6. Record the remote in the README (the links at the top, cloning in the quick start, the CI section saying Actions are off until CS-38). Accepted ADRs and dated research notes that say the repository has no remote stay as written.
7. Commit the README and this task on cs-36-github-repo, push the branch and open a pull request for the owner to review and merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-28: reviewers can only judge a repository they can open, so recommend public at submission time, not before. Before it goes public, check that no source data is committed beyond the redacted evaluation fixtures (CS-48), that releases (CS-49) and the licensed font (ADR-0015) are absent, and that the README maps the repository for a reviewer in one screen.

2026-09-28, from the field survey: one car entry committed a data snapshot that exposes the coordinates of 14,528 listings. Before going public, confirm that no snapshot, release, coordinate or contact detail is in the history, not only in the last commit.

Placed before the deploy on 2026-09-29: deploying from a remote and running CI (CS-38) both need it. Keep it private until the submission (CS-75), then make it public after the checks above.

Renumbered on 2026-09-29: this task was CS-21 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-21; the archived CS-21 points here.

2026-09-29, lane D (worktree ~/Dev/carshenas-d, branch cs-36-github-repo; Compose project carshenas-d on PostgreSQL 5421, worker health 3131, e2e app 3400): scripts/init.sh passed there, with its own container healthy and the other lanes' containers untouched.

History check before the first push, over every version of every file reachable from main (95 commits, 1,277 blobs), not only the tip: no font file (.woff, .woff2, .ttf, .otf), no .env file other than the templates, no .captures, snapshot or release data, largest blob 249 KB. The secret patterns (private keys, AWS, GitHub, OpenAI and Anthropic, Metis, Slack, Google, JWT, Sentry DSN, Arvan, assigned secrets, URLs with passwords) and Iranian mobile numbers matched only test fixtures and placeholders: a PEM header over a repeated constant in redact.test.ts, tpsg-not-a-real-key, a JWT of {"sub":"123"}, hunter2 and not-a-real-secret, and numbers such as 09121234567 and +989120000000. Every commit is authored as pedramrzm@gmail.com.

Created github.com/PedramRZM/carshenas, private (the owner's choice recorded on 2026-09-28 and 2026-09-29: private until the submission, CS-75). GitHub Actions is switched off for the repository (actions/permissions enabled=false) before the first push: e2e.yml runs on every push to main and every pull request, gorilla-nightly.yml every night, and both build the app, which fails without the licensed typeface (docs/runbooks/licensed-font.md). Added the remote origin over SSH and pushed main with tracking: the remote main is efd7107, the same commit as local main; main is the default branch; the repository has 0 workflow runs.

README: the repository link at the top, the clone command and the licensed typeface a fresh clone needs in the quick start, and the CI section now says Actions is off until CS-38. ADR-0002 and the 2026-09-21 gorilla research note still say the remote is to come; an accepted ADR and a dated note stay as written.

Correction to the note above: the 2026-09-28 note recommended making the repository public at submission time. The choice itself, private until the submission (CS-75), is the 2026-09-29 note here and line 110 of CS-75.

task-reviewer (2026-09-29): AC1 verified; main verified on the remote; pnpm check, docs and the secret scan (1,281 file versions) verified; switching Actions off judged right. Its one blocking point was plan step 7, pushing this branch and opening the pull request. Fixed its smaller points: two README rows that still said CI runs on pushes and pull requests now say Actions is off until CS-38, "has been on GitHub since", and CS-38 now gives the command that switches Actions on.

Pull request: https://github.com/PedramRZM/carshenas/pull/1 (cs-36-github-repo into main). The README record reaches main when it is merged; merge by fast-forward and push (the pull request says how), so GitHub marks it merged and the commits keep their hashes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created github.com/PedramRZM/carshenas as a private repository, as recorded on 2026-09-29 here and in CS-75: private until the submission, public only after the history checks in these notes. Switched GitHub Actions off for it before the first push, because both committed workflows build the app and a build without the licensed typeface fails; CS-38 switches it on. Added the remote origin over SSH and pushed main with tracking. Recorded the remote in the README: the link at the top, the clone command and the typeface a fresh clone needs, and CI marked off until CS-38. Added a learning line.

Verified: git ls-remote shows the remote main equal to local main (efd7107); gh shows the repository PRIVATE with default branch main, Actions enabled=false and 0 workflow runs. Before the push, a scan of every version of every file reachable from main (95 commits, 1,277 file versions) found no keys, env files, font files, captures or real phone numbers, only test fixtures and placeholders. pnpm check passes in lane D (~/Dev/carshenas-d, its own PostgreSQL on 5421). The task-reviewer confirmed the criteria; its one blocking point, this pull request, is https://github.com/PedramRZM/carshenas/pull/1.

For the owner: merge the pull request by fast-forward and push main, so the README record reaches the remote main.
<!-- SECTION:FINAL_SUMMARY:END -->
