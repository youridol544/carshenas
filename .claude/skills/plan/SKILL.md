---
name: plan
description: Turn a feature request, epic, or problem into a reviewed spec and a set of Backlog tasks with acceptance criteria and dependencies. Use when asked to plan, scope, break down, spec, or estimate work, and before starting any change that will take more than one focused pull request. Does not implement anything.
argument-hint: "<feature, epic, or problem statement>"
---

# /plan — from request to tracked work

You are planning, not building. The output of this skill is (a) an optional spec in `docs/specs/` and (b) Backlog tasks a future agent can execute without this conversation.

Request: $ARGUMENTS

## 1. Load context (cheaply)

1. Read `AGENTS.md` if not already in context, then the docs it points to that matter here: `docs/product/vision.md`, `docs/product/glossary.md`, relevant `docs/specs/*`, `docs/decisions/*`, `docs/research/*`, and `docs/learnings.md` (lessons from earlier tasks).
2. Check what already exists: `backlog search "<keywords>" --plain` and `backlog task list --exclude-status Done --plain`. Never create a duplicate; extend the existing task instead.
3. Explore the codebase for the areas involved. For anything larger than a handful of files, delegate the sweep to an `Explore` subagent and ask it for the 5–10 files that matter, then read those yourself.

## 2. Resolve ambiguity before designing

List the decisions the request leaves open (scope boundaries, rules such as thresholds or statuses, money/date handling, permissions, error cases). Ask the user all material questions in one batch. Make routine calls yourself and state them as assumptions.

## 3. Decide the shape

- Fits one focused PR → one task. Skip the spec.
- Larger → write `docs/specs/SNN-kebab-slug.md` using the template in `docs/specs/README.md`: users and goal, flows, rules, **what we are NOT doing**, success criteria split into automated and manual, open questions. If an open question blocks the design, stop and ask; do not guess. Present the spec and wait for approval when it contains product or architecture decisions. If a binding technical decision falls out of it, propose an ADR with `/adr`.

## 4. Create the tasks

Read `backlog instructions task-creation` first, then create through the CLI only:

```bash
backlog task create "Parent: <capability>" -d "<why, context a future agent cannot recover from code>" -l <labels> -m "<milestone>" --doc docs/specs/SNN-slug.md
backlog task create -p CS-<parent> "<atomic step>" -d "<why>" --ac "<observable outcome>" --ac "<another>" -l <labels>
backlog task create "<independent piece>" --dep CS-<n> ...
```

Rules that matter here:
- Repeat `--ac` per criterion (a comma inside one `--ac` is not a separator). Criteria describe observable behaviour, not steps.
- Each task is one PR of work, in dependency order, referencing only tasks that already exist.
- Do not add an implementation plan at creation time; the worker writes it after research (`/work`).
- Labels come from `backlog/config.yml`; milestones from `backlog milestone list`.
- Quote arguments with single quotes when they contain backticks.

## 5. Hand off

Report the created IDs, titles and key criteria as a short list. Do not start implementing. Suggest `/work CS-<id>` for the first ready task.
