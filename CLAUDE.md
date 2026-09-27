# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- The `SessionStart` hook (`.claude/hooks/session-start.sh`) puts the board in context on startup, resume and after compaction. Run `backlog instructions overview` once per session before creating or changing tasks.
- Skills: `/plan`, `/work`, `/adr`, `/research`, `/verify-ui`, `/capture-site`, plus `ui-design` (Farsi RTL interface rules and the sourced craft checklist, `references/craft.md`) and `react-patterns` (React 19 and Next.js 16 before/after examples, and verified UI craft patterns in `references/ui-craft.md`) and `database` (PostgreSQL modeling, migrations, Kysely queries, indexing and measurement, with the sourced checklist in `references/craft.md`), which load on demand; `.claude/skills/README.md` lists every skill with its origin, licence and pin. `playwright-cli` and `playwright-trace` are generated from the installed Playwright by `pnpm skills:sync`; do not hand-edit them. Subagents: `task-reviewer` (read-only verification), `design-reviewer` (read-only, fresh-context UI review), `database-reviewer` (read-only review of migrations and queries with their plans) and `project-manager-backlog` (task grooming).
- The `PreToolUse` hook `.claude/hooks/guard-database.mjs` refuses commands that destroy database data or its volume (tested by `pnpm hooks:test`); do not work around it: ask the person to run such a command themselves.
- Plugins enabled in `.claude/settings.json`: `claude-md-management` (run `/revise-claude-md` when a session revealed missing context) and `ralph-loop` (unattended iteration).
- Library and service documentation: use the Context7 MCP before relying on memory.
- Auto-memory (`~/.claude/projects/.../memory/`) is for personal, machine-local learnings. Anything the whole project must know goes in `AGENTS.md` or `docs/`, not memory.
