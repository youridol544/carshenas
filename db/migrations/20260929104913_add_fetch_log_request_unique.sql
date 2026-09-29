-- migrate:up
-- One row per request (CS-33, from its database review): a run sends one request, which starts at one instant, so
-- (crawl_run_id, source_id, requested_at) names it. The crawler logs a request with ON CONFLICT DO NOTHING on this
-- key, so the answer a failed step logs again, after its transaction may or may not have committed, is never logged
-- twice, and no read comes before the write. The index was built concurrently by the previous migration; it also
-- serves fetch_log_crawl_run_fk, whose own index fetch_log_crawl_run_idx it makes redundant (dropped only with the
-- owner's agreement, as every index drop is).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE fetch_log ADD CONSTRAINT fetch_log_request_unique UNIQUE USING INDEX fetch_log_request_unique;

COMMENT ON CONSTRAINT fetch_log_request_unique ON fetch_log IS
  'One row per request: a run sends one request at a time, each starting at its own instant.';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE fetch_log DROP CONSTRAINT fetch_log_request_unique;
