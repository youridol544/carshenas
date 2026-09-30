-- migrate:up
-- Validates the constraints CS-35's earlier migrations added NOT VALID (the widened crawl_run.kind list, the budget
-- checks, and a price event's evidence), each under a SHARE UPDATE EXCLUSIVE lock, which lets crawls keep writing while
-- existing rows are checked.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE crawl_run VALIDATE CONSTRAINT crawl_run_kind_valid;
ALTER TABLE source VALIDATE CONSTRAINT source_daily_request_budget_range;
ALTER TABLE source VALIDATE CONSTRAINT source_crawl_has_budget;
ALTER TABLE crawl_lane VALIDATE CONSTRAINT crawl_lane_budget_day_counted;
ALTER TABLE listing_price_event VALIDATE CONSTRAINT listing_price_event_fetch_log_fk;
ALTER TABLE listing_price_event VALIDATE CONSTRAINT listing_price_event_one_evidence;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A validated constraint cannot be marked NOT VALID again; the earlier migrations' down sections replace or drop them.
SELECT 1;
