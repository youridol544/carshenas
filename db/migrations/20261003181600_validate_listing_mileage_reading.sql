-- migrate:up
-- Validates the CHECKs add_listing_mileage_reading added NOT VALID (CS-101), under a lock that lets the crawler keep
-- writing listings.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing VALIDATE CONSTRAINT listing_mileage_reading_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_mileage_written_range;
ALTER TABLE listing VALIDATE CONSTRAINT listing_mileage_reading_complete;
ALTER TABLE listing VALIDATE CONSTRAINT listing_mileage_reading_value;
ALTER TABLE listing VALIDATE CONSTRAINT listing_mileage_wording_by_text;
ALTER TABLE listing VALIDATE CONSTRAINT listing_mileage_wording_text;
ALTER TABLE listing VALIDATE CONSTRAINT listing_mileage_ask_ratio_tested;

-- migrate:down
-- A constraint is not made unvalidated again; the previous migration's down section drops them.
SELECT 1;
