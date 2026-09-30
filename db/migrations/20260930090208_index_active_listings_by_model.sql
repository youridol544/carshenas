-- migrate:up transaction:false
-- For the listings a complete sweep slice no longer shows (CS-35): active listings of a source by the model key
-- CS-34 derives (listing.source_model_key) or a sweep sets.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY listing_active_model_idx ON listing (source_id, source_model_key) WHERE status = 'active';


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS listing_active_model_idx;
