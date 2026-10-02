-- migrate:up transaction:false
-- The listing page (CS-64) reads one listing's accepted facts through listing_fact_evidence on every view: its first step
-- is the listing's extractions, and extraction had no index starting with listing_id (the composite foreign key to
-- snapshot starts with snapshot_id), so the read scanned the whole table: 0.3 ms at 2,000 rows, growing with every
-- extraction (one per listing and prompt version). With the index it is a few index pages at any size.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY extraction_listing_idx ON extraction (listing_id, snapshot_id);


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS extraction_listing_idx;
