-- migrate:up
-- The public data-status page (CS-66) says how old the market values are and how accurate they were: the latest
-- succeeded valuation run's day and counts, and each catalogue model's leave-one-out error in that run. Reads only;
-- listing_valuation and the comparables stay closed to the web role until a page shows them.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

GRANT SELECT ON valuation_run, valuation_segment TO carshenas_web;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE SELECT ON valuation_run, valuation_segment FROM carshenas_web;
