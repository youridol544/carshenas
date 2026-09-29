-- migrate:up
-- Validates the widened fetch_log_method_valid (the previous migration, CS-33) under a SHARE UPDATE EXCLUSIVE lock,
-- which lets fetches keep being written while existing rows are checked.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE fetch_log VALIDATE CONSTRAINT fetch_log_method_valid;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A validated constraint cannot be marked NOT VALID again; the previous migration's down section replaces it.
SELECT 1;
