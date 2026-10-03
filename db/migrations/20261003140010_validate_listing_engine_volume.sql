-- migrate:up
-- The range check of the previous migration, validated on its own (every stored value is null: the lock is short).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing VALIDATE CONSTRAINT listing_engine_volume_cc_range;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

SELECT 1;
