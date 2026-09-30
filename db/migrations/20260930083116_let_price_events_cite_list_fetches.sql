-- migrate:up
-- A price change seen in a list row is a price event of its own (CS-35 criterion 3; the owner's decision of
-- 2026-09-30). Until now every event cited the snapshot of the listing's page that showed the price. A sweep reads only
-- list pages, and untracked models get no detail request, so an event may now cite instead the list page's request in
-- fetch_log that showed the new price. Exactly one of the two is its evidence. The foreign key and the check are added
-- NOT VALID (listing_price_event has rows where lanes have crawled); a later migration validates them, and another
-- builds the foreign key's index concurrently.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Dropping NOT NULL is the point: a list-row event has no snapshot. Readers that assumed one are the worker's own
-- (knownListings, recordPriceChange), updated with this migration; one_evidence keeps every event evidenced.
ALTER TABLE listing_price_event
  -- squawk-ignore ban-drop-not-null
  ALTER COLUMN snapshot_id DROP NOT NULL,
  ADD COLUMN fetch_log_id bigint;

ALTER TABLE listing_price_event
  ADD CONSTRAINT listing_price_event_fetch_log_fk
    FOREIGN KEY (fetch_log_id) REFERENCES fetch_log (id) ON DELETE CASCADE NOT VALID,
  ADD CONSTRAINT listing_price_event_one_evidence
    CHECK (num_nonnulls(snapshot_id, fetch_log_id) = 1) NOT VALID;

COMMENT ON TABLE listing_price_event IS
  'Append-only price history of a listing in valid time (ADR-0014): one row per change of what it asks, read from a snapshot of its page or from its row on a list page.';
COMMENT ON COLUMN listing_price_event.snapshot_id IS
  'The snapshot of the listing''s page that showed this price; NULL when the evidence is a list row (fetch_log_id).';
COMMENT ON COLUMN listing_price_event.fetch_log_id IS
  'The list page''s request that showed this price in the listing''s row (a sweep or discovery page); NULL when the evidence is a snapshot. Exactly one of the two is set.';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Events whose evidence is a list row cannot go back to requiring a snapshot; only a purge removes observations.
SET LOCAL carshenas.purge = 'on';
DELETE FROM listing_price_event WHERE snapshot_id IS NULL;
ALTER TABLE listing_price_event
  DROP CONSTRAINT listing_price_event_one_evidence,
  DROP CONSTRAINT listing_price_event_fetch_log_fk,
  DROP COLUMN fetch_log_id,
  ALTER COLUMN snapshot_id SET NOT NULL;
COMMENT ON COLUMN listing_price_event.snapshot_id IS 'The snapshot the price was read from: the evidence.';
COMMENT ON TABLE listing_price_event IS
  'Append-only price history of a listing in valid time (ADR-0014): one row per change of what it asks, read from a snapshot of it.';
