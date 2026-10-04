# The production server's first start (CS-119). The image's entrypoint sources this file (it is not executable on purpose) on
# the first start of an empty volume, after 10-roles.sql (a copy of db/bootstrap/10-roles.sql): it sets every login role's
# password from the server's environment, creates the carshenas database the way db/bootstrap/create-database.psql does,
# and installs pg_stat_statements in the maintenance database, where `pnpm db:top-queries` reads the workload. Unlike the
# local container's file (db/bootstrap/20-local-database.sh), no password is optional here.

: "${CARSHENAS_MIGRATE_PASSWORD:?not set}" "${CARSHENAS_WEB_PASSWORD:?not set}" "${CARSHENAS_READONLY_PASSWORD:?not set}"
: "${CARSHENAS_WORKER_PASSWORD:?not set}" "${CARSHENAS_ADMIN_PASSWORD:?not set}"

docker_process_sql --dbname postgres \
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
CREATE EXTENSION pg_stat_statements;
SQL

docker_process_sql --dbname postgres -v dbname=carshenas -f /docker-entrypoint-initdb.d/create-database.psql
