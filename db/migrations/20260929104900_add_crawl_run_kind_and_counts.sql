-- migrate:up
-- What a crawl run was for and what it did (CS-33; ADR-0017 point 5, ADR-0018). Since the worker's lanes, a crawl
-- run is one lane job: a discovery page, a listing's detail or a measurement page. It cites the source's policy check
-- before its request, logs every request in fetch_log, and records its counts once, when it closes (CS-33 criterion
-- 4). crawl_run has no rows anywhere yet: the defaults only let the columns arrive NOT NULL, and kind drops its default
-- at once, so every run states what it was for.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE crawl_run
  ADD COLUMN kind text NOT NULL DEFAULT 'detail'
    CONSTRAINT crawl_run_kind_valid CHECK (kind IN ('discovery', 'detail', 'measure')),
  ADD COLUMN counts jsonb NOT NULL DEFAULT '{}'
    CONSTRAINT crawl_run_counts_is_object CHECK (jsonb_typeof(counts) = 'object');

ALTER TABLE crawl_run ALTER COLUMN kind DROP DEFAULT;

COMMENT ON TABLE crawl_run IS
  'One lane job''s crawl of one source (ADR-0018): a discovery page, a listing''s detail or a measurement page, citing the policy check it ran under (ADR-0008 point 1). The lane runs one job of a source at a time, so at most one run per source is running.';
COMMENT ON COLUMN crawl_run.kind IS
  'What the run spent its request on (ADR-0017 point 5): discovery (a page of the newest listings of tracked models), detail (one listing''s page), measure (a page of a measurement walk).';
COMMENT ON COLUMN crawl_run.counts IS
  'What the run did, written once when it closes: rows read, new listings, snapshots stored or unchanged, price events, and so on, by kind. Its requests and their outcomes are in fetch_log.';
COMMENT ON COLUMN crawl_run.status IS
  'running until its job ends; succeeded or failed then; stopped_on_block when its request was refused (a 401 or 403, a challenge page or empty answer, or a second 429 within 24 hours) and the source stopped with it (ADR-0008 point 6, ADR-0018).';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

COMMENT ON TABLE crawl_run IS 'One crawl of one source, citing the policy check it ran under (ADR-0008 point 1).';
COMMENT ON COLUMN crawl_run.status IS
  'running until finished; stopped_on_block when a 403, 429 or challenge stopped it (ADR-0008 point 6).';
ALTER TABLE crawl_run DROP COLUMN counts, DROP COLUMN kind;
