-- migrate:up transaction:false
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
DROP INDEX CONCURRENTLY fetch_log_crawl_run_idx;


-- migrate:down transaction:false
CREATE INDEX CONCURRENTLY IF NOT EXISTS fetch_log_crawl_run_idx ON fetch_log (crawl_run_id, source_id);
