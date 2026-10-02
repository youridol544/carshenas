-- migrate:up
-- Validates the CHECKs allow_repaired_part_condition added NOT VALID (CS-85), under a SHARE UPDATE EXCLUSIVE lock that
-- lets the crawler keep writing listings.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing VALIDATE CONSTRAINT listing_engine_condition_valid;
ALTER TABLE listing VALIDATE CONSTRAINT listing_gearbox_condition_valid;

-- migrate:down
-- A constraint is not made unvalidated again; the previous migration's down section replaces both.
SELECT 1;
