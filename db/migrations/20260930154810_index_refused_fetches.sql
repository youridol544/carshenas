-- migrate:up transaction:false
-- The superadmin section's refused requests (CS-41 criterion 5): a source's blocked, rate-limited and challenged
-- requests, newest first. They are rare among millions of fetches, so without this index the read walks the whole log
-- to find twenty. The predicate is written as literals in the query too (sql.lit), so the planner matches it.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY fetch_log_refused_idx ON fetch_log (source_id, requested_at DESC)
  WHERE outcome IN ('blocked', 'rate_limited', 'challenge');


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS fetch_log_refused_idx;
