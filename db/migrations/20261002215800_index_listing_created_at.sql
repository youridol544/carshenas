-- migrate:up transaction:false
-- For «new since the buyer last looked» on search files (CS-70): a listing is new when Carshenas first saw it
-- (listing.created_at) after the file's baseline. With few new listings the count scanned every listing (seq scan, 9.8 ms
-- and 1,452 buffers on 23,810 listings on 2026-10-03); a range of this index finds the new ones first.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY listing_created_at_idx ON listing (created_at);


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS listing_created_at_idx;
