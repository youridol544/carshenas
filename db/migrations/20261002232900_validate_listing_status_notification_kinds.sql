-- migrate:up
-- Validates the check the previous file replaced NOT VALID (CS-69): every listing kind names its listing.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE notification VALIDATE CONSTRAINT notification_listing_kind_has_listing;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE notification DROP CONSTRAINT notification_listing_kind_has_listing;
ALTER TABLE notification ADD CONSTRAINT notification_listing_kind_has_listing
  CHECK (kind NOT IN ('listing_price_drop', 'listing_off_market', 'listing_relisted') OR listing_id IS NOT NULL) NOT VALID;
