# Runbooks

Operational how-tos: local setup, deploy, backups, incident steps. Name files by the action: `deploy.md`, `restore-database.md`.

| Runbook | What |
|---|---|
| [accounts.md](accounts.md) | Accounts' settings, making and resetting the superadmin with `pnpm account:superadmin`, sessions and cookies, sign-in throttling and the reverse proxy it needs, the log lines (CS-39) |
| [local-database.md](local-database.md) | Run PostgreSQL locally: start, migrate, connect, measure, reset, upgrade, bootstrap a new server (CS-4) |
| [licensed-font.md](licensed-font.md) | Give a machine the licensed typeface without committing it; what Fontiran's licence allows; what CI and deployment still need (CS-3) |
| [logs-and-errors.md](logs-and-errors.md) | Read and search the logs, find a visitor's «کد پیگیری», change the level, check a deployment, add an OpenTelemetry backend or Sentry (CS-30) |
| [worker.md](worker.md) | Start, stop and inspect the worker and its job queue; resume a stopped source; the lanes' behaviour; upgrade pg-boss (CS-32) |
| [ai-layer.md](ai-layer.md) | Add an AI task and choose its model; the Metis key; prompt caching; check the layer against Metis before an AI SDK upgrade; read the call lines (CS-45) |
| [copy-lint.md](copy-lint.md) | The copy lint and the copy inventory: what counts as a copy file, the rules and length budgets, ignore comments and the allowlist, the baseline and how the rewrite lanes lower it, how to add a rule, the rewrite areas (CS-105) |
| [notifications.md](notifications.md) | The buyers' inbox: add a kind of notification, what marked listings and search file digests write, try one locally with `pnpm notifications:sample`, retention (CS-68) |
| [development.md](development.md) | Working on the repository: the first start in detail, the editor, every check and what it proves, gorilla testing, the reference-site capture tool, working with Claude Code, work tracking and CI (moved from the README, CS-120) |
