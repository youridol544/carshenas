-- migrate:up transaction:false
-- The matching job (CS-72) and «new since the buyer last looked» read the rows indexed after an instant: a range of this
-- index finds them first, however many rows the table holds.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY search_document_indexed_at_idx ON search_document (indexed_at);


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS search_document_indexed_at_idx;
