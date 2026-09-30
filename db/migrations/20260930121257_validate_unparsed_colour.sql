-- migrate:up
-- Validates the widened field list of listing_unparsed_value (the previous migration, CS-50).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing_unparsed_value VALIDATE CONSTRAINT listing_unparsed_value_field_valid;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A validated constraint cannot be marked NOT VALID again; the previous migration's down section replaces it.
SELECT 1;
