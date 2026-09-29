-- Carshenas's database roles (ADR-0011). Roles belong to the server, not to one database, so they are created
-- once per server, before any migration: by the local container on its first start (this directory is its
-- docker-entrypoint-initdb.d), by the schema tests, and by hand on a new production server
-- (docs/runbooks/local-database.md). A role that exists already is left as it is and its settings are applied
-- again, so the file also adds a role that arrived after the server was set up (`pnpm db:roles`). No password is
-- set here: the local container sets development passwords from .env (20-local-database.sh, `pnpm db:roles`);
-- production sets them from its secret store.
--
--   carshenas_owner     owns every object and cannot log in, so nobody works as the owner by accident
--   carshenas_migrate   logs in to run migrations and becomes carshenas_owner for them
--   carshenas_web       the Next.js app: table by table, it may read what pages show and write what people own
--   carshenas_readonly  people and agents inspecting data: read-only sessions, generous timeouts
--   carshenas_worker    the worker (apps/worker): reads sources, writes what it crawls, runs its job queue (ADR-0018)
-- Timeouts live on roles, never in postgresql.conf, where they would also stop migrations and maintenance.

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'carshenas_owner') THEN
    CREATE ROLE carshenas_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'carshenas_migrate') THEN
    CREATE ROLE carshenas_migrate LOGIN IN ROLE carshenas_owner;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'carshenas_web') THEN
    CREATE ROLE carshenas_web LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'carshenas_readonly') THEN
    CREATE ROLE carshenas_readonly LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'carshenas_worker') THEN
    CREATE ROLE carshenas_worker LOGIN;
  END IF;
END
$roles$;

ALTER ROLE carshenas_migrate SET role = 'carshenas_owner';
ALTER ROLE carshenas_migrate SET lock_timeout = '5s';
ALTER ROLE carshenas_migrate SET application_name = 'carshenas-migrate';

ALTER ROLE carshenas_web SET statement_timeout = '5s';
ALTER ROLE carshenas_web SET lock_timeout = '2s';
ALTER ROLE carshenas_web SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE carshenas_web SET transaction_timeout = '15s';

ALTER ROLE carshenas_readonly SET default_transaction_read_only = on;
ALTER ROLE carshenas_readonly SET statement_timeout = '30s';
ALTER ROLE carshenas_readonly SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE carshenas_readonly SET application_name = 'carshenas-readonly';
-- Lets `pnpm db:top-queries` read every role's statements in pg_stat_statements.
GRANT pg_read_all_stats TO carshenas_readonly;

-- The worker's statements are batches (upserts of a page of listings, the job queue's maintenance), so it gets
-- longer limits than the web app; its transactions still hold no network call, so they stay short. Its pools name
-- themselves (carshenas-worker, carshenas-worker-queue). The server logs its statements from one second on, not
-- from the 250 ms that db/postgresql.conf sets for everyone else.
ALTER ROLE carshenas_worker SET statement_timeout = '30s';
ALTER ROLE carshenas_worker SET lock_timeout = '5s';
ALTER ROLE carshenas_worker SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE carshenas_worker SET transaction_timeout = '2min';
ALTER ROLE carshenas_worker SET log_min_duration_statement = '1s';
