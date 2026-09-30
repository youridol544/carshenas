-- migrate:up transaction:false
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY listing_price_event_fetch_log_idx ON listing_price_event (fetch_log_id, listing_id);


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS listing_price_event_fetch_log_idx;
