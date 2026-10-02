-- migrate:up
-- Validates the scope list that the previous migration added NOT VALID (CS-62): only a SHARE UPDATE EXCLUSIVE lock, so
-- sign-ins and searches go on while the table's rows are checked.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE auth_throttle VALIDATE CONSTRAINT auth_throttle_scope_valid;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A validated constraint stays valid: the previous migration's down section replaces the constraint itself.
SELECT 1;
