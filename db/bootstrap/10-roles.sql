-- Carshenas's database roles (ADR-0011). Roles belong to the server, not to one database, so they are created
-- once per server, before any migration: by the local container on its first start (this directory is its
-- docker-entrypoint-initdb.d), by the schema tests, and by hand on a new production server
-- (docs/runbooks/local-database.md). No password is set here: the local container sets development passwords
-- from .env (20-local-database.sh); production sets them from its secret store.
--
--   carshenas_owner     owns every object and cannot log in, so nobody works as the owner by accident
--   carshenas_migrate   logs in to run migrations and becomes carshenas_owner for them
--   carshenas_web       the Next.js app: table by table, it may read what pages show and write what people own
--   carshenas_readonly  people and agents inspecting data: read-only sessions, generous timeouts
-- The ingestion worker gets its own role, carshenas_worker, with the task that builds it (CS-6).
-- Timeouts live on roles, never in postgresql.conf, where they would also stop migrations and maintenance.

CREATE ROLE carshenas_owner NOLOGIN;

CREATE ROLE carshenas_migrate LOGIN IN ROLE carshenas_owner;
ALTER ROLE carshenas_migrate SET role = 'carshenas_owner';
ALTER ROLE carshenas_migrate SET lock_timeout = '5s';
ALTER ROLE carshenas_migrate SET application_name = 'carshenas-migrate';

CREATE ROLE carshenas_web LOGIN;
ALTER ROLE carshenas_web SET statement_timeout = '5s';
ALTER ROLE carshenas_web SET lock_timeout = '2s';
ALTER ROLE carshenas_web SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE carshenas_web SET transaction_timeout = '15s';

CREATE ROLE carshenas_readonly LOGIN;
ALTER ROLE carshenas_readonly SET default_transaction_read_only = on;
ALTER ROLE carshenas_readonly SET statement_timeout = '30s';
ALTER ROLE carshenas_readonly SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE carshenas_readonly SET application_name = 'carshenas-readonly';
-- Lets `pnpm db:top-queries` read every role's statements in pg_stat_statements.
GRANT pg_read_all_stats TO carshenas_readonly;
