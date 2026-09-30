-- migrate:up
-- A daily request budget per crawled source (CS-35; ADR-0017 point 5; ADR-0018 point 7). source.daily_request_budget
-- is how many requests the source may receive in one Tehran day: at most half of what its minimum interval allows in
-- a day (14,400 at the 3-second floor), and required once a source is crawled. The owner set Divar's to 12,000 on
-- 2026-09-30 (CS-33's estimate of 9,300 for ten tracked models, plus room for buyers' re-checks). The lane counts what
-- it spends where it takes each request's lease: crawl_lane.budget_day is the Tehran day being counted and
-- budget_spent the requests leased on it, so no process can spend past the budget. The two source checks are added
-- NOT VALID (source has rows); the next migration validates them.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE source ADD COLUMN daily_request_budget integer;

UPDATE source SET daily_request_budget = 12000 WHERE id = 'divar';

ALTER TABLE source
  ADD CONSTRAINT source_daily_request_budget_range
    CHECK (daily_request_budget > 0 AND daily_request_budget <= 86400000 / min_request_interval_ms / 2) NOT VALID,
  ADD CONSTRAINT source_crawl_has_budget
    CHECK (access_method <> 'crawl' OR daily_request_budget IS NOT NULL) NOT VALID;

COMMENT ON COLUMN source.daily_request_budget IS
  'Requests this source may receive in one Tehran day (ADR-0017 point 5): at most half of what min_request_interval_ms allows in a day, spent in ADR-0017''s priority order, what comes last dropped first. Divar: 12,000 (owner, 2026-09-30). Set by migrations or the owner; the worker only reads it.';

ALTER TABLE crawl_lane
  ADD COLUMN budget_day date,
  ADD COLUMN budget_spent integer NOT NULL DEFAULT 0
    CONSTRAINT crawl_lane_budget_spent_nonnegative CHECK (budget_spent >= 0),
  ADD CONSTRAINT crawl_lane_budget_day_counted CHECK (budget_day IS NOT NULL OR budget_spent = 0) NOT VALID;

COMMENT ON COLUMN crawl_lane.budget_day IS
  'The Tehran day (Asia/Tehran) whose requests budget_spent counts; the first lease of a new day starts the count again. NULL before the lane''s first request.';
COMMENT ON COLUMN crawl_lane.budget_spent IS
  'Requests leased on budget_day, counted when the lease is taken, so a request is paid for even if its answer never arrives; compared with source.daily_request_budget less the reserve of the job''s priority (ADR-0017 point 5).';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE crawl_lane
  DROP CONSTRAINT crawl_lane_budget_day_counted,
  DROP COLUMN budget_spent,
  DROP COLUMN budget_day;
ALTER TABLE source
  DROP CONSTRAINT source_crawl_has_budget,
  DROP CONSTRAINT source_daily_request_budget_range,
  DROP COLUMN daily_request_budget;
