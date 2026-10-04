-- migrate:up
-- The country filter's options are counted into search_facet_count like the makes' (CS-103, ADR-0041): its facet name joins
-- the list the table accepts. The new check is added NOT VALID and validated by the next migration.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE search_facet_count DROP CONSTRAINT search_facet_count_facet_valid;
ALTER TABLE search_facet_count ADD CONSTRAINT search_facet_count_facet_valid CHECK (
  facet IN ('total', 'seen', 'catalogue', 'make', 'model', 'trim', 'body_type', 'city', 'district', 'source', 'country')
) NOT VALID;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DELETE FROM search_facet_count WHERE facet = 'country';
ALTER TABLE search_facet_count DROP CONSTRAINT search_facet_count_facet_valid;
ALTER TABLE search_facet_count ADD CONSTRAINT search_facet_count_facet_valid CHECK (
  facet IN ('total', 'seen', 'catalogue', 'make', 'model', 'trim', 'body_type', 'city', 'district', 'source')
);
