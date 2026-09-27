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

docker_process_sql --dbname postgres -v dbname=carshenas -f /docker-entrypoint-initdb.d/create-database.psql
