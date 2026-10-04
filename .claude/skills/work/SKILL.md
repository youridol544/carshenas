---
name: work
description: Pick up a Backlog task by ID and drive it to "In Review" — branch, research, record the plan on the task, implement in small verified slices, check acceptance criteria with evidence, finalize. Use when asked to work on, implement, do, fix, or finish CS-<n>. Agents never move a task to Done.
argument-hint: "CS-<n>"
---

# /work — execute one Backlog task end to end

Task: $ARGUMENTS

Current task record (may be empty if the ID is wrong):

!`backlog task view $ARGUMENTS --plain 2>&1 || true`

## 1. Start

1. If the task is not shown above, run `backlog task list --plain` and ask which one is meant.
2. Read `backlog instructions task-execution` (once per session), the task's `--doc`/`--ref` links, and any ADR it names. Check its dependencies are Done; if not, stop and say so.
3. Claim it and branch:
   ```bash
   backlog task edit CS-N -s "In Progress" -a @claude
   git switch -c cs-N-<short-slug>          # from main; or use a worktree for parallel work
   ```

## 2. Plan on the task, not in your head

Research the current code, tests and conventions first (use an `Explore` subagent for broad sweeps). Open the files you will change with the Read tool, not `cat`: that is what attaches the path-scoped rules in `.claude/rules/`. For files that do not exist yet, read the rule packs whose `paths` match them. Then record the plan: `backlog task edit CS-N --plan $'1. ...\n2. ...'`. If the plan contains a product, architecture or data-model decision, present it and wait for approval; otherwise proceed.

## 3. Implement in slices

For each slice: change → run the relevant check → `backlog task edit CS-N --append-notes "<what and why>"` → commit. Commit messages start with the task ID: `CS-N: <imperative summary>`. Commit the task file together with the code it describes. Follow the conventions in `AGENTS.md`. If you discover work outside the acceptance criteria, stop and ask whether to extend this task or create a follow-up; never widen scope silently.

## 4. Verify and finalize

Read `backlog instructions task-finalization`, then:
1. Produce objective evidence per acceptance criterion (test output, command output). Code presence is not evidence. For anything a user sees, follow the `verify-ui` skill: a Playwright test in `e2e/` for behaviour, plus screenshots at phone and desktop width that you actually open and describe. For Farsi text, load `copy-fa` and ask the `copy-reviewer` agent as well (`docs/design/product-voice.md`).
2. Ask the `task-reviewer` subagent to check the diff against the criteria and report gaps. Fix real gaps.
3. `backlog task edit CS-N --check-ac <i>` only for criteria with evidence; `--check-dod <i>` likewise.
4. `backlog task edit CS-N --final-summary "Changed X; verified with Y."`
5. `backlog task edit CS-N -s "In Review"` — **never "Done"**; a human verifies and closes.
6. If the task taught something non-obvious that is not visible in code, append one dated line to `docs/learnings.md` (task ID included). Promote to `AGENTS.md` Gotchas only if every future task must respect it.
7. Commit, then report: what changed, how it was verified, what the reviewer flagged, and what is left for the human to check. Suggest `/clear` before the next task.
