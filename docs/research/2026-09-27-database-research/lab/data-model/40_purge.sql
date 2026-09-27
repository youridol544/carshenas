-- 40_purge.sql: Bama asks us to remove one ad (ADR-0008 point 8). One call deletes everything derived from it,
-- queues its stored photo for deletion from object storage, and keeps the request itself as the record.
\set ON_ERROR_STOP on
\pset pager off
SET TIME ZONE 'UTC';
CREATE TEMP VIEW counts AS
SELECT 'listing' AS tbl, count(*) AS n FROM listing
UNION ALL SELECT 'snapshot', count(*) FROM snapshot
UNION ALL SELECT 'fetch_log (rows kept, links nulled)', count(*) FROM fetch_log
UNION ALL SELECT 'fetch_log rows still pointing at a listing', count(*) FROM fetch_log WHERE listing_id IS NOT NULL
UNION ALL SELECT 'extraction', count(*) FROM extraction
UNION ALL SELECT 'listing_price_event', count(*) FROM listing_price_event
UNION ALL SELECT 'photo', count(*) FROM photo
UNION ALL SELECT 'listing_pair', count(*) FROM listing_pair
UNION ALL SELECT 'vehicle_membership', count(*) FROM vehicle_membership
UNION ALL SELECT 'listing_valuation', count(*) FROM listing_valuation
UNION ALL SELECT 'listing_valuation_comparable', count(*) FROM listing_valuation_comparable
UNION ALL SELECT 'alert', count(*) FROM alert
UNION ALL SELECT 'storage_deletion_outbox', count(*) FROM storage_deletion_outbox;
CREATE TEMP TABLE before_purge AS SELECT * FROM counts;

INSERT INTO removal_request (source_id, scope, source_listing_key, received_at, requested_by)
VALUES ('bama', 'listing', 'lab-0001', '2026-09-28 10:00+00', 'bama support (lab)')
RETURNING id AS rr \gset
SELECT purge_listings(:rr) AS listings_deleted;
SELECT rebuild_search_documents() AS search_documents_rebuilt;

SELECT b.tbl, b.n AS before, c.n AS after FROM before_purge b JOIN counts c USING (tbl) ORDER BY b.tbl;
\echo '== the stored photo waits in the outbox for the storage worker'
SELECT object_key, reason, done_at FROM storage_deletion_outbox;
\echo '== the request is kept as the record (no personal data)'
SELECT id, source_id, scope, source_listing_key, status, listings_deleted FROM removal_request;
\echo '== the car is still in search through its Karnameh listing'
SELECT vehicle_id, representative_listing_id, source_ids, asking_price_toman, deal_rating FROM search_document ORDER BY vehicle_id;
