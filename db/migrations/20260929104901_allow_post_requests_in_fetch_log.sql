-- migrate:up
-- Divar's search is a POST to its web API (CS-33; docs/research/2026-09-26-car-listing-sources-and-crawl-policy/
-- divar-web-api.md), so a fetch records http_post as well as http_get. The widened list is added NOT VALID and
-- validated by the next migration, the lock-safe way for a table that may hold rows.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE fetch_log DROP CONSTRAINT fetch_log_method_valid;
ALTER TABLE fetch_log
  ADD CONSTRAINT fetch_log_method_valid CHECK (method IN ('http_get', 'http_post', 'official_api')) NOT VALID;

COMMENT ON COLUMN fetch_log.method IS
  'How the request reached the source: http_get or http_post to its pages or public web API (a crawl), official_api through a partner API it grants.';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

COMMENT ON COLUMN fetch_log.method IS NULL;
ALTER TABLE fetch_log DROP CONSTRAINT fetch_log_method_valid;
ALTER TABLE fetch_log ADD CONSTRAINT fetch_log_method_valid CHECK (method IN ('http_get', 'official_api'));
