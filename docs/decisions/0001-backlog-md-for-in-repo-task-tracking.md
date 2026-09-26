# ADR-0001: Track work in-repo with Backlog.md; keep knowledge in docs/

- Status: accepted
- Date: 2026-09-17 (adopted for Carshenas on 2026-09-26)
- Deciders: Pedrum (with Claude Code)
- Related: `docs/research/2026-09-17-ai-first-task-management.md`, `AGENTS.md`

## Context

Carshenas is built AI-first by one developer working with Claude Code. Work items, plans and decisions must live where the agent can read and write them natively, survive context resets, and be reviewable in git diffs. A product that spans crawling, data normalisation, valuation, search and UI means many tasks with dependencies between them, so ad-hoc TODO files will not scale, and an external tracker (Jira, Linear, GitHub Projects) puts the source of truth outside the agent's reach and outside version control.

Two purpose-built, git-native trackers were evaluated hands-on on 2026-09-17: **Beads** (`@beads/bd` 1.3.0, Steve Yegge) and **Backlog.md** (`backlog.md` 1.52.0, MrLesk). Claude Code's own task list (`TaskCreate` tools) was ruled out because it is stored under `~/.claude/tasks`, not in the repository.

## Decision

Use **Backlog.md** as the single work tracker, with the `backlog/` directory committed to git:

- One markdown file per task under `backlog/tasks/` with YAML frontmatter (status, labels, milestone, dependencies, priority) and structured sections (description, acceptance criteria, implementation plan, notes, final summary). Task IDs are `CS-<n>`; subtasks are `CS-<n>.<m>`.
- Statuses: `To Do → In Progress → In Review → Done`. Agents stop at **In Review**; a human moves work to **Done** after verifying it.
- Agents drive it through the CLI (`backlog task ...`), never by editing task files by hand, following the tool's built-in guides (`backlog instructions overview|task-creation|task-execution|task-finalization`).
- The Kanban board is `backlog board` (terminal) or `backlog browser` (local web UI on 127.0.0.1:6420). No board data lives outside the markdown files.

Long-form knowledge stays in `docs/` as plain markdown: product brief and glossary, feature specs, ADRs, research notes, runbooks. `AGENTS.md` is the map that points to both.

## Alternatives considered

- **Beads (`bd`)** — richest agent-oriented model (hash IDs, dependency graph, `bd ready`, epics), but 1.3.0 stores issues in an embedded **Dolt** database (`.beads/embeddeddolt/`, 2.1 MB on init) synced through `refs/dolt/data` rather than as readable files in the code branch; `bd init` writes Codex, Cursor and Claude config plus git hooks and auto-commits to the repo; and much of the surface (swarms, gates, merge-slots, leases, federation) exists for multi-agent "Gas Town" orchestration. Too heavy and too opaque for a solo project whose tasks should be reviewable on GitHub, and its 2026 issue tracker (about 1,200 open issues, users reporting tasks disappearing after the Dolt move) suggests time would go into maintaining the tracker itself.
- **Plain markdown (`TODO.md`, `docs/plans/`, feature-list JSON + progress file)** — zero dependencies and endorsed by several practitioners, but no board, no dependency queries, no consistent metadata, and every agent invents its own format.
- **GitHub Issues/Projects via `gh`** — good UI, but the source of truth leaves the repo and the agent needs network access and API calls for every read.
- **Spec-kit / Kiro-style `specs/<feature>/tasks.md`** — good for a single feature's plan, not a cross-feature board; can still be used inside a spec if useful.

## Consequences

- Positive: tasks, plans and their history are diffable and travel with branches; the agent's workflow (search → create → plan → implement → verify → finalize) is enforced by tool-provided guides instead of long prompts; the board works offline.
- Negative / risks: `backlog` must be installed on every machine (`bun add -g backlog.md`); task files edited on parallel branches can conflict on merge (mitigated by `check_active_branches: true` and small tasks); the project depends on a single-maintainer open-source tool — the data is plain markdown, so migration away is trivial.
- Follow-ups: CS-1 to CS-25 seeded across milestones m-0 to m-6; `.claude/settings.json` pre-approves `backlog` commands; a `SessionStart` hook injects open tasks into each Claude Code session.
