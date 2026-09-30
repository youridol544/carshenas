-- migrate:up
-- Two lifecycle signals on a listing (CS-35; ADR-0017 point 3; docs/design/data-model.md, layer 1b). expires_at is
-- the source's own end date for the listing (Divar's seo.unavailable_after): past it, the listing is marked expired
-- without a request. last_checked_at is the latest time the listing's own page was read, as against last_seen_at,
-- the latest sighting in a list; a buyer's re-check is skipped while it is younger than the freshness window. Both
-- are nullable: a listing seen only in lists has neither.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN last_checked_at timestamptz;

COMMENT ON COLUMN listing.expires_at IS
  'The source''s own end date for this listing (Divar: seo.unavailable_after, Tehran time), read from its page; past it the listing is marked expired without a request (ADR-0017 point 3). NULL when the source gives none or the page was never read.';
COMMENT ON COLUMN listing.last_checked_at IS
  'When the listing''s own page was last read (a detail, check or recheck run), as against last_seen_at, its latest sighting in a list. A buyer''s re-check is skipped while this is younger than the freshness window (six hours, ADR-0017 point 3).';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing DROP COLUMN last_checked_at, DROP COLUMN expires_at;
