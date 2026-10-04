-- migrate:up
-- The checks of the previous migration, validated on their own (the new columns are null until the rebuild fills them).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE search_document VALIDATE CONSTRAINT search_document_engine_volume_cc_range;
ALTER TABLE search_document VALIDATE CONSTRAINT search_document_car_origin_valid;
ALTER TABLE search_document VALIDATE CONSTRAINT search_document_country_valid;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

SELECT 1;
