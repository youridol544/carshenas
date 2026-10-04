-- migrate:up transaction:false
-- A buyer's engine volume range («بیشتر از ۲۰۰۰ سی‌سی», «بین ۱۴۰۰ و ۱۸۰۰») reads a range of this index. Partial: the rows
-- with an unknown volume are never in a volume filter's answer (CS-100, ADR-0039), so they are not in the index.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY search_document_engine_volume_idx ON search_document (engine_volume_cc)
  WHERE engine_volume_cc IS NOT NULL;


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS search_document_engine_volume_idx;
