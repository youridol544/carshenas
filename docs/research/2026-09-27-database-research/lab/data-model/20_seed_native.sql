-- 20_seed_native.sql: native listings after the migration. One goes all the way to the market; one stays a draft.
\set ON_ERROR_STOP on
\pset pager off
SET TIME ZONE 'UTC';

SELECT id AS tehran FROM city WHERE slug = 'tehran' \gset
SELECT id AS ikco FROM make WHERE slug = 'ikco' \gset
SELECT id AS mdena FROM model WHERE slug = 'dena' \gset
SELECT id AS tdenaplus FROM trim WHERE slug = 'plus' AND model_id = :mdena \gset
SELECT id AS peugeot FROM make WHERE slug = 'peugeot' \gset

INSERT INTO account (phone_e164, phone_hmac, display_name, created_at)
VALUES ('+989121111111', hmac('+989121111111', 'lab-only-key', 'sha256'), 'فروشنده‌ی نمونه', '2026-10-01 09:00+00')
RETURNING id AS seller \gset

-- 1) A Dena Plus: draft, submitted, approved, published.
INSERT INTO listing (origin, source_id, seller_account_id, status, created_at)
VALUES ('native', 'carshenas', :seller, 'draft', '2026-10-01 09:05+00')
RETURNING id AS n1 \gset
INSERT INTO native_listing_revision (listing_id, revision_no, payload, created_at)
VALUES (:n1, 1, '{"trim": "ikco/dena/plus", "model_year_sh": 1401, "mileage_km": 48000, "price_toman": 1150000000,
                  "city": "tehran", "body_condition": "spot_paint", "description": "یک لکه رنگ روی گلگیر عقب"}', '2026-10-01 09:05+00')
RETURNING id AS n1r1 \gset
UPDATE native_listing_revision SET payload = payload || '{"mileage_km": 48500}' WHERE id = :n1r1;   -- still a draft: editable
UPDATE native_listing_revision SET status = 'submitted', submitted_at = '2026-10-01 09:20+00' WHERE id = :n1r1;
UPDATE listing SET status = 'in_review' WHERE id = :n1;
UPDATE native_listing_revision SET status = 'approved', decided_at = '2026-10-01 09:30+00', decided_by = 'moderator-1' WHERE id = :n1r1;
-- project the approved revision into the core, exactly where crawled attributes live
UPDATE listing SET
  make_id = :ikco, model_id = :mdena, trim_id = :tdenaplus, catalogue_match = 'trim',
  model_year_sh = 1401, model_year_written = 'sh', mileage_km = 48500, price_type = 'asking', asking_price_toman = 1150000000,
  city_id = :tehran, body_condition = 'spot_paint', seller_type = 'private', title = 'دنا پلاس مدل ۱۴۰۱',
  description_redacted = 'یک لکه رنگ روی گلگیر عقب', current_revision_id = :n1r1,
  status = 'active', listed_at = '2026-10-01 09:30+00', attributes_updated_at = '2026-10-01 09:30+00'
WHERE id = :n1;
INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, native_revision_id)
VALUES (:n1, '2026-10-01 09:30+00', 'asking', 1150000000, :n1r1);
INSERT INTO listing_condition (listing_id, kind, panel, spot_count, evidence)
VALUES (:n1, 'paint_spot', 'rear_left_fender', 1, 'یک لکه رنگ روی گلگیر عقب');
INSERT INTO vehicle (created_at) VALUES ('2026-10-01 09:31+00') RETURNING id AS nv1 \gset
UPDATE listing SET vehicle_id = :nv1 WHERE id = :n1;
INSERT INTO vehicle_membership (listing_id, vehicle_id, valid, cause) VALUES (:n1, :nv1, tstzrange('2026-10-01 09:31+00', NULL), 'first_resolution');

-- 2) A second car: only a draft so far (the "native listing draft" of the brief).
INSERT INTO listing (origin, source_id, seller_account_id, status, created_at)
VALUES ('native', 'carshenas', :seller, 'draft', '2026-10-02 10:00+00')
RETURNING id AS n2 \gset
INSERT INTO native_listing_revision (listing_id, revision_no, payload, created_at)
VALUES (:n2, 1, '{"trim": "peugeot/206/t5", "model_year_sh": 1398}', '2026-10-02 10:00+00');

-- A buyer asks about the published Dena through Carshenas; the seller's number is not published.
INSERT INTO account (phone_e164, phone_hmac, display_name) VALUES ('+989122222222', hmac('+989122222222', 'lab-only-key', 'sha256'), NULL)
RETURNING id AS buyer \gset
INSERT INTO contact_request (listing_id, buyer_account_id, message, share_buyer_phone)
VALUES (:n1, :buyer, 'سلام، امکان کارشناسی در محل هست؟', true);

SELECT rebuild_search_documents() AS search_documents_built;

\echo '== listings by origin and status: the draft is in the core table but never on the market'
SELECT l.id, l.origin, l.source_id, l.status, l.seller_account_id IS NOT NULL AS has_owner, l.catalogue_match,
       l.asking_price_toman, l.listed_at
FROM listing l ORDER BY l.id;
\echo '== search: the published native listing sits beside crawled cars; the draft does not appear'
SELECT d.vehicle_id, d.representative_listing_id, d.source_ids, d.asking_price_toman, d.deal_rating
FROM search_document d ORDER BY d.vehicle_id;
\echo '== native price history comes from approved revisions'
SELECT e.listing_id, e.observed_at, e.asking_price_toman, e.snapshot_id, e.native_revision_id
FROM listing_price_event e JOIN listing l ON l.id = e.listing_id WHERE l.origin = 'native';
\echo '== revisions'
SELECT listing_id, revision_no, status, submitted_at, decided_by, payload ->> 'mileage_km' AS mileage_km FROM native_listing_revision ORDER BY id;
