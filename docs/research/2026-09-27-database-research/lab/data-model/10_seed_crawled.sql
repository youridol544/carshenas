-- 10_seed_crawled.sql: illustrative Carshenas rows (not market data, not real ads).
-- Story: a Peugeot 206 T2 (1400) is crawled on Bama twice with a price drop, re-fetched unchanged (a revisit),
-- found again on Karnameh, matched as the same car, valued, explained, alerted and projected for search.
\set ON_ERROR_STOP on
\pset pager off
SET TIME ZONE 'UTC';

-- ---------------------------------------------------------------- curated reference data
INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, min_request_interval_ms) VALUES
  ('bama',            'external',  'crawl',        'باما',         'https://bama.ir',              'public',         5000),
  ('karnameh',        'external',  'crawl',        'کارنامه',      'https://karnameh.com',         'public',         5000),
  ('khodro45',        'external',  'crawl',        'خودرو۴۵',      'https://khodro45.com',         'public',         5000),
  ('sheypoor',        'external',  'crawl',        'شیپور',        'https://www.sheypoor.com',     'public',         5000),
  ('divar',           'external',  'official_api', 'دیوار',        'https://divar.ir',             'requester_only', NULL),
  ('hamrah_mechanic', 'benchmark', 'crawl',        'همراه مکانیک', 'https://www.hamrah-mechanic.com', 'public',      5000);

INSERT INTO source_policy_check (source_id, checked_at, checked_by, terms_url, terms_summary, verdict, conditions, photos_allowed) VALUES
  ('bama', '2026-09-26 08:00+00', 'pedrum', 'https://bama.ir/terms', 'LAB PLACEHOLDER: robots.txt allows car pages', 'allowed', NULL, true),
  ('karnameh', '2026-09-26 08:10+00', 'pedrum', 'https://karnameh.com/terms', 'LAB PLACEHOLDER', 'allowed_with_conditions',
   'robots.txt disallows /pictures/car-posts: no photo downloads', false),
  ('sheypoor', '2026-07-01 08:00+00', 'pedrum', 'https://www.sheypoor.com/terms', 'LAB PLACEHOLDER (stale on purpose)', 'allowed_with_conditions',
   'category paths with page_num only', false),
  ('divar', '2026-09-26 08:20+00', 'pedrum', 'https://divar.ir/__contact_terms/', 'terms forbid copying ads; Kenar API only', 'not_allowed', NULL, false);
SELECT id AS bama_policy FROM source_current_policy WHERE source_id = 'bama' \gset
SELECT id AS karnameh_policy FROM source_current_policy WHERE source_id = 'karnameh' \gset

UPDATE source SET crawl_state = 'enabled' WHERE id IN ('bama', 'karnameh', 'sheypoor');

INSERT INTO body_type (code, label_fa) VALUES ('hatchback', 'هاچ‌بک'), ('sedan', 'سدان');
INSERT INTO colour (code, label_fa) VALUES ('white', 'سفید'), ('black', 'مشکی'), ('silver', 'نقره‌ای');
INSERT INTO condition_kind (code, label_fa, severity, needs_panel) VALUES
  ('paint_free', 'بدون رنگ', 0, false), ('paint_spot', 'لکه رنگ', 1, false), ('repainted_panel', 'رنگ‌شدگی قطعه', 2, true),
  ('repainted_around', 'دور رنگ', 4, false), ('replaced_panel', 'تعویض قطعه', 3, true), ('chassis_intact', 'شاسی سالم', 0, false);
INSERT INTO extraction_field_def (code, min_confidence, description) VALUES
  ('trim', 0.900, 'make, model and trim as written'), ('model_year', 0.950, 'model year and its calendar'),
  ('mileage_km', 0.950, 'odometer in km'), ('price', 0.970, 'asking price and price type'),
  ('body_condition', 0.850, 'paint and replaced panels'), ('city', 0.900, 'city and district'),
  ('fuel', 0.900, 'fuel'), ('gearbox', 0.900, 'gearbox'), ('insurance_months_left', 0.800, 'third-party insurance left');

INSERT INTO province (slug, name_fa) VALUES ('tehran', 'تهران') RETURNING id AS tehran_province \gset
INSERT INTO city (province_id, slug, name_fa) VALUES (:tehran_province, 'tehran', 'تهران') RETURNING id AS tehran \gset
INSERT INTO city_alias (city_id, alias) VALUES (:tehran, 'تهران'), (:tehran, 'Tehran');

INSERT INTO make (slug, name_fa, name_en) VALUES ('peugeot', 'پژو', 'Peugeot') RETURNING id AS peugeot \gset
INSERT INTO make (slug, name_fa, name_en) VALUES ('ikco', 'ایران خودرو', 'Iran Khodro') RETURNING id AS ikco \gset
INSERT INTO model (make_id, slug, name_fa, name_en) VALUES (:peugeot, '206', '۲۰۶', '206') RETURNING id AS m206 \gset
INSERT INTO model (make_id, slug, name_fa, name_en) VALUES (:ikco, 'dena', 'دنا', 'Dena') RETURNING id AS mdena \gset
INSERT INTO trim (model_id, slug, name_fa, name_en, body_type, first_year_sh, last_year_sh)
VALUES (:m206, 't2', 'تیپ ۲', 'Type 2', 'hatchback', 1381, 1403) RETURNING id AS t206t2 \gset
INSERT INTO trim (model_id, slug, name_fa, name_en, body_type) VALUES (:m206, 't5', 'تیپ ۵', 'Type 5', 'hatchback') RETURNING id AS t206t5 \gset
INSERT INTO trim (model_id, slug, name_fa, name_en, body_type) VALUES (:mdena, 'plus', 'پلاس', 'Plus', 'sedan') RETURNING id AS tdenaplus \gset
INSERT INTO catalogue_alias (alias, script, make_id) VALUES ('پژو', 'fa', :peugeot), ('peugeot', 'latin', :peugeot);
INSERT INTO catalogue_alias (alias, script, model_id) VALUES ('۲۰۶', 'fa', :m206), ('دویست و شش', 'spelled_number', :m206), ('دنا', 'fa', :mdena);
INSERT INTO catalogue_alias (alias, script, trim_id) VALUES
  ('تیپ ۲', 'fa', :t206t2), ('تيپ دو', 'fa', :t206t2), ('T2', 'latin', :t206t2), ('تیپ ۵', 'fa', :t206t5), ('پلاس', 'fa', :tdenaplus);

-- ---------------------------------------------------------------- Bama, 2026-09-25: first sight
INSERT INTO crawl_run (source_id, policy_check_id, started_at) VALUES ('bama', :bama_policy, '2026-09-25 06:00+00') RETURNING id AS run1 \gset
INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
VALUES ('bama', 'lab-0001', 'https://bama.ir/car/lab-0001', 'active', '2026-09-25 06:00:05+00', '2026-09-25 06:00:05+00')
ON CONFLICT (source_id, source_listing_key) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
RETURNING id AS l1 \gset
INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload, photo_urls)
VALUES (:l1, '2026-09-25 06:00:05+00', 'https://bama.ir/car/lab-0001', 1,
  '{"code": "lab-0001", "title": "پژو ۲۰۶ تیپ ۲ مدل ۱۴۰۰", "price": 845000000, "price_label": "۸۴۵٬۰۰۰٬۰۰۰ تومان",
    "mileage": "۶۲٬۰۰۰", "year": "۱۴۰۰", "city": "تهران", "district": "پونک", "color": "سفید", "gearbox": "دنده‌ای",
    "fuel": "بنزینی", "body": "بدون رنگ، شاسی سالم", "insurance": "۸ ماه", "seller": "private",
    "description": "بدون رنگ، فنی سالم، بیمه ۸ ماه. تماس: [phone removed]"}',
  ARRAY['https://bama.ir/lab/photos/lab-0001-1.jpg'])
ON CONFLICT (listing_id, content_sha256) DO NOTHING
RETURNING id AS s1 \gset
INSERT INTO fetch_log (source_id, crawl_run_id, url, requested_at, http_status, outcome, duration_ms, listing_id, snapshot_id)
VALUES ('bama', :run1, 'https://bama.ir/car/lab-0001', '2026-09-25 06:00:05+00', 200, 'ok', 812, :l1, :s1);

-- extraction (a recorded LLM response): accepted fields only reach the listing
INSERT INTO extraction (snapshot_id, input_sha256, prompt_version, model, status, output, input_tokens, output_tokens, cost_usd_micros)
SELECT :s1, sha256(convert_to('extract-v1|' || payload::text, 'UTF8')), 'extract-v1', 'lab-model', 'accepted',
       '{"trim": "peugeot/206/t2", "model_year_sh": 1400, "mileage_km": 62000, "price_type": "asking", "asking_price_toman": 845000000}',
       1850, 240, 410
FROM snapshot WHERE id = :s1
RETURNING id AS e1 \gset
INSERT INTO extraction_field (extraction_id, field, value, confidence, threshold, evidence, status) VALUES
  (:e1, 'trim', '"peugeot/206/t2"', 0.990, 0.900, 'پژو ۲۰۶ تیپ ۲ مدل ۱۴۰۰', 'accepted'),
  (:e1, 'model_year', '{"sh": 1400}', 0.980, 0.950, 'مدل ۱۴۰۰', 'accepted'),
  (:e1, 'mileage_km', '62000', 0.990, 0.950, '۶۲٬۰۰۰', 'accepted'),
  (:e1, 'price', '{"type": "asking", "toman": 845000000}', 0.995, 0.970, '۸۴۵٬۰۰۰٬۰۰۰ تومان', 'accepted'),
  (:e1, 'body_condition', '"paint_free"', 0.930, 0.850, 'بدون رنگ، شاسی سالم', 'accepted'),
  (:e1, 'insurance_months_left', '8', 0.700, 0.800, 'بیمه ۸ ماه', 'needs_review');
INSERT INTO review_item (kind, extraction_id, field) VALUES ('extraction_field', :e1, 'insurance_months_left');

UPDATE listing SET
  make_id = :peugeot, model_id = :m206, trim_id = :t206t2, catalogue_match = 'trim',
  model_year_sh = 1400, model_year_written = 'sh', mileage_km = 62000, fuel = 'petrol', gearbox = 'manual',
  body_condition = 'paint_free', exterior_colour = 'white', price_type = 'asking', asking_price_toman = 845000000,
  city_id = :tehran, district_text = 'پونک', seller_type = 'private',
  title = 'پژو ۲۰۶ تیپ ۲ مدل ۱۴۰۰', description_redacted = 'بدون رنگ، فنی سالم، بیمه ۸ ماه. تماس: [phone removed]',
  latest_snapshot_id = :s1, extraction_id = :e1, review_pending = true, attributes_updated_at = '2026-09-25 06:05+00'
WHERE id = :l1;
INSERT INTO listing_condition (listing_id, kind, evidence, extraction_id) VALUES
  (:l1, 'paint_free', 'بدون رنگ، شاسی سالم', :e1), (:l1, 'chassis_intact', 'بدون رنگ، شاسی سالم', :e1);
INSERT INTO listing_contact_hash (listing_id, phone_hmac, key_version)
VALUES (:l1, hmac('+989120000000', 'lab-only-key', 'sha256'), 1);
INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, snapshot_id)
VALUES (:l1, '2026-09-25 06:00:05+00', 'asking', 845000000, :s1);

-- the photo showed a plate: the stored copy is masked (ADR-0010)
INSERT INTO photo (listing_id, position, source_url, fetched_at, original_sha256, pii_status, pii_detector_version,
                   stored_object_key, stored_sha256, width, height, phash)
VALUES (:l1, 0, 'https://bama.ir/lab/photos/lab-0001-1.jpg', '2026-09-25 06:00:09+00', sha256('original bytes'), 'masked',
        'pii-detect-v1', 'bama/lab-0001/0-masked.webp', sha256('masked bytes'), 1200, 900, 1234567890123)
RETURNING id AS p1 \gset
INSERT INTO photo_embedding (photo_id, model, embedding) VALUES (:p1, 'lab-image-model', array_fill(0.01, ARRAY[768])::vector);
UPDATE crawl_run SET status = 'succeeded', finished_at = '2026-09-25 06:02+00', pages_fetched = 1, snapshots_new = 1 WHERE id = :run1;

-- entity resolution, first pass: the Bama listing is its own vehicle
INSERT INTO vehicle (created_at) VALUES ('2026-09-25 07:00+00') RETURNING id AS v1 \gset
UPDATE listing SET vehicle_id = :v1 WHERE id = :l1;
INSERT INTO vehicle_membership (listing_id, vehicle_id, valid, cause) VALUES (:l1, :v1, tstzrange('2026-09-25 07:00+00', NULL), 'first_resolution');

-- ---------------------------------------------------------------- Bama, 2026-09-26: the price drops (new content, new snapshot)
INSERT INTO crawl_run (source_id, policy_check_id, started_at) VALUES ('bama', :bama_policy, '2026-09-26 06:00+00') RETURNING id AS run2 \gset
INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
VALUES ('bama', 'lab-0001', 'https://bama.ir/car/lab-0001', 'active', '2026-09-26 06:00:04+00', '2026-09-26 06:00:04+00')
ON CONFLICT (source_id, source_listing_key) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
RETURNING id AS l1_again \gset
INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload, photo_urls)
VALUES (:l1, '2026-09-26 06:00:04+00', 'https://bama.ir/car/lab-0001', 1,
  '{"code": "lab-0001", "title": "پژو ۲۰۶ تیپ ۲ مدل ۱۴۰۰", "price": 815000000, "price_label": "۸۱۵٬۰۰۰٬۰۰۰ تومان",
    "mileage": "۶۲٬۰۰۰", "year": "۱۴۰۰", "city": "تهران", "district": "پونک", "color": "سفید", "gearbox": "دنده‌ای",
    "fuel": "بنزینی", "body": "بدون رنگ، شاسی سالم", "insurance": "۸ ماه", "seller": "private",
    "description": "بدون رنگ، فنی سالم، بیمه ۸ ماه. تماس: [phone removed]"}',
  ARRAY['https://bama.ir/lab/photos/lab-0001-1.jpg'])
ON CONFLICT (listing_id, content_sha256) DO NOTHING
RETURNING id AS s2 \gset
INSERT INTO fetch_log (source_id, crawl_run_id, url, requested_at, http_status, outcome, duration_ms, listing_id, snapshot_id)
VALUES ('bama', :run2, 'https://bama.ir/car/lab-0001', '2026-09-26 06:00:04+00', 200, 'ok', 790, :l1, :s2);
INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, snapshot_id)
VALUES (:l1, '2026-09-26 06:00:04+00', 'asking', 815000000, :s2)
RETURNING id AS pe_drop \gset
UPDATE listing SET asking_price_toman = 815000000, latest_snapshot_id = :s2, attributes_updated_at = '2026-09-26 06:05+00' WHERE id = :l1;
UPDATE crawl_run SET status = 'succeeded', finished_at = '2026-09-26 06:02+00', pages_fetched = 1, snapshots_new = 1, price_changes = 1 WHERE id = :run2;

-- ---------------------------------------------------------------- Bama, 2026-09-27: unchanged content is a revisit, not a new snapshot
INSERT INTO crawl_run (source_id, policy_check_id, started_at) VALUES ('bama', :bama_policy, '2026-09-27 06:00+00') RETURNING id AS run3 \gset
INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload, photo_urls)
SELECT listing_id, '2026-09-27 06:00:03+00', url, canonical_version, payload, photo_urls FROM snapshot WHERE id = :s2
ON CONFLICT (listing_id, content_sha256) DO NOTHING;
INSERT INTO fetch_log (source_id, crawl_run_id, url, requested_at, http_status, outcome, duration_ms, listing_id, snapshot_id)
VALUES ('bama', :run3, 'https://bama.ir/car/lab-0001', '2026-09-27 06:00:03+00', 200, 'ok', 640, :l1, :s2);
UPDATE listing SET last_seen_at = '2026-09-27 06:00:03+00' WHERE id = :l1;
UPDATE crawl_run SET status = 'succeeded', finished_at = '2026-09-27 06:01+00', pages_fetched = 1 WHERE id = :run3;

-- ---------------------------------------------------------------- Karnameh, 2026-09-26: the same car, 30 million dearer, no photos allowed
INSERT INTO crawl_run (source_id, policy_check_id, started_at) VALUES ('karnameh', :karnameh_policy, '2026-09-26 07:00+00') RETURNING id AS krun \gset
INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at)
VALUES ('karnameh', 'lab-k-77', 'https://karnameh.com/car/lab-k-77', 'active', '2026-09-26 07:00:06+00', '2026-09-26 07:00:06+00')
RETURNING id AS l2 \gset
INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload, photo_urls)
VALUES (:l2, '2026-09-26 07:00:06+00', 'https://karnameh.com/car/lab-k-77', 1,
  '{"id": "lab-k-77", "name": "پژو 206 تیپ 2", "year": 1400, "km": 62500, "price": 845000000, "city": "تهران - پونک",
    "color": "سفید", "body_status": "بی رنگ", "description": "خودرو بی‌رنگ و بدون تصادف [phone removed]"}',
  ARRAY['https://karnameh.com/pictures/car-posts/lab-k-77-1.jpg'])
RETURNING id AS k1 \gset
INSERT INTO fetch_log (source_id, crawl_run_id, url, requested_at, http_status, outcome, duration_ms, listing_id, snapshot_id)
VALUES ('karnameh', :krun, 'https://karnameh.com/car/lab-k-77', '2026-09-26 07:00:06+00', 200, 'ok', 1100, :l2, :k1);
UPDATE listing SET
  make_id = :peugeot, model_id = :m206, trim_id = :t206t2, catalogue_match = 'trim', model_year_sh = 1400, model_year_written = 'sh',
  mileage_km = 62500, fuel = 'petrol', body_condition = 'paint_free', exterior_colour = 'white',
  price_type = 'asking', asking_price_toman = 845000000, city_id = :tehran, district_text = 'پونک', title = 'پژو 206 تیپ 2',
  description_redacted = 'خودرو بی‌رنگ و بدون تصادف [phone removed]', latest_snapshot_id = :k1, attributes_updated_at = '2026-09-26 07:05+00'
WHERE id = :l2;
INSERT INTO listing_contact_hash (listing_id, phone_hmac, key_version)
VALUES (:l2, hmac('+989120000000', 'lab-only-key', 'sha256'), 1);
INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, snapshot_id)
VALUES (:l2, '2026-09-26 07:00:06+00', 'asking', 845000000, :k1);
UPDATE crawl_run SET status = 'succeeded', finished_at = '2026-09-26 07:01+00', pages_fetched = 1, snapshots_new = 1 WHERE id = :krun;

INSERT INTO vehicle (created_at) VALUES ('2026-09-26 07:30+00') RETURNING id AS v2 \gset
UPDATE listing SET vehicle_id = :v2 WHERE id = :l2;
INSERT INTO vehicle_membership (listing_id, vehicle_id, valid, cause) VALUES (:l2, :v2, tstzrange('2026-09-26 07:30+00', NULL), 'first_resolution');

-- ---------------------------------------------------------------- duplicate detection: evidence, decisions, merge
INSERT INTO listing_pair (listing_a_id, listing_b_id, blocking_key, text_similarity, photo_similarity, phone_match)
VALUES (least(:l1, :l2), greatest(:l1, :l2), format('trim:%s|y:1400|city:%s|km:60-65k', :t206t2, :tehran), 0.81, NULL, true)
RETURNING id AS pair12 \gset
INSERT INTO pair_decision (listing_pair_id, decision, decided_by, decider_version, score, reason, decided_at) VALUES
  (:pair12, 'uncertain', 'model', 'dedupe-score-v1', 0.71, NULL, '2026-09-26 07:40+00'),
  (:pair12, 'match', 'llm', 'dedupe-llm-v1', 0.93,
   'Same white 206 T2 of 1400 in Punak, 62,000 vs 62,500 km, both paint-free, same phone hash; Karnameh photos not compared (not allowed).',
   '2026-09-26 07:45+00');
-- merge vehicle 2 into vehicle 1 without losing history
BEGIN;
UPDATE vehicle_membership SET valid = tstzrange(lower(valid), '2026-09-26 08:00+00') WHERE listing_id = :l2 AND upper_inf(valid);
INSERT INTO vehicle_membership (listing_id, vehicle_id, valid, cause) VALUES (:l2, :v1, tstzrange('2026-09-26 08:00+00', NULL), 'merge');
UPDATE listing SET vehicle_id = :v1 WHERE id = :l2;
UPDATE vehicle SET status = 'merged', merged_into_vehicle_id = :v1, merged_at = '2026-09-26 08:00+00' WHERE id = :v2;
COMMIT;

-- ---------------------------------------------------------------- comparables (three other Bama listings, attributes set directly for the lab)
INSERT INTO listing (source_id, source_listing_key, url, status, listed_at, last_seen_at, make_id, model_id, trim_id, catalogue_match,
                     model_year_sh, model_year_written, mileage_km, price_type, asking_price_toman, city_id, body_condition)
SELECT 'bama', 'lab-c' || g, 'https://bama.ir/car/lab-c' || g, 'active', timestamptz '2026-09-20 09:00+00' + g * interval '1 day',
       timestamptz '2026-09-27 06:00+00', :peugeot, :m206, :t206t2, 'trim', 1400, 'sh', 50000 + g * 9000, 'asking',
       (ARRAY[850000000, 862000000, 875000000])[g], :tehran, 'paint_free'
FROM generate_series(1, 3) AS g;
INSERT INTO vehicle (created_at) SELECT '2026-09-25 07:00+00' FROM generate_series(1, 3);
WITH c AS (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM listing WHERE source_listing_key LIKE 'lab-c%'),
     v AS (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM vehicle WHERE id NOT IN (:v1, :v2))
UPDATE listing l SET vehicle_id = v.id FROM c JOIN v USING (rn) WHERE l.id = c.id;
INSERT INTO vehicle_membership (listing_id, vehicle_id, valid, cause)
SELECT id, vehicle_id, tstzrange('2026-09-25 07:00+00', NULL), 'first_resolution' FROM listing WHERE source_listing_key LIKE 'lab-c%';

-- ---------------------------------------------------------------- daily valuation for 2026-09-27 (numbers are illustrative)
INSERT INTO valuation_run (as_of_date, method_version, started_at, params)
VALUES ('2026-09-27', 'imv-lab-v1', '2026-09-27 00:30+00', '{"min_comparables": 3, "years": "±0", "window_days": 60}')
RETURNING id AS vr \gset
INSERT INTO segment_valuation (valuation_run_id, as_of_date, trim_id, model_year_sh, province_id, n_comparables,
                               market_value_toman, p25_toman, p75_toman)
VALUES (:vr, '2026-09-27', :t206t2, 1400, :tehran_province, 4, 860000000, 845000000, 868000000);
INSERT INTO listing_valuation (valuation_run_id, listing_id, asking_price_toman, market_value_toman, range_low_toman,
                               range_high_toman, price_gap_pct, deal_rating, n_comparables) VALUES
  (:vr, :l1, 815000000, 860000000, 835000000, 885000000, round((815000000 - 860000000) * 100.0 / 860000000, 2), 'good', 3),
  (:vr, :l2, 845000000, 860000000, 835000000, 885000000, round((845000000 - 860000000) * 100.0 / 860000000, 2), 'fair', 3);
INSERT INTO listing_valuation_comparable (valuation_run_id, listing_id, comparable_listing_id, comparable_price_toman, adjusted_price_toman, weight)
SELECT :vr, x.listing_id, c.id, c.asking_price_toman, c.asking_price_toman - (62000 - c.mileage_km) * 500, 0.33333
FROM listing c CROSS JOIN (VALUES (:l1), (:l2)) AS x (listing_id)
WHERE c.source_listing_key LIKE 'lab-c%';
UPDATE valuation_run SET status = 'succeeded', finished_at = '2026-09-27 00:34+00', metrics = '{"mdape_holdout": null}' WHERE id = :vr;

INSERT INTO deal_explanation (valuation_run_id, listing_id, prompt_version, model, facts, text_fa, numbers_verified)
VALUES (:vr, :l1, 'explain-v1', 'lab-model',
  '{"asking_price_toman": 815000000, "market_value_toman": 860000000, "price_gap_pct": -5.23, "n_comparables": 3, "as_of_date": "2026-09-27"}',
  'این آگهی ۵٫۲۳٪ زیر ارزش بازار امروز است: ۸۱۵ میلیون تومان در برابر ۸۶۰ میلیون تومان، بر اساس ۳ آگهی مشابه.', true);

-- ---------------------------------------------------------------- a buyer's saved search and its alerts
INSERT INTO telegram_chat (chat_id, linked_at) VALUES (900000000001, '2026-09-24 18:00+00') RETURNING id AS chat \gset
INSERT INTO saved_search (telegram_chat_id, status, manage_token_sha256, filters, make_id, model_id, city_id,
                          max_price_toman, min_deal_rating, matched_through, created_at)
VALUES (:chat, 'active', sha256(gen_random_bytes(32)),
        jsonb_build_object('make', 'peugeot', 'model', '206', 'city', 'tehran', 'max_price_toman', 900000000),
        :peugeot, :m206, :tehran, 900000000, 'good', '2026-09-24 18:00+00', '2026-09-24 18:00+00')
RETURNING id AS ss \gset

SELECT rebuild_search_documents() AS search_documents_built;

-- the matcher (runs after each batch; idempotent thanks to the partial unique indexes)
INSERT INTO alert (saved_search_id, kind, vehicle_id, listing_id)
SELECT s.id, 'new_deal', d.vehicle_id, d.representative_listing_id
FROM saved_search s
JOIN search_document d ON (s.model_id IS NULL OR d.model_id = s.model_id)
                      AND (s.city_id IS NULL OR d.city_id = s.city_id)
                      AND (s.max_price_toman IS NULL OR d.asking_price_toman <= s.max_price_toman)
                      AND d.deal_rating <= s.min_deal_rating          -- enum order: great < good < fair < ...
WHERE s.status = 'active' AND s.notify_new_deals AND d.listed_at > s.matched_through
ON CONFLICT (saved_search_id, vehicle_id) WHERE kind = 'new_deal' DO NOTHING;
INSERT INTO alert (saved_search_id, kind, vehicle_id, listing_id, price_event_id)
SELECT s.id, 'price_drop', l.vehicle_id, l.id, e.id
FROM saved_search s
JOIN listing l ON (s.model_id IS NULL OR l.model_id = s.model_id) AND (s.city_id IS NULL OR l.city_id = s.city_id)
               AND l.status = 'active' AND l.vehicle_id IS NOT NULL
JOIN listing_price_event e ON e.listing_id = l.id AND e.asking_price_toman < e.previous_price_toman
WHERE s.status = 'active' AND s.notify_price_drops AND e.observed_at > s.matched_through
ON CONFLICT (saved_search_id, price_event_id) WHERE kind = 'price_drop' DO NOTHING;

-- ---------------------------------------------------------------- a pasted Divar link while Kenar access is pending (CS-19)
INSERT INTO paste_request (pasted_url, source_id, requested_at, outcome, answered_at)
VALUES ('https://divar.ir/v/lab-token', 'divar', '2026-09-27 09:00:00+00', 'divar_access_pending', '2026-09-27 09:00:00.180+00');
