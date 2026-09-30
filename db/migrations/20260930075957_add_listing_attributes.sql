-- migrate:up
-- What a listing says about its car, as its source structures it (CS-34; docs/design/data-model.md, layer 3; the
-- types are ADR-0014's). The parser derives these columns by code from the listing's latest snapshot and
-- `pnpm derive:listings` re-derives them after a parser change, so they are rebuildable, never observations. listing
-- has rows, so every column arrives bare and nullable, with no default, and every CHECK NOT VALID: an inline CHECK
-- would scan the table under ACCESS EXCLUSIVE. A later migration, validate_listing_attributes, validates them.
-- The make, model and trim ids, the colour and the city arrive with the catalogue's code tables and geography (CS-50),
-- vehicle_id with duplicate detection (CS-55), and what only the listing's text states with extraction (CS-52).
-- The six comments that still said "ad" (20260927060003_create_listings.sql) are restated to say listing: an applied
-- migration is never edited.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing
  ADD COLUMN title                   text,
  ADD COLUMN source_model_key        text,
  ADD COLUMN model_year_written      text,
  ADD COLUMN model_year_sh           smallint,
  ADD COLUMN model_year_ad           smallint,
  ADD COLUMN mileage_km              integer,
  ADD COLUMN fuel                    text,
  ADD COLUMN gearbox                 text,
  ADD COLUMN insurance_months_left   smallint,
  ADD COLUMN price_type              text,
  ADD COLUMN asking_price_toman      bigint,
  ADD COLUMN down_payment_toman      bigint,
  ADD COLUMN accepts_swap            boolean,
  ADD COLUMN accepts_installments    boolean,
  ADD COLUMN seller_type             text,
  ADD COLUMN body_condition          text,
  ADD COLUMN engine_condition        text,
  ADD COLUMN gearbox_condition       text,
  ADD COLUMN front_chassis_condition text,
  ADD COLUMN rear_chassis_condition  text,
  ADD COLUMN parser_version          smallint,
  ADD CONSTRAINT listing_title_not_blank CHECK (btrim(title) <> '') NOT VALID,
  ADD CONSTRAINT listing_source_model_key_not_blank CHECK (btrim(source_model_key) <> '') NOT VALID,
  -- The model year, word for word as ADR-0014 and data-model.md (layer 3) fix it. Every branch spells out
  -- IS [NOT] NULL, because a CHECK passes when its expression is NULL.
  ADD CONSTRAINT listing_model_year_written_valid CHECK (model_year_written IN ('sh', 'ad', 'both')) NOT VALID,
  ADD CONSTRAINT listing_model_year_sh_range CHECK (model_year_sh BETWEEN 1300 AND 1500) NOT VALID,
  ADD CONSTRAINT listing_model_year_ad_range CHECK (model_year_ad BETWEEN 1921 AND 2121) NOT VALID,
  ADD CONSTRAINT listing_model_year_calendars_agree CHECK (
    CASE model_year_written
      WHEN 'sh'   THEN model_year_sh IS NOT NULL AND model_year_ad IS NULL
      WHEN 'ad'   THEN model_year_ad IS NOT NULL AND model_year_sh IS NOT NULL AND model_year_sh = model_year_ad - 621
      WHEN 'both' THEN model_year_sh IS NOT NULL AND model_year_ad IS NOT NULL AND model_year_ad - model_year_sh IN (621, 622)
      ELSE model_year_sh IS NULL AND model_year_ad IS NULL
    END) NOT VALID,
  -- No car is known to have driven more than about 5 million km: above 10 million a stated figure is a typo or a code,
  -- which the parser keeps as unparsed (MOST_MILEAGE_KM), and it could not be a mileage.
  ADD CONSTRAINT listing_mileage_km_range CHECK (mileage_km BETWEEN 0 AND 9999999) NOT VALID,
  ADD CONSTRAINT listing_fuel_valid CHECK (
    fuel IN ('petrol', 'dual_fuel_factory', 'dual_fuel_aftermarket', 'hybrid', 'plug_in_hybrid', 'electric', 'diesel')) NOT VALID,
  ADD CONSTRAINT listing_gearbox_valid CHECK (gearbox IN ('manual', 'automatic')) NOT VALID,
  ADD CONSTRAINT listing_insurance_months_left_nonnegative CHECK (insurance_months_left >= 0) NOT VALID,
  -- The price, word for word as data-model.md (layer 3) fixes it (ADR-0014): an amount only for the type that has
  -- one, so a placeholder or an installment offer never passes for an asking price.
  ADD CONSTRAINT listing_price_type_valid CHECK (price_type IN ('asking', 'negotiable', 'installment', 'placeholder')) NOT VALID,
  ADD CONSTRAINT listing_asking_price_toman_range CHECK (asking_price_toman BETWEEN 1 AND 999999999999999) NOT VALID,
  ADD CONSTRAINT listing_down_payment_toman_range CHECK (down_payment_toman BETWEEN 1 AND 999999999999999) NOT VALID,
  ADD CONSTRAINT listing_price_type_amounts CHECK (
    CASE price_type
      WHEN 'asking'      THEN asking_price_toman IS NOT NULL AND down_payment_toman IS NULL
      WHEN 'installment' THEN down_payment_toman IS NOT NULL AND asking_price_toman IS NULL
      ELSE asking_price_toman IS NULL AND down_payment_toman IS NULL
    END) NOT VALID,
  ADD CONSTRAINT listing_seller_type_valid CHECK (seller_type IN ('dealer', 'private')) NOT VALID,
  -- The seller's own ratings, in the values of Divar's own lists (its filters, read on 2026-09-19).
  ADD CONSTRAINT listing_body_condition_valid CHECK (
    body_condition IN ('intact', 'minor_scratches', 'paintless_dent_repair', 'partly_repainted', 'repainted_around',
                       'fully_repainted', 'accident_damaged', 'salvage')) NOT VALID,
  ADD CONSTRAINT listing_engine_condition_valid CHECK (engine_condition IN ('sound', 'needs_repair', 'replaced')) NOT VALID,
  ADD CONSTRAINT listing_gearbox_condition_valid CHECK (gearbox_condition IN ('sound', 'needs_repair', 'replaced')) NOT VALID,
  ADD CONSTRAINT listing_front_chassis_condition_valid CHECK (
    front_chassis_condition IN ('intact', 'repainted', 'damaged')) NOT VALID,
  ADD CONSTRAINT listing_rear_chassis_condition_valid CHECK (
    rear_chassis_condition IN ('intact', 'repainted', 'damaged')) NOT VALID,
  ADD CONSTRAINT listing_parser_version_positive CHECK (parser_version >= 1) NOT VALID;

COMMENT ON COLUMN listing.title IS 'The listing''s title as its source shows it, with phone numbers removed as in its snapshot.';
COMMENT ON COLUMN listing.source_model_key IS
  'The source''s own make, model and trim value (Divar''s brand_model, such as «Peugeot 206 5»), as model_volume keys it; the catalogue (CS-50) maps it to a trim.';
COMMENT ON COLUMN listing.model_year_written IS
  'The calendars the listing stated its model year in: sh (Solar Hijri only), ad (Gregorian only) or both (ADR-0014); null when it stated no single year.';
COMMENT ON COLUMN listing.model_year_sh IS
  'The Solar Hijri model year, set whenever a year is known: as stated, or model_year_ad - 621 when only a Gregorian year was stated. Search, comparables and valuation read this column.';
COMMENT ON COLUMN listing.model_year_ad IS 'The Gregorian model year, only when the listing stated it.';
COMMENT ON COLUMN listing.mileage_km IS
  'Kilometres driven, as stated, from 0 (a new car) to 9,999,999. Null when the listing stated none, stated Divar''s 1,000,000, which stands for unknown, or stated more than any car drives (kept as unparsed).';
COMMENT ON COLUMN listing.fuel IS
  'petrol, dual_fuel_factory (petrol and CNG, fitted by the maker), dual_fuel_aftermarket (CNG fitted later), hybrid, plug_in_hybrid, electric or diesel.';
COMMENT ON COLUMN listing.gearbox IS 'manual or automatic.';
COMMENT ON COLUMN listing.insurance_months_left IS 'Months of third-party insurance left, as the listing stated them.';
COMMENT ON COLUMN listing.price_type IS
  'What the listing asks (ADR-0014): asking (an amount), negotiable («توافقی»), installment (its figure is a down payment, read from the text by CS-52), placeholder (a token figure such as 1,000 tomans, kept only in the snapshot); null until read.';
COMMENT ON COLUMN listing.asking_price_toman IS 'The asking price in whole tomans, exactly when price_type is asking.';
COMMENT ON COLUMN listing.down_payment_toman IS
  'The down payment an installment listing shows as its price, in whole tomans, exactly when price_type is installment.';
COMMENT ON COLUMN listing.accepts_swap IS 'True when the listing says the seller takes a car in exchange («مایل به معاوضه»); null when it says nothing.';
COMMENT ON COLUMN listing.accepts_installments IS
  'True when the listing says the car can be bought in installments («امکان خرید قسطی»); null when it says nothing. Its price may still be the full price.';
COMMENT ON COLUMN listing.seller_type IS 'dealer («نمایشگاه») or private, as the source marks the seller.';
COMMENT ON COLUMN listing.body_condition IS
  'The seller''s own rating of the body, a claim rather than an inspection: intact, minor_scratches, paintless_dent_repair, partly_repainted, repainted_around («دوررنگ»), fully_repainted, accident_damaged or salvage.';
COMMENT ON COLUMN listing.engine_condition IS 'The seller''s own rating of the engine: sound, needs_repair or replaced.';
COMMENT ON COLUMN listing.gearbox_condition IS 'The seller''s own rating of the gearbox: sound, needs_repair or replaced.';
COMMENT ON COLUMN listing.front_chassis_condition IS 'The seller''s own rating of the front chassis: intact (sound and sealed), repainted or damaged.';
COMMENT ON COLUMN listing.rear_chassis_condition IS 'The seller''s own rating of the rear chassis: intact (sound and sealed), repainted or damaged.';
COMMENT ON COLUMN listing.parser_version IS
  'The version of its source''s parser that last derived the columns above from the listing''s latest snapshot (CS-34); null until derived.';

COMMENT ON TABLE listing IS
  'The offer: one listing on one source. Its id is permanent (URLs, alerts, evaluation sets point at it); what it says about the car is derived from its snapshots and rebuildable.';
COMMENT ON COLUMN listing.source_listing_key IS
  'The source''s own id or token for the listing; with source_id it is the natural key the crawler upserts on.';
COMMENT ON COLUMN listing.url IS 'Where the listing lives on its source; the click-out target.';
COMMENT ON COLUMN listing.listed_at IS
  'When the listing went on the market: the source''s posting time when the page shows it, else our first sighting. Native drafts, later, have none: the native-listings migration relaxes NOT NULL for them.';
COMMENT ON COLUMN listing.delisted_at IS 'When the listing left the market; set exactly when the status is off the market.';
COMMENT ON COLUMN listing.last_seen_at IS
  'The latest fetch that showed the listing, to within a day: the crawler refreshes it when it is more than a day old (fetch_log keeps every visit). Deliberately not indexed, so those updates stay HOT.';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

COMMENT ON TABLE listing IS
  'The offer: one ad on one source. Its id is permanent (URLs, alerts, evaluation sets point at it); what it says about the car is derived and rebuildable.';
COMMENT ON COLUMN listing.source_listing_key IS 'The source''s own id or token for the ad; with source_id it is the natural key the crawler upserts on.';
COMMENT ON COLUMN listing.url IS 'Where the ad lives on its source; the click-out target.';
COMMENT ON COLUMN listing.listed_at IS
  'When the ad went on the market: the source''s posting time when the page shows it, else our first sighting. Native drafts, later, have none: the native-listings migration relaxes NOT NULL for them.';
COMMENT ON COLUMN listing.delisted_at IS 'When the ad left the market; set exactly when the status is off the market.';
COMMENT ON COLUMN listing.last_seen_at IS
  'The latest fetch that showed the ad, to within a day: the crawler refreshes it when it is more than a day old (fetch_log keeps every visit). Deliberately not indexed, so those updates stay HOT.';

ALTER TABLE listing
  DROP COLUMN title,
  DROP COLUMN source_model_key,
  DROP COLUMN model_year_written,
  DROP COLUMN model_year_sh,
  DROP COLUMN model_year_ad,
  DROP COLUMN mileage_km,
  DROP COLUMN fuel,
  DROP COLUMN gearbox,
  DROP COLUMN insurance_months_left,
  DROP COLUMN price_type,
  DROP COLUMN asking_price_toman,
  DROP COLUMN down_payment_toman,
  DROP COLUMN accepts_swap,
  DROP COLUMN accepts_installments,
  DROP COLUMN seller_type,
  DROP COLUMN body_condition,
  DROP COLUMN engine_condition,
  DROP COLUMN gearbox_condition,
  DROP COLUMN front_chassis_condition,
  DROP COLUMN rear_chassis_condition,
  DROP COLUMN parser_version;
