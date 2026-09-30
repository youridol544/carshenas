-- migrate:up
-- How fresh the index is, measured and kept (CS-35 criterion 6; ADR-0017 point 6; shown by CS-66 and the superadmin
-- section, CS-41). A worker job measures every hour, for each crawled source and for each of its tracked models, over
-- the 24 hours before measured_at: listings first stored and listings that left the market, the minutes from a
-- listing's posting to its first sighting, and how long ago the active listings were last seen or checked, which is
-- what a results page shows (ADR-0017 point 6: seen within 48 hours, median under 24). Rows are observations: never
-- changed, and deleted only in a purge. Minutes are NULL when there was nothing to measure.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE freshness_measurement (
  id bigint GENERATED ALWAYS AS IDENTITY,
  source_id text NOT NULL,
  source_model_key text,
  measured_at timestamptz NOT NULL,
  new_listings integer NOT NULL,
  left_market integer NOT NULL,
  active_listings integer NOT NULL,
  seen_within_48h integer NOT NULL,
  posting_to_first_seen_p50_minutes integer,
  posting_to_first_seen_p90_minutes integer,
  last_seen_age_p50_minutes integer,
  last_seen_age_p90_minutes integer,
  CONSTRAINT freshness_measurement_pkey PRIMARY KEY (id),
  CONSTRAINT freshness_measurement_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE CASCADE,
  CONSTRAINT freshness_measurement_once_unique UNIQUE NULLS NOT DISTINCT (source_id, source_model_key, measured_at),
  CONSTRAINT freshness_measurement_source_model_key_format
    CHECK (source_model_key ~ '^\S(.*\S)?$' AND char_length(source_model_key) <= 200),
  CONSTRAINT freshness_measurement_counts_nonnegative
    CHECK (new_listings >= 0 AND left_market >= 0 AND active_listings >= 0 AND seen_within_48h >= 0),
  CONSTRAINT freshness_measurement_seen_within_active CHECK (seen_within_48h <= active_listings),
  CONSTRAINT freshness_measurement_minutes_nonnegative CHECK (
    posting_to_first_seen_p50_minutes >= 0 AND posting_to_first_seen_p90_minutes >= posting_to_first_seen_p50_minutes
    AND last_seen_age_p50_minutes >= 0 AND last_seen_age_p90_minutes >= last_seen_age_p50_minutes)
);

CREATE TRIGGER freshness_measurement_append_only
  BEFORE UPDATE OR DELETE ON freshness_measurement
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER freshness_measurement_append_only_truncate
  BEFORE TRUNCATE ON freshness_measurement
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE freshness_measurement IS
  'How fresh the index is, measured every hour per crawled source (source_model_key NULL) and per tracked model, over the 24 hours before measured_at (CS-35; ADR-0017 point 6). Append-only.';
COMMENT ON COLUMN freshness_measurement.source_model_key IS
  'The tracked model''s own filter value on the source (Divar''s brand_model); its trims are counted with it. NULL: the whole source.';
COMMENT ON COLUMN freshness_measurement.new_listings IS 'Listings first stored in the 24 hours before measured_at.';
COMMENT ON COLUMN freshness_measurement.left_market IS
  'Listings whose delisted_at falls in the 24 hours before measured_at: sold, expired or gone.';
COMMENT ON COLUMN freshness_measurement.seen_within_48h IS
  'Active listings seen in a list or checked on their own page within 48 hours: what a results page may show (ADR-0017 point 6).';
COMMENT ON COLUMN freshness_measurement.posting_to_first_seen_p50_minutes IS
  'Median minutes from posting (listed_at) to first storing (created_at), over the listings first stored in the 24 hours whose page has been read, so their posting time is the source''s own. The target is under an hour for tracked models.';
COMMENT ON COLUMN freshness_measurement.last_seen_age_p50_minutes IS
  'Median minutes since each active listing was last seen or checked, at measured_at. The target is under 24 hours.';

GRANT SELECT, INSERT ON freshness_measurement TO carshenas_worker;
-- The public data-status page (CS-66) shows these figures.
GRANT SELECT ON freshness_measurement TO carshenas_web;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE freshness_measurement;
