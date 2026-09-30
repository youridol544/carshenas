# Run PostgreSQL locally

The local database is PostgreSQL 18.6 with pgvector 0.8.6 (ADR-0011), in Docker Compose. This runbook covers starting it, migrating, connecting, measuring, resetting and bootstrapping a new server. How to design tables and write migrations and queries is in the `database` skill; the model is `docs/design/data-model.md`.

## What runs

| Thing | Where | Notes |
|---|---|---|
| Image | `pgvector/pgvector:0.8.6-pg18` in `compose.yaml` | Pinned tag. `pg_trgm`, `btree_gist`, `unaccent`, `fuzzystrmatch`, `pg_stat_statements` and `auto_explain` ship with it |
| Port | `127.0.0.1:5418` (`POSTGRES_PORT` in `.env`) | Loopback only, never the network |
| Data | Docker volume `carshenas_postgres-data`, mounted at `/var/lib/postgresql` | PostgreSQL 18 images keep the cluster in `/var/lib/postgresql/18/docker` |
| Settings | `db/postgresql.conf`, mounted read-only | Written for a 4 GB, 2-core VPS; the container is limited to the same (`mem_limit`, `cpus`) so local plans and timings are honest |
| Roles | `db/bootstrap/10-roles.sql` | `carshenas_owner` (owns everything, cannot log in), `carshenas_migrate` (runs migrations as the owner), `carshenas_web` (the app), `carshenas_readonly` (people and agents), `carshenas_worker` (the worker, CS-32), `carshenas_admin` (the superadmin section, CS-40) |
| Databases | `carshenas`; a scratch `carshenas_<pid>_check` exists only while a `pnpm db:check` run lasts | Builtin `C.UTF-8` locale (`db/bootstrap/create-database.psql`); only `carshenas_migrate` may create temporary tables; `pg_stat_statements` lives in the `postgres` database |
| Settings file | `.env` (copied from `example.env`, gitignored) | Passwords for the local container and one connection string per role |
| Job queue | schema `pgboss`, installed by a migration (ADR-0018) | pg-boss's own tables; the worker has row access, the read-only role can inspect them (`docs/runbooks/worker.md`) |

## First start

```bash
./scripts/init.sh            # copies example.env to .env if missing, starts the database, migrates, runs every check
# or by hand:
cp example.env .env && pnpm db:up && pnpm db:migrate
curl -s http://127.0.0.1:3000/api/health   # with pnpm dev running: {"status":"ok","database":{"migration":"…",…}}
```

The files in `db/bootstrap/` run only when the volume is empty. For a role that arrived later (the worker's, CS-32; the superadmin section's, CS-40) or a password changed in `.env` afterwards, run `pnpm db:roles`: it creates the roles the server lacks, applies every role's settings, and sets every login role's password from `.env`.

## Daily commands

| Command | What it does |
|---|---|
| `pnpm db:up` · `pnpm db:stop` · `pnpm db:restart` | Start and wait until healthy · stop · restart after changing `db/postgresql.conf` |
| `pnpm db:new <snake_case_name>` | A new migration in `db/migrations/` from the house template |
| `pnpm db:migrate` | Apply pending migrations as `carshenas_migrate`, then rewrite `db/schema.sql` and `packages/db/src/db-types.ts`; commit all three |
| `pnpm db:rollback` | Undo the newest migration on the development database (it drops that migration's data); only for a migration that is not on `main` yet. Roll back **before** editing the file: dbmate undoes a migration with the file's current down section, so an edited file cannot undo the version that ran |
| `pnpm db:status` | Applied and pending migrations |
| `pnpm db:roles` | Create the roles this server lacks, apply every role's settings from `db/bootstrap/10-roles.sql`, and set every login role's password from `.env`; safe to run again |
| `pnpm db:lint` | Squawk on every migration's up section, file names, and no edits to migrations already on `main` (part of `pnpm check`) |
| `pnpm db:check` | On a scratch database of its own (`carshenas_<pid>_check`, dropped afterwards, so parallel runs never collide): every migration up, down and up again; the dump compared with `db/schema.sql`; the generated types verified; the integration tests (`*.db.test.ts` of the web app and the worker) run. It never touches `carshenas` |
| `pnpm db:psql` | `psql` as `carshenas_readonly` (read-only sessions), run as the OS user `nobody` inside the container so a shell escape cannot touch the data; pass arguments or pipe SQL in: `pnpm db:psql -c "select count(*) from listing"` |
| `pnpm db:top-queries` | The ten statements with the most total execution time since the last reset (as the read-only role, which `pg_read_all_stats` lets see every role's statements) |
| `pnpm db:unused-indexes` | Indexes never scanned since the statistics were reset, and whether each serves a foreign key |

Log every SQL statement the app sends, with its parameters, by starting the dev server with `CARSHENAS_LOG_SQL=1 pnpm dev`.

## Measuring

- `EXPLAIN (ANALYZE, BUFFERS)` through `pnpm db:psql -c "…"` for one query; the `database` skill says how to read it.
- `pnpm db:top-queries` for the workload. Reset it before a measured run: `docker compose exec postgres psql -U postgres -d postgres -c "select pg_stat_statements_reset()"`.
- Slow statements (over 250 ms), their plans (over 500 ms, through `auto_explain`), lock waits and spills to disk are in the server log: `docker compose logs --since 10m postgres`. Bind parameters are never logged (they can carry personal data); to see them in development, run the app with `CARSHENAS_LOG_SQL=1`.
- Check a setting after a change: `pnpm db:psql -c "show shared_buffers"`.

## Resetting the local database

Deleting the volume loses every row, so only a person does it; the guard hook refuses these commands to agents.

```bash
docker compose down -v     # removes the container and the volume
pnpm db:up && pnpm db:migrate
```

## Upgrading

- A new pgvector or PostgreSQL 18 minor: change the tag in `compose.yaml`, `docker compose pull postgres`, `pnpm db:restart`, then `pnpm db:check`.
- A new PostgreSQL major: data directories are not compatible across majors. Locally, reset the database as above. On a server, plan `pg_upgrade` or a dump and restore in the hosting task, with a backup first.

## Bootstrapping a new server (CS-37)

1. Install PostgreSQL 18 with pgvector, and start it with the settings of `db/postgresql.conf` adjusted to the machine's memory and cores (the `database` skill's configuration table).
2. As the superuser: run `db/bootstrap/10-roles.sql` (again whenever a role is added: it skips the roles that exist), set each login role's password from the secret store (`ALTER ROLE … PASSWORD …`), run `psql -v dbname=carshenas -f db/bootstrap/create-database.psql`, and `CREATE EXTENSION pg_stat_statements` in the `postgres` database.
3. Apply migrations as `carshenas_migrate`: `dbmate --url "$DATABASE_MIGRATE_URL" --migrations-dir db/migrations --no-dump-schema up`.
4. Give the app `DATABASE_URL` for `carshenas_web` and check `GET /api/health`, and `ADMIN_DATABASE_URL` for `carshenas_admin`, which only the superadmin section uses (open `/admin` signed in as the superadmin); give the worker `WORKER_DATABASE_URL` for `carshenas_worker` and check `pnpm worker:health` (`docs/runbooks/worker.md`).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `pnpm db:up` fails: port 5418 in use | Another server holds the port. Change `POSTGRES_PORT` and the three connection strings in `.env` |
| `could not resize shared memory segment … No space left on device` | A parallel index build needs more `/dev/shm` than the container has; `shm_size` in `compose.yaml` must be at least `maintenance_work_mem` |
| `password authentication failed` after editing `.env` | The bootstrap ran with the old passwords: `pnpm db:roles` |
| `WORKER_DATABASE_URL is not set` or `role "carshenas_worker" does not exist` | A `.env` and a volume from before the worker (CS-32): copy `CARSHENAS_WORKER_PASSWORD` and `WORKER_DATABASE_URL` from `example.env` into `.env`, then `pnpm db:roles` |
| `ADMIN_DATABASE_URL is not set`, `CARSHENAS_ADMIN_PASSWORD is not in .env` or `role "carshenas_admin" does not exist` (a migration's GRANT) | A `.env` and a volume from before the superadmin section's role (CS-40): copy `CARSHENAS_ADMIN_PASSWORD` and `ADMIN_DATABASE_URL` from `example.env` into `.env` (with this checkout's port), then `pnpm db:roles`, then `pnpm db:migrate` |
| `/api/health` answers 503 | The server log names the cause (`[health] the database did not answer …`); usually the container is stopped or `.env` is missing |
| `db/schema.sql does not match the migrations` in `pnpm db:check` | The development database was changed by hand or a migration was edited after it ran; roll back and migrate again, or reset the database |
| `pg_dump: error: aborting because of server version mismatch` | A host `pg_dump` older than 18; the scripts always dump through the container, so use `pnpm db:migrate` |
