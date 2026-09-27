-- migrate:up
-- Raw observations (CS-4; ADR-0008, ADR-0013; docs/design/data-model.md, layer 1): each crawl run, every request it made, and the immutable,
-- content-addressed copies of what a listing page showed. The fetch log and snapshots are append-only; only a
-- purge for a removal request deletes from them (ADR-0008 point 8). The backstops that read other rows (a crawl
-- must cite the latest policy check, a block stops the source in the same transaction) arrive with CS-6.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE crawl_run (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       text NOT NULL,
  policy_check_id bigint NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text NOT NULL DEFAULT 'running'
                  CONSTRAINT crawl_run_status_valid CHECK (status IN ('running', 'succeeded', 'failed', 'stopped_on_block')),
  CONSTRAINT crawl_run_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE RESTRICT,
  CONSTRAINT crawl_run_policy_check_fk FOREIGN KEY (policy_check_id, source_id)
    REFERENCES source_policy_check (id, source_id) ON DELETE RESTRICT,
  CONSTRAINT crawl_run_finished_when_not_running CHECK ((status = 'running') = (finished_at IS NULL)),
  CONSTRAINT crawl_run_times_ordered CHECK (finished_at IS NULL OR finished_at >= started_at),
  -- Target of fetch_log (crawl_run_id, source_id): a fetch belongs to a run of its own source.
  CONSTRAINT crawl_run_id_source_unique UNIQUE (id, source_id)
);

CREATE INDEX crawl_run_source_started_idx ON crawl_run (source_id, started_at DESC);
CREATE INDEX crawl_run_policy_check_idx ON crawl_run (policy_check_id, source_id);
-- ADR-0008 point 5: one request at a time per host, so at most one running crawl per source.
CREATE UNIQUE INDEX crawl_run_running_per_source_unique ON crawl_run (source_id) WHERE status = 'running';

COMMENT ON TABLE crawl_run IS 'One crawl of one source, citing the policy check it ran under (ADR-0008 point 1).';
COMMENT ON COLUMN crawl_run.status IS
  'running until finished; stopped_on_block when a 403, 429 or challenge stopped it (ADR-0008 point 6).';

CREATE TABLE fetch_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id     text NOT NULL,
  crawl_run_id  bigint NOT NULL,
  url           text NOT NULL
                CONSTRAINT fetch_log_url_http CHECK (url ~ '^https?://'),
  method        text NOT NULL DEFAULT 'http_get'
                CONSTRAINT fetch_log_method_valid CHECK (method IN ('http_get', 'official_api')),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  http_status   smallint
                CONSTRAINT fetch_log_http_status_range CHECK (http_status BETWEEN 100 AND 599),
  outcome       text NOT NULL
                CONSTRAINT fetch_log_outcome_valid CHECK (outcome IN (
                  'ok', 'not_modified', 'not_found', 'gone', 'blocked', 'rate_limited', 'challenge', 'error')),
  duration_ms   integer
                CONSTRAINT fetch_log_duration_nonnegative CHECK (duration_ms >= 0),
  etag          text,
  last_modified text,
  listing_id    bigint,
  snapshot_id   bigint,
  CONSTRAINT fetch_log_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE RESTRICT,
  CONSTRAINT fetch_log_crawl_run_fk FOREIGN KEY (crawl_run_id, source_id)
    REFERENCES crawl_run (id, source_id) ON DELETE CASCADE,
  -- The listing of the same source; a purge of a listing removes its fetches too: the URL itself is data about the ad.
  CONSTRAINT fetch_log_listing_fk FOREIGN KEY (listing_id, source_id) REFERENCES listing (id, source_id) ON DELETE CASCADE,
  CONSTRAINT fetch_log_snapshot_only_with_content CHECK (snapshot_id IS NULL OR outcome IN ('ok', 'not_modified')),
  CONSTRAINT fetch_log_snapshot_has_listing CHECK (snapshot_id IS NULL OR listing_id IS NOT NULL)
);

CREATE INDEX fetch_log_source_requested_idx ON fetch_log (source_id, requested_at DESC);
CREATE INDEX fetch_log_crawl_run_idx ON fetch_log (crawl_run_id, source_id);
-- A listing's fetch history is read with its source (listing_id = $1 AND source_id = $2), so this index serves both
-- that and the foreign key.
CREATE INDEX fetch_log_listing_requested_idx ON fetch_log (listing_id, source_id, requested_at DESC);

CREATE TRIGGER fetch_log_append_only
  BEFORE UPDATE OR DELETE ON fetch_log
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER fetch_log_append_only_truncate
  BEFORE TRUNCATE ON fetch_log
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE fetch_log IS
  'Append-only: one row per request we made to a source. A revisit whose content did not change points at the existing snapshot.';
COMMENT ON COLUMN fetch_log.outcome IS
  'blocked, rate_limited and challenge stop the source (ADR-0008 point 6); error means no usable response (network failure, timeout).';
COMMENT ON COLUMN fetch_log.etag IS 'The response ETag, sent back as If-None-Match on the next visit (ADR-0008 point 5).';
COMMENT ON COLUMN fetch_log.last_modified IS 'The response Last-Modified, sent back as If-Modified-Since on the next visit.';

CREATE TABLE snapshot (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id        bigint NOT NULL,
  first_fetched_at  timestamptz NOT NULL,
  url               text NOT NULL
                    CONSTRAINT snapshot_url_http CHECK (url ~ '^https?://'),
  canonical_version smallint NOT NULL
                    CONSTRAINT snapshot_canonical_version_positive CHECK (canonical_version > 0),
  payload           jsonb NOT NULL
                    CONSTRAINT snapshot_payload_is_object CHECK (jsonb_typeof(payload) = 'object'),
  content_sha256    bytea NOT NULL GENERATED ALWAYS AS (jsonb_sha256(payload)) STORED,
  CONSTRAINT snapshot_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE,
  CONSTRAINT snapshot_content_unique UNIQUE (listing_id, content_sha256),
  -- Target of fetch_log (snapshot_id, listing_id): a fetch can only point at a snapshot of its own listing.
  CONSTRAINT snapshot_id_listing_unique UNIQUE (id, listing_id)
);

CREATE TRIGGER snapshot_append_only
  BEFORE UPDATE OR DELETE ON snapshot
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER snapshot_append_only_truncate
  BEFORE TRUNCATE ON snapshot
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE snapshot IS
  'Append-only, content-addressed copies of what a listing page showed, in canonical JSON with personal data removed (ADR-0008 point 7).';
COMMENT ON COLUMN snapshot.first_fetched_at IS 'When this content was first fetched; later identical fetches point here from fetch_log.';
COMMENT ON COLUMN snapshot.canonical_version IS
  'Version of the crawler''s canonical form. A new version may re-express an unchanged page as new JSON, which is then a new snapshot; identical JSON is one snapshot whatever the version.';
COMMENT ON COLUMN snapshot.payload IS
  'What the page showed, as canonical JSON: phone numbers and other personal data are removed before storage (ADR-0008 point 7). Compressed with lz4 through default_toast_compression (db/postgresql.conf).';
COMMENT ON COLUMN snapshot.content_sha256 IS 'Computed by the database from payload, so the deduplication key can never disagree with the content.';

-- The snapshot a fetch produced or found unchanged. SET NULL (snapshot_id) keeps the fetch when a snapshot alone
-- is purged, and the index lets that purge find the fetches without reading the whole log.
ALTER TABLE fetch_log
  ADD CONSTRAINT fetch_log_snapshot_fk FOREIGN KEY (snapshot_id, listing_id)
    REFERENCES snapshot (id, listing_id) ON DELETE SET NULL (snapshot_id);
CREATE INDEX fetch_log_snapshot_idx ON fetch_log (snapshot_id, listing_id);

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DROP TABLE fetch_log;
DROP TABLE snapshot;
DROP TABLE crawl_run;
