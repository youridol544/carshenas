#!/usr/bin/env bash
# Local database commands (ADR-0011, docs/runbooks/local-database.md), run through `pnpm db:<command>`.
# They reach the Compose container only, never a shared or production database. Connection settings come from
# .env (copied from example.env by scripts/init.sh).
#
#   up | stop | restart      start (and wait until healthy), stop, or restart the PostgreSQL container
#   migrate | rollback       apply pending migrations or roll back the newest, then refresh db/schema.sql and types
#   roles                    create the roles this server lacks, apply every role's settings, and set every login
#                            role's password from .env (a role that arrived after the volume was created)
#   new <name>               create db/migrations/<timestamp>_<name>.sql from the house template
#   status                   list applied and pending migrations
#   lint                     Squawk on every migration's up section, file names, and no edits to merged migrations
#   check                    replay all migrations on a scratch database: up, down, up; schema and type drift;
#                            then the integration tests (*.db.test.ts) against it
#   psql [args]              psql as carshenas_readonly (read-only sessions), for people and agents
#   top-queries              the ten statements with the most total execution time (pg_stat_statements)
#   unused-indexes           indexes never scanned since the statistics were reset
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '[db] %s\n' "$*" >&2; }
fail() {
  printf '[db] FAILED: %s\n' "$*" >&2
  exit 1
}

load_env() {
  [ -f .env ] || fail ".env is missing: copy example.env to .env (scripts/init.sh does it)."
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
}

require_running() {
  # </dev/null: `docker compose exec` would otherwise swallow input piped to the command that follows.
  docker compose exec -T postgres pg_isready --host=127.0.0.1 --quiet </dev/null 2>/dev/null ||
    fail "the PostgreSQL container is not running: pnpm db:up"
}

superuser_psql() { docker compose exec -T postgres psql --username=postgres --no-psqlrc --quiet -v ON_ERROR_STOP=1 "$@"; }
# psql for people and agents runs as the unprivileged OS user nobody inside the container, so a shell escape (\!)
# cannot touch the data directory, which only the postgres user may write.
readonly_psql() {
  docker compose exec -T --user 65534:65534 -e PGPASSWORD="$CARSHENAS_READONLY_PASSWORD" postgres \
    psql --host=127.0.0.1 --username=carshenas_readonly --no-psqlrc --quiet -v ON_ERROR_STOP=1 "$@"
}
dbmate() { node_modules/.bin/dbmate --migrations-dir db/migrations --no-dump-schema "$@"; }
codegen() { (cd packages/db && node_modules/.bin/kysely-codegen "$@"); }

# The same connection string with another database name.
url_for_database() { node -e 'const u = new URL(process.argv[1]); u.pathname = "/" + process.argv[2]; console.log(u.href)' "$1" "$2"; }

# The schema as pg_dump prints it from inside the container (the host's pg_dump may be an older major, and
# dbmate's own dump silently skips on a version mismatch), followed by the applied migration versions. A fixed
# \restrict key keeps the file byte-for-byte reproducible; it is a review and drift artifact, never restored.
dump_schema() {
  docker compose exec -T postgres pg_dump --username=postgres --dbname="$1" --schema-only --no-owner --restrict-key=carshenas
  printf -- '--\n-- Applied migrations\n--\n\n'
  superuser_psql --dbname="$1" --tuples-only --no-align \
    --command="SELECT format('INSERT INTO public.schema_migrations (version) VALUES (%L);', version) FROM schema_migrations ORDER BY version"
}

refresh_artifacts() {
  dump_schema carshenas >db/schema.sql
  codegen --log-level=warn --url 'env(DATABASE_MIGRATE_URL)'
  say "db/schema.sql and packages/db/src/db-types.ts are up to date; commit them with the migration."
}

cmd_lint() {
  local status=0 file
  for file in db/migrations/*.sql; do
    [[ $(basename "$file") =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]] ||
      { say "$file: name it <14-digit UTC timestamp>_<snake_case_name>.sql (pnpm db:new <name>)"; status=1; }
    sed '/^-- migrate:down/,$d' "$file" | node_modules/.bin/squawk --stdin-filepath "$file" || status=1
  done
  # Proof that Squawk, with this configuration, still refuses a lock-heavy statement on a table that has rows.
  if printf -- '-- migrate:up\nCREATE INDEX listing_url_idx ON listing (url);\n' |
    node_modules/.bin/squawk --stdin-filepath planted-self-check.sql >/dev/null 2>&1; then
    say "Squawk accepted CREATE INDEX without CONCURRENTLY or timeouts: .squawk.toml no longer lints what it must"
    status=1
  fi
  # Applied migrations are history: once on main, a migration is never edited, deleted or renamed, only followed by
  # another. --no-renames makes a rename show as the deletion it is.
  if base=$(git merge-base HEAD main 2>/dev/null); then
    changed=$(git diff --name-only --no-renames --diff-filter=MD "$base" -- db/migrations)
    if [ -n "$changed" ]; then
      say "migrations already on main were edited or deleted; add a new migration instead:"
      printf '  %s\n' $changed >&2
      status=1
    fi
  else
    say "note: no local main branch, so edits to merged migrations were not checked"
  fi
  return "$status"
}

cmd_check() {
  load_env
  require_running
  # One scratch database per run, so two runs never share one; the integration tests refuse any name not ending
  # in _check.
  local db="carshenas_$$_check" url count
  trap "superuser_psql --dbname=postgres --command='DROP DATABASE IF EXISTS $db WITH (FORCE)' || true" EXIT
  superuser_psql --dbname=postgres --command="DROP DATABASE IF EXISTS $db WITH (FORCE)"
  superuser_psql --dbname=postgres -v dbname="$db" --file=/docker-entrypoint-initdb.d/create-database.psql
  url=$(url_for_database "$DATABASE_MIGRATE_URL" "$db")

  say "Migrate up, roll every migration back, migrate up again ($db)"
  dbmate --url "$url" up
  count=$(find db/migrations -name '*.sql' | wc -l)
  for _ in $(seq "$count"); do dbmate --url "$url" rollback; done
  dbmate --url "$url" up

  say "Compare the replayed schema with db/schema.sql"
  dump_schema "$db" | diff -u db/schema.sql - ||
    fail "db/schema.sql does not match the migrations: run pnpm db:migrate and commit db/schema.sql."

  say "Verify the generated types"
  # --log-level=error prints the difference when the committed types are stale.
  codegen --log-level=error --url "$url" --verify ||
    fail "packages/db/src/db-types.ts is stale: run pnpm db:migrate and commit it."

  say "Integration tests against $db"
  [ -n "${ADMIN_DATABASE_URL:-}" ] ||
    fail "ADMIN_DATABASE_URL is not in .env: copy it and CARSHENAS_ADMIN_PASSWORD from example.env, then pnpm db:roles."
  DATABASE_URL=$(url_for_database "$DATABASE_URL" "$db") DATABASE_MIGRATE_URL="$url" \
    ADMIN_DATABASE_URL=$(url_for_database "$ADMIN_DATABASE_URL" "$db") \
    pnpm --filter @carshenas/web test:db
  [ -n "${WORKER_DATABASE_URL:-}" ] ||
    fail "WORKER_DATABASE_URL is not in .env: copy it and CARSHENAS_WORKER_PASSWORD from example.env, then pnpm db:roles."
  WORKER_DATABASE_URL=$(url_for_database "$WORKER_DATABASE_URL" "$db") DATABASE_MIGRATE_URL="$url" \
    pnpm --filter @carshenas/worker test:db
  DATABASE_MIGRATE_URL="$url" pnpm --filter @carshenas/accounts test:db
  DATABASE_URL=$(url_for_database "$DATABASE_URL" "$db") DATABASE_MIGRATE_URL="$url" \
    pnpm --filter @carshenas/search test:db
  say "OK: migrations replay, roll back and match db/schema.sql and the types; integration tests pass."
}

cmd_roles() {
  load_env
  require_running
  local name
  for name in CARSHENAS_MIGRATE_PASSWORD CARSHENAS_WEB_PASSWORD CARSHENAS_READONLY_PASSWORD CARSHENAS_WORKER_PASSWORD \
    CARSHENAS_ADMIN_PASSWORD; do
    [ -n "${!name:-}" ] ||
      fail "$name is not in .env: copy it from example.env (with WORKER_DATABASE_URL for the worker, ADMIN_DATABASE_URL for the superadmin section)."
  done
  say "Create the roles this server lacks and apply every role's settings (db/bootstrap/10-roles.sql)"
  # Without notices: granting pg_read_all_stats again is harmless and PostgreSQL says so.
  docker compose exec -T -e PGOPTIONS='-c client_min_messages=warning' postgres \
    psql --username=postgres --no-psqlrc --quiet -v ON_ERROR_STOP=1 --dbname=postgres \
    --file=/docker-entrypoint-initdb.d/10-roles.sql </dev/null
  say "Set every login role's password from .env"
  superuser_psql --dbname=postgres \
    -v migrate_password="$CARSHENAS_MIGRATE_PASSWORD" \
    -v web_password="$CARSHENAS_WEB_PASSWORD" \
    -v readonly_password="$CARSHENAS_READONLY_PASSWORD" \
    -v worker_password="$CARSHENAS_WORKER_PASSWORD" \
    -v admin_password="$CARSHENAS_ADMIN_PASSWORD" <<'SQL'
ALTER ROLE carshenas_migrate PASSWORD :'migrate_password';
ALTER ROLE carshenas_web PASSWORD :'web_password';
ALTER ROLE carshenas_readonly PASSWORD :'readonly_password';
ALTER ROLE carshenas_worker PASSWORD :'worker_password';
ALTER ROLE carshenas_admin PASSWORD :'admin_password';
SQL
  # What db/bootstrap/create-database.psql grants a new database, for one created before a role existed.
  superuser_psql --dbname=postgres \
    --command='GRANT CONNECT ON DATABASE carshenas TO carshenas_web, carshenas_readonly, carshenas_worker, carshenas_admin' </dev/null
  say "OK: roles, settings and passwords match db/bootstrap and .env."
}

cmd_new() {
  [ $# -eq 1 ] && [[ $1 =~ ^[a-z0-9_]+$ ]] || fail "usage: pnpm db:new <snake_case_name>"
  local file
  file="db/migrations/$(date -u +%Y%m%d%H%M%S)_$1.sql"
  [ -e "$file" ] && fail "$file exists"
  cat >"$file" <<'SQL'
-- migrate:up
-- What this migration changes and why (the task, the ADR or the design doc).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

SQL
  say "created $file; the database skill's migration checklist applies (.claude/skills/database)"
}

command=${1:-}
[ $# -gt 0 ] && shift
case "$command" in
  up)
    load_env
    docker compose up --detach --wait postgres
    ;;
  stop) docker compose stop postgres ;;
  restart)
    load_env
    docker compose restart postgres
    docker compose up --detach --wait postgres
    ;;
  migrate)
    load_env
    require_running
    dbmate --env DATABASE_MIGRATE_URL up
    refresh_artifacts
    ;;
  rollback)
    load_env
    require_running
    dbmate --env DATABASE_MIGRATE_URL rollback
    refresh_artifacts
    ;;
  status)
    load_env
    dbmate --env DATABASE_MIGRATE_URL status
    ;;
  roles) cmd_roles ;;
  new) cmd_new "$@" ;;
  lint) cmd_lint ;;
  check) cmd_check ;;
  psql)
    load_env
    require_running
    tty=()
    [ -t 0 ] || tty=(-T)
    docker compose exec "${tty[@]}" --user 65534:65534 -e PGPASSWORD="$CARSHENAS_READONLY_PASSWORD" postgres \
      psql --host=127.0.0.1 --username=carshenas_readonly --dbname=carshenas "$@"
    ;;
  top-queries)
    load_env
    require_running
    # As the read-only role, which pg_read_all_stats lets see every role's statements.
    readonly_psql --dbname=postgres <<'SQL'
SELECT round(s.total_exec_time::numeric, 1) AS total_ms,
       round((100 * s.total_exec_time / nullif(sum(s.total_exec_time) OVER (), 0))::numeric, 1) AS pct,
       s.calls,
       round(s.mean_exec_time::numeric, 2) AS mean_ms,
       round(s.rows::numeric / nullif(s.calls, 0), 1) AS rows_per_call,
       round((s.shared_blks_hit + s.shared_blks_read)::numeric / nullif(s.calls, 0), 1) AS buffers_per_call,
       s.temp_blks_written AS temp_blocks,
       left(regexp_replace(s.query, '\s+', ' ', 'g'), 110) AS query
FROM pg_stat_statements s
JOIN pg_database d ON d.oid = s.dbid
WHERE d.datname = 'carshenas'
ORDER BY s.total_exec_time DESC
LIMIT 10;
SQL
    say "counts since the last pg_stat_statements_reset(); failed and cancelled statements are not included"
    ;;
  unused-indexes)
    load_env
    require_running
    readonly_psql --dbname=carshenas <<'SQL'
SELECT s.relname AS table_name,
       s.indexrelname AS index_name,
       s.idx_scan AS scans,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
       EXISTS (SELECT FROM pg_constraint c
               WHERE c.contype = 'f' AND c.conrelid = s.relid
                 AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey) AS serves_foreign_key
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.idx_scan = 0 AND NOT i.indisunique
ORDER BY pg_relation_size(s.indexrelid) DESC;
SQL
    say "scans since the statistics were last reset ($(readonly_psql --dbname=carshenas -At -c "select coalesce(stats_reset::text, 'never') from pg_stat_database where datname = 'carshenas'")); an index that serves a foreign key protects deletes of parent rows even when it is never scanned"
    ;;
  *)
    sed -n '2,17p' "$0" >&2
    exit 2
    ;;
esac
