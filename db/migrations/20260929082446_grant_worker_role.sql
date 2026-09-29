-- migrate:up
-- What the worker's role may do on the tables that exist (CS-32; docs/design/data-model.md, "Roles and grants"). It
-- reads sources and their policy checks, writes listings and crawl runs, and adds observations it may never change:
-- fetches and snapshots are append-only for it as for everyone. It reads listing_status_transition because the
-- lifecycle guard (listing_status_guard) runs with the caller's rights, and schema_migrations for its health check.
-- It never changes a source directly: stop_source() (the crawl_lane migration) is its one way to stop one.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

GRANT SELECT ON schema_migrations TO carshenas_worker;
GRANT SELECT ON source, source_policy_check, source_current_policy, listing_status_transition TO carshenas_worker;
GRANT SELECT, INSERT, UPDATE ON listing, crawl_run TO carshenas_worker;
GRANT SELECT, INSERT ON fetch_log, snapshot TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE ALL ON fetch_log, snapshot FROM carshenas_worker;
REVOKE ALL ON listing, crawl_run FROM carshenas_worker;
REVOKE ALL ON source, source_policy_check, source_current_policy, listing_status_transition FROM carshenas_worker;
REVOKE ALL ON schema_migrations FROM carshenas_worker;
