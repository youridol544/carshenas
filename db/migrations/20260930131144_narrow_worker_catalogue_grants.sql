-- migrate:up
-- The worker only ever adds aliases and cities (CS-50, database review): it keeps SELECT and INSERT on them, and loses
-- the UPDATE its first grant gave.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE UPDATE ON catalogue_alias, city FROM carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

GRANT UPDATE ON catalogue_alias, city TO carshenas_worker;
