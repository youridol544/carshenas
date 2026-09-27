-- migrate:up
-- Where listings come from, and the recorded reading of each source's robots.txt and terms (CS-4; ADR-0008, ADR-0013;
-- read by CS-5).
-- The rules a single row can state are constraints here; the rules that read other rows (a crawl must cite the
-- latest policy check, a block stops the source) are backstop triggers that arrive with the crawler (CS-6).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE source (
  id                      text PRIMARY KEY
                          CONSTRAINT source_id_format CHECK (id ~ '^[a-z][a-z0-9_]{1,30}$'),
  origin                  text NOT NULL
                          CONSTRAINT source_origin_valid CHECK (origin IN ('external', 'native', 'benchmark')),
  access_method           text NOT NULL
                          CONSTRAINT source_access_method_valid CHECK (access_method IN ('crawl', 'official_api', 'native')),
  name_fa                 text NOT NULL
                          CONSTRAINT source_name_fa_not_blank CHECK (btrim(name_fa) <> ''),
  base_url                text NOT NULL
                          CONSTRAINT source_base_url_https CHECK (base_url ~ '^https://[^/\s]+/?$'),
  listing_visibility      text NOT NULL
                          CONSTRAINT source_listing_visibility_valid CHECK (listing_visibility IN ('public', 'requester_only')),
  crawl_state             text NOT NULL DEFAULT 'paused'
                          CONSTRAINT source_crawl_state_valid CHECK (crawl_state IN ('enabled', 'paused', 'stopped_on_block')),
  min_request_interval_ms integer,
  policy_max_age_days     integer NOT NULL DEFAULT 30
                          CONSTRAINT source_policy_max_age_days_positive CHECK (policy_max_age_days > 0),
  stopped_at              timestamptz,
  stop_reason             text
                          CONSTRAINT source_stop_reason_valid CHECK (stop_reason IN ('blocked', 'rate_limited', 'challenge')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_native_iff_native_access CHECK ((origin = 'native') = (access_method = 'native')),
  -- ADR-0008 point 5: at least three seconds between requests to a crawled source. IS NOT NULL is spelled out:
  -- a CHECK passes when its expression is NULL, so a missing interval would otherwise slip through.
  CONSTRAINT source_crawl_interval_floor CHECK (
    access_method <> 'crawl' OR (min_request_interval_ms IS NOT NULL AND min_request_interval_ms >= 3000)),
  -- ADR-0008 point 3: a source read through an official API (Divar's Kenar) can never be switched to crawling.
  CONSTRAINT source_only_crawled_sources_run CHECK (crawl_state = 'paused' OR access_method = 'crawl'),
  -- ADR-0008 point 6: a stopped source says when and why (the blocked request is the source's fetch_log row at
  -- stopped_at); a human clears both when re-enabling it.
  CONSTRAINT source_stop_recorded CHECK (
    (crawl_state = 'stopped_on_block') = (stopped_at IS NOT NULL)
    AND (crawl_state = 'stopped_on_block') = (stop_reason IS NOT NULL)),
  -- Target of listing (source_id, origin): a listing's origin must be its source's origin.
  CONSTRAINT source_id_origin_unique UNIQUE (id, origin)
);

COMMENT ON TABLE source IS
  'A website or channel listings come from (ADR-0008). Curated by hand. Carshenas itself becomes the native source "carshenas" when native listings arrive.';
COMMENT ON COLUMN source.id IS 'Stable code used in URLs, logs and job names, for example bama.';
COMMENT ON COLUMN source.origin IS
  'external: listings on other sites; native: listings created on Carshenas; benchmark: published price tables, never listings.';
COMMENT ON COLUMN source.access_method IS
  'crawl: our crawler reads pages its robots.txt and terms allow; official_api: single items through an official API (Divar Kenar, CS-19); native: our own database.';
COMMENT ON COLUMN source.listing_visibility IS
  'public: its listings appear in search; requester_only: shown only to the buyer who pasted the link (CS-19).';
COMMENT ON COLUMN source.crawl_state IS
  'enabled or paused by a human; stopped_on_block by the crawler on a 403, 429 or challenge (ADR-0008 point 6), until a human reads the evidence and re-enables it.';
COMMENT ON COLUMN source.min_request_interval_ms IS
  'Milliseconds between two requests to this source; at least 3000 for crawled sources, longer when robots.txt asks (Crawl-delay).';
COMMENT ON COLUMN source.policy_max_age_days IS 'How many days old the latest policy check may be before a crawl is refused.';
COMMENT ON COLUMN source.stopped_at IS
  'When the crawler stopped the source: the requested_at of the blocked request in fetch_log, which is the evidence.';

CREATE TABLE source_policy_check (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id      text NOT NULL,
  checked_at     timestamptz NOT NULL,
  checked_by     text NOT NULL
                 CONSTRAINT source_policy_check_checked_by_not_blank CHECK (btrim(checked_by) <> ''),
  robots_txt     text,
  terms_url      text
                 CONSTRAINT source_policy_check_terms_url_http CHECK (terms_url ~ '^https?://'),
  terms_summary  text NOT NULL
                 CONSTRAINT source_policy_check_terms_summary_not_blank CHECK (btrim(terms_summary) <> ''),
  verdict        text NOT NULL
                 CONSTRAINT source_policy_check_verdict_valid CHECK (verdict IN ('allowed', 'allowed_with_conditions', 'not_allowed')),
  conditions     text
                 CONSTRAINT source_policy_check_conditions_not_blank CHECK (btrim(conditions) <> ''),
  photos_allowed boolean NOT NULL,
  CONSTRAINT source_policy_check_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE RESTRICT,
  CONSTRAINT source_policy_check_conditions_stated CHECK (verdict <> 'allowed_with_conditions' OR conditions IS NOT NULL),
  CONSTRAINT source_policy_check_not_allowed_no_photos CHECK (verdict <> 'not_allowed' OR NOT photos_allowed),
  -- Target of crawl_run (policy_check_id, source_id): a crawl cites a policy check of its own source.
  CONSTRAINT source_policy_check_id_source_unique UNIQUE (id, source_id)
);

-- Serves the foreign key and "the latest check per source" (the view below) with one index.
CREATE INDEX source_policy_check_source_latest_idx ON source_policy_check (source_id, checked_at DESC, id DESC);

CREATE TRIGGER source_policy_check_append_only
  BEFORE UPDATE OR DELETE ON source_policy_check
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER source_policy_check_append_only_truncate
  BEFORE TRUNCATE ON source_policy_check
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE source_policy_check IS
  'Append-only record of each reading of a source''s robots.txt and terms (ADR-0008 point 1, CS-5). The newest row is in force.';
COMMENT ON COLUMN source_policy_check.robots_txt IS 'The robots.txt text as read, kept as evidence.';
COMMENT ON COLUMN source_policy_check.photos_allowed IS
  'Whether this source''s rules allow downloading and re-hosting its photos (ADR-0010).';

CREATE VIEW source_current_policy AS
SELECT DISTINCT ON (source_id)
  id, source_id, checked_at, checked_by, verdict, conditions, photos_allowed
FROM source_policy_check
ORDER BY source_id, checked_at DESC, id DESC;

COMMENT ON VIEW source_current_policy IS 'The policy check in force for each source: its newest reading.';

-- Pages name each listing's source; policy checks stay closed to the web app.
GRANT SELECT ON source TO carshenas_web;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
REVOKE SELECT ON source FROM carshenas_web;
DROP VIEW source_current_policy;
DROP TABLE source_policy_check;
DROP TABLE source;
