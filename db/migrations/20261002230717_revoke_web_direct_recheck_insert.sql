-- migrate:up
-- The listing page's re-check request goes through request_listing_recheck() (20261002222059), which keeps the
-- one-pending-request-per-listing guard and the caps (200 waiting, 120 an hour) in the database. While the web role could
-- still INSERT (listing_id) itself, a caller of the public action's database role could skip the caps: the insert is the
-- function owner's now.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE INSERT (listing_id) ON listing_recheck_request FROM carshenas_web;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

GRANT INSERT (listing_id) ON listing_recheck_request TO carshenas_web;
