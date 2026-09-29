-- migrate:up transaction:false
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE UNIQUE INDEX CONCURRENTLY fetch_log_request_unique ON fetch_log (crawl_run_id, source_id, requested_at);


-- migrate:down transaction:false
-- The next migration's down drops it with its constraint.
DROP INDEX CONCURRENTLY IF EXISTS fetch_log_request_unique;
