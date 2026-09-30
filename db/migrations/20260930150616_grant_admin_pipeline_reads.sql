-- migrate:up
-- The superadmin section's reads of the worker and the pipeline (CS-41, ADR-0023's follow-up): its role,
-- carshenas_admin, reads the job queue, each source's lane, crawl runs, the fetch log, listings,
-- their price events and unparsed values, and the freshness measurements, so the section shows the worker without
-- anyone reading raw logs. Reads only: the role still changes nothing directly, and retrying or cancelling a job will
-- go through a function that records the superadmin, as change_source_state() does for a source.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

GRANT USAGE ON SCHEMA pgboss TO carshenas_admin;
-- Through the partitioned parent, which is how every read reaches a partition. pg-boss owns these tables: an upgrade
-- that recreates one drops this grant (docs/runbooks/worker.md, "Upgrading pg-boss").
GRANT SELECT ON pgboss.job TO carshenas_admin;

GRANT SELECT ON crawl_lane, crawl_run, fetch_log TO carshenas_admin;
GRANT SELECT ON listing, listing_price_event, listing_unparsed_value, freshness_measurement TO carshenas_admin;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE SELECT ON listing, listing_price_event, listing_unparsed_value, freshness_measurement FROM carshenas_admin;
REVOKE SELECT ON crawl_lane, crawl_run, fetch_log FROM carshenas_admin;
REVOKE SELECT ON pgboss.job FROM carshenas_admin;
REVOKE USAGE ON SCHEMA pgboss FROM carshenas_admin;
