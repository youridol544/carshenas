# Local development only. The image's entrypoint sources this file (it is not executable on purpose) on the
# first start of an empty volume, after 10-roles.sql. It sets the development passwords from .env, creates the
# carshenas database, and installs pg_stat_statements in the maintenance database, where `pnpm db:top-queries`
# reads the whole server's workload without adding the extension to the application's schema.

docker_process_sql --dbname postgres \
  -v migrate_password="$CARSHENAS_MIGRATE_PASSWORD" \
  -v web_password="$CARSHENAS_WEB_PASSWORD" \
  -v readonly_password="$CARSHENAS_READONLY_PASSWORD" <<'SQL'
ALTER ROLE carshenas_migrate PASSWORD :'migrate_password';
ALTER ROLE carshenas_web PASSWORD :'web_password';
ALTER ROLE carshenas_readonly PASSWORD :'readonly_password';
CREATE EXTENSION pg_stat_statements;
SQL

# The worker's and the superadmin section's passwords are optional here, so a .env written before the worker (CS-32)
# or the section's role (CS-40) existed still starts the container; `pnpm db:roles` sets them once .env has them.
if [ -n "${CARSHENAS_WORKER_PASSWORD:-}" ]; then
  docker_process_sql --dbname postgres -v worker_password="$CARSHENAS_WORKER_PASSWORD" <<'SQL'
ALTER ROLE carshenas_worker PASSWORD :'worker_password';
SQL
fi
if [ -n "${CARSHENAS_ADMIN_PASSWORD:-}" ]; then
  docker_process_sql --dbname postgres -v admin_password="$CARSHENAS_ADMIN_PASSWORD" <<'SQL'
ALTER ROLE carshenas_admin PASSWORD :'admin_password';
SQL
fi

docker_process_sql --dbname postgres -v dbname=carshenas -f /docker-entrypoint-initdb.d/create-database.psql
