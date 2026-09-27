-- 01_core.sql: the crawled-now model (external listings only).
-- Conventions: bigint identity keys; text code keys for tiny curated vocabularies; timestamptz everywhere;
-- `date` only for Asia/Tehran business days; money as bigint toman with the unit in the column name;
-- states as text + CHECK (easy to extend), one ordered enum (deal_rating); every constraint named.
BEGIN;

-- ---------------------------------------------------------------- helpers
-- Persian normalisation for matching (not for display): Arabic yeh/kaf/alef maksura to Persian, heh forms to heh,
-- Persian and Arabic-Indic digits to Latin, ZWNJ/ZWJ to space, Latin to lower case, whitespace collapsed.
CREATE FUNCTION normalize_fa(t text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN btrim(regexp_replace(lower(translate(
         regexp_replace(t, '[ً-ٰٟ]', '', 'g'),            -- strip harakat
         'يكىۀة۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩' || chr(8204) || chr(8205),
         'یکیهه01234567890123456789  ')), '\s+', ' ', 'g'));

-- sha256 of a jsonb value's canonical text. convert_to() is STABLE only because of encoding conversion;
-- in a UTF8 database converting to UTF8 is the identity, so declaring this wrapper IMMUTABLE is safe here.
CREATE FUNCTION jsonb_sha256(j jsonb) RETURNS bytea
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN sha256(convert_to(j::text, 'UTF8'));

CREATE FUNCTION forbid_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('carshenas.purge', true), '') = 'on' THEN
    RETURN NEW;   -- a purge may null out references here (ON DELETE SET NULL) while it deletes a source's data
  END IF;
  RAISE EXCEPTION '% is append-only: UPDATE is not allowed', TG_TABLE_NAME
    USING HINT = 'Insert a new row; a purge (removal request) is the only way rows leave this table.';
END $$;

CREATE FUNCTION forbid_delete_unless_purge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('carshenas.purge', true), '') <> 'on' THEN
    RAISE EXCEPTION '% rows are immutable: DELETE only inside a purge', TG_TABLE_NAME
      USING HINT = 'Run the removal request through purge_listings(), which sets carshenas.purge for its transaction.';
  END IF;
  RETURN OLD;
END $$;

-- ---------------------------------------------------------------- layer 0: sources and crawl policy (curated)
CREATE TABLE source (
  id                      text PRIMARY KEY CONSTRAINT source_id_format CHECK (id ~ '^[a-z][a-z0-9_]{1,30}$'),
  origin                  text NOT NULL CONSTRAINT source_origin_valid CHECK (origin IN ('external', 'native', 'benchmark')),
  access_method           text NOT NULL CONSTRAINT source_access_method_valid CHECK (access_method IN ('crawl', 'official_api', 'native')),
  name_fa                 text NOT NULL,
  base_url                text NOT NULL,
  listing_visibility      text NOT NULL CONSTRAINT source_visibility_valid CHECK (listing_visibility IN ('public', 'requester_only')),
  crawl_state             text NOT NULL DEFAULT 'paused'
                          CONSTRAINT source_crawl_state_valid CHECK (crawl_state IN ('enabled', 'paused', 'stopped_on_block')),
  min_request_interval_ms integer,
  policy_max_age          interval NOT NULL DEFAULT '30 days',
  stopped_at              timestamptz,
  stop_fetch_id           bigint,           -- FK to fetch_log added below (circular)
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_native_iff_native_access CHECK ((origin = 'native') = (access_method = 'native')),
  CONSTRAINT source_crawl_interval_floor CHECK (access_method <> 'crawl' OR min_request_interval_ms >= 3000), -- ADR-0008 point 5
  CONSTRAINT source_only_crawl_sources_run CHECK (crawl_state = 'paused' OR access_method = 'crawl'),           -- Divar is never crawled
  CONSTRAINT source_stop_has_evidence CHECK ((crawl_state = 'stopped_on_block') = (stopped_at IS NOT NULL AND stop_fetch_id IS NOT NULL)),
  CONSTRAINT source_id_origin_key UNIQUE (id, origin)  -- target of listing (source_id, origin)
);

-- Append-only record of each robots.txt and terms reading (CS-5; ADR-0008 point 1). The latest row is in force.
CREATE TABLE source_policy_check (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id      text NOT NULL REFERENCES source (id) ON DELETE RESTRICT,
  checked_at     timestamptz NOT NULL,
  checked_by     text NOT NULL,
  robots_txt     text,
  terms_url      text,
  terms_summary  text NOT NULL,
  verdict        text NOT NULL CONSTRAINT policy_verdict_valid CHECK (verdict IN ('allowed', 'allowed_with_conditions', 'not_allowed')),
  conditions     text,
  photos_allowed boolean NOT NULL,  -- may we download and re-host this source's photos (ADR-0010)?
  CONSTRAINT policy_conditions_stated CHECK (verdict <> 'allowed_with_conditions' OR conditions IS NOT NULL),
  CONSTRAINT policy_not_allowed_no_photos CHECK (verdict <> 'not_allowed' OR NOT photos_allowed),
  CONSTRAINT policy_check_id_source_key UNIQUE (id, source_id)
);
CREATE TRIGGER source_policy_check_append_only BEFORE UPDATE ON source_policy_check
  FOR EACH ROW EXECUTE FUNCTION forbid_update();

CREATE VIEW source_current_policy AS
SELECT DISTINCT ON (source_id) *
FROM source_policy_check
ORDER BY source_id, checked_at DESC, id DESC;

-- ---------------------------------------------------------------- curated vocabularies (code tables)
CREATE TABLE body_type (
  code     text PRIMARY KEY CONSTRAINT body_type_code_format CHECK (code ~ '^[a-z_]+$'),
  label_fa text NOT NULL UNIQUE
);
CREATE TABLE colour (
  code     text PRIMARY KEY CONSTRAINT colour_code_format CHECK (code ~ '^[a-z_]+$'),
  label_fa text NOT NULL UNIQUE
);
CREATE TABLE condition_kind (
  code        text PRIMARY KEY CONSTRAINT condition_kind_code_format CHECK (code ~ '^[a-z_]+$'),
  label_fa    text NOT NULL UNIQUE,
  severity    smallint NOT NULL CONSTRAINT condition_kind_severity_range CHECK (severity BETWEEN 0 AND 5),
  needs_panel boolean NOT NULL DEFAULT false
);
-- Every extracted field with its review threshold (CS-8 #2).
CREATE TABLE extraction_field_def (
  code           text PRIMARY KEY CONSTRAINT extraction_field_code_format CHECK (code ~ '^[a-z_]+$'),
  min_confidence numeric(4,3) NOT NULL CONSTRAINT field_def_threshold_range CHECK (min_confidence > 0 AND min_confidence <= 1),
  description    text NOT NULL
);

-- ---------------------------------------------------------------- geography (curated)
CREATE TABLE province (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug    text NOT NULL UNIQUE CONSTRAINT province_slug_format CHECK (slug ~ '^[a-z][a-z0-9-]*$'),
  name_fa text NOT NULL UNIQUE
);
CREATE TABLE city (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  province_id bigint NOT NULL REFERENCES province (id) ON DELETE RESTRICT,
  slug        text NOT NULL CONSTRAINT city_slug_format CHECK (slug ~ '^[a-z][a-z0-9-]*$'),
  name_fa     text NOT NULL,
  CONSTRAINT city_slug_unique UNIQUE (province_id, slug),
  CONSTRAINT city_name_unique UNIQUE (province_id, name_fa),
  CONSTRAINT city_id_province_key UNIQUE (id, province_id)
);
CREATE TABLE city_alias (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city_id    bigint NOT NULL REFERENCES city (id) ON DELETE CASCADE,
  alias      text NOT NULL,
  alias_norm text GENERATED ALWAYS AS (normalize_fa(alias)) STORED,
  source_id  text REFERENCES source (id) ON DELETE CASCADE,  -- NULL: a general alias; set: how one source writes it
  CONSTRAINT city_alias_unique UNIQUE NULLS NOT DISTINCT (alias_norm, source_id)
);

-- ---------------------------------------------------------------- catalogue: make > model > trim (curated, CS-10)
CREATE TABLE make (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug    text NOT NULL UNIQUE CONSTRAINT make_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name_fa text NOT NULL UNIQUE,
  name_en text NOT NULL UNIQUE,
  name_norm text GENERATED ALWAYS AS (normalize_fa(name_fa || ' ' || name_en)) STORED
);
CREATE TABLE model (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  make_id bigint NOT NULL REFERENCES make (id) ON DELETE RESTRICT,
  slug    text NOT NULL CONSTRAINT model_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name_fa text NOT NULL,
  name_en text NOT NULL,
  name_norm text GENERATED ALWAYS AS (normalize_fa(name_fa || ' ' || name_en)) STORED,
  CONSTRAINT model_slug_unique UNIQUE (make_id, slug),
  CONSTRAINT model_id_make_key UNIQUE (id, make_id)   -- lets child rows carry a consistent (model_id, make_id)
);
CREATE TABLE trim (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_id      bigint NOT NULL REFERENCES model (id) ON DELETE RESTRICT,
  slug          text NOT NULL CONSTRAINT trim_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name_fa       text NOT NULL,
  name_en       text NOT NULL,
  name_norm     text GENERATED ALWAYS AS (normalize_fa(name_fa || ' ' || name_en)) STORED,
  body_type     text REFERENCES body_type (code),
  first_year_sh smallint CONSTRAINT trim_first_year_range CHECK (first_year_sh BETWEEN 1300 AND 1500),
  last_year_sh  smallint CONSTRAINT trim_last_year_range CHECK (last_year_sh BETWEEN 1300 AND 1500),
  CONSTRAINT trim_years_ordered CHECK (first_year_sh IS NULL OR last_year_sh IS NULL OR first_year_sh <= last_year_sh),
  CONSTRAINT trim_slug_unique UNIQUE (model_id, slug),
  CONSTRAINT trim_id_model_key UNIQUE (id, model_id)
);
-- Aliases: Persian, Latin-typed and spelled-out names. Like Wikidata aliases they need not be unique across
-- targets («تیپ ۲» exists under many models); matching resolves ambiguity by context (make > model > trim).
CREATE TABLE catalogue_alias (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alias      text NOT NULL CONSTRAINT catalogue_alias_not_blank CHECK (btrim(alias) <> ''),
  alias_norm text GENERATED ALWAYS AS (normalize_fa(alias)) STORED,
  script     text NOT NULL CONSTRAINT catalogue_alias_script_valid CHECK (script IN ('fa', 'latin', 'spelled_number', 'mixed')),
  make_id    bigint REFERENCES make (id) ON DELETE CASCADE,
  model_id   bigint REFERENCES model (id) ON DELETE CASCADE,
  trim_id    bigint REFERENCES trim (id) ON DELETE CASCADE,
  source_id  text REFERENCES source (id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'curated' CONSTRAINT catalogue_alias_status_valid CHECK (status IN ('curated', 'suggested', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_alias_one_target CHECK (num_nonnulls(make_id, model_id, trim_id) = 1),
  CONSTRAINT catalogue_alias_unique UNIQUE NULLS NOT DISTINCT (alias_norm, make_id, model_id, trim_id, source_id)
);

-- ---------------------------------------------------------------- the physical car (entity-resolution cluster)
-- A vehicle IS the duplicate group: the set of listings whose vehicle_id points here. Merged vehicles stay as
-- tombstones so old references (alerts, links) still resolve.
CREATE TABLE vehicle (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status                 text NOT NULL DEFAULT 'active' CONSTRAINT vehicle_status_valid CHECK (status IN ('active', 'merged')),
  merged_into_vehicle_id bigint REFERENCES vehicle (id) ON DELETE RESTRICT,
  merged_at              timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_merge_consistent CHECK ((status = 'merged') = (merged_into_vehicle_id IS NOT NULL AND merged_at IS NOT NULL)),
  CONSTRAINT vehicle_not_merged_into_itself CHECK (merged_into_vehicle_id <> id)
);

-- ---------------------------------------------------------------- the offer: listing core (any origin)
CREATE TABLE listing (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  origin                text NOT NULL DEFAULT 'external' CONSTRAINT listing_origin_valid CHECK (origin IN ('external', 'native')),
  source_id             text NOT NULL,
  source_listing_key    text,              -- the source's own ad id or token; NULL only for native listings
  url                   text,              -- click-out target for external listings
  status                text NOT NULL,
  listed_at             timestamptz,       -- first time on the market (days on market start here)
  delisted_at           timestamptz,       -- left the market (gone, sold, expired, ...)
  last_seen_at          timestamptz,       -- external: last fetch that showed it
  vehicle_id            bigint REFERENCES vehicle (id) ON DELETE RESTRICT,  -- NULL until entity resolution runs
  -- catalogue match (CS-10): denormalised ids kept consistent by composite foreign keys
  make_id               bigint,
  model_id              bigint,
  trim_id               bigint,
  catalogue_match       text NOT NULL DEFAULT 'none'
                        CONSTRAINT listing_catalogue_match_valid CHECK (catalogue_match IN ('trim', 'model', 'make', 'none')),
  -- vehicle claims as this listing states them (two listings of one car may disagree)
  model_year_sh         smallint CONSTRAINT listing_model_year_sh_range CHECK (model_year_sh BETWEEN 1300 AND 1500),
  model_year_ad         smallint CONSTRAINT listing_model_year_ad_range CHECK (model_year_ad BETWEEN 1920 AND 2100),
  model_year_written    text CONSTRAINT listing_model_year_written_valid CHECK (model_year_written IN ('sh', 'ad')),
  mileage_km            integer CONSTRAINT listing_mileage_range CHECK (mileage_km >= 0 AND mileage_km < 3000000),
  fuel                  text CONSTRAINT listing_fuel_valid CHECK (fuel IN ('petrol', 'dual_fuel', 'hybrid', 'electric', 'diesel')),
  gearbox               text CONSTRAINT listing_gearbox_valid CHECK (gearbox IN ('manual', 'automatic')),
  body_condition        text CONSTRAINT listing_body_condition_valid
                        CHECK (body_condition IN ('paint_free', 'spot_paint', 'partly_repainted', 'fully_repainted', 'accident_damaged')),
  exterior_colour       text REFERENCES colour (code),
  insurance_months_left smallint CONSTRAINT listing_insurance_range CHECK (insurance_months_left BETWEEN 0 AND 12),
  -- the offer itself
  price_type            text CONSTRAINT listing_price_type_valid CHECK (price_type IN ('asking', 'negotiable', 'installment', 'placeholder')),
  asking_price_toman    bigint CONSTRAINT listing_asking_price_positive CHECK (asking_price_toman > 0),
  accepts_swap          boolean,           -- NULL: the ad does not say
  city_id               bigint REFERENCES city (id) ON DELETE RESTRICT,
  district_text         text,
  seller_type           text CONSTRAINT listing_seller_type_valid CHECK (seller_type IN ('dealer', 'private')),
  source_dealer_key     text,              -- a dealer's id on the source; never stored for private sellers
  title                 text,
  title_norm            text GENERATED ALWAYS AS (normalize_fa(title)) STORED,   -- normalised once, at write time
  description_redacted  text,              -- phone numbers removed before storage (ADR-0008 point 7)
  -- provenance of the derived attributes
  latest_snapshot_id    bigint,            -- FK added after snapshot
  extraction_id         bigint,            -- FK added after extraction
  review_pending        boolean NOT NULL DEFAULT false,
  attributes_updated_at timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT listing_source_fk FOREIGN KEY (source_id, origin) REFERENCES source (id, origin) ON DELETE RESTRICT,
  CONSTRAINT listing_source_key_unique UNIQUE (source_id, source_listing_key),
  CONSTRAINT listing_make_fk FOREIGN KEY (make_id) REFERENCES make (id) ON DELETE RESTRICT,
  CONSTRAINT listing_model_make_fk FOREIGN KEY (model_id, make_id) REFERENCES model (id, make_id) ON DELETE RESTRICT,
  CONSTRAINT listing_trim_model_fk FOREIGN KEY (trim_id, model_id) REFERENCES trim (id, model_id) ON DELETE RESTRICT,
  CONSTRAINT listing_only_external_for_now CHECK (origin = 'external'),               -- dropped by 02_native.sql
  CONSTRAINT listing_external_identity CHECK (origin <> 'external' OR (source_listing_key IS NOT NULL AND url IS NOT NULL)),
  CONSTRAINT listing_status_valid CHECK (status IN ('active', 'sold', 'expired', 'gone', 'removed')), -- 02 widens
  CONSTRAINT listing_catalogue_match_consistent CHECK (
        (catalogue_match = 'trim'  AND trim_id IS NOT NULL AND model_id IS NOT NULL AND make_id IS NOT NULL)
     OR (catalogue_match = 'model' AND trim_id IS NULL AND model_id IS NOT NULL AND make_id IS NOT NULL)
     OR (catalogue_match = 'make'  AND trim_id IS NULL AND model_id IS NULL AND make_id IS NOT NULL)
     OR (catalogue_match = 'none'  AND trim_id IS NULL AND model_id IS NULL AND make_id IS NULL)),
  CONSTRAINT listing_model_year_written_present CHECK (
        model_year_written IS NULL
     OR (model_year_written = 'sh' AND model_year_sh IS NOT NULL)
     OR (model_year_written = 'ad' AND model_year_ad IS NOT NULL)),
  CONSTRAINT listing_model_year_calendars_agree CHECK (
        model_year_sh IS NULL OR model_year_ad IS NULL OR model_year_ad - model_year_sh BETWEEN 621 AND 622),
  CONSTRAINT listing_price_matches_type CHECK (
        (price_type IS NULL AND asking_price_toman IS NULL)
     OR (price_type = 'negotiable' AND asking_price_toman IS NULL)
     OR (price_type IN ('asking', 'installment', 'placeholder') AND asking_price_toman IS NOT NULL)),
  CONSTRAINT listing_private_seller_has_no_key CHECK (source_dealer_key IS NULL OR seller_type = 'dealer'),
  CONSTRAINT listing_active_is_listed CHECK (status <> 'active' OR (listed_at IS NOT NULL AND delisted_at IS NULL)),
  CONSTRAINT listing_off_market_has_date CHECK ((status IN ('sold', 'expired', 'gone', 'withdrawn', 'removed')) = (delisted_at IS NOT NULL)),
  CONSTRAINT listing_market_dates_ordered CHECK (delisted_at IS NULL OR (listed_at IS NOT NULL AND delisted_at >= listed_at))
);

-- Lifecycle as data: which status changes each origin allows ('new' = the first status on insert).
CREATE TABLE listing_status_transition (
  origin      text NOT NULL CONSTRAINT transition_origin_valid CHECK (origin IN ('external', 'native')),
  from_status text NOT NULL,
  to_status   text NOT NULL,
  PRIMARY KEY (origin, from_status, to_status)
);
INSERT INTO listing_status_transition (origin, from_status, to_status) VALUES
  ('external', 'new', 'active'), ('external', 'new', 'gone'),          -- a pasted link may already be gone
  ('external', 'active', 'sold'), ('external', 'active', 'expired'),
  ('external', 'active', 'gone'), ('external', 'active', 'removed'),
  ('external', 'gone', 'active'), ('external', 'expired', 'active'), ('external', 'sold', 'active');

CREATE FUNCTION listing_status_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_from text := CASE WHEN TG_OP = 'INSERT' THEN 'new' ELSE OLD.status END;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.origin IS DISTINCT FROM OLD.origin THEN
    RAISE EXCEPTION 'listing %: origin cannot change', OLD.id;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM listing_status_transition t
                 WHERE t.origin = NEW.origin AND t.from_status = v_from AND t.to_status = NEW.status) THEN
    RAISE EXCEPTION 'listing %: % listing cannot go from % to %', NEW.id, NEW.origin, v_from, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER listing_status_guard BEFORE INSERT OR UPDATE OF status, origin ON listing
  FOR EACH ROW EXECUTE FUNCTION listing_status_guard();

-- ---------------------------------------------------------------- layer 1: raw observations (immutable)
CREATE TABLE crawl_run (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       text NOT NULL REFERENCES source (id) ON DELETE RESTRICT,
  policy_check_id bigint NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text NOT NULL DEFAULT 'running'
                  CONSTRAINT crawl_run_status_valid CHECK (status IN ('running', 'succeeded', 'failed', 'stopped_on_block')),
  pages_fetched   integer NOT NULL DEFAULT 0 CONSTRAINT crawl_run_pages_nonneg CHECK (pages_fetched >= 0),
  snapshots_new   integer NOT NULL DEFAULT 0 CONSTRAINT crawl_run_snapshots_nonneg CHECK (snapshots_new >= 0),
  price_changes   integer NOT NULL DEFAULT 0 CONSTRAINT crawl_run_price_changes_nonneg CHECK (price_changes >= 0),
  errors          integer NOT NULL DEFAULT 0 CONSTRAINT crawl_run_errors_nonneg CHECK (errors >= 0),
  CONSTRAINT crawl_run_policy_same_source FOREIGN KEY (policy_check_id, source_id)
    REFERENCES source_policy_check (id, source_id) ON DELETE RESTRICT,
  CONSTRAINT crawl_run_finished_consistent CHECK ((status = 'running') = (finished_at IS NULL)),
  CONSTRAINT crawl_run_time_ordered CHECK (finished_at IS NULL OR finished_at >= started_at),
  CONSTRAINT crawl_run_id_source_key UNIQUE (id, source_id)
);
-- One crawl at a time per source (ADR-0008 point 5: one request at a time per host).
CREATE UNIQUE INDEX crawl_run_one_running_per_source ON crawl_run (source_id) WHERE status = 'running';

CREATE FUNCTION crawl_run_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  s source%ROWTYPE;
  p record;
BEGIN
  SELECT * INTO s FROM source WHERE id = NEW.source_id;
  IF s.access_method <> 'crawl' THEN
    RAISE EXCEPTION 'source % is read through %, never crawled (ADR-0008)', s.id, s.access_method;
  END IF;
  IF s.crawl_state <> 'enabled' THEN
    RAISE EXCEPTION 'source % is %; a human re-enables it after reading the stop evidence', s.id, s.crawl_state;
  END IF;
  SELECT * INTO p FROM source_current_policy WHERE source_id = NEW.source_id;
  IF NOT FOUND OR p.id <> NEW.policy_check_id THEN
    RAISE EXCEPTION 'crawl of % must cite its latest policy check', NEW.source_id;
  END IF;
  IF p.verdict = 'not_allowed' THEN
    RAISE EXCEPTION 'the terms of % do not allow crawling (policy check %)', NEW.source_id, p.id;
  END IF;
  IF p.checked_at < now() - s.policy_max_age THEN
    RAISE EXCEPTION 'robots.txt and terms of % were last read %; re-check before crawling', NEW.source_id, p.checked_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crawl_run_guard BEFORE INSERT ON crawl_run FOR EACH ROW EXECUTE FUNCTION crawl_run_guard();

-- One row per request we made (append-only). Identical content is a revisit: it points at an existing snapshot.
CREATE TABLE fetch_log (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id        text NOT NULL,
  crawl_run_id     bigint,
  paste_request_id bigint,   -- FK added after paste_request
  url              text NOT NULL,
  method           text NOT NULL DEFAULT 'http_get' CONSTRAINT fetch_method_valid CHECK (method IN ('http_get', 'official_api')),
  requested_at     timestamptz NOT NULL DEFAULT now(),
  http_status      smallint CONSTRAINT fetch_http_status_range CHECK (http_status BETWEEN 100 AND 599),
  outcome          text NOT NULL CONSTRAINT fetch_outcome_valid
                   CHECK (outcome IN ('ok', 'not_modified', 'not_found', 'gone', 'blocked', 'rate_limited', 'challenge', 'error')),
  duration_ms      integer CONSTRAINT fetch_duration_nonneg CHECK (duration_ms >= 0),
  etag             text,
  last_modified    text,
  listing_id       bigint REFERENCES listing (id) ON DELETE SET NULL,
  snapshot_id      bigint,   -- FK added after snapshot
  CONSTRAINT fetch_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE RESTRICT,
  CONSTRAINT fetch_run_same_source FOREIGN KEY (crawl_run_id, source_id) REFERENCES crawl_run (id, source_id) ON DELETE CASCADE,
  CONSTRAINT fetch_has_one_cause CHECK (num_nonnulls(crawl_run_id, paste_request_id) = 1)
);
CREATE TRIGGER fetch_log_append_only BEFORE UPDATE ON fetch_log FOR EACH ROW EXECUTE FUNCTION forbid_update();

ALTER TABLE source ADD CONSTRAINT source_stop_fetch_fk FOREIGN KEY (stop_fetch_id) REFERENCES fetch_log (id) ON DELETE RESTRICT;

-- Backstop for ADR-0008 point 6: a block stops the source in the same transaction that records it,
-- and no further crawl request can be logged until a human re-enables the source.
CREATE FUNCTION fetch_log_before() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.crawl_run_id IS NOT NULL THEN
    IF (SELECT crawl_state FROM source WHERE id = NEW.source_id) <> 'enabled' THEN
      RAISE EXCEPTION 'source % is not enabled: request to % must not be sent (ADR-0008 point 6)', NEW.source_id, NEW.url;
    END IF;
    IF (SELECT status FROM crawl_run WHERE id = NEW.crawl_run_id) <> 'running' THEN
      RAISE EXCEPTION 'crawl run % is not running', NEW.crawl_run_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fetch_log_before BEFORE INSERT ON fetch_log FOR EACH ROW EXECUTE FUNCTION fetch_log_before();

CREATE FUNCTION fetch_log_after() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.outcome IN ('blocked', 'rate_limited', 'challenge') AND NEW.crawl_run_id IS NOT NULL THEN
    UPDATE source SET crawl_state = 'stopped_on_block', stopped_at = NEW.requested_at, stop_fetch_id = NEW.id
     WHERE id = NEW.source_id;
    UPDATE crawl_run SET status = 'stopped_on_block', finished_at = greatest(NEW.requested_at, started_at)
     WHERE id = NEW.crawl_run_id AND status = 'running';
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER fetch_log_after AFTER INSERT ON fetch_log FOR EACH ROW EXECUTE FUNCTION fetch_log_after();

-- Content-addressed, immutable copies of what a source showed. The hash is computed by the database from the
-- canonical payload, so the dedupe key can never disagree with the content.
CREATE TABLE snapshot (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id        bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  first_fetched_at  timestamptz NOT NULL,
  url               text NOT NULL,
  canonical_version smallint NOT NULL CONSTRAINT snapshot_canonical_version_positive CHECK (canonical_version > 0),
  payload           jsonb COMPRESSION lz4 NOT NULL,   -- redacted: no phone numbers (ADR-0008 point 7)
  content_sha256    bytea GENERATED ALWAYS AS (jsonb_sha256(payload)) STORED,
  photo_urls        text[] NOT NULL DEFAULT '{}',     -- recorded even when photos may not be downloaded (CS-6)
  raw_object_key    text,                             -- optional compressed raw page in object storage
  CONSTRAINT snapshot_unique_content UNIQUE (listing_id, content_sha256)
);
CREATE TRIGGER snapshot_immutable BEFORE UPDATE ON snapshot FOR EACH ROW EXECUTE FUNCTION forbid_update();
CREATE TRIGGER snapshot_delete_only_in_purge BEFORE DELETE ON snapshot FOR EACH ROW EXECUTE FUNCTION forbid_delete_unless_purge();

ALTER TABLE fetch_log ADD CONSTRAINT fetch_snapshot_fk FOREIGN KEY (snapshot_id) REFERENCES snapshot (id) ON DELETE SET NULL;
ALTER TABLE listing ADD CONSTRAINT listing_latest_snapshot_fk FOREIGN KEY (latest_snapshot_id) REFERENCES snapshot (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------- LLM extraction: recorded external responses
-- Kept, not recomputed: a re-run costs money and may answer differently (Fowler's "external query").
CREATE TABLE extraction (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_id     bigint NOT NULL REFERENCES snapshot (id) ON DELETE CASCADE,
  input_sha256    bytea NOT NULL CONSTRAINT extraction_input_sha256_length CHECK (octet_length(input_sha256) = 32),
  prompt_version  text NOT NULL CONSTRAINT extraction_prompt_version_format CHECK (prompt_version ~ '^extract-v[0-9]+(\.[0-9]+)*$'),
  model           text NOT NULL,
  status          text NOT NULL CONSTRAINT extraction_status_valid CHECK (status IN ('accepted', 'needs_review')),
  output          jsonb NOT NULL,   -- schema-valid output only; invalid output is retried or queued, never stored (CS-8 #1)
  input_tokens    integer NOT NULL CONSTRAINT extraction_input_tokens_nonneg CHECK (input_tokens >= 0),
  output_tokens   integer NOT NULL CONSTRAINT extraction_output_tokens_nonneg CHECK (output_tokens >= 0),
  cost_usd_micros bigint NOT NULL CONSTRAINT extraction_cost_nonneg CHECK (cost_usd_micros >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT extraction_cache_key UNIQUE (input_sha256, prompt_version, model)   -- CS-8 #3: no second model call
);
CREATE TABLE extraction_field (
  extraction_id bigint NOT NULL REFERENCES extraction (id) ON DELETE CASCADE,
  field         text NOT NULL REFERENCES extraction_field_def (code),
  value         jsonb,               -- NULL: the ad does not say
  confidence    numeric(4,3) NOT NULL CONSTRAINT extraction_field_confidence_range CHECK (confidence BETWEEN 0 AND 1),
  threshold     numeric(4,3) NOT NULL CONSTRAINT extraction_field_threshold_range CHECK (threshold > 0 AND threshold <= 1),
  evidence      text,                -- the sentence the value was read from (condition chips show it)
  status        text NOT NULL CONSTRAINT extraction_field_status_valid CHECK (status IN ('accepted', 'needs_review', 'corrected', 'rejected')),
  PRIMARY KEY (extraction_id, field),
  CONSTRAINT extraction_field_value_has_evidence CHECK (value IS NULL OR evidence IS NOT NULL),
  CONSTRAINT extraction_field_accepted_meets_threshold CHECK (status <> 'accepted' OR confidence >= threshold),
  CONSTRAINT extraction_field_review_below_threshold CHECK (status <> 'needs_review' OR confidence < threshold)
);
ALTER TABLE listing ADD CONSTRAINT listing_extraction_fk FOREIGN KEY (extraction_id) REFERENCES extraction (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------- listing details (derived from extraction)
CREATE TABLE listing_condition (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id    bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  kind          text NOT NULL REFERENCES condition_kind (code),
  panel         text CONSTRAINT listing_condition_panel_valid CHECK (panel IN (
                  'hood', 'roof', 'trunk', 'front_bumper', 'rear_bumper', 'front_left_fender', 'front_right_fender',
                  'rear_left_fender', 'rear_right_fender', 'front_left_door', 'front_right_door', 'rear_left_door',
                  'rear_right_door', 'pillar', 'chassis')),
  spot_count    smallint CONSTRAINT listing_condition_spot_count_positive CHECK (spot_count > 0),
  evidence      text NOT NULL,
  extraction_id bigint REFERENCES extraction (id) ON DELETE CASCADE,
  CONSTRAINT listing_condition_unique UNIQUE NULLS NOT DISTINCT (listing_id, kind, panel)
);

-- Keyed hashes of phone numbers for duplicate detection only (ADR-0008 point 7). A per-row random salt would make
-- equal numbers hash differently and defeat matching, so this is an HMAC with a secret key kept outside the database.
CREATE TABLE listing_contact_hash (
  listing_id  bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  phone_hmac  bytea NOT NULL CONSTRAINT contact_hmac_length CHECK (octet_length(phone_hmac) = 32),
  key_version smallint NOT NULL CONSTRAINT contact_key_version_positive CHECK (key_version > 0),
  PRIMARY KEY (listing_id, phone_hmac)
);

-- Price history: append-only; valid time = observed_at (first observation at this price), the next event ends it.
CREATE TABLE listing_price_event (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id           bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  observed_at          timestamptz NOT NULL,
  price_type           text NOT NULL CONSTRAINT price_event_type_valid CHECK (price_type IN ('asking', 'negotiable', 'installment', 'placeholder')),
  asking_price_toman   bigint CONSTRAINT price_event_price_positive CHECK (asking_price_toman > 0),
  previous_price_toman bigint CONSTRAINT price_event_previous_positive CHECK (previous_price_toman > 0),
  snapshot_id          bigint REFERENCES snapshot (id) ON DELETE CASCADE,
  recorded_at          timestamptz NOT NULL DEFAULT now(),   -- record time: differs from observed_at on re-derivation
  CONSTRAINT price_event_price_matches_type CHECK (
        (price_type = 'negotiable' AND asking_price_toman IS NULL)
     OR (price_type <> 'negotiable' AND asking_price_toman IS NOT NULL)),
  CONSTRAINT price_event_is_a_change CHECK (
        previous_price_toman IS NULL OR asking_price_toman IS NULL OR previous_price_toman <> asking_price_toman),
  CONSTRAINT price_event_from_snapshot CHECK (snapshot_id IS NOT NULL),            -- 02 widens to native revisions
  CONSTRAINT price_event_one_per_instant UNIQUE (listing_id, observed_at)
);
CREATE TRIGGER listing_price_event_append_only BEFORE UPDATE ON listing_price_event
  FOR EACH ROW EXECUTE FUNCTION forbid_update();

CREATE FUNCTION price_event_fill_previous() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT e.asking_price_toman INTO NEW.previous_price_toman
    FROM listing_price_event e
   WHERE e.listing_id = NEW.listing_id AND e.observed_at < NEW.observed_at
   ORDER BY e.observed_at DESC
   LIMIT 1;
  RETURN NEW;
END $$;
CREATE TRIGGER price_event_fill_previous BEFORE INSERT ON listing_price_event
  FOR EACH ROW EXECUTE FUNCTION price_event_fill_previous();

-- ---------------------------------------------------------------- photos (ADR-0010) and the deletion outbox
CREATE TABLE photo (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id           bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  position             smallint NOT NULL CONSTRAINT photo_position_nonneg CHECK (position >= 0),
  source_url           text,
  fetched_at           timestamptz,
  original_sha256      bytea CONSTRAINT photo_original_sha256_length CHECK (octet_length(original_sha256) = 32),
  pii_status           text NOT NULL DEFAULT 'pending'
                       CONSTRAINT photo_pii_status_valid CHECK (pii_status IN ('pending', 'clean', 'masked', 'dropped', 'review')),
  pii_detector_version text,
  stored_object_key    text UNIQUE,
  stored_sha256        bytea CONSTRAINT photo_stored_sha256_length CHECK (octet_length(stored_sha256) = 32),
  width                integer CONSTRAINT photo_width_positive CHECK (width > 0),
  height               integer CONSTRAINT photo_height_positive CHECK (height > 0),
  phash                bigint,   -- 64-bit perceptual hash for near-duplicate photos across sites
  CONSTRAINT photo_position_unique UNIQUE (listing_id, position) DEFERRABLE INITIALLY IMMEDIATE,
  -- only a clean or masked copy is ever stored; a photo with a phone number or plate is masked or dropped
  CONSTRAINT photo_stored_only_when_safe CHECK ((pii_status IN ('clean', 'masked')) = (stored_object_key IS NOT NULL)),
  CONSTRAINT photo_checked_names_detector CHECK (pii_status = 'pending' OR pii_detector_version IS NOT NULL),
  CONSTRAINT photo_stored_has_facts CHECK (stored_object_key IS NULL OR (stored_sha256 IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL))
);
CREATE TABLE photo_embedding (
  photo_id  bigint PRIMARY KEY REFERENCES photo (id) ON DELETE CASCADE,
  model     text NOT NULL,
  embedding vector(768) NOT NULL   -- dimension follows the chosen image model (provisional)
);

CREATE FUNCTION photo_source_allows() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  listing_origin text;
  allowed boolean;
BEGIN
  SELECT l.origin, coalesce(p.photos_allowed, false) INTO listing_origin, allowed
    FROM listing l LEFT JOIN source_current_policy p ON p.source_id = l.source_id
   WHERE l.id = NEW.listing_id;
  IF listing_origin = 'external' AND NOT allowed THEN
    RAISE EXCEPTION 'the source of listing % does not allow downloading its photos (ADR-0008 point 4)', NEW.listing_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER photo_source_allows BEFORE INSERT ON photo FOR EACH ROW EXECUTE FUNCTION photo_source_allows();

-- Transactional outbox: object-storage deletions are queued in the same transaction that deletes the row.
CREATE TABLE storage_deletion_outbox (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  object_key  text NOT NULL,
  reason      text NOT NULL,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  done_at     timestamptz
);
CREATE FUNCTION photo_enqueue_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.stored_object_key IS NOT NULL THEN
    INSERT INTO storage_deletion_outbox (object_key, reason) VALUES (OLD.stored_object_key, 'photo row deleted');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER photo_enqueue_deletion AFTER DELETE ON photo FOR EACH ROW EXECUTE FUNCTION photo_enqueue_deletion();

-- ---------------------------------------------------------------- entity resolution: evidence, decisions, membership history
CREATE TABLE listing_pair (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_a_id     bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  listing_b_id     bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  blocking_key     text NOT NULL,   -- CS-11 #1: same trim, year band, city and mileage band
  text_similarity  real CONSTRAINT listing_pair_text_sim_range CHECK (text_similarity BETWEEN 0 AND 1),
  photo_similarity real CONSTRAINT listing_pair_photo_sim_range CHECK (photo_similarity BETWEEN 0 AND 1),
  phone_match      boolean,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_pair_ordered CHECK (listing_a_id < listing_b_id),
  CONSTRAINT listing_pair_unique UNIQUE (listing_a_id, listing_b_id)
);
CREATE TABLE pair_decision (   -- append-only: every machine and human verdict is kept
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_pair_id bigint NOT NULL REFERENCES listing_pair (id) ON DELETE CASCADE,
  decision        text NOT NULL CONSTRAINT pair_decision_valid CHECK (decision IN ('match', 'non_match', 'uncertain')),
  decided_by      text NOT NULL CONSTRAINT pair_decider_valid CHECK (decided_by IN ('rule', 'model', 'llm', 'human')),
  decider_version text NOT NULL,
  score           real CONSTRAINT pair_decision_score_range CHECK (score BETWEEN 0 AND 1),
  reason          text,
  decided_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pair_decision_reason_stored CHECK (decided_by NOT IN ('llm', 'human') OR reason IS NOT NULL)  -- CS-11 #2
);
CREATE TRIGGER pair_decision_append_only BEFORE UPDATE ON pair_decision FOR EACH ROW EXECUTE FUNCTION forbid_update();
CREATE VIEW pair_current_decision AS   -- a human verdict outranks any later machine verdict
SELECT DISTINCT ON (listing_pair_id) *
FROM pair_decision
ORDER BY listing_pair_id, (decided_by = 'human') DESC, decided_at DESC, id DESC;

-- Which vehicle a listing belonged to, when (type-2 history). One vehicle per listing at any instant.
CREATE TABLE vehicle_membership (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  vehicle_id bigint NOT NULL REFERENCES vehicle (id) ON DELETE RESTRICT,
  valid      tstzrange NOT NULL CONSTRAINT vehicle_membership_valid_bounded CHECK (NOT isempty(valid) AND lower(valid) IS NOT NULL),
  cause      text NOT NULL CONSTRAINT vehicle_membership_cause_valid CHECK (cause IN ('first_resolution', 'merge', 'split', 'manual')),
  CONSTRAINT vehicle_membership_no_overlap EXCLUDE USING gist (listing_id WITH =, valid WITH &&)
);

-- ---------------------------------------------------------------- derived analytics: valuations (rebuildable)
CREATE TYPE deal_rating AS ENUM ('great', 'good', 'fair', 'high', 'overpriced');  -- ordered: great < good < ...

CREATE TABLE valuation_run (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  as_of_date     date NOT NULL,    -- the Asia/Tehran calendar day the values describe
  method_version text NOT NULL,
  status         text NOT NULL DEFAULT 'running'
                 CONSTRAINT valuation_run_status_valid CHECK (status IN ('running', 'succeeded', 'failed', 'superseded')),
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  params         jsonb NOT NULL DEFAULT '{}',
  metrics        jsonb,            -- e.g. median absolute percentage error on held-out listings (CS-12 #5)
  CONSTRAINT valuation_run_finished_consistent CHECK ((status = 'running') = (finished_at IS NULL)),
  CONSTRAINT valuation_run_id_date_key UNIQUE (id, as_of_date)
);
CREATE UNIQUE INDEX valuation_run_one_success_per_day ON valuation_run (as_of_date, method_version) WHERE status = 'succeeded';

CREATE TABLE segment_valuation (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  valuation_run_id   bigint NOT NULL,
  as_of_date         date NOT NULL,   -- copied from the run for trend queries; the composite FK keeps it honest
  trim_id            bigint NOT NULL REFERENCES trim (id) ON DELETE RESTRICT,
  model_year_sh      smallint NOT NULL CONSTRAINT segment_year_range CHECK (model_year_sh BETWEEN 1300 AND 1500),
  province_id        bigint REFERENCES province (id) ON DELETE RESTRICT,   -- NULL: national
  n_comparables      integer NOT NULL CONSTRAINT segment_n_nonneg CHECK (n_comparables >= 0),
  market_value_toman bigint CONSTRAINT segment_value_positive CHECK (market_value_toman > 0),
  p25_toman          bigint CONSTRAINT segment_p25_positive CHECK (p25_toman > 0),
  p75_toman          bigint CONSTRAINT segment_p75_positive CHECK (p75_toman > 0),
  CONSTRAINT segment_run_fk FOREIGN KEY (valuation_run_id, as_of_date) REFERENCES valuation_run (id, as_of_date) ON DELETE CASCADE,
  CONSTRAINT segment_range_ordered CHECK (p25_toman IS NULL OR p75_toman IS NULL OR p25_toman <= p75_toman),
  CONSTRAINT segment_valuation_unique UNIQUE NULLS NOT DISTINCT (valuation_run_id, trim_id, model_year_sh, province_id)
);

CREATE TABLE listing_valuation (
  valuation_run_id   bigint NOT NULL REFERENCES valuation_run (id) ON DELETE CASCADE,
  listing_id         bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  asking_price_toman bigint CONSTRAINT lv_asking_positive CHECK (asking_price_toman > 0),  -- the input rated, recorded
  market_value_toman bigint CONSTRAINT lv_value_positive CHECK (market_value_toman > 0),
  range_low_toman    bigint CONSTRAINT lv_low_positive CHECK (range_low_toman > 0),
  range_high_toman   bigint CONSTRAINT lv_high_positive CHECK (range_high_toman > 0),
  price_gap_pct      numeric(7,2),
  deal_rating        deal_rating,
  no_rating_reason   text CONSTRAINT lv_no_rating_reason_valid CHECK (no_rating_reason IN (
                       'no_price', 'negotiable', 'installment', 'placeholder', 'too_few_comparables',
                       'unmatched_trim', 'missing_year', 'missing_mileage')),
  n_comparables      integer NOT NULL CONSTRAINT lv_n_nonneg CHECK (n_comparables >= 0),
  PRIMARY KEY (valuation_run_id, listing_id),
  CONSTRAINT lv_rating_xor_reason CHECK ((deal_rating IS NULL) <> (no_rating_reason IS NULL)),
  CONSTRAINT lv_rated_has_numbers CHECK (deal_rating IS NULL OR (market_value_toman IS NOT NULL AND asking_price_toman IS NOT NULL AND price_gap_pct IS NOT NULL)),
  CONSTRAINT lv_range_brackets_value CHECK (range_low_toman IS NULL OR range_high_toman IS NULL OR market_value_toman IS NULL
                                            OR (range_low_toman <= market_value_toman AND market_value_toman <= range_high_toman))
);
CREATE TABLE listing_valuation_comparable (
  valuation_run_id       bigint NOT NULL,
  listing_id             bigint NOT NULL,
  comparable_listing_id  bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  comparable_price_toman bigint NOT NULL CONSTRAINT lvc_price_positive CHECK (comparable_price_toman > 0),
  adjusted_price_toman   bigint NOT NULL CONSTRAINT lvc_adjusted_positive CHECK (adjusted_price_toman > 0),
  weight                 numeric(6,5) NOT NULL CONSTRAINT lvc_weight_range CHECK (weight > 0 AND weight <= 1),
  PRIMARY KEY (valuation_run_id, listing_id, comparable_listing_id),
  CONSTRAINT lvc_valuation_fk FOREIGN KEY (valuation_run_id, listing_id) REFERENCES listing_valuation ON DELETE CASCADE,
  CONSTRAINT lvc_not_itself CHECK (comparable_listing_id <> listing_id)
);
-- Words from the model, numbers from the database (CS-17 #2): the facts given to the model are stored with the text.
CREATE TABLE deal_explanation (
  valuation_run_id bigint NOT NULL,
  listing_id       bigint NOT NULL,
  prompt_version   text NOT NULL,
  model            text NOT NULL,
  facts            jsonb NOT NULL,
  text_fa          text NOT NULL,
  numbers_verified boolean NOT NULL,   -- every number in text_fa was found in facts; pages show verified rows only
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (valuation_run_id, listing_id, prompt_version),
  CONSTRAINT deal_explanation_valuation_fk FOREIGN KEY (valuation_run_id, listing_id) REFERENCES listing_valuation ON DELETE CASCADE
);
-- Published price tables used only as a benchmark (CS-13).
CREATE TABLE benchmark_price (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id     text NOT NULL REFERENCES source (id) ON DELETE RESTRICT,
  as_of_date    date NOT NULL,
  label_raw     text NOT NULL,
  trim_id       bigint REFERENCES trim (id) ON DELETE RESTRICT,
  model_year_sh smallint CONSTRAINT benchmark_year_range CHECK (model_year_sh BETWEEN 1300 AND 1500),
  price_toman   bigint NOT NULL CONSTRAINT benchmark_price_positive CHECK (price_toman > 0),
  fetch_id      bigint REFERENCES fetch_log (id) ON DELETE SET NULL,
  CONSTRAINT benchmark_price_unique UNIQUE (source_id, as_of_date, label_raw)
);

-- ---------------------------------------------------------------- human review queue (one queue, typed subjects)
CREATE TABLE review_item (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind            text NOT NULL CONSTRAINT review_kind_valid CHECK (kind IN ('extraction_field', 'catalogue_match', 'duplicate_pair', 'photo_pii')),
  extraction_id   bigint,
  field           text,
  listing_id      bigint REFERENCES listing (id) ON DELETE CASCADE,
  listing_pair_id bigint REFERENCES listing_pair (id) ON DELETE CASCADE,
  photo_id        bigint REFERENCES photo (id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'open' CONSTRAINT review_status_valid CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     text,
  resolution      jsonb,
  CONSTRAINT review_field_fk FOREIGN KEY (extraction_id, field) REFERENCES extraction_field (extraction_id, field) ON DELETE CASCADE,
  CONSTRAINT review_subject_matches_kind CHECK (
        (kind = 'extraction_field' AND extraction_id IS NOT NULL AND field IS NOT NULL AND num_nonnulls(listing_id, listing_pair_id, photo_id) = 0)
     OR (kind = 'catalogue_match'  AND listing_id IS NOT NULL AND num_nonnulls(extraction_id, field, listing_pair_id, photo_id) = 0)
     OR (kind = 'duplicate_pair'   AND listing_pair_id IS NOT NULL AND num_nonnulls(extraction_id, field, listing_id, photo_id) = 0)
     OR (kind = 'photo_pii'        AND photo_id IS NOT NULL AND num_nonnulls(extraction_id, field, listing_id, listing_pair_id) = 0)),
  CONSTRAINT review_resolution_consistent CHECK ((status = 'open') = (resolved_at IS NULL)),
  CONSTRAINT review_resolver_named CHECK (status = 'open' OR resolved_by IS NOT NULL)
);
CREATE UNIQUE INDEX review_item_one_open_per_subject
  ON review_item (kind, extraction_id, field, listing_id, listing_pair_id, photo_id) NULLS NOT DISTINCT
  WHERE status = 'open';

-- ---------------------------------------------------------------- labelled evaluation sets (curated; the repository file is the truth)
CREATE TABLE eval_set (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name              text NOT NULL UNIQUE,
  task              text NOT NULL CONSTRAINT eval_set_task_valid CHECK (task IN (
                      'extraction', 'catalogue_match', 'duplicate_pairs', 'query_parse', 'photo_pii', 'valuation_holdout')),
  guideline_version text NOT NULL,
  repo_path         text NOT NULL,   -- CS-9 #1: labels live in the repository; these rows are a loaded copy
  frozen_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE eval_item (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  eval_set_id     bigint NOT NULL REFERENCES eval_set (id) ON DELETE CASCADE,
  item_key        text NOT NULL,
  snapshot_sha256 bytea CONSTRAINT eval_item_sha256_length CHECK (octet_length(snapshot_sha256) = 32), -- survives database rebuilds
  input           jsonb,
  labels          jsonb NOT NULL,
  labelled_by     text NOT NULL,
  labelled_at     timestamptz NOT NULL,
  CONSTRAINT eval_item_key_unique UNIQUE (eval_set_id, item_key),
  CONSTRAINT eval_item_has_input CHECK (num_nonnulls(snapshot_sha256, input) >= 1)
);
CREATE TABLE eval_run (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  eval_set_id     bigint NOT NULL REFERENCES eval_set (id) ON DELETE RESTRICT,
  subject_version text NOT NULL,   -- prompt, rule or model version under test (CS-9 #3)
  model           text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  metrics         jsonb,
  cost_usd_micros bigint CONSTRAINT eval_run_cost_nonneg CHECK (cost_usd_micros >= 0),
  CONSTRAINT eval_run_time_ordered CHECK (finished_at IS NULL OR finished_at >= started_at)
);
CREATE TABLE eval_result (
  eval_run_id  bigint NOT NULL REFERENCES eval_run (id) ON DELETE CASCADE,
  eval_item_id bigint NOT NULL REFERENCES eval_item (id) ON DELETE CASCADE,
  field        text NOT NULL,
  expected     jsonb,
  predicted    jsonb,
  confidence   numeric(4,3) CONSTRAINT eval_result_confidence_range CHECK (confidence BETWEEN 0 AND 1),
  correct      boolean NOT NULL,
  PRIMARY KEY (eval_run_id, eval_item_id, field)
);

-- ---------------------------------------------------------------- buyers: saved searches and Telegram alerts (CS-20)
CREATE TABLE telegram_chat (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id    bigint NOT NULL CONSTRAINT telegram_chat_id_unique UNIQUE,  -- Telegram: at most 52 significant bits
  linked_at  timestamptz NOT NULL DEFAULT now(),
  blocked_at timestamptz   -- the user blocked the bot: stop sending
);
CREATE TABLE saved_search (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_chat_id      bigint REFERENCES telegram_chat (id) ON DELETE CASCADE,
  status                text NOT NULL DEFAULT 'pending_link'
                        CONSTRAINT saved_search_status_valid CHECK (status IN ('pending_link', 'active', 'stopped')),
  link_token_sha256     bytea CONSTRAINT saved_search_link_token_unique UNIQUE
                        CONSTRAINT saved_search_link_token_length CHECK (octet_length(link_token_sha256) = 32),
  link_token_expires_at timestamptz,
  manage_token_sha256   bytea NOT NULL CONSTRAINT saved_search_manage_token_unique UNIQUE
                        CONSTRAINT saved_search_manage_token_length CHECK (octet_length(manage_token_sha256) = 32),
  filters               jsonb NOT NULL,   -- same schema as the filter UI and the plain-Farsi parser (CS-15)
  make_id               bigint REFERENCES make (id) ON DELETE RESTRICT,
  model_id              bigint,
  trim_id               bigint,
  city_id               bigint REFERENCES city (id) ON DELETE RESTRICT,
  max_price_toman       bigint CONSTRAINT saved_search_max_price_positive CHECK (max_price_toman > 0),
  min_model_year_sh     smallint CONSTRAINT saved_search_year_range CHECK (min_model_year_sh BETWEEN 1300 AND 1500),
  max_mileage_km        integer CONSTRAINT saved_search_mileage_nonneg CHECK (max_mileage_km >= 0),
  notify_new_deals      boolean NOT NULL DEFAULT true,
  min_deal_rating       deal_rating NOT NULL DEFAULT 'good',
  notify_price_drops    boolean NOT NULL DEFAULT true,
  matched_through       timestamptz NOT NULL DEFAULT now(),   -- watermark of the matcher
  created_at            timestamptz NOT NULL DEFAULT now(),
  stopped_at            timestamptz,
  stopped_via           text CONSTRAINT saved_search_stopped_via_valid CHECK (stopped_via IN ('telegram', 'site')),
  CONSTRAINT saved_search_model_make_fk FOREIGN KEY (model_id, make_id) REFERENCES model (id, make_id) ON DELETE RESTRICT,
  CONSTRAINT saved_search_trim_model_fk FOREIGN KEY (trim_id, model_id) REFERENCES trim (id, model_id) ON DELETE RESTRICT,
  CONSTRAINT saved_search_linked_unless_pending CHECK (status = 'pending_link' OR telegram_chat_id IS NOT NULL),
  CONSTRAINT saved_search_pending_has_token CHECK (status <> 'pending_link' OR (link_token_sha256 IS NOT NULL AND link_token_expires_at IS NOT NULL)),
  CONSTRAINT saved_search_stop_recorded CHECK ((status = 'stopped') = (stopped_at IS NOT NULL AND stopped_via IS NOT NULL)),
  CONSTRAINT saved_search_notifies_something CHECK (notify_new_deals OR notify_price_drops)
);
CREATE TABLE alert (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  saved_search_id     bigint NOT NULL REFERENCES saved_search (id) ON DELETE CASCADE,
  kind                text NOT NULL CONSTRAINT alert_kind_valid CHECK (kind IN ('new_deal', 'price_drop')),
  vehicle_id          bigint NOT NULL REFERENCES vehicle (id) ON DELETE RESTRICT,
  listing_id          bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  price_event_id      bigint REFERENCES listing_price_event (id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'pending'
                      CONSTRAINT alert_status_valid CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'suppressed')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  sent_at             timestamptz,
  telegram_message_id bigint,
  CONSTRAINT alert_price_drop_has_event CHECK ((kind = 'price_drop') = (price_event_id IS NOT NULL)),
  CONSTRAINT alert_sent_recorded CHECK ((status = 'sent') = (sent_at IS NOT NULL))
);
-- CS-20 #2: one message per car per saved search, and one per price drop; the matcher inserts with ON CONFLICT DO NOTHING.
CREATE UNIQUE INDEX alert_once_per_new_vehicle ON alert (saved_search_id, vehicle_id) WHERE kind = 'new_deal';
CREATE UNIQUE INDEX alert_once_per_price_drop ON alert (saved_search_id, price_event_id) WHERE kind = 'price_drop';

-- ---------------------------------------------------------------- pasted links (CS-19)
CREATE TABLE paste_request (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pasted_url   text NOT NULL,
  source_id    text REFERENCES source (id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  outcome      text NOT NULL DEFAULT 'pending' CONSTRAINT paste_outcome_valid CHECK (outcome IN (
                 'pending', 'rated_from_database', 'fetched_and_rated', 'unsupported_source',
                 'divar_access_pending', 'broken_link', 'source_blocked', 'error')),
  listing_id   bigint REFERENCES listing (id) ON DELETE SET NULL,
  answered_at  timestamptz,   -- answered_at - requested_at is the latency CS-19 #4 bounds at five seconds
  CONSTRAINT paste_answer_consistent CHECK ((outcome = 'pending') = (answered_at IS NULL)),
  CONSTRAINT paste_rated_has_listing CHECK (outcome NOT IN ('rated_from_database', 'fetched_and_rated') OR listing_id IS NOT NULL)
);
ALTER TABLE fetch_log ADD CONSTRAINT fetch_paste_fk FOREIGN KEY (paste_request_id) REFERENCES paste_request (id) ON DELETE CASCADE;

-- ---------------------------------------------------------------- removal requests and the purge path (ADR-0008 point 8)
CREATE TABLE removal_request (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id          text NOT NULL REFERENCES source (id) ON DELETE RESTRICT,
  scope              text NOT NULL CONSTRAINT removal_scope_valid CHECK (scope IN ('source', 'listing')),
  source_listing_key text,
  received_at        timestamptz NOT NULL,
  requested_by       text NOT NULL,
  status             text NOT NULL DEFAULT 'received' CONSTRAINT removal_status_valid CHECK (status IN ('received', 'completed', 'rejected')),
  completed_at       timestamptz,
  listings_deleted   integer,
  CONSTRAINT removal_scope_has_key CHECK ((scope = 'listing') = (source_listing_key IS NOT NULL)),
  CONSTRAINT removal_completed_consistent CHECK ((status = 'completed') = (completed_at IS NOT NULL AND listings_deleted IS NOT NULL))
);
CREATE FUNCTION purge_listings(request_id bigint) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  r removal_request%ROWTYPE;
  n integer;
BEGIN
  SELECT * INTO r FROM removal_request WHERE id = request_id FOR UPDATE;
  IF r.status <> 'received' THEN
    RAISE EXCEPTION 'removal request % is already %', request_id, r.status;
  END IF;
  PERFORM set_config('carshenas.purge', 'on', true);   -- transaction-local
  DELETE FROM listing
   WHERE source_id = r.source_id
     AND (r.scope = 'source' OR source_listing_key = r.source_listing_key);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('carshenas.purge', 'off', true);
  UPDATE removal_request SET status = 'completed', completed_at = now(), listings_deleted = n WHERE id = request_id;
  RETURN n;
END $$;

-- ---------------------------------------------------------------- search projection (derived, rebuildable with one call)
-- One row per vehicle with at least one active, public listing: the unit a buyer sees (cheapest listing first).
-- Rebuilt in place here for clarity. In the volume lab (244,090 rows) an in-place reload took 10-14 s, almost all of it
-- incremental maintenance of the trigram GIN index; loading a shadow table and building its indexes afterwards took 3.4 s.
CREATE TABLE search_document (
  vehicle_id                bigint PRIMARY KEY REFERENCES vehicle (id) ON DELETE CASCADE,
  representative_listing_id bigint NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  make_id                   bigint NOT NULL,
  model_id                  bigint NOT NULL,
  trim_id                   bigint,
  model_year_sh             smallint,
  mileage_km                integer,
  city_id                   bigint,
  price_type                text,
  asking_price_toman        bigint,
  deal_rating               deal_rating,
  price_gap_pct             numeric(7,2),
  deal_sort_key             numeric,     -- lower is a better deal; NULL (no rating) sorts last
  body_condition            text,
  fuel                      text,
  gearbox                   text,
  seller_type               text,
  source_ids                text[] NOT NULL,
  listing_count             integer NOT NULL CONSTRAINT search_doc_count_positive CHECK (listing_count >= 1),
  listed_at                 timestamptz NOT NULL,   -- earliest in the group: days on market
  has_photo                 boolean NOT NULL,
  search_text               text NOT NULL,
  refreshed_at              timestamptz NOT NULL DEFAULT now()
);

CREATE VIEW listing_latest_valuation AS
SELECT DISTINCT ON (lv.listing_id) lv.*, vr.as_of_date
FROM listing_valuation lv
JOIN valuation_run vr ON vr.id = lv.valuation_run_id AND vr.status = 'succeeded'
ORDER BY lv.listing_id, vr.as_of_date DESC, vr.id DESC;

CREATE FUNCTION rebuild_search_documents() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM search_document;
  INSERT INTO search_document (
    vehicle_id, representative_listing_id, make_id, model_id, trim_id, model_year_sh, mileage_km, city_id,
    price_type, asking_price_toman, deal_rating, price_gap_pct, deal_sort_key, body_condition, fuel, gearbox,
    seller_type, source_ids, listing_count, listed_at, has_photo, search_text)
  WITH active AS (
    SELECT l.*, v.deal_rating AS rating, v.price_gap_pct AS gap
    FROM listing l
    JOIN source s ON s.id = l.source_id AND s.listing_visibility = 'public'
    LEFT JOIN listing_latest_valuation v ON v.listing_id = l.id
    WHERE l.status = 'active' AND l.vehicle_id IS NOT NULL AND l.model_id IS NOT NULL
  ), rep AS (   -- cheapest priced listing first, as on Torob's product page
    SELECT DISTINCT ON (vehicle_id) *
    FROM active
    ORDER BY vehicle_id, (price_type = 'asking') DESC NULLS LAST, asking_price_toman NULLS LAST, listed_at, id
  ), grp AS (
    SELECT vehicle_id, array_agg(DISTINCT source_id ORDER BY source_id) AS source_ids,
           count(*)::integer AS listing_count, min(listed_at) AS listed_at
    FROM active GROUP BY vehicle_id
  )
  SELECT r.vehicle_id, r.id, r.make_id, r.model_id, r.trim_id, r.model_year_sh, r.mileage_km, r.city_id,
         r.price_type, r.asking_price_toman, r.rating, r.gap, r.gap, r.body_condition, r.fuel, r.gearbox,
         r.seller_type, g.source_ids, g.listing_count, g.listed_at,
         EXISTS (SELECT 1 FROM photo p JOIN listing m ON m.id = p.listing_id
                  WHERE m.vehicle_id = r.vehicle_id AND p.stored_object_key IS NOT NULL),
         concat_ws(' ', mk.name_norm, md.name_norm, t.name_norm, r.title_norm)
  FROM rep r
  JOIN grp g USING (vehicle_id)
  JOIN make mk ON mk.id = r.make_id
  JOIN model md ON md.id = r.model_id
  LEFT JOIN trim t ON t.id = r.trim_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

COMMIT;
