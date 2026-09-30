-- migrate:up
-- Validates the listing's catalogue and place columns' checks and keys, added NOT VALID by the previous migration
-- (CS-50), under SHARE UPDATE EXCLUSIVE, which lets the crawler keep writing while existing rows are checked.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing VALIDATE CONSTRAINT listing_catalogue_match_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_catalogue_match_consistent;
ALTER TABLE listing VALIDATE CONSTRAINT listing_district_fa_not_blank;
ALTER TABLE listing VALIDATE CONSTRAINT listing_make_fk;
ALTER TABLE listing VALIDATE CONSTRAINT listing_model_fk;
ALTER TABLE listing VALIDATE CONSTRAINT listing_trim_fk;
ALTER TABLE listing VALIDATE CONSTRAINT listing_colour_fk;
ALTER TABLE listing VALIDATE CONSTRAINT listing_city_fk;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A validated constraint cannot be marked NOT VALID again; the previous migration's down section drops them.
SELECT 1;
