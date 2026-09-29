# The worker: start, stop and inspect it and its job queue

The worker (`apps/worker`, CS-32) is the Node.js process that runs Carshenas's background jobs outside Next.js: crawling now, parsing, extraction, valuation and alerts later. Its jobs live in pg-boss 12 on the same PostgreSQL (ADR-0011); each crawled source has its own lane, and every request to a source is paced in the database (ADR-0018). How it logs: `docs/runbooks/logs-and-errors.md`, "The worker". The database: `docs/runbooks/local-database.md`.

## Before the first start

The worker connects as its own role, `carshenas_worker`. A `.env` from before CS-32 lacks its settings:

1. Copy these lines from `example.env` into `.env`: `CARSHENAS_WORKER_PASSWORD`, `WORKER_DATABASE_URL`, and, once a job sends requests to a source, `CRAWLER_USER_AGENT` (how the crawler names itself, with a contact address: ADR-0008 point 5).
2. `pnpm db:up`, then `pnpm db:roles` (creates the role on a volume made before it existed, and sets its password from `.env`), then `pnpm db:migrate` (installs the job queue's schema `pgboss` and the lanes' table).

A fresh clone gets all of this from `./scripts/init.sh`.

## Start and stop

| Command | What it does |
|---|---|
| `pnpm worker` | Starts the worker: JSON lines on standard output, health on `127.0.0.1:3101` |
| `pnpm worker:dev` | The same with readable lines at debug level, restarted when a file changes |
| `pnpm worker:health` | Asks the running worker; exits 0 with its report when it can work, 1 otherwise |
| Ctrl-C, or `kill -TERM <pid>` | Stops claiming jobs, lets running ones finish for up to 30 seconds (then fails them back to the queue), closes its pools, exits 0. A second Ctrl-C exits at once |

Find its process by its port, never with `pkill -f` (it can kill the shell that runs it): `ss -ltnpH 'sport = :3101'`.

Settings (all in `.env` or the environment; `apps/worker/src/env.ts` reads them):

| Variable | Default | Meaning |
|---|---|---|
| `WORKER_DATABASE_URL` | none | `carshenas_worker`'s connection string; used by the worker's pool and by pg-boss's |
| `WORKER_HEALTH_PORT` | 3101 | The loopback port of `GET /health` |
| `CRAWLER_USER_AGENT` | none | Required once a job sends a request |
| `LOG_LEVEL`, `LOG_FORMAT`, `CARSHENAS_LOG_SQL`, `CARSHENAS_RELEASE`, `CARSHENAS_ENVIRONMENT`, `OTEL_EXPORTER_OTLP_ENDPOINT` | as the web app | `docs/runbooks/logs-and-errors.md` |

## What a healthy worker says

```bash
pnpm worker:health
{"status":"ok","database":{"migration":"20260929082449","latencyMs":2},"queue":{"schemaVersion":43},"lanes":[{"sourceId":"divar","queue":"crawl.divar","state":"running"}]}
```

- `database`: a real query through the worker's own pool and role, with the newest migration applied.
- `queue`: pg-boss's installed schema version, read from its own table.
- `lanes`: one per crawled source, `running` or `paused` with its `closure` (`stopped`, `paused`, `cooling_down`, `waiting`) and, when known, `until`. A paused lane is the worker doing its job, not a fault: the check still answers ok.

It answers 503 with `{"status":"unavailable","failing":[…]}` when the database or the queue cannot be reached or the runtime is not running, and logs why (`worker health check failed`).

## Inspect the queue

`pnpm db:psql` reads everything the worker writes (read-only sessions). Queues: `crawl.<source>` for each source's lane (every crawl kind of that source, one job at a time), one queue per job kind for other work, and `dead-letter` for jobs that failed for good.

```bash
# Jobs per queue and state
pnpm db:psql -c "select name, state, count(*) from pgboss.job group by 1, 2 order by 1, 2"

# What a lane holds, in the order it will run them
pnpm db:psql -c "select id, data->>'kind' as kind, priority, state, retry_count, start_after from pgboss.job where name = 'crawl.divar' and state in ('created', 'retry', 'active') order by priority desc, created_on"

# Recent failures with their error
pnpm db:psql -c "select name, id, data->>'kind' as kind, retry_count, output->>'type' as error, output->>'message' as message, completed_on from pgboss.job where state = 'failed' order by completed_on desc limit 20"

# Dead letters: where each came from and why
pnpm db:psql -c "select id, source_name, data->>'kind' as kind, source_output->>'message' as error, created_on from pgboss.job where name = 'dead-letter' order by created_on desc limit 20"

# Each source's pacing: next turn, the request in flight, the breaker, the last 429, and whether it is stopped
pnpm db:psql -c "select s.id, s.crawl_state, s.stop_reason, s.stopped_at, l.next_request_at, l.lease_holder, l.failure_streak, l.cooldown_until, l.cooldown_reason, l.rate_limited_at from source s left join crawl_lane l on l.source_id = s.id where s.access_method = 'crawl'"
```

## Act on a source or a job

These change data, so they run as the owner, not through `pnpm db:psql`. A person decides them; the superadmin section will offer them (CS-40, CS-41).

```bash
# Resume a source the worker stopped on a block (ADR-0008 point 6): read the evidence first, the source's fetches at stopped_at
docker compose exec -T postgres psql -U postgres -d carshenas -c "update source set crawl_state = 'enabled', stopped_at = null, stop_reason = null where id = 'divar'"

# Pause a source (its lane stops claiming within ten seconds; queued jobs wait with their attempts)
docker compose exec -T postgres psql -U postgres -d carshenas -c "update source set crawl_state = 'paused' where id = 'divar'"
```

To send dead letters back to their queues, use pg-boss's `redrive()` from a script run as the worker (it takes a `sourceName` and a `limit`); a one-off redrive by hand is `update pgboss.job … ` only with care, since the dead-letter copy is a new job.

## How the lanes behave

- A lane runs one job at a time, across every worker process (pg-boss's `singleton` policy), highest priority first. Lanes run side by side.
- Every request takes the lane's lease in `crawl_lane`: never two in flight, and each starts at least the source's `min_request_interval_ms` (3 s or more) after the previous one ended, longer after a slow answer (five times its duration, up to 30 s).
- A job waits inside its handler for at most one gap. When the source is stopped or paused, or the lane cools down, the lane stops claiming; queued jobs keep their attempts, and the job that met the condition is put back with its attempts untouched.
- Three timeouts, 5xx or dropped connections in a row cool the lane down for about 1, 2, 4 … 60 minutes (jittered); the next request after it is the probe.
- A 401, 403, or a challenge page or empty answer the source's adapter recognises stops the source until you resume it. A 429 cools the lane down for its `Retry-After` (or 15 minutes) and doubles the gap for 24 hours; a second 429 in those 24 hours stops the source.

## Upgrading pg-boss

pg-boss's schema belongs to the migrations, so the worker runs it with `migrate: false` and would refuse to start on a schema version it does not expect.

1. Bump the pinned version in `apps/worker/package.json` and `pnpm install`; read the release notes.
2. `pnpm db:new upgrade_job_queue_<version>`, then paste below the template's timeouts the output of `pnpm --filter @carshenas/worker pgboss:sql upgrade <installed schema version>` (the installed one: `pnpm db:psql -c "select version from pgboss.version"`).
3. `pnpm db:migrate`, `pnpm db:check`, and start the worker.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `WORKER_DATABASE_URL is not set` | `.env` predates the worker: see "Before the first start" |
| `password authentication failed for user "carshenas_worker"` or `role "carshenas_worker" does not exist` | `pnpm db:roles` |
| pg-boss refuses to start: schema not installed, or another version | `pnpm db:migrate`; after a pg-boss bump, the upgrade migration above |
| `listen EADDRINUSE 127.0.0.1:3101` | Another worker is running (`ss -ltnpH 'sport = :3101'`), or set `WORKER_HEALTH_PORT` |
| A lane stays `paused` with `closure: stopped` | The source was stopped on a block: `source.stop_reason` and `stopped_at` say which and when; resume it once you have read the evidence |
| A lane's jobs sit in `active` after a crash | pg-boss fails a job whose worker stopped sending heartbeats (30 s) at its next check, and the lane moves on |
| A job keeps coming back with `job of an unknown kind put back` | A worker without that job's code claimed it (an old process during a deploy). It is dead-lettered after 25 tries; stop the old process |
