-- migrate:up
-- Two more kinds a marked listing produces (CS-69, ADR-0026 point 3): it leaves the market (sold, expired or gone) and it
-- comes back. Both are about a listing, so both join the check that says a listing's kind names its listing; the check
-- is replaced NOT VALID here and validated in the next file, so the table is not scanned under the lock.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

INSERT INTO notification_kind (id, description) VALUES
  ('listing_off_market', 'A listing the buyer follows was sold, expired or disappeared from its source: one per time it leaves the market (CS-69).'),
  ('listing_relisted', 'A listing the buyer follows that had left the market is on it again: one per return (CS-69).');

ALTER TABLE notification DROP CONSTRAINT notification_listing_kind_has_listing;
ALTER TABLE notification ADD CONSTRAINT notification_listing_kind_has_listing
  CHECK (kind NOT IN ('listing_price_drop', 'listing_off_market', 'listing_relisted') OR listing_id IS NOT NULL) NOT VALID;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DELETE FROM notification WHERE kind IN ('listing_off_market', 'listing_relisted');
DELETE FROM notification_mute WHERE kind IN ('listing_off_market', 'listing_relisted');
ALTER TABLE notification DROP CONSTRAINT notification_listing_kind_has_listing;
ALTER TABLE notification ADD CONSTRAINT notification_listing_kind_has_listing
  CHECK (kind <> 'listing_price_drop' OR listing_id IS NOT NULL) NOT VALID;
DELETE FROM notification_kind WHERE id IN ('listing_off_market', 'listing_relisted');
