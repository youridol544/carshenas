-- migrate:up transaction:false
-- Gives the rows that existed before search_document.indexed_at their listing's first sight (listing.created_at), so a
-- search file's «new» keeps the meaning it had (CS-72, ADR-0034). In batches of 5,000 listing ids, each its own
-- transaction, so no batch holds a lock for long and a writer is never made to wait behind the whole table. Safe to run
-- again: it only lowers a time that is later than the listing's creation.
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
DO $$
DECLARE
  from_id bigint := 0;
  last_id bigint;
BEGIN
  SELECT coalesce(max(listing_id), 0) INTO last_id FROM search_document;
  WHILE from_id <= last_id LOOP
    UPDATE search_document d SET indexed_at = l.created_at
    FROM listing l
    WHERE l.id = d.listing_id AND d.listing_id >= from_id AND d.listing_id < from_id + 5000
      AND l.created_at < d.indexed_at;
    from_id := from_id + 5000;
    COMMIT;
  END LOOP;
END
$$;


-- migrate:down transaction:false
-- Nothing to undo: the times were wrong before and are dropped with the column.
SELECT 1;
