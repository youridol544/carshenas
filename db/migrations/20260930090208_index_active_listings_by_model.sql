-- migrate:up transaction:false
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY listing_active_model_idx ON listing (source_id, source_model_key) WHERE status = 'active';


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS listing_active_model_idx;
