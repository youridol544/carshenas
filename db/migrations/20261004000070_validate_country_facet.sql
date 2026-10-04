-- migrate:up
-- The check of the previous migration, validated on its own (the table holds a few hundred rows).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE search_facet_count VALIDATE CONSTRAINT search_facet_count_facet_valid;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

SELECT 1;
