-- migrate:up transaction:false
-- The matching job (CS-72) reads the price events recorded since its watermark to find drops on a file's matches; a range
-- of this index finds them without reading every event. Events are only ever appended, in time order.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY listing_price_event_recorded_at_idx ON listing_price_event (recorded_at);


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS listing_price_event_recorded_at_idx;
