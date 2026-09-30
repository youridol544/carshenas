-- migrate:up
-- Validates the CHECKs add_listing_attributes added NOT VALID (CS-34), each under a SHARE UPDATE EXCLUSIVE lock, which
-- lets the crawler keep writing listings while existing rows are checked.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing VALIDATE CONSTRAINT listing_title_not_blank;
ALTER TABLE listing VALIDATE CONSTRAINT listing_source_model_key_not_blank;
ALTER TABLE listing VALIDATE CONSTRAINT listing_model_year_written_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_model_year_sh_range;
ALTER TABLE listing VALIDATE CONSTRAINT listing_model_year_ad_range;
ALTER TABLE listing VALIDATE CONSTRAINT listing_model_year_calendars_agree;
ALTER TABLE listing VALIDATE CONSTRAINT listing_mileage_km_nonnegative;
ALTER TABLE listing VALIDATE CONSTRAINT listing_fuel_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_gearbox_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_insurance_months_left_nonnegative;
ALTER TABLE listing VALIDATE CONSTRAINT listing_price_type_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_asking_price_toman_range;
ALTER TABLE listing VALIDATE CONSTRAINT listing_down_payment_toman_range;
ALTER TABLE listing VALIDATE CONSTRAINT listing_price_type_amounts;
ALTER TABLE listing VALIDATE CONSTRAINT listing_seller_type_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_body_condition_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_engine_condition_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_gearbox_condition_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_front_chassis_condition_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_rear_chassis_condition_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_parser_version_positive;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A validated constraint cannot be marked NOT VALID again; add_listing_attributes' down section drops them.
SELECT 1;
