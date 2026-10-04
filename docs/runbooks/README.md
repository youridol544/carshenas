# Runbooks

Operational how-tos: local setup, deploy, backups, incident steps. Name files by the action: `deploy.md`, `restore-database.md`.

| Runbook | What |
|---|---|
| [deploy.md](deploy.md) | Deploy to a server you rent with one command (images shipped over ssh, nothing pulled there), HTTPS and the unlisted site, update and roll back, the probe URL and the logs, the first day, if the crawler is blocked, backups and releases cut and restored, secrets, CI (CS-119; prepares CS-37, delivers CS-38 and CS-49's minimum) |
| [accounts.md](accounts.md) | Accounts' settings, making and resetting the superadmin with `pnpm account:superadmin`, sessions and cookies, sign-in throttling and the reverse proxy it needs, the log lines (CS-39) |
| [local-database.md](local-database.md) | Run PostgreSQL locally: start, migrate, connect, measure, reset, upgrade, bootstrap a new server (CS-4) |
| [licensed-font.md](licensed-font.md) | Give a machine the licensed typeface without committing it; what Fontiran's licence allows; what CI and deployment still need (CS-3) |
| [logs-and-errors.md](logs-and-errors.md) | Read and search the logs, find a visitor's «کد پیگیری», change the level, check a deployment, add an OpenTelemetry backend or Sentry (CS-30) |
| [worker.md](worker.md) | Start, stop and inspect the worker and its job queue; resume a stopped source; the lanes' behaviour; upgrade pg-boss (CS-32) |
| [ai-layer.md](ai-layer.md) | Add an AI task and choose its model; the Metis key; prompt caching; check the layer against Metis before an AI SDK upgrade; read the call lines (CS-45) |
