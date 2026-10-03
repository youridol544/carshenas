-- migrate:up transaction:false
-- The backfill planner (CS-53) reads a model's active listings whose own page was never read, newest first: this index
-- holds exactly those, in that order, so the read stops after the rows it needs however many listings are read already.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY listing_backfill_candidate_idx ON listing (source_id, model_id, listed_at DESC, id DESC)
  WHERE status = 'active' AND last_checked_at IS NULL;


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS listing_backfill_candidate_idx;
