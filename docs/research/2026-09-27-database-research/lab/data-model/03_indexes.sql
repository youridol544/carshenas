-- 03_indexes.sql: query-serving indexes. PROVISIONAL until measured with EXPLAIN (ANALYZE, BUFFERS) on realistic volume.
-- Constraint-backed indexes (PK, UNIQUE, EXCLUDE) are declared with their tables and are not repeated here.
BEGIN;
-- listing: group members (listing page «همین خودرو در …», search rebuild)
CREATE INDEX listing_vehicle_idx ON listing (vehicle_id) WHERE vehicle_id IS NOT NULL;
-- comparables for valuation: same trim and year, a real asking price, current or recently delisted
CREATE INDEX listing_comparables_idx ON listing (trim_id, model_year_sh)
  INCLUDE (asking_price_toman, mileage_km, city_id, body_condition, listed_at, delisted_at)
  WHERE price_type = 'asking';
-- duplicate candidates (blocking, CS-11 #1): same trim, year and city, mileage range scan
CREATE INDEX listing_dedupe_block_idx ON listing (trim_id, model_year_sh, city_id, mileage_km) WHERE status = 'active';
-- saved-search matcher: listings new since the watermark
CREATE INDEX listing_listed_at_idx ON listing (listed_at) WHERE status = 'active';
-- fetch log: per run, per listing (last seen), per snapshot (FK SET NULL on purge), and time ranges on an append-only table
CREATE INDEX fetch_log_run_idx ON fetch_log (crawl_run_id) WHERE crawl_run_id IS NOT NULL;
CREATE INDEX fetch_log_listing_time_idx ON fetch_log (listing_id, requested_at DESC) WHERE listing_id IS NOT NULL;
CREATE INDEX fetch_log_snapshot_idx ON fetch_log (snapshot_id) WHERE snapshot_id IS NOT NULL;
CREATE INDEX fetch_log_requested_brin ON fetch_log USING brin (requested_at);
-- price drops since the watermark (alerts); history itself is served by UNIQUE (listing_id, observed_at)
CREATE INDEX price_event_drops_idx ON listing_price_event (observed_at) WHERE asking_price_toman < previous_price_toman;
CREATE INDEX price_event_snapshot_idx ON listing_price_event (snapshot_id);
-- extraction and review queue
CREATE INDEX extraction_snapshot_idx ON extraction (snapshot_id);
CREATE INDEX extraction_field_review_idx ON extraction_field (field) WHERE status = 'needs_review';
CREATE INDEX review_item_open_idx ON review_item (kind, created_at) WHERE status = 'open';
-- catalogue matching: exact alias lookups, then fuzzy candidates
CREATE INDEX catalogue_alias_norm_idx ON catalogue_alias (alias_norm) WHERE status = 'curated';
CREATE INDEX catalogue_alias_trgm_idx ON catalogue_alias USING gin (alias_norm gin_trgm_ops);
-- duplicate evidence
CREATE INDEX listing_contact_hash_phone_idx ON listing_contact_hash (phone_hmac);
CREATE INDEX photo_phash_idx ON photo (phash) WHERE phash IS NOT NULL;
CREATE INDEX listing_pair_b_idx ON listing_pair (listing_b_id);
CREATE INDEX pair_decision_pair_idx ON pair_decision (listing_pair_id, decided_at DESC);
CREATE INDEX vehicle_membership_vehicle_idx ON vehicle_membership (vehicle_id);
-- valuations: latest per listing, segment trend (model page), comparables by the other side (purge cascade)
CREATE INDEX listing_valuation_listing_idx ON listing_valuation (listing_id, valuation_run_id DESC);
CREATE INDEX segment_valuation_trend_idx ON segment_valuation (trim_id, model_year_sh, as_of_date);
CREATE INDEX lv_comparable_listing_idx ON listing_valuation_comparable (comparable_listing_id);
-- search projection: best deal first, optionally within a model or a city; price sort within a model
CREATE INDEX search_doc_deal_idx ON search_document (deal_sort_key ASC NULLS LAST, vehicle_id);
CREATE INDEX search_doc_model_deal_idx ON search_document (model_id, deal_sort_key ASC NULLS LAST, vehicle_id);
CREATE INDEX search_doc_city_deal_idx ON search_document (city_id, deal_sort_key ASC NULLS LAST, vehicle_id);
CREATE INDEX search_doc_model_price_idx ON search_document (model_id, asking_price_toman);
CREATE INDEX search_doc_text_trgm_idx ON search_document USING gin (search_text gin_trgm_ops);
-- alerts: active saved searches by model, the sender's queue, and FK lookups used by purge cascades
CREATE INDEX saved_search_active_model_idx ON saved_search (model_id) WHERE status = 'active';
CREATE INDEX alert_outbox_idx ON alert (created_at) WHERE status IN ('pending', 'sending');
CREATE INDEX alert_listing_idx ON alert (listing_id);
CREATE INDEX alert_price_event_idx ON alert (price_event_id) WHERE price_event_id IS NOT NULL;
COMMIT;
