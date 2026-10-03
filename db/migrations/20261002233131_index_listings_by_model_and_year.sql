-- migrate:up transaction:false
-- The model page's trend (CS-67) reads the valuation history of one model year: it must start from that model year's
-- listings (a few hundred of them) and follow listing_valuation_listing_idx to their rows in each run. Without an index
-- on the model and year the planner started from the runs' listing_valuation rows (every active listing in every run,
-- about 21,000 a day for up to 90 days) and probed the listing table for each: 35 ms with three runs, growing with
-- every run. listing_source_model_id_idx leads with the source, which this read does not name.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY listing_model_year_idx ON listing (model_id, model_year_sh);


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS listing_model_year_idx;
