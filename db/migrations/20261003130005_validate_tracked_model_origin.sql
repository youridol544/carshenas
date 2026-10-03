-- migrate:up
-- The relaxed origin check of the previous migration, validated on its own (the rows are few; this keeps the lock short).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE tracked_model VALIDATE CONSTRAINT tracked_model_origin_matches;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

SELECT 1;
