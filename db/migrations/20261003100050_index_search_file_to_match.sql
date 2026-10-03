-- migrate:up transaction:false
-- The matching job (CS-72) reads the watching, unmuted files whose watermark is oldest, a limited number a run: this index
-- serves that read however many files paused, closed or muted buyers keep.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY search_file_to_match_idx ON search_file (matched_through, id)
  WHERE status = 'watching' AND muted_at IS NULL;


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS search_file_to_match_idx;
