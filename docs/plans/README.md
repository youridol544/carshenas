# Plans

Claude Code's plan mode writes its plan files here (`plansDirectory` in `.claude/settings.json`) instead of `~/.claude/plans/`, which is swept after 30 days. A plan survives context compaction and is the artefact a human reviews before code is written.

Rules:

- Keep a plan only if it was approved and executed; delete abandoned ones before committing.
- Rename kept plans to `YYYY-MM-DD-<slug>.md` and link them from the task: `backlog task edit CS-N --ref docs/plans/<file>`.
- The task's own **Implementation Plan** section stays the plan of record for a single task; a file here is for work that spans several tasks or needed a written review.
