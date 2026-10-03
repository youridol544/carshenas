-- migrate:up
-- The superadmin's crawl-request screen (CS-71) names a request's car from the catalogue: its make, model and trim. The
-- section already reads model (CS-41); make and trim hold the same kind of curated, public names.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

GRANT SELECT ON make, trim TO carshenas_admin;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE SELECT ON make, trim FROM carshenas_admin;
