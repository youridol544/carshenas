-- 11_queries_crawled.sql: read the story back the way the pages will.
\pset pager off
SET TIME ZONE 'UTC';

\echo '== fetch log: three Bama visits, two snapshots (the third visit is a revisit of snapshot 2)'
SELECT f.id AS fetch_id, f.source_id, f.requested_at, f.outcome, f.snapshot_id, s.first_fetched_at AS snapshot_first_seen,
       left(encode(s.content_sha256, 'hex'), 12) AS sha256_prefix
FROM fetch_log f JOIN snapshot s ON s.id = f.snapshot_id
ORDER BY f.requested_at;

\echo '== price history of the Bama listing (valid time: from observed_at until the next event)'
SELECT e.observed_at AS valid_from,
       lead(e.observed_at) OVER (ORDER BY e.observed_at) AS valid_to,
       e.price_type, e.asking_price_toman, e.previous_price_toman,
       e.asking_price_toman - e.previous_price_toman AS change_toman
FROM listing_price_event e JOIN listing l ON l.id = e.listing_id
WHERE l.source_listing_key = 'lab-0001'
ORDER BY e.observed_at;

\echo '== listing page: «همین خودرو در منابع دیگر», cheapest first, with days on market of the listing and of the car'
SELECT l.source_id, l.asking_price_toman, v.deal_rating, v.price_gap_pct, v.as_of_date AS valued_on,
       (date '2026-09-27' - (l.listed_at AT TIME ZONE 'Asia/Tehran')::date) AS days_on_market_listing,
       (date '2026-09-27' - (min(l.listed_at) OVER () AT TIME ZONE 'Asia/Tehran')::date) AS days_on_market_car
FROM listing l
LEFT JOIN listing_latest_valuation v ON v.listing_id = l.id
WHERE l.vehicle_id = (SELECT vehicle_id FROM listing WHERE source_listing_key = 'lab-0001') AND l.status = 'active'
ORDER BY l.asking_price_toman;

\echo '== membership history: the Karnameh listing moved from vehicle 2 to vehicle 1 on merge; vehicle 2 is a tombstone'
SELECT m.listing_id, l.source_id, m.vehicle_id, m.valid, m.cause, vh.status AS vehicle_status, vh.merged_into_vehicle_id
FROM vehicle_membership m JOIN listing l ON l.id = m.listing_id JOIN vehicle vh ON vh.id = m.vehicle_id
WHERE l.source_listing_key IN ('lab-0001', 'lab-k-77')
ORDER BY m.listing_id, lower(m.valid);

\echo '== match evidence: every verdict kept; the current one comes from the view'
SELECT d.decided_at, d.decided_by, d.decider_version, d.decision, d.score, left(d.reason, 60) AS reason
FROM pair_decision d ORDER BY d.decided_at;
SELECT listing_pair_id, decision, decided_by FROM pair_current_decision;

\echo '== comparables behind the Bama listing''s market value'
SELECT c.comparable_listing_id, cl.source_listing_key, c.comparable_price_toman, c.adjusted_price_toman, c.weight
FROM listing_valuation_comparable c JOIN listing cl ON cl.id = c.comparable_listing_id
WHERE c.listing_id = (SELECT id FROM listing WHERE source_listing_key = 'lab-0001')
ORDER BY c.adjusted_price_toman;

\echo '== search projection: one row per car, cheapest listing first, sources listed'
SELECT vehicle_id, representative_listing_id, asking_price_toman, deal_rating, price_gap_pct, source_ids, listing_count,
       listed_at, has_photo
FROM search_document ORDER BY deal_sort_key NULLS LAST, vehicle_id;

\echo '== alerts created by the matcher (a second run inserts nothing)'
SELECT a.kind, a.vehicle_id, a.listing_id, a.price_event_id, a.status FROM alert a ORDER BY a.id;
INSERT INTO alert (saved_search_id, kind, vehicle_id, listing_id)
SELECT s.id, 'new_deal', d.vehicle_id, d.representative_listing_id
FROM saved_search s JOIN search_document d ON d.model_id = s.model_id AND d.deal_rating <= s.min_deal_rating
WHERE s.status = 'active'
ON CONFLICT (saved_search_id, vehicle_id) WHERE kind = 'new_deal' DO NOTHING;

\echo '== extraction fields below their threshold wait in the review queue'
SELECT r.kind, r.field, f.confidence, f.threshold, f.status, r.status AS review_status
FROM review_item r JOIN extraction_field f USING (extraction_id, field);

\echo '== sources and their crawl state'
SELECT s.id, s.origin, s.access_method, s.crawl_state, s.listing_visibility, p.verdict, p.photos_allowed, p.checked_at
FROM source s LEFT JOIN source_current_policy p ON p.source_id = s.id ORDER BY s.id;
