-- migrate:up
-- Validates what 20261003100000 added NOT VALID (CS-72): the tables are small and every row already satisfies them.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE search_file VALIDATE CONSTRAINT search_file_matched_after_created;
ALTER TABLE search_file VALIDATE CONSTRAINT search_file_muted_after_created;
ALTER TABLE search_file VALIDATE CONSTRAINT search_file_alert_after_created;
ALTER TABLE notification VALIDATE CONSTRAINT notification_search_file_fk;
ALTER TABLE notification VALIDATE CONSTRAINT notification_search_file_kind_has_file;

-- migrate:down
-- Nothing to undo: a validated constraint is dropped with its column by the earlier migration's down.
SELECT 1;
