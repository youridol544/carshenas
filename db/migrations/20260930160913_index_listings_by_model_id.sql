-- migrate:up transaction:false
-- A source's listings of one catalogue model (CS-41): the superadmin section counts each tracked model's listings, in
-- and out, through the model the catalogue matched (listing.model_id, CS-50), which covers the model's trims too.
-- Later pages that list a model's listings read the same range.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY listing_source_model_id_idx ON listing (source_id, model_id);


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS listing_source_model_id_idx;
