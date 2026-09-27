--
-- PostgreSQL database dump
--

\restrict carshenas

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg12+2)
-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: jsonb_sha256(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.jsonb_sha256(value jsonb) RETURNS bytea
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    RETURN sha256(convert_to((value)::text, 'UTF8'::name));


--
-- Name: FUNCTION jsonb_sha256(value jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.jsonb_sha256(value jsonb) IS 'sha256 of the canonical text of a jsonb value; IMMUTABLE only because this database is UTF8.';


--
-- Name: listing_status_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listing_status_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  previous_status text := CASE TG_OP WHEN 'INSERT' THEN 'new' ELSE OLD.status END;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.origin IS DISTINCT FROM OLD.origin THEN
      RAISE EXCEPTION 'listing %: the origin of a listing never changes', OLD.id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'listing_status_guard', TABLE = TG_TABLE_NAME;
    END IF;
    IF NEW.status = OLD.status THEN
      RETURN NEW;
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT FROM public.listing_status_transition t
    WHERE t.origin = NEW.origin AND t.from_status = previous_status AND t.to_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'listing %: % listings cannot change status from % to %', NEW.id, NEW.origin, previous_status, NEW.status
      USING ERRCODE = 'check_violation', CONSTRAINT = 'listing_status_guard', TABLE = TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: FUNCTION listing_status_guard(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.listing_status_guard() IS 'Refuses a listing status change that listing_status_transition does not allow, and any change of origin; errors name the constraint listing_status_guard.';


--
-- Name: refuse_change_unless_purge(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refuse_change_unless_purge() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF coalesce(current_setting('carshenas.purge', true), '') = 'on' THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;  -- NULL for TRUNCATE, whose return value is ignored
  END IF;
  RAISE EXCEPTION '% is append-only: % is allowed only inside a purge', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation',
          CONSTRAINT = TG_TABLE_NAME || '_append_only',
          TABLE = TG_TABLE_NAME,
          HINT = 'Insert a new row instead. A purge for a removal request runs SET LOCAL carshenas.purge = ''on''.';
END
$$;


--
-- Name: FUNCTION refuse_change_unless_purge(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.refuse_change_unless_purge() IS 'Append-only guard: a BEFORE UPDATE OR DELETE row trigger plus a BEFORE TRUNCATE statement trigger; allows changes only when carshenas.purge is on.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: crawl_run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crawl_run (
    id bigint NOT NULL,
    source_id text NOT NULL,
    policy_check_id bigint NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    CONSTRAINT crawl_run_finished_when_not_running CHECK (((status = 'running'::text) = (finished_at IS NULL))),
    CONSTRAINT crawl_run_status_valid CHECK ((status = ANY (ARRAY['running'::text, 'succeeded'::text, 'failed'::text, 'stopped_on_block'::text]))),
    CONSTRAINT crawl_run_times_ordered CHECK (((finished_at IS NULL) OR (finished_at >= started_at)))
);


--
-- Name: TABLE crawl_run; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.crawl_run IS 'One crawl of one source, citing the policy check it ran under (ADR-0008 point 1).';


--
-- Name: COLUMN crawl_run.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_run.status IS 'running until finished; stopped_on_block when a 403, 429 or challenge stopped it (ADR-0008 point 6).';


--
-- Name: crawl_run_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.crawl_run ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.crawl_run_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fetch_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fetch_log (
    id bigint NOT NULL,
    source_id text NOT NULL,
    crawl_run_id bigint NOT NULL,
    url text NOT NULL,
    method text DEFAULT 'http_get'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    http_status smallint,
    outcome text NOT NULL,
    duration_ms integer,
    etag text,
    last_modified text,
    listing_id bigint,
    snapshot_id bigint,
    CONSTRAINT fetch_log_duration_nonnegative CHECK ((duration_ms >= 0)),
    CONSTRAINT fetch_log_http_status_range CHECK (((http_status >= 100) AND (http_status <= 599))),
    CONSTRAINT fetch_log_method_valid CHECK ((method = ANY (ARRAY['http_get'::text, 'official_api'::text]))),
    CONSTRAINT fetch_log_outcome_valid CHECK ((outcome = ANY (ARRAY['ok'::text, 'not_modified'::text, 'not_found'::text, 'gone'::text, 'blocked'::text, 'rate_limited'::text, 'challenge'::text, 'error'::text]))),
    CONSTRAINT fetch_log_snapshot_has_listing CHECK (((snapshot_id IS NULL) OR (listing_id IS NOT NULL))),
    CONSTRAINT fetch_log_snapshot_only_with_content CHECK (((snapshot_id IS NULL) OR (outcome = ANY (ARRAY['ok'::text, 'not_modified'::text])))),
    CONSTRAINT fetch_log_url_http CHECK ((url ~ '^https?://'::text))
);


--
-- Name: TABLE fetch_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fetch_log IS 'Append-only: one row per request we made to a source. A revisit whose content did not change points at the existing snapshot.';


--
-- Name: COLUMN fetch_log.outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fetch_log.outcome IS 'blocked, rate_limited and challenge stop the source (ADR-0008 point 6); error means no usable response (network failure, timeout).';


--
-- Name: COLUMN fetch_log.etag; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fetch_log.etag IS 'The response ETag, sent back as If-None-Match on the next visit (ADR-0008 point 5).';


--
-- Name: COLUMN fetch_log.last_modified; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fetch_log.last_modified IS 'The response Last-Modified, sent back as If-Modified-Since on the next visit.';


--
-- Name: fetch_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.fetch_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.fetch_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: listing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing (
    id bigint NOT NULL,
    origin text DEFAULT 'external'::text NOT NULL,
    source_id text NOT NULL,
    source_listing_key text,
    url text,
    status text NOT NULL,
    listed_at timestamp with time zone NOT NULL,
    delisted_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT listing_external_identity CHECK (((origin <> 'external'::text) OR ((source_listing_key IS NOT NULL) AND (url IS NOT NULL)))),
    CONSTRAINT listing_external_was_seen CHECK (((origin <> 'external'::text) OR (last_seen_at IS NOT NULL))),
    CONSTRAINT listing_gone_not_seen_since CHECK (((status <> ALL (ARRAY['expired'::text, 'gone'::text])) OR (last_seen_at <= delisted_at))),
    CONSTRAINT listing_market_dates_ordered CHECK (((delisted_at IS NULL) OR (delisted_at >= listed_at))),
    CONSTRAINT listing_off_market_has_date CHECK (((status = ANY (ARRAY['sold'::text, 'expired'::text, 'gone'::text, 'removed'::text])) = (delisted_at IS NOT NULL))),
    CONSTRAINT listing_only_external_for_now CHECK ((origin = 'external'::text)),
    CONSTRAINT listing_origin_valid CHECK ((origin = ANY (ARRAY['external'::text, 'native'::text]))),
    CONSTRAINT listing_source_listing_key_format CHECK ((source_listing_key ~ '^\S{1,200}$'::text)),
    CONSTRAINT listing_status_valid CHECK ((status = ANY (ARRAY['active'::text, 'sold'::text, 'expired'::text, 'gone'::text, 'removed'::text]))),
    CONSTRAINT listing_url_http CHECK ((url ~ '^https?://'::text))
)
WITH (fillfactor='90', autovacuum_vacuum_scale_factor='0.02', autovacuum_analyze_scale_factor='0.02');


--
-- Name: TABLE listing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.listing IS 'The offer: one ad on one source. Its id is permanent (URLs, alerts, evaluation sets point at it); what it says about the car is derived and rebuildable.';


--
-- Name: COLUMN listing.origin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.origin IS 'external: crawled or read through an official API; native: created on Carshenas (later).';


--
-- Name: COLUMN listing.source_listing_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.source_listing_key IS 'The source''s own id or token for the ad; with source_id it is the natural key the crawler upserts on.';


--
-- Name: COLUMN listing.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.url IS 'Where the ad lives on its source; the click-out target.';


--
-- Name: COLUMN listing.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.status IS 'active: on the market; sold, expired, gone (disappeared from the source): off the market; removed: taken down by Carshenas. Changes follow listing_status_transition.';


--
-- Name: COLUMN listing.listed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.listed_at IS 'When the ad went on the market: the source''s posting time when the page shows it, else our first sighting. Native drafts, later, have none: the native-listings migration relaxes NOT NULL for them.';


--
-- Name: COLUMN listing.delisted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.delisted_at IS 'When the ad left the market; set exactly when the status is off the market.';


--
-- Name: COLUMN listing.last_seen_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.last_seen_at IS 'The latest fetch that showed the ad, to within a day: the crawler refreshes it when it is more than a day old (fetch_log keeps every visit). Deliberately not indexed, so those updates stay HOT.';


--
-- Name: listing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.listing ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.listing_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: listing_status_transition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_status_transition (
    origin text NOT NULL,
    from_status text NOT NULL,
    to_status text NOT NULL,
    CONSTRAINT listing_status_transition_changes_status CHECK ((from_status <> to_status)),
    CONSTRAINT listing_status_transition_origin_valid CHECK ((origin = ANY (ARRAY['external'::text, 'native'::text]))),
    CONSTRAINT listing_status_transition_statuses_valid CHECK (((from_status = ANY (ARRAY['new'::text, 'active'::text, 'sold'::text, 'expired'::text, 'gone'::text, 'removed'::text])) AND (to_status = ANY (ARRAY['active'::text, 'sold'::text, 'expired'::text, 'gone'::text, 'removed'::text]))))
);


--
-- Name: TABLE listing_status_transition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.listing_status_transition IS 'Allowed listing status changes per origin; listing_status_guard enforces them. Curated: a new lifecycle rule is a migration.';


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.snapshot (
    id bigint NOT NULL,
    listing_id bigint NOT NULL,
    first_fetched_at timestamp with time zone NOT NULL,
    url text NOT NULL,
    canonical_version smallint NOT NULL,
    payload jsonb NOT NULL,
    content_sha256 bytea GENERATED ALWAYS AS (public.jsonb_sha256(payload)) STORED NOT NULL,
    CONSTRAINT snapshot_canonical_version_positive CHECK ((canonical_version > 0)),
    CONSTRAINT snapshot_payload_is_object CHECK ((jsonb_typeof(payload) = 'object'::text)),
    CONSTRAINT snapshot_url_http CHECK ((url ~ '^https?://'::text))
);


--
-- Name: TABLE snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.snapshot IS 'Append-only, content-addressed copies of what a listing page showed, in canonical JSON with personal data removed (ADR-0008 point 7).';


--
-- Name: COLUMN snapshot.first_fetched_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.snapshot.first_fetched_at IS 'When this content was first fetched; later identical fetches point here from fetch_log.';


--
-- Name: COLUMN snapshot.canonical_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.snapshot.canonical_version IS 'Version of the crawler''s canonical form. A new version may re-express an unchanged page as new JSON, which is then a new snapshot; identical JSON is one snapshot whatever the version.';


--
-- Name: COLUMN snapshot.payload; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.snapshot.payload IS 'What the page showed, as canonical JSON: phone numbers and other personal data are removed before storage (ADR-0008 point 7). Compressed with lz4 through default_toast_compression (db/postgresql.conf).';


--
-- Name: COLUMN snapshot.content_sha256; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.snapshot.content_sha256 IS 'Computed by the database from payload, so the deduplication key can never disagree with the content.';


--
-- Name: snapshot_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.snapshot ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.snapshot_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: source; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source (
    id text NOT NULL,
    origin text NOT NULL,
    access_method text NOT NULL,
    name_fa text NOT NULL,
    base_url text NOT NULL,
    listing_visibility text NOT NULL,
    crawl_state text DEFAULT 'paused'::text NOT NULL,
    min_request_interval_ms integer,
    policy_max_age_days integer DEFAULT 30 NOT NULL,
    stopped_at timestamp with time zone,
    stop_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT source_access_method_valid CHECK ((access_method = ANY (ARRAY['crawl'::text, 'official_api'::text, 'native'::text]))),
    CONSTRAINT source_base_url_https CHECK ((base_url ~ '^https://[^/\s]+/?$'::text)),
    CONSTRAINT source_crawl_interval_floor CHECK (((access_method <> 'crawl'::text) OR ((min_request_interval_ms IS NOT NULL) AND (min_request_interval_ms >= 3000)))),
    CONSTRAINT source_crawl_state_valid CHECK ((crawl_state = ANY (ARRAY['enabled'::text, 'paused'::text, 'stopped_on_block'::text]))),
    CONSTRAINT source_id_format CHECK ((id ~ '^[a-z][a-z0-9_]{1,30}$'::text)),
    CONSTRAINT source_listing_visibility_valid CHECK ((listing_visibility = ANY (ARRAY['public'::text, 'requester_only'::text]))),
    CONSTRAINT source_name_fa_not_blank CHECK ((btrim(name_fa) <> ''::text)),
    CONSTRAINT source_native_iff_native_access CHECK (((origin = 'native'::text) = (access_method = 'native'::text))),
    CONSTRAINT source_only_crawled_sources_run CHECK (((crawl_state = 'paused'::text) OR (access_method = 'crawl'::text))),
    CONSTRAINT source_origin_valid CHECK ((origin = ANY (ARRAY['external'::text, 'native'::text, 'benchmark'::text]))),
    CONSTRAINT source_policy_max_age_days_positive CHECK ((policy_max_age_days > 0)),
    CONSTRAINT source_stop_reason_valid CHECK ((stop_reason = ANY (ARRAY['blocked'::text, 'rate_limited'::text, 'challenge'::text]))),
    CONSTRAINT source_stop_recorded CHECK ((((crawl_state = 'stopped_on_block'::text) = (stopped_at IS NOT NULL)) AND ((crawl_state = 'stopped_on_block'::text) = (stop_reason IS NOT NULL))))
);


--
-- Name: TABLE source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.source IS 'A website or channel listings come from (ADR-0008). Curated by hand. Carshenas itself becomes the native source "carshenas" when native listings arrive.';


--
-- Name: COLUMN source.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source.id IS 'Stable code used in URLs, logs and job names, for example bama.';


--
-- Name: COLUMN source.origin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source.origin IS 'external: listings on other sites; native: listings created on Carshenas; benchmark: published price tables, never listings.';


--
-- Name: COLUMN source.access_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source.access_method IS 'crawl: our crawler reads the source''s pages or public web API within ADR-0008 (Divar through its web API, by the owner''s decision of 2026-09-27); official_api: single items through a partner API the source grants; native: our own database.';


--
-- Name: COLUMN source.listing_visibility; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source.listing_visibility IS 'public: its listings appear in search; requester_only: a source whose rules allow reading a pasted link but not publishing it, shown only to the buyer who pasted it (CS-19).';


--
-- Name: COLUMN source.crawl_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source.crawl_state IS 'enabled or paused by a human; stopped_on_block by the crawler on a 403, 429 or challenge (ADR-0008 point 6), until a human reads the evidence and re-enables it.';


--
-- Name: COLUMN source.min_request_interval_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source.min_request_interval_ms IS 'Milliseconds between two requests to this source; at least 3000 for crawled sources, longer when robots.txt asks (Crawl-delay).';


--
-- Name: COLUMN source.policy_max_age_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source.policy_max_age_days IS 'How many days old the latest policy check may be before a crawl is refused.';


--
-- Name: COLUMN source.stopped_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source.stopped_at IS 'When the crawler stopped the source: the requested_at of the blocked request in fetch_log, which is the evidence.';


--
-- Name: source_policy_check; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_policy_check (
    id bigint NOT NULL,
    source_id text NOT NULL,
    checked_at timestamp with time zone NOT NULL,
    checked_by text NOT NULL,
    robots_txt text,
    terms_url text,
    terms_summary text NOT NULL,
    verdict text NOT NULL,
    conditions text,
    photos_allowed boolean NOT NULL,
    CONSTRAINT source_policy_check_checked_by_not_blank CHECK ((btrim(checked_by) <> ''::text)),
    CONSTRAINT source_policy_check_conditions_not_blank CHECK ((btrim(conditions) <> ''::text)),
    CONSTRAINT source_policy_check_conditions_stated CHECK (((verdict <> 'allowed_with_conditions'::text) OR (conditions IS NOT NULL))),
    CONSTRAINT source_policy_check_not_allowed_no_photos CHECK (((verdict <> 'not_allowed'::text) OR (NOT photos_allowed))),
    CONSTRAINT source_policy_check_terms_summary_not_blank CHECK ((btrim(terms_summary) <> ''::text)),
    CONSTRAINT source_policy_check_terms_url_http CHECK ((terms_url ~ '^https?://'::text)),
    CONSTRAINT source_policy_check_verdict_valid CHECK ((verdict = ANY (ARRAY['allowed'::text, 'allowed_with_conditions'::text, 'not_allowed'::text])))
);


--
-- Name: TABLE source_policy_check; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.source_policy_check IS 'Append-only record of each reading of a source''s robots.txt and terms (ADR-0008 point 1, CS-5). The newest row is in force.';


--
-- Name: COLUMN source_policy_check.robots_txt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source_policy_check.robots_txt IS 'The robots.txt text as read, kept as evidence.';


--
-- Name: COLUMN source_policy_check.photos_allowed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source_policy_check.photos_allowed IS 'Whether this source''s rules allow downloading and re-hosting its photos (ADR-0010).';


--
-- Name: source_current_policy; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.source_current_policy AS
 SELECT DISTINCT ON (source_id) id,
    source_id,
    checked_at,
    checked_by,
    verdict,
    conditions,
    photos_allowed
   FROM public.source_policy_check
  ORDER BY source_id, checked_at DESC, id DESC;


--
-- Name: VIEW source_current_policy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.source_current_policy IS 'The policy check in force for each source: its newest reading.';


--
-- Name: source_policy_check_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.source_policy_check ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.source_policy_check_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crawl_run crawl_run_id_source_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crawl_run
    ADD CONSTRAINT crawl_run_id_source_unique UNIQUE (id, source_id);


--
-- Name: crawl_run crawl_run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crawl_run
    ADD CONSTRAINT crawl_run_pkey PRIMARY KEY (id);


--
-- Name: fetch_log fetch_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fetch_log
    ADD CONSTRAINT fetch_log_pkey PRIMARY KEY (id);


--
-- Name: listing listing_id_source_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_id_source_unique UNIQUE (id, source_id);


--
-- Name: listing listing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_pkey PRIMARY KEY (id);


--
-- Name: listing listing_source_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_source_key_unique UNIQUE (source_id, source_listing_key);


--
-- Name: listing_status_transition listing_status_transition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_status_transition
    ADD CONSTRAINT listing_status_transition_pkey PRIMARY KEY (origin, from_status, to_status);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: snapshot snapshot_content_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot
    ADD CONSTRAINT snapshot_content_unique UNIQUE (listing_id, content_sha256);


--
-- Name: snapshot snapshot_id_listing_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot
    ADD CONSTRAINT snapshot_id_listing_unique UNIQUE (id, listing_id);


--
-- Name: snapshot snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot
    ADD CONSTRAINT snapshot_pkey PRIMARY KEY (id);


--
-- Name: source source_id_origin_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source
    ADD CONSTRAINT source_id_origin_unique UNIQUE (id, origin);


--
-- Name: source source_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source
    ADD CONSTRAINT source_pkey PRIMARY KEY (id);


--
-- Name: source_policy_check source_policy_check_id_source_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_policy_check
    ADD CONSTRAINT source_policy_check_id_source_unique UNIQUE (id, source_id);


--
-- Name: source_policy_check source_policy_check_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_policy_check
    ADD CONSTRAINT source_policy_check_pkey PRIMARY KEY (id);


--
-- Name: crawl_run_policy_check_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crawl_run_policy_check_idx ON public.crawl_run USING btree (policy_check_id, source_id);


--
-- Name: crawl_run_running_per_source_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX crawl_run_running_per_source_unique ON public.crawl_run USING btree (source_id) WHERE (status = 'running'::text);


--
-- Name: crawl_run_source_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crawl_run_source_started_idx ON public.crawl_run USING btree (source_id, started_at DESC);


--
-- Name: fetch_log_crawl_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fetch_log_crawl_run_idx ON public.fetch_log USING btree (crawl_run_id, source_id);


--
-- Name: fetch_log_listing_requested_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fetch_log_listing_requested_idx ON public.fetch_log USING btree (listing_id, source_id, requested_at DESC);


--
-- Name: fetch_log_snapshot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fetch_log_snapshot_idx ON public.fetch_log USING btree (snapshot_id, listing_id);


--
-- Name: fetch_log_source_requested_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fetch_log_source_requested_idx ON public.fetch_log USING btree (source_id, requested_at DESC);


--
-- Name: source_policy_check_source_latest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX source_policy_check_source_latest_idx ON public.source_policy_check USING btree (source_id, checked_at DESC, id DESC);


--
-- Name: fetch_log fetch_log_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fetch_log_append_only BEFORE DELETE OR UPDATE ON public.fetch_log FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: fetch_log fetch_log_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fetch_log_append_only_truncate BEFORE TRUNCATE ON public.fetch_log FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: listing listing_status_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER listing_status_guard BEFORE UPDATE OF status, origin ON public.listing FOR EACH ROW EXECUTE FUNCTION public.listing_status_guard();


--
-- Name: listing listing_status_guard_on_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER listing_status_guard_on_insert AFTER INSERT ON public.listing FOR EACH ROW EXECUTE FUNCTION public.listing_status_guard();


--
-- Name: snapshot snapshot_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER snapshot_append_only BEFORE DELETE OR UPDATE ON public.snapshot FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: snapshot snapshot_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER snapshot_append_only_truncate BEFORE TRUNCATE ON public.snapshot FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: source_policy_check source_policy_check_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER source_policy_check_append_only BEFORE DELETE OR UPDATE ON public.source_policy_check FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: source_policy_check source_policy_check_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER source_policy_check_append_only_truncate BEFORE TRUNCATE ON public.source_policy_check FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: crawl_run crawl_run_policy_check_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crawl_run
    ADD CONSTRAINT crawl_run_policy_check_fk FOREIGN KEY (policy_check_id, source_id) REFERENCES public.source_policy_check(id, source_id) ON DELETE RESTRICT;


--
-- Name: crawl_run crawl_run_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crawl_run
    ADD CONSTRAINT crawl_run_source_fk FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE RESTRICT;


--
-- Name: fetch_log fetch_log_crawl_run_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fetch_log
    ADD CONSTRAINT fetch_log_crawl_run_fk FOREIGN KEY (crawl_run_id, source_id) REFERENCES public.crawl_run(id, source_id) ON DELETE CASCADE;


--
-- Name: fetch_log fetch_log_listing_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fetch_log
    ADD CONSTRAINT fetch_log_listing_fk FOREIGN KEY (listing_id, source_id) REFERENCES public.listing(id, source_id) ON DELETE CASCADE;


--
-- Name: fetch_log fetch_log_snapshot_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fetch_log
    ADD CONSTRAINT fetch_log_snapshot_fk FOREIGN KEY (snapshot_id, listing_id) REFERENCES public.snapshot(id, listing_id) ON DELETE SET NULL (snapshot_id);


--
-- Name: fetch_log fetch_log_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fetch_log
    ADD CONSTRAINT fetch_log_source_fk FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE RESTRICT;


--
-- Name: listing listing_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_source_fk FOREIGN KEY (source_id, origin) REFERENCES public.source(id, origin) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT listing_source_fk ON listing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT listing_source_fk ON public.listing IS 'unindexed: listing_source_key_unique (source_id, source_listing_key) serves it through its leading column, origin follows from source_id, and sources are never deleted while they have listings.';


--
-- Name: snapshot snapshot_listing_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshot
    ADD CONSTRAINT snapshot_listing_fk FOREIGN KEY (listing_id) REFERENCES public.listing(id) ON DELETE CASCADE;


--
-- Name: source_policy_check source_policy_check_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_policy_check
    ADD CONSTRAINT source_policy_check_source_fk FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE RESTRICT;


--
-- Name: TABLE crawl_run; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.crawl_run TO carshenas_readonly;


--
-- Name: TABLE fetch_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.fetch_log TO carshenas_readonly;


--
-- Name: TABLE listing; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing TO carshenas_readonly;
GRANT SELECT ON TABLE public.listing TO carshenas_web;


--
-- Name: TABLE listing_status_transition; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing_status_transition TO carshenas_readonly;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.schema_migrations TO carshenas_web;
GRANT SELECT ON TABLE public.schema_migrations TO carshenas_readonly;


--
-- Name: TABLE snapshot; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.snapshot TO carshenas_readonly;


--
-- Name: TABLE source; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.source TO carshenas_readonly;
GRANT SELECT ON TABLE public.source TO carshenas_web;


--
-- Name: TABLE source_policy_check; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.source_policy_check TO carshenas_readonly;


--
-- Name: TABLE source_current_policy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.source_current_policy TO carshenas_readonly;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE carshenas_owner IN SCHEMA public GRANT SELECT ON TABLES TO carshenas_readonly;


--
-- PostgreSQL database dump complete
--

\unrestrict carshenas

--
-- Applied migrations
--

INSERT INTO public.schema_migrations (version) VALUES ('20260927060001');
INSERT INTO public.schema_migrations (version) VALUES ('20260927060002');
INSERT INTO public.schema_migrations (version) VALUES ('20260927060003');
INSERT INTO public.schema_migrations (version) VALUES ('20260927060004');
