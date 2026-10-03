-- migrate:up transaction:false
-- Serves the foreign key notification_search_file_fk: deleting a search file deletes its notifications (CS-72).
-- squawk-disable-assume-in-transaction
-- squawk-ignore require-lock-timeout, require-statement-timeout
CREATE INDEX CONCURRENTLY notification_search_file_idx ON notification (search_file_id);


-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS notification_search_file_idx;
