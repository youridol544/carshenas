-- migrate:up
-- Three more things a crawl run can spend its request on (CS-35; ADR-0017 points 3 and 5): sweep (a list page of the
-- daily or weekly inventory sweep), check (one listing's page read to confirm it left the market after a complete
-- sweep missed it), recheck (one listing's page read because a buyer opened it). The budget report groups requests by
-- these kinds. The widened list is added NOT VALID, because crawl_run has rows where lanes have crawled; the next
-- migration validates it.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE crawl_run DROP CONSTRAINT crawl_run_kind_valid;
ALTER TABLE crawl_run
  ADD CONSTRAINT crawl_run_kind_valid
    CHECK (kind IN ('discovery', 'detail', 'measure', 'sweep', 'check', 'recheck')) NOT VALID;

COMMENT ON COLUMN crawl_run.kind IS
  'What the run spent its request on (ADR-0017 point 5): discovery (a page of the newest listings of tracked models), detail (a new or changed listing''s page), measure (a page of a measurement walk), sweep (a list page of the inventory sweep), check (a listing''s page read to confirm it left the market), recheck (a listing''s page a buyer asked to re-read).';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

COMMENT ON COLUMN crawl_run.kind IS
  'What the run spent its request on (ADR-0017 point 5): discovery (a page of the newest listings of tracked models), detail (one listing''s page), measure (a page of a measurement walk).';
ALTER TABLE crawl_run DROP CONSTRAINT crawl_run_kind_valid;
ALTER TABLE crawl_run
  ADD CONSTRAINT crawl_run_kind_valid CHECK (kind IN ('discovery', 'detail', 'measure')) NOT VALID;
