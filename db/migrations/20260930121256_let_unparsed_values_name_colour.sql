-- migrate:up
-- A colour a post states that the parser does not know is kept as an unparsed value, like any other field it reads
-- (CS-50: the colour is read now, with its code table). The widened list is added NOT VALID (the table has rows); the
-- next migration validates it.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing_unparsed_value DROP CONSTRAINT listing_unparsed_value_field_valid;
ALTER TABLE listing_unparsed_value
  ADD CONSTRAINT listing_unparsed_value_field_valid CHECK (field IN (
    'model_year', 'mileage_km', 'fuel', 'gearbox', 'insurance_months_left', 'price', 'accepts_swap', 'accepts_installments', 'seller_type', 'body_condition', 'engine_condition', 'gearbox_condition', 'chassis_condition', 'colour')) NOT VALID;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Unparsed colours go with the list that allowed them; they are derived and come back with pnpm derive:listings.
DELETE FROM listing_unparsed_value WHERE field = 'colour';
ALTER TABLE listing_unparsed_value DROP CONSTRAINT listing_unparsed_value_field_valid;
ALTER TABLE listing_unparsed_value
  ADD CONSTRAINT listing_unparsed_value_field_valid CHECK (field IN (
    'model_year', 'mileage_km', 'fuel', 'gearbox', 'insurance_months_left', 'price', 'accepts_swap', 'accepts_installments', 'seller_type', 'body_condition', 'engine_condition', 'gearbox_condition', 'chassis_condition')) NOT VALID;
