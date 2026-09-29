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
-- Name: pgboss; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgboss;


--
-- Name: SCHEMA pgboss; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA pgboss IS 'The job queue (ADR-0011, ADR-0018): pg-boss 12''s tables, installed and upgraded by migrations; the worker reads and writes their rows.';


--
-- Name: job_state; Type: TYPE; Schema: pgboss; Owner: -
--

CREATE TYPE pgboss.job_state AS ENUM (
    'created',
    'retry',
    'active',
    'completed',
    'cancelled',
    'failed'
);


--
-- Name: create_queue(text, jsonb); Type: FUNCTION; Schema: pgboss; Owner: -
--

CREATE FUNCTION pgboss.create_queue(queue_name text, options jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $_$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE 'job_common'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO pgboss.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name,
          heartbeat_seconds,
          notify,
          created_on,
          updated_on
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, 2),
          COALESCE((options->>'retryDelay')::int, 0),
          COALESCE((options->>'retryBackoff')::bool, false),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, 900),
          COALESCE((options->>'retentionSeconds')::int, 1209600),
          COALESCE((options->>'deleteAfterSeconds')::int, 604800),
          COALESCE((options->>'warningQueueSize')::int, 0),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, false),
          tablename,
          (options->>'heartbeatSeconds')::int,
          COALESCE((options->>'notify')::bool, false),
          pgboss.job_now(),
          pgboss.job_now()
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE pgboss.%I (LIKE pgboss.job INCLUDING DEFAULTS)', tablename);

      EXECUTE pgboss.job_table_format($cmd$ALTER TABLE pgboss.job ADD PRIMARY KEY (name, id)$cmd$, tablename);
      EXECUTE pgboss.job_table_format($cmd$ALTER TABLE pgboss.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES pgboss.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);
      EXECUTE pgboss.job_table_format($cmd$ALTER TABLE pgboss.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES pgboss.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);

      EXECUTE pgboss.job_table_format($cmd$CREATE INDEX job_i11 ON pgboss.job (name, priority DESC, created_on, start_after) WHERE state < 'active' AND NOT blocked$cmd$, tablename);
      EXECUTE pgboss.job_table_format($cmd$CREATE UNIQUE INDEX job_i4 ON pgboss.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL$cmd$, tablename);
      EXECUTE pgboss.job_table_format($cmd$CREATE INDEX job_i7 ON pgboss.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL$cmd$, tablename);
      EXECUTE pgboss.job_table_format($cmd$CREATE INDEX job_i9 ON pgboss.job (name, id) WHERE blocking AND state = 'completed'$cmd$, tablename);
      EXECUTE pgboss.job_table_format($cmd$CREATE INDEX job_i12 ON pgboss.job (source_root_id) WHERE source_root_id IS NOT NULL$cmd$, tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE pgboss.job_table_format($cmd$CREATE UNIQUE INDEX job_i1 ON pgboss.job (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short'$cmd$, tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE pgboss.job_table_format($cmd$CREATE UNIQUE INDEX job_i2 ON pgboss.job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'$cmd$, tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE pgboss.job_table_format($cmd$CREATE UNIQUE INDEX job_i3 ON pgboss.job (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately'$cmd$, tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE pgboss.job_table_format($cmd$CREATE UNIQUE INDEX job_i6 ON pgboss.job (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'$cmd$, tablename);
      ELSIF options->>'policy' = 'key_strict_fifo' THEN
        EXECUTE pgboss.job_table_format($cmd$CREATE UNIQUE INDEX job_i8 ON pgboss.job (name, singleton_key) WHERE state IN ('active', 'retry', 'failed') AND policy = 'key_strict_fifo'$cmd$, tablename);
        EXECUTE pgboss.job_table_format($cmd$CREATE INDEX job_i10 ON pgboss.job (name, singleton_key, state DESC, created_on, id) INCLUDE (start_after) WHERE state < 'active' AND NOT blocked AND policy = 'key_strict_fifo'$cmd$, tablename);
        EXECUTE pgboss.job_table_format($cmd$ALTER TABLE pgboss.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = 'key_strict_fifo' AND singleton_key IS NULL))$cmd$, tablename);
      END IF;

      EXECUTE format('ALTER TABLE pgboss.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE pgboss.job ATTACH PARTITION pgboss.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $_$;


--
-- Name: delete_queue(text); Type: FUNCTION; Schema: pgboss; Owner: -
--

CREATE FUNCTION pgboss.delete_queue(queue_name text) RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_table varchar;
      v_partition bool;
    BEGIN
      
      SELECT table_name, partition
      FROM pgboss.queue
      WHERE name = queue_name
      INTO v_table, v_partition;

      IF v_partition THEN
        EXECUTE format('DROP TABLE IF EXISTS pgboss.%I', v_table);
      ELSE
        EXECUTE format('DELETE FROM pgboss.%I WHERE name = %L', v_table, queue_name);
      END IF;
    
      DELETE FROM pgboss.queue WHERE name = queue_name;
    END;
    $$;


--
-- Name: job_now(); Type: FUNCTION; Schema: pgboss; Owner: -
--

CREATE FUNCTION pgboss.job_now() RETURNS timestamp with time zone
    LANGUAGE sql STABLE
    AS $$
      SELECT pg_catalog.now();
    $$;


--
-- Name: job_table_format(text, text); Type: FUNCTION; Schema: pgboss; Owner: -
--

CREATE FUNCTION pgboss.job_table_format(command text, table_name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
      SELECT format(
        regexp_replace(
          regexp_replace(command, '\.job\y', '.%1$I', 'g'),
          '\yjob_i(\d+)', '%1$s_i\1', 'g'
        ),
        table_name
      );
    $_$;


--
-- Name: job_table_run(text, text, text); Type: FUNCTION; Schema: pgboss; Owner: -
--

CREATE FUNCTION pgboss.job_table_run(command text, tbl_name text DEFAULT NULL::text, queue_name text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
      tbl RECORD;
    BEGIN
      IF queue_name IS NOT NULL THEN
        SELECT table_name INTO tbl_name FROM pgboss.queue WHERE name = queue_name;
      END IF;

      IF tbl_name IS NOT NULL THEN
        EXECUTE pgboss.job_table_format(command, tbl_name);
        RETURN;
      END IF;

      EXECUTE pgboss.job_table_format(command, 'job_common');

      FOR tbl IN SELECT table_name FROM pgboss.queue WHERE partition = true
      LOOP
        EXECUTE pgboss.job_table_format(command, tbl.table_name);
      END LOOP;
    END;
    $$;


--
-- Name: job_table_run_async(text, integer, text, text, text); Type: FUNCTION; Schema: pgboss; Owner: -
--

CREATE FUNCTION pgboss.job_table_run_async(command_name text, version integer, command text, tbl_name text DEFAULT NULL::text, queue_name text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF queue_name IS NOT NULL THEN
        SELECT table_name INTO tbl_name FROM pgboss.queue WHERE name = queue_name;
      END IF;

      IF tbl_name IS NOT NULL THEN
        INSERT INTO pgboss.bam (name, version, status, queue, table_name, command)
        VALUES (
          command_name,
          version,
          'pending',
          queue_name,
          tbl_name,
          pgboss.job_table_format(command, tbl_name)
        );
        RETURN;
      END IF;

      INSERT INTO pgboss.bam (name, version, status, queue, table_name, command)
      SELECT
        command_name,
        version,
        'pending',
        NULL,
        'job_common',
        pgboss.job_table_format(command, 'job_common')
      UNION ALL
      SELECT
        command_name,
        version,
        'pending',
        queue.name,
        queue.table_name,
        pgboss.job_table_format(command, queue.table_name)
      FROM pgboss.queue
      WHERE partition = true;
    END;
    $$;


--
-- Name: crawl_run_history_fixed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crawl_run_history_fixed() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF (NEW.id, NEW.source_id, NEW.policy_check_id, NEW.kind, NEW.started_at)
     IS DISTINCT FROM (OLD.id, OLD.source_id, OLD.policy_check_id, OLD.kind, OLD.started_at) THEN
    RAISE EXCEPTION 'crawl run %: its source, policy check, kind and start are fixed when it opens', OLD.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_run_identity_fixed', TABLE = TG_TABLE_NAME;
  END IF;
  IF OLD.status <> 'running' AND (NEW.status, NEW.finished_at) IS DISTINCT FROM (OLD.status, OLD.finished_at) THEN
    RAISE EXCEPTION 'crawl run % finished as %: a finished run stays finished', OLD.id, OLD.status
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_run_finished_is_final', TABLE = TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: FUNCTION crawl_run_history_fixed(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.crawl_run_history_fixed() IS 'Refuses a change to a crawl run''s id, source, policy check, kind or start (crawl_run_identity_fixed), and to the status or end of a finished run (crawl_run_finished_is_final); its counts may still be written.';


--
-- Name: crawl_run_policy_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crawl_run_policy_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  crawled record;
  newest record;
BEGIN
  SELECT s.access_method, s.crawl_state, s.policy_max_age_days INTO crawled
  FROM public.source s
  WHERE s.id = NEW.source_id
  FOR SHARE;
  IF crawled.access_method <> 'crawl' OR crawled.crawl_state <> 'enabled' THEN
    RAISE EXCEPTION 'source % is not an enabled crawled source: only a person enables it (ADR-0008)', NEW.source_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_run_source_enabled', TABLE = TG_TABLE_NAME;
  END IF;
  SELECT p.id, p.verdict, p.checked_at INTO newest
  FROM public.source_policy_check p
  WHERE p.source_id = NEW.source_id
  ORDER BY p.checked_at DESC, p.id DESC
  LIMIT 1;
  IF newest.id IS DISTINCT FROM NEW.policy_check_id THEN
    RAISE EXCEPTION 'a crawl of % must cite its newest policy check (%), not %', NEW.source_id, newest.id, NEW.policy_check_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_run_policy_current', TABLE = TG_TABLE_NAME;
  END IF;
  IF newest.verdict = 'not_allowed' THEN
    RAISE EXCEPTION 'the policy check % of % does not allow crawling it', newest.id, NEW.source_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_run_policy_allows', TABLE = TG_TABLE_NAME;
  END IF;
  IF newest.checked_at < now() - make_interval(days => crawled.policy_max_age_days) THEN
    RAISE EXCEPTION 'the robots.txt and terms of % were last read at %: read them again before crawling (ADR-0008 point 1)',
      NEW.source_id, newest.checked_at
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_run_policy_fresh', TABLE = TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END
$$;


--
-- Name: FUNCTION crawl_run_policy_guard(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.crawl_run_policy_guard() IS 'Refuses a crawl run of a source that is not an enabled crawled source (crawl_run_source_enabled), or that does not cite its newest policy check (crawl_run_policy_current), whose verdict must not be not_allowed (crawl_run_policy_allows) and which must be no older than policy_max_age_days (crawl_run_policy_fresh).';


--
-- Name: fetch_log_stops_on_block(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fetch_log_stops_on_block() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  crawled record;
BEGIN
  IF NEW.outcome IN ('blocked', 'challenge') THEN
    -- Unless the lane stopped it already, or a person paused it meanwhile: stop_source() stops only an enabled source.
    PERFORM public.stop_source(NEW.source_id, NEW.outcome, NEW.requested_at);
  END IF;
  SELECT s.crawl_state, s.stopped_at, s.stop_reason INTO crawled
  FROM public.source s
  WHERE s.id = NEW.source_id;
  IF crawled.crawl_state = 'stopped_on_block' AND crawled.stopped_at = NEW.requested_at
     AND crawled.stop_reason = NEW.outcome THEN
    -- The request that stopped its source, the stop's evidence: its run ends with it.
    UPDATE public.crawl_run
    SET status = 'stopped_on_block', finished_at = greatest(now(), started_at)
    WHERE id = NEW.crawl_run_id AND status = 'running';
  END IF;
  RETURN NULL;
END
$$;


--
-- Name: FUNCTION fetch_log_stops_on_block(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.fetch_log_stops_on_block() IS 'A blocked or challenge fetch stops its source through stop_source(); the fetch whose requested_at and outcome are its source''s stopped_at and stop_reason ends its run as stopped_on_block (ADR-0008 point 6).';


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
-- Name: listing_price_event_fill_previous(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listing_price_event_fill_previous() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  previous record;
BEGIN
  -- One writer per listing at a time: the second waits here and then reads the first's event as its predecessor.
  PERFORM FROM public.listing l WHERE l.id = NEW.listing_id FOR NO KEY UPDATE;
  -- An exact re-insert of an event (a job that runs twice) is not late: listing_price_event_observed_unique takes it.
  IF EXISTS (
    SELECT FROM public.listing_price_event e
    WHERE e.listing_id = NEW.listing_id AND e.observed_at > NEW.observed_at
  ) AND NOT EXISTS (
    SELECT FROM public.listing_price_event e
    WHERE e.listing_id = NEW.listing_id AND e.observed_at = NEW.observed_at
  ) THEN
    RAISE EXCEPTION 'listing %: a price observed at % is older than its latest price event', NEW.listing_id, NEW.observed_at
      USING ERRCODE = 'check_violation', CONSTRAINT = 'listing_price_event_in_order', TABLE = TG_TABLE_NAME;
  END IF;
  -- Strictly earlier events only, so an exact re-insert of (listing_id, observed_at) gets the values the original
  -- got and is left to listing_price_event_observed_unique (ON CONFLICT DO NOTHING skips it).
  SELECT e.price_type, e.asking_price_toman INTO previous
  FROM public.listing_price_event e
  WHERE e.listing_id = NEW.listing_id AND e.observed_at < NEW.observed_at
  ORDER BY e.observed_at DESC
  LIMIT 1;
  NEW.previous_price_type := previous.price_type;
  NEW.previous_price_toman := previous.asking_price_toman;
  NEW.last_asking_price_toman := (
    SELECT e.asking_price_toman
    FROM public.listing_price_event e
    WHERE e.listing_id = NEW.listing_id AND e.observed_at < NEW.observed_at AND e.price_type = 'asking'
    ORDER BY e.observed_at DESC
    LIMIT 1);
  RETURN NEW;
END
$$;


--
-- Name: FUNCTION listing_price_event_fill_previous(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.listing_price_event_fill_previous() IS 'Fills previous_price_type, previous_price_toman and last_asking_price_toman from the listing''s earlier events, holding the listing row, and refuses an event older than the listing''s latest (listing_price_event_in_order); one at an existing event''s instant is left to listing_price_event_observed_unique.';


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


--
-- Name: stop_source(text, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stop_source(stopping_source_id text, reason text, blocked_request_at timestamp with time zone) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  WITH stopped AS (
    UPDATE public.source
    SET crawl_state = 'stopped_on_block', stopped_at = blocked_request_at, stop_reason = reason
    WHERE id = stopping_source_id AND access_method = 'crawl' AND crawl_state IN ('enabled', 'paused')
    RETURNING id
  )
  SELECT EXISTS (SELECT FROM stopped)
$$;


--
-- Name: FUNCTION stop_source(stopping_source_id text, reason text, blocked_request_at timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.stop_source(stopping_source_id text, reason text, blocked_request_at timestamp with time zone) IS 'Stops a crawled source on a block (ADR-0008 point 6, ADR-0018 point 6), whether it is enabled or was paused while the request was on the wire, recording when the blocked request started and why (blocked, rate_limited, challenge); true when this call stopped it. A stopped source keeps its first stop. Only a human re-enables a source.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bam; Type: TABLE; Schema: pgboss; Owner: -
--

CREATE TABLE pgboss.bam (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    version integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    queue text,
    table_name text NOT NULL,
    command text NOT NULL,
    error text,
    created_on timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    started_on timestamp with time zone,
    completed_on timestamp with time zone
);


--
-- Name: job; Type: TABLE; Schema: pgboss; Owner: -
--

CREATE TABLE pgboss.job (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    data jsonb,
    state pgboss.job_state DEFAULT 'created'::pgboss.job_state NOT NULL,
    retry_limit integer DEFAULT 2 NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    retry_delay integer DEFAULT 0 NOT NULL,
    retry_backoff boolean DEFAULT false NOT NULL,
    retry_delay_max integer,
    expire_seconds integer DEFAULT 900 NOT NULL,
    deletion_seconds integer DEFAULT 604800 NOT NULL,
    singleton_key text,
    singleton_on timestamp without time zone,
    group_id text,
    group_tier text,
    start_after timestamp with time zone DEFAULT now() NOT NULL,
    created_on timestamp with time zone DEFAULT now() NOT NULL,
    started_on timestamp with time zone,
    completed_on timestamp with time zone,
    keep_until timestamp with time zone DEFAULT (now() + '336:00:00'::interval) NOT NULL,
    output jsonb,
    dead_letter text,
    policy text,
    heartbeat_on timestamp with time zone,
    heartbeat_seconds integer,
    blocked boolean DEFAULT false NOT NULL,
    blocking boolean DEFAULT false NOT NULL,
    pending_dependencies integer DEFAULT 0 NOT NULL,
    source_name text,
    source_id uuid,
    source_created_on timestamp with time zone,
    source_retry_count integer,
    source_output jsonb,
    source_root_id uuid
)
PARTITION BY LIST (name);


--
-- Name: job_common; Type: TABLE; Schema: pgboss; Owner: -
--

CREATE TABLE pgboss.job_common (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT job_id_not_null NOT NULL,
    name text CONSTRAINT job_name_not_null NOT NULL,
    priority integer DEFAULT 0 CONSTRAINT job_priority_not_null NOT NULL,
    data jsonb,
    state pgboss.job_state DEFAULT 'created'::pgboss.job_state CONSTRAINT job_state_not_null NOT NULL,
    retry_limit integer DEFAULT 2 CONSTRAINT job_retry_limit_not_null NOT NULL,
    retry_count integer DEFAULT 0 CONSTRAINT job_retry_count_not_null NOT NULL,
    retry_delay integer DEFAULT 0 CONSTRAINT job_retry_delay_not_null NOT NULL,
    retry_backoff boolean DEFAULT false CONSTRAINT job_retry_backoff_not_null NOT NULL,
    retry_delay_max integer,
    expire_seconds integer DEFAULT 900 CONSTRAINT job_expire_seconds_not_null NOT NULL,
    deletion_seconds integer DEFAULT 604800 CONSTRAINT job_deletion_seconds_not_null NOT NULL,
    singleton_key text,
    singleton_on timestamp without time zone,
    group_id text,
    group_tier text,
    start_after timestamp with time zone DEFAULT now() CONSTRAINT job_start_after_not_null NOT NULL,
    created_on timestamp with time zone DEFAULT now() CONSTRAINT job_created_on_not_null NOT NULL,
    started_on timestamp with time zone,
    completed_on timestamp with time zone,
    keep_until timestamp with time zone DEFAULT (now() + '336:00:00'::interval) CONSTRAINT job_keep_until_not_null NOT NULL,
    output jsonb,
    dead_letter text,
    policy text,
    heartbeat_on timestamp with time zone,
    heartbeat_seconds integer,
    blocked boolean DEFAULT false CONSTRAINT job_blocked_not_null NOT NULL,
    blocking boolean DEFAULT false CONSTRAINT job_blocking_not_null NOT NULL,
    pending_dependencies integer DEFAULT 0 CONSTRAINT job_pending_dependencies_not_null NOT NULL,
    source_name text,
    source_id uuid,
    source_created_on timestamp with time zone,
    source_retry_count integer,
    source_output jsonb,
    source_root_id uuid,
    CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK ((NOT ((policy = 'key_strict_fifo'::text) AND (singleton_key IS NULL))))
);


--
-- Name: job_dependency; Type: TABLE; Schema: pgboss; Owner: -
--

CREATE TABLE pgboss.job_dependency (
    child_name text NOT NULL,
    child_id uuid NOT NULL,
    parent_name text NOT NULL,
    parent_id uuid NOT NULL
);


--
-- Name: queue; Type: TABLE; Schema: pgboss; Owner: -
--

CREATE TABLE pgboss.queue (
    name text NOT NULL,
    policy text NOT NULL,
    retry_limit integer NOT NULL,
    retry_delay integer NOT NULL,
    retry_backoff boolean NOT NULL,
    retry_delay_max integer,
    expire_seconds integer NOT NULL,
    retention_seconds integer NOT NULL,
    deletion_seconds integer NOT NULL,
    dead_letter text,
    partition boolean NOT NULL,
    table_name text NOT NULL,
    deferred_count integer DEFAULT 0 NOT NULL,
    queued_count integer DEFAULT 0 NOT NULL,
    ready_count integer DEFAULT 0 NOT NULL,
    warning_queued integer DEFAULT 0 NOT NULL,
    active_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    total_count integer DEFAULT 0 NOT NULL,
    created_delta integer DEFAULT 0 NOT NULL,
    completed_delta integer DEFAULT 0 NOT NULL,
    failed_delta integer DEFAULT 0 NOT NULL,
    delta_on timestamp with time zone,
    delta_seconds integer,
    ready_history integer[] DEFAULT '{}'::integer[] NOT NULL,
    heartbeat_seconds integer,
    notify boolean DEFAULT false NOT NULL,
    singletons_active text[],
    monitor_claim_on timestamp with time zone,
    monitor_on timestamp with time zone,
    maintain_on timestamp with time zone,
    created_on timestamp with time zone DEFAULT now() NOT NULL,
    updated_on timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT queue_check CHECK ((dead_letter IS DISTINCT FROM name))
);


--
-- Name: queue_stats; Type: TABLE; Schema: pgboss; Owner: -
--

CREATE TABLE pgboss.queue_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    deferred_count integer DEFAULT 0 NOT NULL,
    queued_count integer DEFAULT 0 NOT NULL,
    ready_count integer DEFAULT 0 NOT NULL,
    active_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    total_count integer DEFAULT 0 NOT NULL,
    created_delta integer,
    completed_delta integer,
    failed_delta integer,
    delta_seconds integer,
    delta_on timestamp with time zone,
    captured_on timestamp with time zone DEFAULT now() NOT NULL
)
PARTITION BY RANGE (captured_on);


--
-- Name: schedule; Type: TABLE; Schema: pgboss; Owner: -
--

CREATE TABLE pgboss.schedule (
    name text NOT NULL,
    key text DEFAULT ''::text NOT NULL,
    kind text DEFAULT 'cron'::text NOT NULL,
    cron text NOT NULL,
    timezone text DEFAULT 'UTC'::text,
    data jsonb,
    options jsonb,
    created_on timestamp with time zone DEFAULT now() NOT NULL,
    updated_on timestamp with time zone DEFAULT now() NOT NULL,
    last_job_id uuid,
    CONSTRAINT schedule_kind_check CHECK ((kind = ANY (ARRAY['cron'::text, 'rrule'::text])))
);


--
-- Name: subscription; Type: TABLE; Schema: pgboss; Owner: -
--

CREATE TABLE pgboss.subscription (
    event text NOT NULL,
    name text NOT NULL,
    created_on timestamp with time zone DEFAULT now() NOT NULL,
    updated_on timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: version; Type: TABLE; Schema: pgboss; Owner: -
--

CREATE TABLE pgboss.version (
    version integer NOT NULL,
    cron_on timestamp with time zone,
    bam_on timestamp with time zone,
    flow_on timestamp with time zone,
    reindex_on timestamp with time zone,
    monitor_backoff_on timestamp with time zone
);


--
-- Name: warning; Type: TABLE; Schema: pgboss; Owner: -
--

CREATE TABLE pgboss.warning (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    message text NOT NULL,
    data jsonb,
    created_on timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crawl_feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crawl_feed (
    source_id text NOT NULL,
    feed_key text NOT NULL,
    read_through_at timestamp with time zone,
    round_started_at timestamp with time zone,
    CONSTRAINT crawl_feed_feed_key_format CHECK ((feed_key ~ '^[a-z][a-z0-9_]{1,40}$'::text))
);


--
-- Name: TABLE crawl_feed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.crawl_feed IS 'How far discovery has read each newest-first feed of a source (ADR-0017 point 3): a round reads down to read_through_at. Written by the worker every round.';


--
-- Name: COLUMN crawl_feed.feed_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_feed.feed_key IS 'Names the feed within its source, for example tracked_models.';


--
-- Name: COLUMN crawl_feed.read_through_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_feed.read_through_at IS 'The newest sort time, by the source''s own clock, down from which a finished round read the whole feed; null before the first round finishes. Rows sorted after it are new or were moved up since.';


--
-- Name: COLUMN crawl_feed.round_started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_feed.round_started_at IS 'When the latest round started; a new round starts only ten minutes or more after it.';


--
-- Name: crawl_lane; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crawl_lane (
    source_id text NOT NULL,
    next_request_at timestamp with time zone DEFAULT now() NOT NULL,
    last_request_at timestamp with time zone,
    lease_holder text,
    lease_until timestamp with time zone,
    failure_streak integer DEFAULT 0 NOT NULL,
    cooldowns integer DEFAULT 0 NOT NULL,
    cooldown_until timestamp with time zone,
    cooldown_reason text,
    rate_limited_at timestamp with time zone,
    CONSTRAINT crawl_lane_cooldown_explained CHECK (((cooldown_until IS NULL) = (cooldown_reason IS NULL))),
    CONSTRAINT crawl_lane_cooldown_reason_valid CHECK ((cooldown_reason = ANY (ARRAY['unavailable'::text, 'rate_limited'::text]))),
    CONSTRAINT crawl_lane_cooldowns_nonnegative CHECK ((cooldowns >= 0)),
    CONSTRAINT crawl_lane_failure_streak_nonnegative CHECK ((failure_streak >= 0)),
    CONSTRAINT crawl_lane_lease_bounded CHECK (((lease_until IS NULL) OR ((last_request_at IS NOT NULL) AND (lease_until > last_request_at) AND (lease_until <= (last_request_at + '00:15:00'::interval))))),
    CONSTRAINT crawl_lane_lease_complete CHECK (((lease_holder IS NULL) = (lease_until IS NULL))),
    CONSTRAINT crawl_lane_lease_holder_not_blank CHECK ((btrim(lease_holder) <> ''::text))
);


--
-- Name: TABLE crawl_lane; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.crawl_lane IS 'Request pacing per source (ADR-0018): when the next request may start, the request in flight, the breaker and the last 429. Written by the worker on every request.';


--
-- Name: COLUMN crawl_lane.next_request_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_lane.next_request_at IS 'The earliest start of the next request (from the lane''s creation at first): the end of the previous one plus its gap (five times its duration, at least source.min_request_interval_ms, doubled for 24 hours after a 429, at most 30 s unless the interval is longer).';


--
-- Name: COLUMN crawl_lane.last_request_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_lane.last_request_at IS 'When the latest request started.';


--
-- Name: COLUMN crawl_lane.lease_holder; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_lane.lease_holder IS 'Who holds the request in flight (worker process and job), or null. A lease that outlives lease_until is free again, so a crashed worker cannot hold the lane.';


--
-- Name: COLUMN crawl_lane.failure_streak; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_lane.failure_streak IS 'Timeouts, server errors and dropped connections in a row; three open the breaker (a cool-down). Any other answer resets it.';


--
-- Name: COLUMN crawl_lane.cooldowns; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_lane.cooldowns IS 'Cool-downs in a row without a successful request between them; each one lasts about twice the previous, up to an hour.';


--
-- Name: COLUMN crawl_lane.cooldown_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_lane.cooldown_until IS 'The lane sends nothing until then: after three transient failures in a row (unavailable), or after a 429 (rate_limited). The next request after it is the probe.';


--
-- Name: COLUMN crawl_lane.rate_limited_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_lane.rate_limited_at IS 'The latest 429. For 24 hours after it the gap is doubled, and another 429 stops the source (ADR-0018 point 6).';


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
    kind text NOT NULL,
    counts jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT crawl_run_counts_is_object CHECK ((jsonb_typeof(counts) = 'object'::text)),
    CONSTRAINT crawl_run_finished_when_not_running CHECK (((status = 'running'::text) = (finished_at IS NULL))),
    CONSTRAINT crawl_run_kind_valid CHECK ((kind = ANY (ARRAY['discovery'::text, 'detail'::text, 'measure'::text]))),
    CONSTRAINT crawl_run_status_valid CHECK ((status = ANY (ARRAY['running'::text, 'succeeded'::text, 'failed'::text, 'stopped_on_block'::text]))),
    CONSTRAINT crawl_run_times_ordered CHECK (((finished_at IS NULL) OR (finished_at >= started_at)))
);


--
-- Name: TABLE crawl_run; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.crawl_run IS 'One lane job''s crawl of one source (ADR-0018): a discovery page, a listing''s detail or a measurement page, citing the policy check it ran under (ADR-0008 point 1). The lane runs one job of a source at a time, so at most one run per source is running.';


--
-- Name: COLUMN crawl_run.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_run.status IS 'running until its job ends; succeeded or failed then; stopped_on_block when its request was refused (a 401 or 403, a challenge page or empty answer, or a second 429 within 24 hours) and the source stopped with it (ADR-0008 point 6, ADR-0018).';


--
-- Name: COLUMN crawl_run.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_run.kind IS 'What the run spent its request on (ADR-0017 point 5): discovery (a page of the newest listings of tracked models), detail (one listing''s page), measure (a page of a measurement walk).';


--
-- Name: COLUMN crawl_run.counts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_run.counts IS 'What the run did, written once when it closes: rows read, new listings, snapshots stored or unchanged, price events, and so on, by kind. Its requests and their outcomes are in fetch_log.';


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
    CONSTRAINT fetch_log_method_valid CHECK ((method = ANY (ARRAY['http_get'::text, 'http_post'::text, 'official_api'::text]))),
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
-- Name: COLUMN fetch_log.method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fetch_log.method IS 'How the request reached the source: http_get or http_post to its pages or public web API (a crawl), official_api through a partner API it grants.';


--
-- Name: COLUMN fetch_log.outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fetch_log.outcome IS 'What came back. blocked (401, 403) and challenge stop the source, and so does a second rate_limited (429) within 24 hours (ADR-0008 point 6, ADR-0018); error means no usable answer: a network failure, a timeout, a 5xx, or an answer the crawler could not read.';


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
-- Name: listing_price_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_price_event (
    id bigint NOT NULL,
    listing_id bigint NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    price_type text NOT NULL,
    asking_price_toman bigint,
    previous_price_type text,
    previous_price_toman bigint,
    last_asking_price_toman bigint,
    snapshot_id bigint NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT listing_price_event_amount_matches_type CHECK (((price_type = 'asking'::text) = (asking_price_toman IS NOT NULL))),
    CONSTRAINT listing_price_event_asking_price_toman_range CHECK (((asking_price_toman >= 1) AND (asking_price_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_price_event_is_a_change CHECK (((price_type IS DISTINCT FROM previous_price_type) OR (asking_price_toman IS DISTINCT FROM previous_price_toman))),
    CONSTRAINT listing_price_event_last_asking_price_toman_range CHECK (((last_asking_price_toman >= 1) AND (last_asking_price_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_price_event_previous_amount_matches_type CHECK ((((previous_price_type IS NOT NULL) AND (previous_price_type = 'asking'::text)) = (previous_price_toman IS NOT NULL))),
    CONSTRAINT listing_price_event_previous_price_toman_range CHECK (((previous_price_toman >= 1) AND (previous_price_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_price_event_previous_price_type_valid CHECK ((previous_price_type = ANY (ARRAY['asking'::text, 'negotiable'::text, 'installment'::text, 'placeholder'::text]))),
    CONSTRAINT listing_price_event_price_type_valid CHECK ((price_type = ANY (ARRAY['asking'::text, 'negotiable'::text, 'installment'::text, 'placeholder'::text])))
);


--
-- Name: TABLE listing_price_event; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.listing_price_event IS 'Append-only price history of a listing in valid time (ADR-0014): one row per change of what it asks, read from a snapshot of it.';


--
-- Name: COLUMN listing_price_event.observed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_price_event.observed_at IS 'When the source showed this price: the start of the request whose snapshot is the evidence. Events of a listing are inserted in this order.';


--
-- Name: COLUMN listing_price_event.price_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_price_event.price_type IS 'asking (an amount), negotiable («توافقی»), installment (an installment offer: its figure is not the car''s price), placeholder (a token figure such as 1,000 tomans); only asking carries an amount.';


--
-- Name: COLUMN listing_price_event.asking_price_toman; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_price_event.asking_price_toman IS 'The asking price in whole tomans, exactly when price_type is asking.';


--
-- Name: COLUMN listing_price_event.previous_price_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_price_event.previous_price_type IS 'The type of the listing''s previous event, filled by the trigger; null for its first.';


--
-- Name: COLUMN listing_price_event.previous_price_toman; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_price_event.previous_price_toman IS 'The previous event''s asking price, filled by the trigger; null when that event carried none.';


--
-- Name: COLUMN listing_price_event.last_asking_price_toman; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_price_event.last_asking_price_toman IS 'The latest earlier asking price, filled by the trigger, across negotiable and placeholder events: an asking price below it is a drop.';


--
-- Name: COLUMN listing_price_event.snapshot_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_price_event.snapshot_id IS 'The snapshot the price was read from: the evidence.';


--
-- Name: COLUMN listing_price_event.recorded_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_price_event.recorded_at IS 'When we stored the event; differs from observed_at when history is re-derived.';


--
-- Name: listing_price_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.listing_price_event ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.listing_price_event_id_seq
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
-- Name: model_volume; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_volume (
    id bigint NOT NULL,
    source_id text NOT NULL,
    source_model_key text NOT NULL,
    level text NOT NULL,
    swept_at timestamp with time zone NOT NULL,
    active_count integer NOT NULL,
    pages_read integer NOT NULL,
    complete boolean NOT NULL,
    CONSTRAINT model_volume_active_count_nonnegative CHECK ((active_count >= 0)),
    CONSTRAINT model_volume_level_valid CHECK ((level = ANY (ARRAY['all'::text, 'brand'::text, 'model'::text, 'trim'::text]))),
    CONSTRAINT model_volume_pages_read_nonnegative CHECK ((pages_read >= 0)),
    CONSTRAINT model_volume_source_model_key_not_blank CHECK ((btrim(source_model_key) <> ''::text))
);


--
-- Name: TABLE model_volume; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.model_volume IS 'Active listings per source and filter value (make, model or trim), counted from the source''s list pages in one sweep; written once per slice and sweep.';


--
-- Name: COLUMN model_volume.source_model_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_volume.source_model_key IS 'The source''s own filter value for the slice, as its search takes it (Divar''s brand_model: ROOT, Peugeot, Peugeot 206, Peugeot 206 5); mapped to the catalogue when CS-50 knows it.';


--
-- Name: COLUMN model_volume.level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_volume.level IS 'all (every car), brand, model or trim: how finely the slice is cut.';


--
-- Name: COLUMN model_volume.swept_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_volume.swept_at IS 'When the sweep (or measurement) that counted it started: it groups one sweep''s slices.';


--
-- Name: COLUMN model_volume.active_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_volume.active_count IS 'Listings the walk read in the slice, promoted rows counted once.';


--
-- Name: COLUMN model_volume.pages_read; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_volume.pages_read IS 'List pages the walk read: how deep the source let it follow the slice.';


--
-- Name: COLUMN model_volume.complete; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_volume.complete IS 'Whether the walk reached the end of the slice; false when the source stopped answering pages first or the walk hit its page limit, and then active_count is a lower bound.';


--
-- Name: model_volume_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.model_volume ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.model_volume_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


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

COMMENT ON COLUMN public.source.crawl_state IS 'enabled or paused by a human; stopped_on_block by the crawler on a 401 or 403, a challenge, or a second 429 within 24 hours (ADR-0008 point 6, ADR-0018), until a human reads the evidence and re-enables it.';


--
-- Name: COLUMN source.min_request_interval_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source.min_request_interval_ms IS 'Milliseconds between two requests to this source; at least 3000 for crawled sources (ADR-0008 point 5). robots.txt is recorded, not followed, so a Crawl-delay does not lengthen it; the lane waits longer after a slow answer and after a 429 (ADR-0018).';


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
-- Name: job_common; Type: TABLE ATTACH; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.job ATTACH PARTITION pgboss.job_common DEFAULT;


--
-- Name: bam bam_pkey; Type: CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.bam
    ADD CONSTRAINT bam_pkey PRIMARY KEY (id);


--
-- Name: job job_pkey; Type: CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.job
    ADD CONSTRAINT job_pkey PRIMARY KEY (name, id);


--
-- Name: job_common job_common_pkey; Type: CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.job_common
    ADD CONSTRAINT job_common_pkey PRIMARY KEY (name, id);


--
-- Name: job_dependency job_dependency_pkey; Type: CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.job_dependency
    ADD CONSTRAINT job_dependency_pkey PRIMARY KEY (child_name, child_id, parent_name, parent_id);


--
-- Name: queue queue_pkey; Type: CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.queue
    ADD CONSTRAINT queue_pkey PRIMARY KEY (name);


--
-- Name: queue_stats queue_stats_pkey; Type: CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.queue_stats
    ADD CONSTRAINT queue_stats_pkey PRIMARY KEY (id, captured_on);


--
-- Name: schedule schedule_pkey; Type: CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.schedule
    ADD CONSTRAINT schedule_pkey PRIMARY KEY (name, key);


--
-- Name: subscription subscription_pkey; Type: CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.subscription
    ADD CONSTRAINT subscription_pkey PRIMARY KEY (event, name);


--
-- Name: version version_pkey; Type: CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.version
    ADD CONSTRAINT version_pkey PRIMARY KEY (version);


--
-- Name: warning warning_pkey; Type: CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.warning
    ADD CONSTRAINT warning_pkey PRIMARY KEY (id);


--
-- Name: crawl_feed crawl_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crawl_feed
    ADD CONSTRAINT crawl_feed_pkey PRIMARY KEY (source_id, feed_key);


--
-- Name: crawl_lane crawl_lane_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crawl_lane
    ADD CONSTRAINT crawl_lane_pkey PRIMARY KEY (source_id);


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
-- Name: fetch_log fetch_log_request_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fetch_log
    ADD CONSTRAINT fetch_log_request_unique UNIQUE (crawl_run_id, source_id, requested_at);


--
-- Name: CONSTRAINT fetch_log_request_unique ON fetch_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT fetch_log_request_unique ON public.fetch_log IS 'One row per request: a run sends one request at a time, each starting at its own instant.';


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
-- Name: listing_price_event listing_price_event_observed_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_price_event
    ADD CONSTRAINT listing_price_event_observed_unique UNIQUE (listing_id, observed_at);


--
-- Name: listing_price_event listing_price_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_price_event
    ADD CONSTRAINT listing_price_event_pkey PRIMARY KEY (id);


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
-- Name: model_volume model_volume_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_volume
    ADD CONSTRAINT model_volume_pkey PRIMARY KEY (id);


--
-- Name: model_volume model_volume_sweep_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_volume
    ADD CONSTRAINT model_volume_sweep_unique UNIQUE (source_id, source_model_key, swept_at);


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
-- Name: job_common_i1; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE UNIQUE INDEX job_common_i1 ON pgboss.job_common USING btree (name, COALESCE(singleton_key, ''::text)) WHERE ((state = 'created'::pgboss.job_state) AND (policy = 'short'::text));


--
-- Name: job_common_i10; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE INDEX job_common_i10 ON pgboss.job_common USING btree (name, singleton_key, state DESC, created_on, id) INCLUDE (start_after) WHERE ((state < 'active'::pgboss.job_state) AND (NOT blocked) AND (policy = 'key_strict_fifo'::text));


--
-- Name: job_common_i11; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE INDEX job_common_i11 ON pgboss.job_common USING btree (name, priority DESC, created_on, start_after) WHERE ((state < 'active'::pgboss.job_state) AND (NOT blocked));


--
-- Name: job_common_i12; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE INDEX job_common_i12 ON pgboss.job_common USING btree (source_root_id) WHERE (source_root_id IS NOT NULL);


--
-- Name: job_common_i2; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE UNIQUE INDEX job_common_i2 ON pgboss.job_common USING btree (name, COALESCE(singleton_key, ''::text)) WHERE ((state = 'active'::pgboss.job_state) AND (policy = 'singleton'::text));


--
-- Name: job_common_i3; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE UNIQUE INDEX job_common_i3 ON pgboss.job_common USING btree (name, state, COALESCE(singleton_key, ''::text)) WHERE ((state <= 'active'::pgboss.job_state) AND (policy = 'stately'::text));


--
-- Name: job_common_i4; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE UNIQUE INDEX job_common_i4 ON pgboss.job_common USING btree (name, singleton_on, COALESCE(singleton_key, ''::text)) WHERE ((state <> 'cancelled'::pgboss.job_state) AND (singleton_on IS NOT NULL));


--
-- Name: job_common_i6; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE UNIQUE INDEX job_common_i6 ON pgboss.job_common USING btree (name, COALESCE(singleton_key, ''::text)) WHERE ((state <= 'active'::pgboss.job_state) AND (policy = 'exclusive'::text));


--
-- Name: job_common_i7; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE INDEX job_common_i7 ON pgboss.job_common USING btree (name, group_id) WHERE ((state = 'active'::pgboss.job_state) AND (group_id IS NOT NULL));


--
-- Name: job_common_i8; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE UNIQUE INDEX job_common_i8 ON pgboss.job_common USING btree (name, singleton_key) WHERE ((state = ANY (ARRAY['active'::pgboss.job_state, 'retry'::pgboss.job_state, 'failed'::pgboss.job_state])) AND (policy = 'key_strict_fifo'::text));


--
-- Name: job_common_i9; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE INDEX job_common_i9 ON pgboss.job_common USING btree (name, id) WHERE (blocking AND (state = 'completed'::pgboss.job_state));


--
-- Name: job_dep_parent_idx; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE INDEX job_dep_parent_idx ON pgboss.job_dependency USING btree (parent_name, parent_id);


--
-- Name: queue_stats_i1; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE INDEX queue_stats_i1 ON ONLY pgboss.queue_stats USING btree (name, captured_on DESC) INCLUDE (deferred_count, queued_count, ready_count, active_count, failed_count, total_count);


--
-- Name: warning_i1; Type: INDEX; Schema: pgboss; Owner: -
--

CREATE INDEX warning_i1 ON pgboss.warning USING btree (created_on DESC);


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
-- Name: listing_price_event_snapshot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listing_price_event_snapshot_idx ON public.listing_price_event USING btree (snapshot_id, listing_id);


--
-- Name: source_policy_check_source_latest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX source_policy_check_source_latest_idx ON public.source_policy_check USING btree (source_id, checked_at DESC, id DESC);


--
-- Name: job_common_pkey; Type: INDEX ATTACH; Schema: pgboss; Owner: -
--

ALTER INDEX pgboss.job_pkey ATTACH PARTITION pgboss.job_common_pkey;


--
-- Name: crawl_run crawl_run_history_fixed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER crawl_run_history_fixed BEFORE UPDATE ON public.crawl_run FOR EACH ROW EXECUTE FUNCTION public.crawl_run_history_fixed();


--
-- Name: crawl_run crawl_run_policy_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER crawl_run_policy_guard AFTER INSERT ON public.crawl_run FOR EACH ROW EXECUTE FUNCTION public.crawl_run_policy_guard();


--
-- Name: fetch_log fetch_log_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fetch_log_append_only BEFORE DELETE OR UPDATE ON public.fetch_log FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: fetch_log fetch_log_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fetch_log_append_only_truncate BEFORE TRUNCATE ON public.fetch_log FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: fetch_log fetch_log_stops_on_block; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fetch_log_stops_on_block AFTER INSERT ON public.fetch_log FOR EACH ROW WHEN ((new.outcome = ANY (ARRAY['blocked'::text, 'challenge'::text, 'rate_limited'::text]))) EXECUTE FUNCTION public.fetch_log_stops_on_block();


--
-- Name: listing_price_event listing_price_event_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER listing_price_event_append_only BEFORE DELETE OR UPDATE ON public.listing_price_event FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: listing_price_event listing_price_event_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER listing_price_event_append_only_truncate BEFORE TRUNCATE ON public.listing_price_event FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: listing_price_event listing_price_event_fill_previous; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER listing_price_event_fill_previous BEFORE INSERT ON public.listing_price_event FOR EACH ROW EXECUTE FUNCTION public.listing_price_event_fill_previous();


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
-- Name: job_common dlq_fkey; Type: FK CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.job_common
    ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES pgboss.queue(name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: job_common q_fkey; Type: FK CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.job_common
    ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES pgboss.queue(name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: queue queue_dead_letter_fkey; Type: FK CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.queue
    ADD CONSTRAINT queue_dead_letter_fkey FOREIGN KEY (dead_letter) REFERENCES pgboss.queue(name);


--
-- Name: schedule schedule_name_fkey; Type: FK CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.schedule
    ADD CONSTRAINT schedule_name_fkey FOREIGN KEY (name) REFERENCES pgboss.queue(name) ON DELETE CASCADE;


--
-- Name: subscription subscription_name_fkey; Type: FK CONSTRAINT; Schema: pgboss; Owner: -
--

ALTER TABLE ONLY pgboss.subscription
    ADD CONSTRAINT subscription_name_fkey FOREIGN KEY (name) REFERENCES pgboss.queue(name) ON DELETE CASCADE;


--
-- Name: crawl_feed crawl_feed_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crawl_feed
    ADD CONSTRAINT crawl_feed_source_fk FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE CASCADE;


--
-- Name: crawl_lane crawl_lane_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crawl_lane
    ADD CONSTRAINT crawl_lane_source_fk FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE CASCADE;


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
-- Name: listing_price_event listing_price_event_listing_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_price_event
    ADD CONSTRAINT listing_price_event_listing_fk FOREIGN KEY (listing_id) REFERENCES public.listing(id) ON DELETE CASCADE;


--
-- Name: listing_price_event listing_price_event_snapshot_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_price_event
    ADD CONSTRAINT listing_price_event_snapshot_fk FOREIGN KEY (snapshot_id, listing_id) REFERENCES public.snapshot(id, listing_id) ON DELETE CASCADE;


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
-- Name: model_volume model_volume_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_volume
    ADD CONSTRAINT model_volume_source_fk FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE RESTRICT;


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
-- Name: SCHEMA pgboss; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA pgboss TO carshenas_worker;
GRANT USAGE ON SCHEMA pgboss TO carshenas_readonly;


--
-- Name: FUNCTION crawl_run_policy_guard(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crawl_run_policy_guard() FROM PUBLIC;


--
-- Name: FUNCTION stop_source(stopping_source_id text, reason text, blocked_request_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stop_source(stopping_source_id text, reason text, blocked_request_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stop_source(stopping_source_id text, reason text, blocked_request_at timestamp with time zone) TO carshenas_worker;


--
-- Name: TABLE bam; Type: ACL; Schema: pgboss; Owner: -
--

GRANT SELECT ON TABLE pgboss.bam TO carshenas_worker;
GRANT SELECT ON TABLE pgboss.bam TO carshenas_readonly;


--
-- Name: TABLE job; Type: ACL; Schema: pgboss; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE pgboss.job TO carshenas_worker;
GRANT SELECT ON TABLE pgboss.job TO carshenas_readonly;


--
-- Name: TABLE job_common; Type: ACL; Schema: pgboss; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE pgboss.job_common TO carshenas_worker;
GRANT SELECT ON TABLE pgboss.job_common TO carshenas_readonly;


--
-- Name: TABLE job_dependency; Type: ACL; Schema: pgboss; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE pgboss.job_dependency TO carshenas_worker;
GRANT SELECT ON TABLE pgboss.job_dependency TO carshenas_readonly;


--
-- Name: TABLE queue; Type: ACL; Schema: pgboss; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE pgboss.queue TO carshenas_worker;
GRANT SELECT ON TABLE pgboss.queue TO carshenas_readonly;


--
-- Name: TABLE queue_stats; Type: ACL; Schema: pgboss; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE pgboss.queue_stats TO carshenas_worker;
GRANT SELECT ON TABLE pgboss.queue_stats TO carshenas_readonly;


--
-- Name: TABLE schedule; Type: ACL; Schema: pgboss; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE pgboss.schedule TO carshenas_worker;
GRANT SELECT ON TABLE pgboss.schedule TO carshenas_readonly;


--
-- Name: TABLE subscription; Type: ACL; Schema: pgboss; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE pgboss.subscription TO carshenas_worker;
GRANT SELECT ON TABLE pgboss.subscription TO carshenas_readonly;


--
-- Name: TABLE version; Type: ACL; Schema: pgboss; Owner: -
--

GRANT SELECT,UPDATE ON TABLE pgboss.version TO carshenas_worker;
GRANT SELECT ON TABLE pgboss.version TO carshenas_readonly;


--
-- Name: TABLE warning; Type: ACL; Schema: pgboss; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE pgboss.warning TO carshenas_worker;
GRANT SELECT ON TABLE pgboss.warning TO carshenas_readonly;


--
-- Name: TABLE crawl_feed; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.crawl_feed TO carshenas_readonly;
GRANT SELECT,INSERT,UPDATE ON TABLE public.crawl_feed TO carshenas_worker;


--
-- Name: TABLE crawl_lane; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.crawl_lane TO carshenas_readonly;
GRANT SELECT,INSERT,UPDATE ON TABLE public.crawl_lane TO carshenas_worker;


--
-- Name: TABLE crawl_run; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.crawl_run TO carshenas_readonly;
GRANT SELECT,INSERT,UPDATE ON TABLE public.crawl_run TO carshenas_worker;


--
-- Name: TABLE fetch_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.fetch_log TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.fetch_log TO carshenas_worker;


--
-- Name: TABLE listing; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing TO carshenas_readonly;
GRANT SELECT ON TABLE public.listing TO carshenas_web;
GRANT SELECT,INSERT,UPDATE ON TABLE public.listing TO carshenas_worker;


--
-- Name: TABLE listing_price_event; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing_price_event TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.listing_price_event TO carshenas_worker;


--
-- Name: TABLE listing_status_transition; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing_status_transition TO carshenas_readonly;
GRANT SELECT ON TABLE public.listing_status_transition TO carshenas_worker;


--
-- Name: TABLE model_volume; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.model_volume TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.model_volume TO carshenas_worker;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.schema_migrations TO carshenas_web;
GRANT SELECT ON TABLE public.schema_migrations TO carshenas_readonly;
GRANT SELECT ON TABLE public.schema_migrations TO carshenas_worker;


--
-- Name: TABLE snapshot; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.snapshot TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.snapshot TO carshenas_worker;


--
-- Name: TABLE source; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.source TO carshenas_readonly;
GRANT SELECT ON TABLE public.source TO carshenas_web;
GRANT SELECT ON TABLE public.source TO carshenas_worker;


--
-- Name: TABLE source_policy_check; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.source_policy_check TO carshenas_readonly;
GRANT SELECT ON TABLE public.source_policy_check TO carshenas_worker;


--
-- Name: TABLE source_current_policy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.source_current_policy TO carshenas_readonly;
GRANT SELECT ON TABLE public.source_current_policy TO carshenas_worker;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: pgboss; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE carshenas_owner IN SCHEMA pgboss GRANT SELECT ON TABLES TO carshenas_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE carshenas_owner IN SCHEMA pgboss GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO carshenas_worker;


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
INSERT INTO public.schema_migrations (version) VALUES ('20260929082446');
INSERT INTO public.schema_migrations (version) VALUES ('20260929082447');
INSERT INTO public.schema_migrations (version) VALUES ('20260929082449');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104900');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104901');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104903');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104905');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104906');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104908');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104909');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104911');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104912');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104913');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104914');
INSERT INTO public.schema_migrations (version) VALUES ('20260929104915');
