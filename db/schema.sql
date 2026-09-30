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
-- Name: deal_rating; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.deal_rating AS ENUM (
    'great',
    'good',
    'fair',
    'high',
    'overpriced'
);


--
-- Name: TYPE deal_rating; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.deal_rating IS 'The five deal ratings from best to worst (S01): «معامله‌ی عالی», «معامله‌ی خوب», «قیمت منصفانه», «گران», «خیلی گران».';


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
-- Name: change_job_state(text, uuid, text, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.change_job_state(changing_queue text, changing_job_id uuid, seen_state text, chosen_action text, changed_by bigint) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  job_row record;
BEGIN
  IF chosen_action IS NULL OR chosen_action NOT IN ('retry', 'cancel') THEN
    RAISE EXCEPTION 'a person may only retry or cancel a job, not %', chosen_action
      USING ERRCODE = 'check_violation', CONSTRAINT = 'job_state_change_action_valid', TABLE = 'job_state_change';
  END IF;
  IF starts_with(changing_queue, '__pgboss__') THEN
    RAISE EXCEPTION 'queue % is pg-boss''s own: its jobs are never retried or cancelled by hand', changing_queue
      USING ERRCODE = 'check_violation', CONSTRAINT = 'job_state_change_queue_not_internal',
        TABLE = 'job_state_change';
  END IF;
  PERFORM FROM public.account a WHERE a.id = changed_by AND a.role = 'superadmin' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account % is not a superadmin: only a superadmin retries or cancels a job', changed_by
      USING ERRCODE = 'check_violation', CONSTRAINT = 'job_state_change_by_superadmin', TABLE = 'job_state_change';
  END IF;
  SELECT j.state::text AS state INTO job_row
  FROM pgboss.job j
  WHERE j.name = changing_queue AND j.id = changing_job_id
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;
  IF (chosen_action = 'retry' AND job_row.state = 'retry') OR (chosen_action = 'cancel' AND job_row.state = 'cancelled')
  THEN
    RETURN 'unchanged';
  END IF;
  IF job_row.state IS DISTINCT FROM seen_state
     OR NOT ((chosen_action = 'retry' AND job_row.state = 'failed')
             OR (chosen_action = 'cancel' AND job_row.state IN ('created', 'retry'))) THEN
    RETURN 'stale';
  END IF;
  IF chosen_action = 'retry' THEN
    UPDATE pgboss.job j
    SET state = 'retry', retry_limit = j.retry_limit + 1, completed_on = NULL, start_after = pgboss.job_now(),
        keep_until = GREATEST(j.keep_until, pgboss.job_now() + make_interval(secs => q.retention_seconds))
    FROM pgboss.queue q
    WHERE q.name = j.name AND j.name = changing_queue AND j.id = changing_job_id;
  ELSE
    UPDATE pgboss.job
    SET state = 'cancelled', completed_on = pgboss.job_now()
    WHERE name = changing_queue AND id = changing_job_id;
  END IF;
  INSERT INTO public.job_state_change (queue, job_id, action, from_state, changed_by_account_id, changed_at)
  VALUES (changing_queue, changing_job_id, chosen_action, job_row.state, changed_by, clock_timestamp());
  RETURN 'changed';
END
$$;


--
-- Name: FUNCTION change_job_state(changing_queue text, changing_job_id uuid, seen_state text, chosen_action text, changed_by bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.change_job_state(changing_queue text, changing_job_id uuid, seen_state text, chosen_action text, changed_by bigint) IS 'Retries a failed job or cancels a waiting one for a superadmin (CS-41, ADR-0023) and records it in job_state_change: changed; unchanged when the job is already retrying or cancelled; stale, changing nothing, when the job is gone or its state is no longer the one the person saw, or the action does not apply to it. Refuses any account but a superadmin (job_state_change_by_superadmin), any action but retry or cancel (job_state_change_action_valid) and pg-boss''s own queues (job_state_change_queue_not_internal).';


--
-- Name: change_source_state(text, text, timestamp with time zone, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.change_source_state(changing_source_id text, seen_state text, seen_stopped_at timestamp with time zone, new_state text, changed_by bigint) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  source_row record;
BEGIN
  IF new_state IS NULL OR new_state NOT IN ('enabled', 'paused') THEN
    RAISE EXCEPTION 'a person may only enable or pause a source, not set it to %', new_state
      USING ERRCODE = 'check_violation', CONSTRAINT = 'source_state_change_to_state_valid',
        TABLE = 'source_state_change';
  END IF;
  PERFORM FROM public.account a WHERE a.id = changed_by AND a.role = 'superadmin' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account % is not a superadmin: only a superadmin changes a source''s crawl state', changed_by
      USING ERRCODE = 'check_violation', CONSTRAINT = 'source_state_change_by_superadmin',
        TABLE = 'source_state_change';
  END IF;
  SELECT s.crawl_state, s.stopped_at, s.stop_reason INTO source_row
  FROM public.source s
  WHERE s.id = changing_source_id
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;
  IF source_row.crawl_state = new_state THEN
    RETURN 'unchanged';
  END IF;
  IF (source_row.crawl_state, source_row.stopped_at) IS DISTINCT FROM (seen_state, seen_stopped_at) THEN
    RETURN 'stale';
  END IF;
  UPDATE public.source
  SET crawl_state = new_state, stopped_at = NULL, stop_reason = NULL
  WHERE id = changing_source_id;
  -- Stamped now, holding the lock: a call that waited for it is recorded after the change it waited behind.
  INSERT INTO public.source_state_change (
    source_id, from_state, to_state, changed_by_account_id, changed_at, cleared_stopped_at, cleared_stop_reason)
  VALUES (
    changing_source_id, source_row.crawl_state, new_state, changed_by, clock_timestamp(), source_row.stopped_at,
    source_row.stop_reason);
  RETURN 'changed';
END
$$;


--
-- Name: FUNCTION change_source_state(changing_source_id text, seen_state text, seen_stopped_at timestamp with time zone, new_state text, changed_by bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.change_source_state(changing_source_id text, seen_state text, seen_stopped_at timestamp with time zone, new_state text, changed_by bigint) IS 'Enables or pauses a source for a superadmin (CS-40, ADR-0023) and records the change in source_state_change: changed; unchanged when the source is in that state already; stale, changing nothing, when its state or stop is no longer what the person saw, or it is gone. A stop it leaves is cleared on the source and kept in the change. Refuses any account but a superadmin (source_state_change_by_superadmin) and any state but enabled or paused (source_state_change_to_state_valid); a source that is not crawled cannot be enabled (source_only_crawled_sources_run).';


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
-- Name: create_notification(bigint, text, text, jsonb, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(for_account_id bigint, of_kind text, for_event_key text, with_payload jsonb, about_listing_id bigint DEFAULT NULL::bigint) RETURNS bigint
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  INSERT INTO public.notification (account_id, kind, event_key, payload, listing_id)
  SELECT for_account_id, of_kind, for_event_key, with_payload, about_listing_id
  WHERE NOT EXISTS (
    SELECT FROM public.notification_mute m WHERE m.account_id = for_account_id AND m.kind = of_kind)
  ON CONFLICT ON CONSTRAINT notification_once_per_event_unique DO NOTHING
  RETURNING id
$$;


--
-- Name: FUNCTION create_notification(for_account_id bigint, of_kind text, for_event_key text, with_payload jsonb, about_listing_id bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_notification(for_account_id bigint, of_kind text, for_event_key text, with_payload jsonb, about_listing_id bigint) IS 'The only way a notification is written (ADR-0026 point 2): returns the new id, or NULL when the account muted the kind or was already told of this event. Call it in the transaction that records the event, so both commit or neither does. A missing account, kind or listing, a malformed event key and a payload that is not a small object are refused by the table''s constraints.';


--
-- Name: fa_normalize(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fa_normalize(value text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    RETURN btrim(regexp_replace(lower(translate(value, (((((((((((((((((((((((((chr(1610) || chr(1609)) || chr(1603)) || chr(1728)) || chr(8204)) || chr(1776)) || chr(1777)) || chr(1778)) || chr(1779)) || chr(1780)) || chr(1781)) || chr(1782)) || chr(1783)) || chr(1784)) || chr(1785)) || chr(1632)) || chr(1633)) || chr(1634)) || chr(1635)) || chr(1636)) || chr(1637)) || chr(1638)) || chr(1639)) || chr(1640)) || chr(1641)) || chr(1600)), ((((((chr(1740) || chr(1740)) || chr(1705)) || chr(1607)) || ' '::text) || '0123456789'::text) || '0123456789'::text))), '\s+'::text, ' '::text, 'g'::text));


--
-- Name: FUNCTION fa_normalize(value text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.fa_normalize(value text) IS 'A name as matching compares it (CS-50): Arabic yeh, alef maksura and kaf to Persian yeh and kaf, heh with yeh to heh, tatweel removed, the zero-width non-joiner as a space, Persian and Arabic digits to Latin, lower case, single spaces, trimmed.';


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
  -- crawl_run before source, the order openCrawlRun takes them in.
  PERFORM 1 FROM public.crawl_run WHERE id = NEW.crawl_run_id FOR NO KEY UPDATE;
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
-- Name: colour; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colour (
    code text NOT NULL,
    label_fa text NOT NULL,
    family text NOT NULL,
    CONSTRAINT colour_code_format CHECK ((code ~ '^[a-z][a-z_]{1,39}$'::text)),
    CONSTRAINT colour_family_valid CHECK ((family = ANY (ARRAY['white'::text, 'black'::text, 'grey'::text, 'silver'::text, 'blue'::text, 'red'::text, 'green'::text, 'yellow'::text, 'orange'::text, 'brown'::text, 'beige'::text, 'gold'::text, 'purple'::text, 'pink'::text, 'other'::text])))
);


--
-- Name: TABLE colour; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.colour IS 'A car''s colour as a source names it (label_fa, Divar''s own word) with the family a filter groups it in (CS-50).';


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
    title text,
    source_model_key text,
    model_year_written text,
    model_year_sh smallint,
    model_year_ad smallint,
    mileage_km integer,
    fuel text,
    gearbox text,
    insurance_months_left smallint,
    price_type text,
    asking_price_toman bigint,
    down_payment_toman bigint,
    accepts_swap boolean,
    accepts_installments boolean,
    seller_type text,
    body_condition text,
    engine_condition text,
    gearbox_condition text,
    front_chassis_condition text,
    rear_chassis_condition text,
    parser_version smallint,
    expires_at timestamp with time zone,
    last_checked_at timestamp with time zone,
    make_id bigint,
    model_id bigint,
    trim_id bigint,
    catalogue_match text,
    colour text,
    city_id bigint,
    district_fa text,
    CONSTRAINT listing_asking_price_toman_range CHECK (((asking_price_toman >= 1) AND (asking_price_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_body_condition_valid CHECK ((body_condition = ANY (ARRAY['intact'::text, 'minor_scratches'::text, 'paintless_dent_repair'::text, 'partly_repainted'::text, 'repainted_around'::text, 'fully_repainted'::text, 'accident_damaged'::text, 'salvage'::text]))),
    CONSTRAINT listing_catalogue_match_consistent CHECK (
CASE catalogue_match
    WHEN 'trim'::text THEN ((make_id IS NOT NULL) AND (model_id IS NOT NULL) AND (trim_id IS NOT NULL))
    WHEN 'model'::text THEN ((make_id IS NOT NULL) AND (model_id IS NOT NULL) AND (trim_id IS NULL))
    ELSE ((make_id IS NULL) AND (model_id IS NULL) AND (trim_id IS NULL))
END),
    CONSTRAINT listing_catalogue_match_valid CHECK ((catalogue_match = ANY (ARRAY['trim'::text, 'model'::text, 'unmatched'::text]))),
    CONSTRAINT listing_district_fa_not_blank CHECK ((btrim(district_fa) <> ''::text)),
    CONSTRAINT listing_down_payment_toman_range CHECK (((down_payment_toman >= 1) AND (down_payment_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_engine_condition_valid CHECK ((engine_condition = ANY (ARRAY['sound'::text, 'needs_repair'::text, 'replaced'::text]))),
    CONSTRAINT listing_external_identity CHECK (((origin <> 'external'::text) OR ((source_listing_key IS NOT NULL) AND (url IS NOT NULL)))),
    CONSTRAINT listing_external_was_seen CHECK (((origin <> 'external'::text) OR (last_seen_at IS NOT NULL))),
    CONSTRAINT listing_front_chassis_condition_valid CHECK ((front_chassis_condition = ANY (ARRAY['intact'::text, 'repainted'::text, 'damaged'::text]))),
    CONSTRAINT listing_fuel_valid CHECK ((fuel = ANY (ARRAY['petrol'::text, 'dual_fuel_factory'::text, 'dual_fuel_aftermarket'::text, 'hybrid'::text, 'plug_in_hybrid'::text, 'electric'::text, 'diesel'::text]))),
    CONSTRAINT listing_gearbox_condition_valid CHECK ((gearbox_condition = ANY (ARRAY['sound'::text, 'needs_repair'::text, 'replaced'::text]))),
    CONSTRAINT listing_gearbox_valid CHECK ((gearbox = ANY (ARRAY['manual'::text, 'automatic'::text]))),
    CONSTRAINT listing_gone_not_seen_since CHECK (((status <> ALL (ARRAY['expired'::text, 'gone'::text])) OR (last_seen_at <= delisted_at))),
    CONSTRAINT listing_insurance_months_left_nonnegative CHECK ((insurance_months_left >= 0)),
    CONSTRAINT listing_market_dates_ordered CHECK (((delisted_at IS NULL) OR (delisted_at >= listed_at))),
    CONSTRAINT listing_mileage_km_range CHECK (((mileage_km >= 0) AND (mileage_km <= 9999999))),
    CONSTRAINT listing_model_year_ad_range CHECK (((model_year_ad >= 1921) AND (model_year_ad <= 2121))),
    CONSTRAINT listing_model_year_calendars_agree CHECK (
CASE model_year_written
    WHEN 'sh'::text THEN ((model_year_sh IS NOT NULL) AND (model_year_ad IS NULL))
    WHEN 'ad'::text THEN ((model_year_ad IS NOT NULL) AND (model_year_sh IS NOT NULL) AND (model_year_sh = (model_year_ad - 621)))
    WHEN 'both'::text THEN ((model_year_sh IS NOT NULL) AND (model_year_ad IS NOT NULL) AND ((model_year_ad - model_year_sh) = ANY (ARRAY[621, 622])))
    ELSE ((model_year_sh IS NULL) AND (model_year_ad IS NULL))
END),
    CONSTRAINT listing_model_year_sh_range CHECK (((model_year_sh >= 1300) AND (model_year_sh <= 1500))),
    CONSTRAINT listing_model_year_written_valid CHECK ((model_year_written = ANY (ARRAY['sh'::text, 'ad'::text, 'both'::text]))),
    CONSTRAINT listing_off_market_has_date CHECK (((status = ANY (ARRAY['sold'::text, 'expired'::text, 'gone'::text, 'removed'::text])) = (delisted_at IS NOT NULL))),
    CONSTRAINT listing_only_external_for_now CHECK ((origin = 'external'::text)),
    CONSTRAINT listing_origin_valid CHECK ((origin = ANY (ARRAY['external'::text, 'native'::text]))),
    CONSTRAINT listing_parser_version_positive CHECK ((parser_version >= 1)),
    CONSTRAINT listing_price_type_amounts CHECK (
CASE price_type
    WHEN 'asking'::text THEN ((asking_price_toman IS NOT NULL) AND (down_payment_toman IS NULL))
    WHEN 'installment'::text THEN ((down_payment_toman IS NOT NULL) AND (asking_price_toman IS NULL))
    ELSE ((asking_price_toman IS NULL) AND (down_payment_toman IS NULL))
END),
    CONSTRAINT listing_price_type_valid CHECK ((price_type = ANY (ARRAY['asking'::text, 'negotiable'::text, 'installment'::text, 'placeholder'::text]))),
    CONSTRAINT listing_rear_chassis_condition_valid CHECK ((rear_chassis_condition = ANY (ARRAY['intact'::text, 'repainted'::text, 'damaged'::text]))),
    CONSTRAINT listing_seller_type_valid CHECK ((seller_type = ANY (ARRAY['dealer'::text, 'private'::text]))),
    CONSTRAINT listing_source_listing_key_format CHECK ((source_listing_key ~ '^\S{1,200}$'::text)),
    CONSTRAINT listing_source_model_key_not_blank CHECK ((btrim(source_model_key) <> ''::text)),
    CONSTRAINT listing_status_valid CHECK ((status = ANY (ARRAY['active'::text, 'sold'::text, 'expired'::text, 'gone'::text, 'removed'::text]))),
    CONSTRAINT listing_title_not_blank CHECK ((btrim(title) <> ''::text)),
    CONSTRAINT listing_url_http CHECK ((url ~ '^https?://'::text))
)
WITH (fillfactor='90', autovacuum_vacuum_scale_factor='0.02', autovacuum_analyze_scale_factor='0.02');


--
-- Name: TABLE listing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.listing IS 'The offer: one listing on one source. Its id is permanent (URLs, alerts, evaluation sets point at it); what it says about the car is derived from its snapshots and rebuildable.';


--
-- Name: COLUMN listing.origin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.origin IS 'external: crawled or read through an official API; native: created on Carshenas (later).';


--
-- Name: COLUMN listing.source_listing_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.source_listing_key IS 'The source''s own id or token for the listing; with source_id it is the natural key the crawler upserts on.';


--
-- Name: COLUMN listing.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.url IS 'Where the listing lives on its source; the click-out target.';


--
-- Name: COLUMN listing.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.status IS 'active: on the market; sold, expired, gone (disappeared from the source): off the market; removed: taken down by Carshenas. Changes follow listing_status_transition.';


--
-- Name: COLUMN listing.listed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.listed_at IS 'When the listing went on the market: the source''s posting time when the page shows it, else our first sighting. Native drafts, later, have none: the native-listings migration relaxes NOT NULL for them.';


--
-- Name: COLUMN listing.delisted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.delisted_at IS 'When the listing left the market; set exactly when the status is off the market.';


--
-- Name: COLUMN listing.last_seen_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.last_seen_at IS 'The latest fetch that showed the listing, to within a day: the crawler refreshes it when it is more than a day old (fetch_log keeps every visit). Deliberately not indexed, so those updates stay HOT.';


--
-- Name: COLUMN listing.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.title IS 'The listing''s title as its source shows it, with phone numbers removed as in its snapshot.';


--
-- Name: COLUMN listing.source_model_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.source_model_key IS 'The source''s own make, model and trim value (Divar''s brand_model, such as «Peugeot 206 5»), as model_volume keys it; the catalogue (CS-50) maps it to a trim.';


--
-- Name: COLUMN listing.model_year_written; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.model_year_written IS 'The calendars the listing stated its model year in: sh (Solar Hijri only), ad (Gregorian only) or both (ADR-0014); null when it stated no single year.';


--
-- Name: COLUMN listing.model_year_sh; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.model_year_sh IS 'The Solar Hijri model year, set whenever a year is known: as stated, or model_year_ad - 621 when only a Gregorian year was stated. Search, comparables and valuation read this column.';


--
-- Name: COLUMN listing.model_year_ad; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.model_year_ad IS 'The Gregorian model year, only when the listing stated it.';


--
-- Name: COLUMN listing.mileage_km; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.mileage_km IS 'Kilometres driven, as stated, from 0 (a new car) to 9,999,999. Null when the listing stated none, stated Divar''s 1,000,000, which stands for unknown, or stated more than any car drives (kept as unparsed).';


--
-- Name: COLUMN listing.fuel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.fuel IS 'petrol, dual_fuel_factory (petrol and CNG, fitted by the maker), dual_fuel_aftermarket (CNG fitted later), hybrid, plug_in_hybrid, electric or diesel.';


--
-- Name: COLUMN listing.gearbox; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.gearbox IS 'manual or automatic.';


--
-- Name: COLUMN listing.insurance_months_left; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.insurance_months_left IS 'Months of third-party insurance left, as the listing stated them.';


--
-- Name: COLUMN listing.price_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.price_type IS 'What the listing asks (ADR-0014): asking (an amount), negotiable («توافقی»), installment (its figure is a down payment, read from the text by CS-52), placeholder (a token figure such as 1,000 tomans, kept only in the snapshot); null until read.';


--
-- Name: COLUMN listing.asking_price_toman; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.asking_price_toman IS 'The asking price in whole tomans, exactly when price_type is asking.';


--
-- Name: COLUMN listing.down_payment_toman; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.down_payment_toman IS 'The down payment an installment listing shows as its price, in whole tomans, exactly when price_type is installment.';


--
-- Name: COLUMN listing.accepts_swap; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.accepts_swap IS 'True when the listing says the seller takes a car in exchange («مایل به معاوضه»); null when it says nothing.';


--
-- Name: COLUMN listing.accepts_installments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.accepts_installments IS 'True when the listing says the car can be bought in installments («امکان خرید قسطی»); null when it says nothing. Its price may still be the full price.';


--
-- Name: COLUMN listing.seller_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.seller_type IS 'dealer («نمایشگاه») or private, as the source marks the seller.';


--
-- Name: COLUMN listing.body_condition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.body_condition IS 'The seller''s own rating of the body, a claim rather than an inspection: intact, minor_scratches, paintless_dent_repair, partly_repainted, repainted_around («دوررنگ»), fully_repainted, accident_damaged or salvage.';


--
-- Name: COLUMN listing.engine_condition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.engine_condition IS 'The seller''s own rating of the engine: sound, needs_repair or replaced.';


--
-- Name: COLUMN listing.gearbox_condition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.gearbox_condition IS 'The seller''s own rating of the gearbox: sound, needs_repair or replaced.';


--
-- Name: COLUMN listing.front_chassis_condition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.front_chassis_condition IS 'The seller''s own rating of the front chassis: intact (sound and sealed), repainted or damaged.';


--
-- Name: COLUMN listing.rear_chassis_condition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.rear_chassis_condition IS 'The seller''s own rating of the rear chassis: intact (sound and sealed), repainted or damaged.';


--
-- Name: COLUMN listing.parser_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.parser_version IS 'The version of its source''s parser that last derived the columns above from the listing''s latest snapshot (CS-34); null until derived.';


--
-- Name: COLUMN listing.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.expires_at IS 'The source''s own end date for this listing (Divar: seo.unavailable_after, Tehran time), read from its page; past it the listing is marked expired without a request (ADR-0017 point 3). NULL when the source gives none or the page was never read.';


--
-- Name: COLUMN listing.last_checked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.last_checked_at IS 'When the listing''s own page was last read (a detail, check or recheck run), as against last_seen_at, its latest sighting in a list. A buyer''s re-check is skipped while this is younger than the freshness window (six hours, ADR-0017 point 3).';


--
-- Name: COLUMN listing.catalogue_match; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.catalogue_match IS 'What the catalogue knows of the car (CS-50): trim (make, model and trim), model (the source named the model only: trim unknown) or unmatched (its source_model_key is not in the catalogue). NULL until matched. Never a guess.';


--
-- Name: COLUMN listing.colour; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.colour IS 'The colour the post states, as a colour code (CS-50); an unknown word is kept in listing_unparsed_value.';


--
-- Name: COLUMN listing.city_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.city_id IS 'The city the post is in (Divar: city.second_slug).';


--
-- Name: COLUMN listing.district_fa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing.district_fa IS 'The district the post names, as written (Divar: seo.web_info.district_persian).';


--
-- Name: valuation_coefficient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.valuation_coefficient (
    id bigint NOT NULL,
    valuation_run_id bigint NOT NULL,
    term text NOT NULL,
    model_id bigint,
    trim_id bigint,
    coefficient double precision NOT NULL,
    CONSTRAINT valuation_coefficient_finite CHECK (((coefficient >= ('-1000'::integer)::double precision) AND (coefficient <= (1000)::double precision))),
    CONSTRAINT valuation_coefficient_scope_matches_term CHECK (
CASE term
    WHEN 'model_level'::text THEN ((model_id IS NOT NULL) AND (trim_id IS NULL))
    WHEN 'model_age_slope'::text THEN ((model_id IS NOT NULL) AND (trim_id IS NULL))
    WHEN 'trim_level'::text THEN ((model_id IS NOT NULL) AND (trim_id IS NOT NULL))
    ELSE ((model_id IS NULL) AND (trim_id IS NULL))
END),
    CONSTRAINT valuation_coefficient_term_valid CHECK ((term = ANY (ARRAY['model_level'::text, 'model_age_slope'::text, 'trim_level'::text, 'age_slope'::text, 'mileage_deviation'::text, 'zero_km'::text, 'body_minor'::text, 'body_painted'::text, 'body_painted_around'::text, 'chassis_repainted'::text, 'gearbox_automatic'::text, 'dual_fuel_aftermarket'::text, 'electrified'::text, 'off_colour'::text, 'day'::text])))
);


--
-- Name: TABLE valuation_coefficient; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.valuation_coefficient IS 'Every coefficient a run fitted (CS-51, S01), on ln(price in tomans): what valuation_rate_listing() values a listing from.';


--
-- Name: COLUMN valuation_coefficient.coefficient; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.valuation_coefficient.coefficient IS 'On the log scale: a shared term adds it once per unit of its feature; model_age_slope is the model''s whole slope per year of age.';


--
-- Name: valuation_comparable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.valuation_comparable (
    valuation_run_id bigint NOT NULL,
    listing_id bigint NOT NULL,
    model_id bigint NOT NULL,
    model_year_sh smallint NOT NULL,
    mileage_km integer NOT NULL,
    asking_price_toman bigint NOT NULL,
    fitted_value_toman bigint NOT NULL,
    is_outlier boolean NOT NULL,
    CONSTRAINT valuation_comparable_asking_price_toman_range CHECK (((asking_price_toman >= 1) AND (asking_price_toman <= '999999999999999'::bigint))),
    CONSTRAINT valuation_comparable_fitted_value_toman_range CHECK (((fitted_value_toman >= 1) AND (fitted_value_toman <= '999999999999999'::bigint))),
    CONSTRAINT valuation_comparable_mileage_km_range CHECK (((mileage_km >= 0) AND (mileage_km <= 9999999)))
);


--
-- Name: TABLE valuation_comparable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.valuation_comparable IS 'A listing a run learned from (CS-51, S01 "Comparables"), with the attributes and asking price it entered with and the value the fit gave it; an outlier was dropped from the second fit and is not rated.';


--
-- Name: valuation_run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.valuation_run (
    id bigint NOT NULL,
    as_of_date date NOT NULL,
    method_version smallint NOT NULL,
    status text NOT NULL,
    reference_year_sh smallint NOT NULL,
    mileage_norm_km_per_year integer NOT NULL,
    window_days smallint NOT NULL,
    prior_strength double precision NOT NULL,
    comparable_count integer,
    valued_count integer,
    rated_count integer,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT valuation_run_counts_nonnegative CHECK (((comparable_count >= 0) AND (valued_count >= 0) AND (rated_count >= 0))),
    CONSTRAINT valuation_run_counts_when_succeeded CHECK (((status <> 'succeeded'::text) OR ((comparable_count IS NOT NULL) AND (valued_count IS NOT NULL) AND (rated_count IS NOT NULL)))),
    CONSTRAINT valuation_run_finished_when_done CHECK (((status = 'running'::text) = (finished_at IS NULL))),
    CONSTRAINT valuation_run_method_version_positive CHECK ((method_version >= 1)),
    CONSTRAINT valuation_run_mileage_norm_positive CHECK ((mileage_norm_km_per_year > 0)),
    CONSTRAINT valuation_run_prior_strength_nonnegative CHECK ((prior_strength >= (0)::double precision)),
    CONSTRAINT valuation_run_reference_year_sh_range CHECK (((reference_year_sh >= 1300) AND (reference_year_sh <= 1500))),
    CONSTRAINT valuation_run_status_valid CHECK ((status = ANY (ARRAY['running'::text, 'succeeded'::text, 'failed'::text]))),
    CONSTRAINT valuation_run_window_days_positive CHECK ((window_days > 0))
);


--
-- Name: TABLE valuation_run; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.valuation_run IS 'One daily valuation (CS-51, S01): the Tehran day it values the market on, the method version, and the constants the fit and valuation_rate_listing() used. Pages read the latest succeeded run.';


--
-- Name: COLUMN valuation_run.as_of_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.valuation_run.as_of_date IS 'The Tehran day the market values hold for.';


--
-- Name: COLUMN valuation_run.reference_year_sh; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.valuation_run.reference_year_sh IS 'The Jalali year of as_of_date: a car''s age is this minus its model_year_sh, floored at 0.';


--
-- Name: COLUMN valuation_run.mileage_norm_km_per_year; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.valuation_run.mileage_norm_km_per_year IS 'Kilometres a year the market treats as normal (20,000 in method 1): mileage is measured against it.';


--
-- Name: COLUMN valuation_run.window_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.valuation_run.window_days IS 'How many days before as_of_date a listing may have last been seen and still be a comparable.';


--
-- Name: COLUMN valuation_run.prior_strength; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.valuation_run.prior_strength IS 'How many listings each coefficient''s prior weighs in the ridge fit.';


--
-- Name: valuation_segment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.valuation_segment (
    valuation_run_id bigint NOT NULL,
    model_id bigint NOT NULL,
    comparable_count integer NOT NULL,
    zero_km_count integer NOT NULL,
    min_model_year_sh smallint NOT NULL,
    max_model_year_sh smallint NOT NULL,
    error_pct numeric(6,2),
    rates_listings boolean NOT NULL,
    CONSTRAINT valuation_segment_comparable_count_positive CHECK ((comparable_count > 0)),
    CONSTRAINT valuation_segment_error_pct_nonnegative CHECK ((error_pct >= (0)::numeric)),
    CONSTRAINT valuation_segment_rates_with_error CHECK (((NOT rates_listings) OR (error_pct IS NOT NULL))),
    CONSTRAINT valuation_segment_years_ordered CHECK ((min_model_year_sh <= max_model_year_sh)),
    CONSTRAINT valuation_segment_zero_km_count_range CHECK (((zero_km_count >= 0) AND (zero_km_count <= comparable_count)))
);


--
-- Name: TABLE valuation_segment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.valuation_segment IS 'A catalogue model in a run (CS-51, S01): its comparables, the model years they span, its leave-one-out median absolute percentage error, and whether it rates listings (enough comparables, error within bounds).';


--
-- Name: COLUMN valuation_segment.zero_km_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.valuation_segment.zero_km_count IS 'How many of its comparables (outliers left out) are zero-km, under 1,000 km.';


--
-- Name: COLUMN valuation_segment.error_pct; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.valuation_segment.error_pct IS 'Median absolute percentage error of the model''s comparables, each valued by the fit without itself (leave-one-out); null when too few to measure.';


--
-- Name: valuation_rate_listing(bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valuation_rate_listing(run_id bigint, rated_listing_id bigint) RETURNS TABLE(asking_price_toman bigint, market_value_toman bigint, price_gap_pct numeric, deal_rating public.deal_rating, no_rating_reason text)
    LANGUAGE sql STABLE PARALLEL SAFE
    BEGIN ATOMIC
 WITH l AS (
          SELECT li.id,
             li.origin,
             li.source_id,
             li.source_listing_key,
             li.url,
             li.status,
             li.listed_at,
             li.delisted_at,
             li.last_seen_at,
             li.created_at,
             li.title,
             li.source_model_key,
             li.model_year_written,
             li.model_year_sh,
             li.model_year_ad,
             li.mileage_km,
             li.fuel,
             li.gearbox,
             li.insurance_months_left,
             li.price_type,
             li.asking_price_toman,
             li.down_payment_toman,
             li.accepts_swap,
             li.accepts_installments,
             li.seller_type,
             li.body_condition,
             li.engine_condition,
             li.gearbox_condition,
             li.front_chassis_condition,
             li.rear_chassis_condition,
             li.parser_version,
             li.expires_at,
             li.last_checked_at,
             li.make_id,
             li.model_id,
             li.trim_id,
             li.catalogue_match,
             li.colour,
             li.city_id,
             li.district_fa,
             r.reference_year_sh,
             r.mileage_norm_km_per_year,
             GREATEST(((r.reference_year_sh - li.model_year_sh))::integer, 0) AS age,
             COALESCE(co.family, 'white'::text) AS colour_family,
                 CASE
                     WHEN (li.model_id IS NULL) THEN 'unmatched_model'::text
                     WHEN (li.price_type IS NULL) THEN 'unknown_price'::text
                     WHEN ((li.model_year_sh IS NULL) OR (li.mileage_km IS NULL) OR (li.gearbox IS NULL)) THEN 'missing_attributes'::text
                     WHEN ((li.body_condition = ANY (ARRAY['fully_repainted'::text, 'accident_damaged'::text, 'salvage'::text])) OR (li.engine_condition = ANY (ARRAY['replaced'::text, 'needs_repair'::text])) OR (li.gearbox_condition = ANY (ARRAY['replaced'::text, 'needs_repair'::text])) OR (('damaged'::text = li.front_chassis_condition) OR ('damaged'::text = li.rear_chassis_condition))) THEN 'excluded_condition'::text
                     ELSE NULL::text
                 END AS unvalued_reason
            FROM ((public.listing li
              JOIN public.valuation_run r ON ((r.id = valuation_rate_listing.run_id)))
              LEFT JOIN public.colour co ON ((co.code = li.colour)))
           WHERE (li.id = valuation_rate_listing.rated_listing_id)
         ), c AS (
          SELECT l.id,
             l.unvalued_reason,
                 CASE
                     WHEN (l.unvalued_reason IS NULL) THEN ( SELECT seg.rates_listings
                        FROM public.valuation_segment seg
                       WHERE ((seg.valuation_run_id = valuation_rate_listing.run_id) AND (seg.model_id = l.model_id)))
                     ELSE NULL::boolean
                 END AS rates_listings,
                 CASE
                     WHEN (l.unvalued_reason IS NULL) THEN ( SELECT seg.comparable_count
                        FROM public.valuation_segment seg
                       WHERE ((seg.valuation_run_id = valuation_rate_listing.run_id) AND (seg.model_id = l.model_id)))
                     ELSE NULL::integer
                 END AS segment_count,
                 CASE
                     WHEN (l.unvalued_reason IS NULL) THEN ( SELECT count(*) AS count
                        FROM public.valuation_comparable vc
                       WHERE ((vc.valuation_run_id = valuation_rate_listing.run_id) AND (vc.model_id = l.model_id) AND (NOT vc.is_outlier) AND ((vc.model_year_sh >= (l.model_year_sh - 2)) AND (vc.model_year_sh <= (l.model_year_sh + 2)))))
                     ELSE NULL::bigint
                 END AS near_year_count,
                 CASE
                     WHEN (l.unvalued_reason IS NULL) THEN ( SELECT
                             CASE
                                 WHEN (l.mileage_km < 1000) THEN seg.zero_km_count
                                 ELSE (seg.comparable_count - seg.zero_km_count)
                             END AS "case"
                        FROM public.valuation_segment seg
                       WHERE ((seg.valuation_run_id = valuation_rate_listing.run_id) AND (seg.model_id = l.model_id)))
                     ELSE NULL::integer
                 END AS same_zero_km_count,
                 CASE
                     WHEN (l.unvalued_reason IS NULL) THEN ( SELECT vc.is_outlier
                        FROM public.valuation_comparable vc
                       WHERE ((vc.valuation_run_id = valuation_rate_listing.run_id) AND (vc.listing_id = l.id)))
                     ELSE NULL::boolean
                 END AS is_outlier,
                 CASE
                     WHEN (l.unvalued_reason IS NULL) THEN ((( SELECT sum(k.coefficient) AS sum
                        FROM public.valuation_coefficient k
                       WHERE ((k.valuation_run_id = valuation_rate_listing.run_id) AND (k.model_id = l.model_id) AND ((k.term = 'model_level'::text) OR ((k.term = 'trim_level'::text) AND (k.trim_id = l.trim_id))))) + ((l.age)::double precision * ( SELECT k.coefficient
                        FROM public.valuation_coefficient k
                       WHERE ((k.valuation_run_id = valuation_rate_listing.run_id) AND (k.term = 'model_age_slope'::text) AND (k.model_id = l.model_id))))) + COALESCE(( SELECT sum((k.coefficient * (
                             CASE k.term
                                 WHEN 'mileage_deviation'::text THEN (((l.mileage_km)::numeric - ((l.mileage_norm_km_per_year)::numeric * GREATEST((l.age)::numeric, 0.5))) / 100000.0)
                                 WHEN 'zero_km'::text THEN (((l.mileage_km < 1000))::integer)::numeric
                                 WHEN 'body_minor'::text THEN (((l.body_condition = 'minor_scratches'::text))::integer)::numeric
                                 WHEN 'body_painted'::text THEN (((l.body_condition = 'partly_repainted'::text))::integer)::numeric
                                 WHEN 'body_painted_around'::text THEN (((l.body_condition = 'repainted_around'::text))::integer)::numeric
                                 WHEN 'chassis_repainted'::text THEN ((('repainted'::text = ANY (ARRAY[l.front_chassis_condition, l.rear_chassis_condition])))::integer)::numeric
                                 WHEN 'gearbox_automatic'::text THEN (((l.gearbox = 'automatic'::text))::integer)::numeric
                                 WHEN 'dual_fuel_aftermarket'::text THEN (((l.fuel = 'dual_fuel_aftermarket'::text))::integer)::numeric
                                 WHEN 'electrified'::text THEN (((l.fuel = ANY (ARRAY['hybrid'::text, 'plug_in_hybrid'::text, 'electric'::text])))::integer)::numeric
                                 WHEN 'off_colour'::text THEN (((l.colour_family <> ALL (ARRAY['white'::text, 'black'::text, 'silver'::text, 'grey'::text])))::integer)::numeric
                                 ELSE (0)::numeric
                             END)::double precision)) AS sum
                        FROM public.valuation_coefficient k
                       WHERE ((k.valuation_run_id = valuation_rate_listing.run_id) AND (k.model_id IS NULL))), (0)::double precision))
                     ELSE NULL::double precision
                 END AS ln_value
            FROM l
         ), v AS (
          SELECT l.price_type,
             l.asking_price_toman,
             l.seller_type,
             l.mileage_km,
                 CASE
                     WHEN (c.unvalued_reason IS NOT NULL) THEN c.unvalued_reason
                     WHEN ((c.ln_value IS NULL) OR (c.segment_count IS NULL) OR (c.segment_count < 8)) THEN 'too_few_comparables'::text
                     WHEN (NOT c.rates_listings) THEN 'uncertain_segment'::text
                     WHEN ((c.near_year_count < 3) OR (c.same_zero_km_count < 1)) THEN 'year_out_of_range'::text
                     ELSE NULL::text
                 END AS unrated_reason,
             (round(exp(c.ln_value)))::bigint AS value_toman,
             c.is_outlier
            FROM (l
              JOIN c ON ((c.id = l.id)))
         ), p AS (
          SELECT v.price_type,
             v.asking_price_toman,
             v.seller_type,
             v.mileage_km,
             v.unrated_reason,
             v.value_toman,
             v.is_outlier,
                 CASE
                     WHEN (v.unrated_reason IS NOT NULL) THEN v.unrated_reason
                     WHEN (v.price_type = 'negotiable'::text) THEN 'no_asking_price'::text
                     WHEN (v.price_type = 'placeholder'::text) THEN 'placeholder_price'::text
                     WHEN (v.price_type = 'installment'::text) THEN 'installment_price'::text
                     WHEN ((v.seller_type = 'dealer'::text) AND (v.mileage_km < 1000)) THEN 'dealer_new_car'::text
                     WHEN (v.is_outlier OR (((v.asking_price_toman)::numeric < ((v.value_toman)::numeric / 3.0)) OR ((v.asking_price_toman)::numeric > ((v.value_toman)::numeric * 3.0)))) THEN 'price_outlier'::text
                     ELSE NULL::text
                 END AS reason
            FROM v
         ), g AS (
          SELECT p.price_type,
             p.asking_price_toman,
             p.seller_type,
             p.mileage_km,
             p.unrated_reason,
             p.value_toman,
             p.is_outlier,
             p.reason,
                 CASE
                     WHEN (p.reason IS NULL) THEN round(((((p.asking_price_toman - p.value_toman))::numeric * (100)::numeric) / (p.value_toman)::numeric), 2)
                     ELSE NULL::numeric
                 END AS gap
            FROM p
         )
  SELECT g.asking_price_toman,
         CASE
             WHEN (g.unrated_reason IS NULL) THEN g.value_toman
             ELSE NULL::bigint
         END AS "case",
     (g.gap)::numeric(7,2) AS gap,
         CASE
             WHEN (g.gap IS NULL) THEN NULL::public.deal_rating
             WHEN (g.gap <= ('-10'::integer)::numeric) THEN 'great'::public.deal_rating
             WHEN (g.gap <= ('-4'::integer)::numeric) THEN 'good'::public.deal_rating
             WHEN (g.gap < (4)::numeric) THEN 'fair'::public.deal_rating
             WHEN (g.gap < (10)::numeric) THEN 'high'::public.deal_rating
             ELSE 'overpriced'::public.deal_rating
         END AS "case",
     g.reason
    FROM g;
END;


--
-- Name: FUNCTION valuation_rate_listing(run_id bigint, rated_listing_id bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.valuation_rate_listing(run_id bigint, rated_listing_id bigint) IS 'A listing''s asking price, market value, price gap and deal rating (or the reason for none) from a run''s stored coefficients and segments (CS-51, S01); one row, or none when the listing or run does not exist.';


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
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id bigint NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'buyer'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_password_hash_argon2id CHECK (starts_with(password_hash, '$argon2id$v=19$'::text)),
    CONSTRAINT account_role_valid CHECK ((role = ANY (ARRAY['buyer'::text, 'superadmin'::text]))),
    CONSTRAINT account_username_format CHECK ((username ~ '^[a-z][a-z0-9_]{2,29}$'::text))
);


--
-- Name: TABLE account; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.account IS 'A person who signs in to Carshenas with a username and a password (ADR-0020): a buyer, or the superadmin.';


--
-- Name: COLUMN account.username; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.account.username IS 'Lowercase Latin letters, digits and underscore, 3 to 30 characters, starting with a letter; normalised before it is stored (capitals lowered, Persian digits made Latin). Never logged: people type passwords into it by mistake.';


--
-- Name: COLUMN account.password_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.account.password_hash IS 'Argon2id as a PHC string (ADR-0020 point 4). Never the password itself; the read-only role cannot read it.';


--
-- Name: COLUMN account.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.account.role IS 'buyer by default; superadmin only through pnpm account:superadmin, recorded in account_role_change. The web role reads it and can never write it.';


--
-- Name: account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.account ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.account_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: account_role_change; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_role_change (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    from_role text,
    to_role text NOT NULL,
    changed_by text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_role_change_changed_by_not_blank CHECK ((btrim(changed_by) <> ''::text)),
    CONSTRAINT account_role_change_from_role_valid CHECK ((from_role = ANY (ARRAY['buyer'::text, 'superadmin'::text]))),
    CONSTRAINT account_role_change_is_change CHECK ((from_role IS DISTINCT FROM to_role)),
    CONSTRAINT account_role_change_to_role_valid CHECK ((to_role = ANY (ARRAY['buyer'::text, 'superadmin'::text])))
);


--
-- Name: TABLE account_role_change; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.account_role_change IS 'Append-only record of every role an account was given, written by pnpm account:superadmin in the same transaction as the change (ADR-0020 point 9).';


--
-- Name: COLUMN account_role_change.from_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.account_role_change.from_role IS 'NULL when the account was created with to_role.';


--
-- Name: COLUMN account_role_change.changed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.account_role_change.changed_by IS 'Who ran the command: the operating-system user and host, for example cli:pedram@carshenas-1.';


--
-- Name: account_role_change_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.account_role_change ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.account_role_change_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: account_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_session (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    token_sha256 bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT account_session_lifetime_bounded CHECK (((expires_at > created_at) AND (expires_at <= (created_at + '720:00:00'::interval)))),
    CONSTRAINT account_session_token_sha256_length CHECK ((octet_length(token_sha256) = 32))
);


--
-- Name: TABLE account_session; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.account_session IS 'A signed-in browser (ADR-0020 point 5). The cookie holds a random 32-byte token; only its SHA-256 is kept here, so a copy of this table signs nobody in.';


--
-- Name: COLUMN account_session.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.account_session.expires_at IS 'Fixed at sign-in: 30 days for a buyer, 12 hours for the superadmin. Never extended; sign-out deletes the row.';


--
-- Name: account_session_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.account_session ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.account_session_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ai_answer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_answer (
    id bigint NOT NULL,
    cost_usd_micros bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cache_key bytea NOT NULL,
    task text NOT NULL,
    prompt_version text NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    answering_model text NOT NULL,
    output jsonb NOT NULL,
    CONSTRAINT ai_answer_answering_model_format CHECK ((answering_model ~ '^\S{1,200}$'::text)),
    CONSTRAINT ai_answer_cache_key_is_sha256 CHECK ((octet_length(cache_key) = 32)),
    CONSTRAINT ai_answer_cost_usd_micros_range CHECK (((cost_usd_micros >= 0) AND (cost_usd_micros <= '999999999999999'::bigint))),
    CONSTRAINT ai_answer_model_format CHECK ((model ~ '^\S{1,200}$'::text)),
    CONSTRAINT ai_answer_output_is_object CHECK ((jsonb_typeof(output) = 'object'::text)),
    CONSTRAINT ai_answer_prompt_version_format CHECK ((prompt_version ~ '^[0-9a-f]{16}$'::text)),
    CONSTRAINT ai_answer_provider_valid CHECK ((provider = ANY (ARRAY['openai'::text, 'anthropic'::text, 'google'::text, 'deepseek'::text]))),
    CONSTRAINT ai_answer_task_format CHECK (((task ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$'::text) AND (char_length(task) <= 100)))
);


--
-- Name: TABLE ai_answer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_answer IS 'One validated answer of a language model, for one AI task, prompt version, model and rendered input (CS-45, ADR-0021). packages/ai answers a repeated call from here without a request, and a rebuild reuses it instead of asking again. Append-only outside a purge; kept across prompt versions until a retention rule is needed.';


--
-- Name: COLUMN ai_answer.cost_usd_micros; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_answer.cost_usd_micros IS 'What producing the answer cost at the live Metis list price, every attempt included, in millionths of a US dollar; NULL when the model had no price.';


--
-- Name: COLUMN ai_answer.cache_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_answer.cache_key IS 'SHA-256 of the task, the prompt version, the requested model with its options and the rendered input (cacheKey in packages/ai/src/answer-cache.ts). The input itself is never stored.';


--
-- Name: COLUMN ai_answer.task; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_answer.task IS 'The registry name of the AI task: <area>.<what>, such as listing.facts.';


--
-- Name: COLUMN ai_answer.prompt_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_answer.prompt_version IS 'The first 16 hex digits of the SHA-256 of the instructions, the output schema, the version of the task checks and the output budget.';


--
-- Name: COLUMN ai_answer.provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_answer.provider IS 'The Metis native route the model was asked on (ADR-0019 point 2).';


--
-- Name: COLUMN ai_answer.model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_answer.model IS 'The model id the layer asked for, as the route takes it (claude-haiku-4-5).';


--
-- Name: COLUMN ai_answer.answering_model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_answer.answering_model IS 'The model id the provider reported: Metis may route a requested id to another model (CS-42).';


--
-- Name: COLUMN ai_answer.output; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_answer.output IS 'The answer as the task schema and checks accepted it. Built from text that was redacted before it was sent (ADR-0019), so it holds no seller contact details.';


--
-- Name: ai_answer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ai_answer ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ai_answer_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_throttle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_throttle (
    id bigint NOT NULL,
    scope text NOT NULL,
    subject_hmac bytea NOT NULL,
    hits integer DEFAULT 0 NOT NULL,
    window_started_at timestamp with time zone DEFAULT now() NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auth_throttle_hits_nonnegative CHECK ((hits >= 0)),
    CONSTRAINT auth_throttle_scope_valid CHECK ((scope = ANY (ARRAY['sign_in_account'::text, 'sign_in_device'::text, 'sign_in_address'::text, 'sign_up_address'::text, 'username_check_address'::text]))),
    CONSTRAINT auth_throttle_subject_hmac_length CHECK ((octet_length(subject_hmac) = 32))
);


--
-- Name: TABLE auth_throttle; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.auth_throttle IS 'Counters that slow down password guessing and username enumeration (ADR-0020 point 8), one row per scope and subject. Holds no username or address: the subject is a keyed hash.';


--
-- Name: COLUMN auth_throttle.subject_hmac; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auth_throttle.subject_hmac IS 'HMAC-SHA-256, under CARSHENAS_AUTH_KEY, of the typed username (whether or not the account exists), a device token or the client address.';


--
-- Name: COLUMN auth_throttle.hits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auth_throttle.hits IS 'Consecutive failed sign-ins for sign_in_account and sign_in_device; failed sign-ins, sign-up attempts or username checks within the window for the address scopes.';


--
-- Name: COLUMN auth_throttle.window_started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auth_throttle.window_started_at IS 'When the counted streak or window began.';


--
-- Name: COLUMN auth_throttle.next_attempt_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auth_throttle.next_attempt_at IS 'For sign_in_account and sign_in_device, the earliest time the next attempt may start: a growing wait after repeated failures, or a 15-second lease while one attempt is being checked. The address scopes leave it at its default; their wait ends an hour after window_started_at.';


--
-- Name: auth_throttle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auth_throttle ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.auth_throttle_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: body_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.body_type (
    code text NOT NULL,
    label_fa text NOT NULL,
    "position" smallint NOT NULL,
    CONSTRAINT body_type_code_format CHECK ((code ~ '^[a-z][a-z_]{1,29}$'::text)),
    CONSTRAINT body_type_label_fa_not_blank CHECK ((btrim(label_fa) <> ''::text))
);


--
-- Name: TABLE body_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.body_type IS 'The fixed list of body types (CS-50 criterion 4), a filter and a catalogue (CS-58), in the order pages show them (position).';


--
-- Name: catalogue_alias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogue_alias (
    id bigint NOT NULL,
    make_id bigint,
    model_id bigint,
    trim_id bigint,
    alias text NOT NULL,
    alias_norm text GENERATED ALWAYS AS (public.fa_normalize(alias)) STORED,
    script text NOT NULL,
    status text NOT NULL,
    source_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catalogue_alias_not_blank CHECK (((btrim(alias) <> ''::text) AND (char_length(alias) <= 200))),
    CONSTRAINT catalogue_alias_one_target CHECK ((num_nonnulls(make_id, model_id, trim_id) = 1)),
    CONSTRAINT catalogue_alias_script_valid CHECK ((script = ANY (ARRAY['fa'::text, 'latin'::text, 'spelled'::text]))),
    CONSTRAINT catalogue_alias_status_valid CHECK ((status = ANY (ARRAY['curated'::text, 'suggested'::text, 'rejected'::text])))
);


--
-- Name: TABLE catalogue_alias; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.catalogue_alias IS 'Another way a make, model or trim is written (CS-50): «۲۰۶», "206", «دویست و شش», «تیپ دو». curated by a person, suggested by what a source wrote, rejected when a person refused it. An alias need not be unique across targets: matching resolves by context, make before model before trim.';


--
-- Name: COLUMN catalogue_alias.alias_norm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.catalogue_alias.alias_norm IS 'fa_normalize(alias): what matching compares.';


--
-- Name: catalogue_alias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.catalogue_alias ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.catalogue_alias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: catalogue_source_key; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogue_source_key (
    source_id text NOT NULL,
    source_model_key text NOT NULL,
    level text NOT NULL,
    make_id bigint NOT NULL,
    model_id bigint,
    trim_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catalogue_source_key_level_matches CHECK (
CASE level
    WHEN 'make'::text THEN ((model_id IS NULL) AND (trim_id IS NULL))
    WHEN 'model'::text THEN ((model_id IS NOT NULL) AND (trim_id IS NULL))
    ELSE ((model_id IS NOT NULL) AND (trim_id IS NOT NULL))
END),
    CONSTRAINT catalogue_source_key_level_valid CHECK ((level = ANY (ARRAY['make'::text, 'model'::text, 'trim'::text]))),
    CONSTRAINT catalogue_source_key_not_blank CHECK ((btrim(source_model_key) <> ''::text))
);


--
-- Name: TABLE catalogue_source_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.catalogue_source_key IS 'A source''s own model key (Divar: brand_model, such as "Peugeot 206 5") and the make, model or trim it names (CS-50): how a listing is matched, by its source_model_key.';


--
-- Name: city; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.city (
    id bigint NOT NULL,
    slug text NOT NULL,
    name_fa text NOT NULL,
    CONSTRAINT city_name_fa_not_blank CHECK ((btrim(name_fa) <> ''::text)),
    CONSTRAINT city_slug_format CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (char_length(slug) <= 60)))
);


--
-- Name: TABLE city; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.city IS 'A city a listing is in (CS-50), keyed by Divar''s own slug (city.second_slug: tehran); added by the parser''s derivation as posts name them.';


--
-- Name: city_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.city ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.city_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
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
    budget_day date,
    budget_spent integer DEFAULT 0 NOT NULL,
    CONSTRAINT crawl_lane_budget_day_counted CHECK (((budget_day IS NOT NULL) OR (budget_spent = 0))),
    CONSTRAINT crawl_lane_budget_spent_nonnegative CHECK ((budget_spent >= 0)),
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
-- Name: COLUMN crawl_lane.budget_day; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_lane.budget_day IS 'The Tehran day (Asia/Tehran) whose requests budget_spent counts; the first lease of a new day starts the count again. NULL before the lane''s first request.';


--
-- Name: COLUMN crawl_lane.budget_spent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crawl_lane.budget_spent IS 'Requests leased on budget_day, counted when the lease is taken, so a request is paid for even if its answer never arrives; compared with source.daily_request_budget less the reserve of the job''s priority (ADR-0017 point 5).';


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
    CONSTRAINT crawl_run_kind_valid CHECK ((kind = ANY (ARRAY['discovery'::text, 'detail'::text, 'measure'::text, 'sweep'::text, 'check'::text, 'recheck'::text]))),
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

COMMENT ON COLUMN public.crawl_run.kind IS 'What the run spent its request on (ADR-0017 point 5): discovery (a page of the newest listings of tracked models), detail (a new or changed listing''s page), measure (a page of a measurement walk), sweep (a list page of the inventory sweep), check (a listing''s page read to confirm it left the market), recheck (a listing''s page a buyer asked to re-read).';


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
-- Name: extraction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extraction (
    id bigint NOT NULL,
    snapshot_id bigint NOT NULL,
    listing_id bigint NOT NULL,
    ai_answer_id bigint NOT NULL,
    status text NOT NULL,
    hold_reasons text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT extraction_held_with_reason CHECK (((status = 'held'::text) = (cardinality(hold_reasons) > 0))),
    CONSTRAINT extraction_hold_reasons_valid CHECK ((hold_reasons <@ ARRAY['addressed_model'::text, 'hidden_characters'::text])),
    CONSTRAINT extraction_status_valid CHECK ((status = ANY (ARRAY['usable'::text, 'held'::text])))
);


--
-- Name: TABLE extraction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.extraction IS 'One snapshot read by an AI extraction step (CS-52) through one validated answer; a new prompt version gives a new answer and a new row beside the old. Derived: deleted with its snapshot.';


--
-- Name: COLUMN extraction.listing_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.extraction.listing_id IS 'The snapshot''s listing, part of the composite key to snapshot so an extraction cannot name another listing''s snapshot.';


--
-- Name: COLUMN extraction.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.extraction.status IS 'usable: its accepted fields may be used; held: a person reads it first, because the listing addressed the model or hid tag characters (hold_reasons).';


--
-- Name: extraction_field; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extraction_field (
    extraction_id bigint NOT NULL,
    field text NOT NULL,
    value text NOT NULL,
    evidence text NOT NULL,
    confidence numeric(4,3) NOT NULL,
    threshold numeric(4,3) NOT NULL,
    status text NOT NULL,
    CONSTRAINT extraction_field_confidence_range CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT extraction_field_evidence_length CHECK ((char_length(evidence) <= 1200)),
    CONSTRAINT extraction_field_evidence_with_value CHECK (((value = 'not_stated'::text) = (evidence = ''::text))),
    CONSTRAINT extraction_field_status_by_threshold CHECK (((status = 'accepted'::text) = (confidence >= threshold))),
    CONSTRAINT extraction_field_status_valid CHECK ((status = ANY (ARRAY['accepted'::text, 'needs_review'::text]))),
    CONSTRAINT extraction_field_threshold_range CHECK (((threshold > (0)::numeric) AND (threshold <= (1)::numeric))),
    CONSTRAINT extraction_field_value_format CHECK ((value ~ '^[a-z0-9_]{1,40}$'::text))
);


--
-- Name: TABLE extraction_field; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.extraction_field IS 'Each field of an extraction (CS-52): the value the model chose, the phrase of the listing it copied as evidence, and the confidence computed in code from signals (never the model''s own), accepted only at or above the threshold it was held to.';


--
-- Name: COLUMN extraction_field.value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.extraction_field.value IS 'The schema''s value code, such as partial, down_payment, free_zone or 5_or_more; not_stated when the text says nothing.';


--
-- Name: COLUMN extraction_field.threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.extraction_field.threshold IS 'extraction_field_def.min_confidence when the field was stored, kept for audit.';


--
-- Name: extraction_field_def; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extraction_field_def (
    code text NOT NULL,
    min_confidence numeric(4,3) NOT NULL,
    CONSTRAINT extraction_field_def_code_format CHECK ((code ~ '^[a-z][a-z_]{0,39}$'::text)),
    CONSTRAINT extraction_field_def_min_confidence_range CHECK (((min_confidence > (0)::numeric) AND (min_confidence <= (1)::numeric)))
);


--
-- Name: TABLE extraction_field_def; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.extraction_field_def IS 'Every field an extraction step reads from text, with the confidence a value needs before it is used (CS-52): below it, the field waits in review_item.';


--
-- Name: extraction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.extraction ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.extraction_id_seq
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
-- Name: freshness_measurement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.freshness_measurement (
    id bigint NOT NULL,
    source_id text NOT NULL,
    source_model_key text,
    measured_at timestamp with time zone NOT NULL,
    new_listings integer NOT NULL,
    left_market integer NOT NULL,
    active_listings integer NOT NULL,
    seen_within_48h integer NOT NULL,
    posting_to_first_seen_p50_minutes integer,
    posting_to_first_seen_p90_minutes integer,
    last_seen_age_p50_minutes integer,
    last_seen_age_p90_minutes integer,
    CONSTRAINT freshness_measurement_counts_nonnegative CHECK (((new_listings >= 0) AND (left_market >= 0) AND (active_listings >= 0) AND (seen_within_48h >= 0))),
    CONSTRAINT freshness_measurement_minutes_nonnegative CHECK (((posting_to_first_seen_p50_minutes >= 0) AND (posting_to_first_seen_p90_minutes >= posting_to_first_seen_p50_minutes) AND (last_seen_age_p50_minutes >= 0) AND (last_seen_age_p90_minutes >= last_seen_age_p50_minutes))),
    CONSTRAINT freshness_measurement_seen_within_active CHECK ((seen_within_48h <= active_listings)),
    CONSTRAINT freshness_measurement_source_model_key_format CHECK (((source_model_key ~ '^\S(.*\S)?$'::text) AND (char_length(source_model_key) <= 200)))
);


--
-- Name: TABLE freshness_measurement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.freshness_measurement IS 'How fresh the index is, measured every hour per crawled source (source_model_key NULL) and per tracked model, over the 24 hours before measured_at (CS-35; ADR-0017 point 6). Append-only.';


--
-- Name: COLUMN freshness_measurement.source_model_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.freshness_measurement.source_model_key IS 'The tracked model''s own filter value on the source (Divar''s brand_model); its trims are counted with it. NULL: the whole source.';


--
-- Name: COLUMN freshness_measurement.new_listings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.freshness_measurement.new_listings IS 'Listings first stored in the 24 hours before measured_at.';


--
-- Name: COLUMN freshness_measurement.left_market; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.freshness_measurement.left_market IS 'Listings whose delisted_at falls in the 24 hours before measured_at: sold, expired or gone.';


--
-- Name: COLUMN freshness_measurement.seen_within_48h; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.freshness_measurement.seen_within_48h IS 'Active listings seen in a list or checked on their own page within 48 hours: what a results page may show (ADR-0017 point 6).';


--
-- Name: COLUMN freshness_measurement.posting_to_first_seen_p50_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.freshness_measurement.posting_to_first_seen_p50_minutes IS 'Median minutes from posting (listed_at) to first storing (created_at), over the listings first stored in the 24 hours whose page has been read, so their posting time is the source''s own. The target is under an hour for tracked models.';


--
-- Name: COLUMN freshness_measurement.last_seen_age_p50_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.freshness_measurement.last_seen_age_p50_minutes IS 'Median minutes since each active listing was last seen or checked, at measured_at. The target is under 24 hours.';


--
-- Name: freshness_measurement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.freshness_measurement ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.freshness_measurement_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_state_change; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_state_change (
    id bigint NOT NULL,
    queue text NOT NULL,
    job_id uuid NOT NULL,
    action text NOT NULL,
    from_state text NOT NULL,
    changed_by_account_id bigint NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_state_change_action_valid CHECK ((action = ANY (ARRAY['retry'::text, 'cancel'::text]))),
    CONSTRAINT job_state_change_from_state_valid CHECK ((((action = 'retry'::text) AND (from_state = 'failed'::text)) OR ((action = 'cancel'::text) AND (from_state = ANY (ARRAY['created'::text, 'retry'::text]))))),
    CONSTRAINT job_state_change_queue_format CHECK (((btrim(queue) <> ''::text) AND (char_length(queue) <= 200))),
    CONSTRAINT job_state_change_queue_not_internal CHECK ((NOT starts_with(queue, '__pgboss__'::text)))
);


--
-- Name: TABLE job_state_change; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.job_state_change IS 'Append-only record of every job a superadmin retried or cancelled in the superadmin section (CS-41, ADR-0023), written by change_job_state() in the transaction that makes the change.';


--
-- Name: COLUMN job_state_change.queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.job_state_change.queue IS 'The pg-boss queue of the job (pgboss.job.name).';


--
-- Name: COLUMN job_state_change.job_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.job_state_change.job_id IS 'pgboss.job.id; the job itself may since have been deleted by pg-boss.';


--
-- Name: COLUMN job_state_change.from_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.job_state_change.from_state IS 'pgboss.job.state before the change.';


--
-- Name: COLUMN job_state_change.changed_by_account_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.job_state_change.changed_by_account_id IS 'The superadmin who made the change; change_job_state() refuses any other account.';


--
-- Name: COLUMN job_state_change.changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.job_state_change.changed_at IS 'When the change took effect, holding the job''s lock (clock_timestamp()).';


--
-- Name: job_state_change_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.job_state_change ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.job_state_change_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


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
-- Name: listing_photo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_photo (
    listing_id bigint NOT NULL,
    "position" bigint NOT NULL,
    url text NOT NULL,
    thumbnail_url text,
    CONSTRAINT listing_photo_position_positive CHECK (("position" >= 1)),
    CONSTRAINT listing_photo_thumbnail_url_https CHECK ((thumbnail_url ~ '^https://'::text)),
    CONSTRAINT listing_photo_url_https CHECK ((url ~ '^https://'::text))
);


--
-- Name: TABLE listing_photo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.listing_photo IS 'A listing''s photos as addresses on its source''s own photo host, in the source''s order (ADR-0025): derived from its latest snapshot, never downloaded or stored.';


--
-- Name: COLUMN listing_photo."position"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_photo."position" IS 'The photo''s place in the source''s order, from 1: the first is the listing''s main photo.';


--
-- Name: COLUMN listing_photo.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_photo.url IS 'The full-size photo''s address on the source''s photo host, which pages load it from.';


--
-- Name: COLUMN listing_photo.thumbnail_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_photo.thumbnail_url IS 'The source''s own small version of the same photo, for result cards; null when the source gives none.';


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
    snapshot_id bigint,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    fetch_log_id bigint,
    CONSTRAINT listing_price_event_amount_matches_type CHECK (((price_type = 'asking'::text) = (asking_price_toman IS NOT NULL))),
    CONSTRAINT listing_price_event_asking_price_toman_range CHECK (((asking_price_toman >= 1) AND (asking_price_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_price_event_is_a_change CHECK (((price_type IS DISTINCT FROM previous_price_type) OR (asking_price_toman IS DISTINCT FROM previous_price_toman))),
    CONSTRAINT listing_price_event_last_asking_price_toman_range CHECK (((last_asking_price_toman >= 1) AND (last_asking_price_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_price_event_one_evidence CHECK ((num_nonnulls(snapshot_id, fetch_log_id) = 1)),
    CONSTRAINT listing_price_event_previous_amount_matches_type CHECK ((((previous_price_type IS NOT NULL) AND (previous_price_type = 'asking'::text)) = (previous_price_toman IS NOT NULL))),
    CONSTRAINT listing_price_event_previous_price_toman_range CHECK (((previous_price_toman >= 1) AND (previous_price_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_price_event_previous_price_type_valid CHECK ((previous_price_type = ANY (ARRAY['asking'::text, 'negotiable'::text, 'installment'::text, 'placeholder'::text]))),
    CONSTRAINT listing_price_event_price_type_valid CHECK ((price_type = ANY (ARRAY['asking'::text, 'negotiable'::text, 'installment'::text, 'placeholder'::text])))
);


--
-- Name: TABLE listing_price_event; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.listing_price_event IS 'Append-only price history of a listing in valid time (ADR-0014): one row per change of what it asks, read from a snapshot of its page or from its row on a list page.';


--
-- Name: COLUMN listing_price_event.observed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_price_event.observed_at IS 'When the source showed this price: the start of the request that is the evidence, the listing''s page (snapshot_id) or the list page (fetch_log_id).';


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

COMMENT ON COLUMN public.listing_price_event.snapshot_id IS 'The snapshot of the listing''s page that showed this price; NULL when the evidence is a list row (fetch_log_id).';


--
-- Name: COLUMN listing_price_event.recorded_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_price_event.recorded_at IS 'When we stored the event; differs from observed_at when history is re-derived.';


--
-- Name: COLUMN listing_price_event.fetch_log_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_price_event.fetch_log_id IS 'The list page''s request that showed this price in the listing''s row (a sweep or discovery page); NULL when the evidence is a snapshot. Exactly one of the two is set.';


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
-- Name: listing_recheck_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_recheck_request (
    id bigint NOT NULL,
    listing_id bigint NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    handled_at timestamp with time zone,
    outcome text,
    CONSTRAINT listing_recheck_request_handled_after_request CHECK ((handled_at >= requested_at)),
    CONSTRAINT listing_recheck_request_handled_with_outcome CHECK (((handled_at IS NULL) = (outcome IS NULL))),
    CONSTRAINT listing_recheck_request_outcome_valid CHECK ((outcome = ANY (ARRAY['queued'::text, 'fresh'::text, 'off_market'::text])))
);


--
-- Name: TABLE listing_recheck_request; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.listing_recheck_request IS 'A buyer''s request to re-read one listing (CS-35, CS-64): inserted by the web app, drained every minute by the worker into a high-priority lane job, at most one pending per listing.';


--
-- Name: COLUMN listing_recheck_request.handled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_recheck_request.handled_at IS 'When the worker handled the request; NULL while pending.';


--
-- Name: COLUMN listing_recheck_request.outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_recheck_request.outcome IS 'What became of it: queued (a re-check job was sent), fresh (the listing''s page was read within the freshness window, six hours) or off_market (the listing had already left the market).';


--
-- Name: listing_recheck_request_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.listing_recheck_request ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.listing_recheck_request_id_seq
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
-- Name: listing_unparsed_value; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_unparsed_value (
    listing_id bigint NOT NULL,
    field text NOT NULL,
    raw_text text NOT NULL,
    CONSTRAINT listing_unparsed_value_field_valid CHECK ((field = ANY (ARRAY['model_year'::text, 'mileage_km'::text, 'fuel'::text, 'gearbox'::text, 'insurance_months_left'::text, 'price'::text, 'accepts_swap'::text, 'accepts_installments'::text, 'seller_type'::text, 'body_condition'::text, 'engine_condition'::text, 'gearbox_condition'::text, 'chassis_condition'::text, 'colour'::text]))),
    CONSTRAINT listing_unparsed_value_raw_text_not_blank CHECK ((btrim(raw_text) <> ''::text))
);


--
-- Name: TABLE listing_unparsed_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.listing_unparsed_value IS 'A value a listing states that its source''s parser could not read, with its raw text; the column it would fill stays null. Derived with the listing''s other attributes.';


--
-- Name: COLUMN listing_unparsed_value.field; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_unparsed_value.field IS 'The attribute the value would fill: model_year (model_year_written, _sh and _ad), price (price_type and its amounts), chassis_condition (front and rear), or the listing column of that name.';


--
-- Name: COLUMN listing_unparsed_value.raw_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_unparsed_value.raw_text IS 'The value exactly as the source wrote it, direction marks and all.';


--
-- Name: listing_valuation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_valuation (
    valuation_run_id bigint NOT NULL,
    listing_id bigint NOT NULL,
    asking_price_toman bigint,
    market_value_toman bigint,
    price_gap_pct numeric(7,2),
    deal_rating public.deal_rating,
    no_rating_reason text,
    CONSTRAINT listing_valuation_asking_price_toman_range CHECK (((asking_price_toman >= 1) AND (asking_price_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_valuation_gap_only_when_rated CHECK (((price_gap_pct IS NULL) OR (deal_rating IS NOT NULL))),
    CONSTRAINT listing_valuation_market_value_toman_range CHECK (((market_value_toman >= 1) AND (market_value_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_valuation_no_rating_reason_valid CHECK ((no_rating_reason = ANY (ARRAY['unmatched_model'::text, 'missing_attributes'::text, 'excluded_condition'::text, 'too_few_comparables'::text, 'uncertain_segment'::text, 'year_out_of_range'::text, 'unknown_price'::text, 'no_asking_price'::text, 'placeholder_price'::text, 'installment_price'::text, 'dealer_new_car'::text, 'price_outlier'::text]))),
    CONSTRAINT listing_valuation_rating_has_numbers CHECK (((deal_rating IS NULL) OR ((asking_price_toman IS NOT NULL) AND (market_value_toman IS NOT NULL) AND (price_gap_pct IS NOT NULL)))),
    CONSTRAINT listing_valuation_rating_or_reason CHECK (((deal_rating IS NULL) <> (no_rating_reason IS NULL)))
);


--
-- Name: TABLE listing_valuation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.listing_valuation IS 'A listing''s market value, price gap and deal rating in one run (CS-51 criteria 3 and 4): exactly one of a rating and a reason for none.';


--
-- Name: COLUMN listing_valuation.asking_price_toman; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_valuation.asking_price_toman IS 'The asking price that was rated, as the listing showed it when the run read it; null when its price type is not asking.';


--
-- Name: COLUMN listing_valuation.market_value_toman; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_valuation.market_value_toman IS 'The market value on the run''s day; null when the listing''s model, attributes or condition cannot be valued. A negotiable listing keeps its value but no rating.';


--
-- Name: COLUMN listing_valuation.price_gap_pct; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listing_valuation.price_gap_pct IS '(asking - market value) / market value, in percent; negative is cheaper than the market.';


--
-- Name: listing_valuation_comparable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_valuation_comparable (
    valuation_run_id bigint NOT NULL,
    listing_id bigint NOT NULL,
    comparable_listing_id bigint NOT NULL,
    "position" smallint NOT NULL,
    asking_price_toman bigint NOT NULL,
    adjusted_price_toman bigint NOT NULL,
    CONSTRAINT listing_valuation_comparable_adjusted_price_toman_range CHECK (((adjusted_price_toman >= 1) AND (adjusted_price_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_valuation_comparable_asking_price_toman_range CHECK (((asking_price_toman >= 1) AND (asking_price_toman <= '999999999999999'::bigint))),
    CONSTRAINT listing_valuation_comparable_not_itself CHECK ((comparable_listing_id <> listing_id)),
    CONSTRAINT listing_valuation_comparable_position_range CHECK ((("position" >= 1) AND ("position" <= 10)))
);


--
-- Name: TABLE listing_valuation_comparable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.listing_valuation_comparable IS 'Up to ten comparables of a rated listing, nearest in model year and mileage within its model (CS-51, shown by CS-64), with each one''s asking price and that price adjusted to this listing''s attributes.';


--
-- Name: make; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.make (
    id bigint NOT NULL,
    slug text NOT NULL,
    name_fa text,
    name_en text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT make_name_en_not_blank CHECK ((btrim(name_en) <> ''::text)),
    CONSTRAINT make_name_fa_not_blank CHECK ((btrim(name_fa) <> ''::text)),
    CONSTRAINT make_slug_format CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (char_length(slug) <= 60)))
);


--
-- Name: TABLE make; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.make IS 'A car maker, canonical (CS-50). name_fa is null until a source or a person names it in Persian.';


--
-- Name: make_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.make ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.make_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: model; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model (
    id bigint NOT NULL,
    make_id bigint NOT NULL,
    slug text NOT NULL,
    name_fa text,
    name_en text NOT NULL,
    body_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT model_name_en_not_blank CHECK ((btrim(name_en) <> ''::text)),
    CONSTRAINT model_name_fa_not_blank CHECK ((btrim(name_fa) <> ''::text)),
    CONSTRAINT model_slug_format CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (char_length(slug) <= 80)))
);


--
-- Name: TABLE model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.model IS 'A model of a make, canonical (CS-50); its body type is curated, null only for a model with no listings yet.';


--
-- Name: model_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.model ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.model_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: model_spend; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_spend (
    id bigint NOT NULL,
    task text NOT NULL,
    prompt_version text NOT NULL,
    model text NOT NULL,
    outcome text NOT NULL,
    error_reason text,
    cost_usd_micros bigint NOT NULL,
    estimated boolean NOT NULL,
    snapshot_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT model_spend_cost_usd_micros_range CHECK (((cost_usd_micros >= 0) AND (cost_usd_micros <= '999999999999999'::bigint))),
    CONSTRAINT model_spend_error_reason_valid CHECK ((error_reason = ANY (ARRAY['timeout'::text, 'aborted'::text, 'rate_limited'::text, 'unavailable'::text, 'unauthorized'::text, 'no_credit'::text, 'rejected'::text]))),
    CONSTRAINT model_spend_model_format CHECK ((model ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'::text)),
    CONSTRAINT model_spend_outcome_valid CHECK ((outcome = ANY (ARRAY['ok'::text, 'invalid'::text, 'refusal'::text, 'truncated'::text, 'empty'::text, 'error'::text]))),
    CONSTRAINT model_spend_prompt_version_format CHECK ((prompt_version ~ '^[0-9a-f]{16}$'::text)),
    CONSTRAINT model_spend_reason_with_error CHECK (((outcome = 'error'::text) = (error_reason IS NOT NULL))),
    CONSTRAINT model_spend_task_format CHECK ((task ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$'::text))
);


--
-- Name: TABLE model_spend; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.model_spend IS 'Every paid model call and what it cost, whatever came back (CS-52): what a daily spending cap sums. Cached answers cost nothing and have no row. Append-only; leaves with its snapshot in a purge.';


--
-- Name: COLUMN model_spend.cost_usd_micros; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_spend.cost_usd_micros IS 'Millionths of a US dollar at Metis''s price, every attempt of the call included.';


--
-- Name: COLUMN model_spend.estimated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_spend.estimated IS 'True when the layer could not measure the cost (an attempt that got no answer, a model with no price) and the caller counted its estimate.';


--
-- Name: COLUMN model_spend.snapshot_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_spend.snapshot_id IS 'The snapshot the call read, for a listing step; how often its calls failed decides when it goes to review.';


--
-- Name: model_spend_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.model_spend ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.model_spend_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


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
-- Name: notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    kind text NOT NULL,
    event_key text NOT NULL,
    payload jsonb NOT NULL,
    listing_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    CONSTRAINT notification_event_key_format CHECK ((event_key ~ '^[a-z][a-z0-9_]{0,40}:[0-9A-Za-z_.:-]{1,160}$'::text)),
    CONSTRAINT notification_payload_object CHECK ((jsonb_typeof(payload) = 'object'::text)),
    CONSTRAINT notification_payload_small CHECK ((octet_length((payload)::text) <= 4096)),
    CONSTRAINT notification_read_after_created CHECK ((read_at >= created_at))
);


--
-- Name: TABLE notification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notification IS 'One thing one buyer is told (CS-68, ADR-0026): written only through create_notification(), which honours the buyer''s mutes and notifies each event once. The row keeps the facts; the Farsi text is built from them when shown.';


--
-- Name: COLUMN notification.event_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification.event_key IS 'Names the event this notification announces, built by the kind''s definition from its payload (price_event:812, crawl_request:31:approved); with the account and the kind it is unique, so a producer that runs twice notifies once.';


--
-- Name: COLUMN notification.payload; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification.payload IS 'The facts the notification was built from, when it was created (a car''s name, the price before and after), as the kind''s schema in packages/notifications defines them; never personal data.';


--
-- Name: COLUMN notification.listing_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification.listing_id IS 'The listing it is about, for a listing''s kinds; search files and crawl requests get columns of their own with their tables (CS-70, CS-71).';


--
-- Name: COLUMN notification.read_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification.read_at IS 'When the buyer read it or marked it read; NULL while unread. The only column the web app may change.';


--
-- Name: notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notification ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notification_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notification_kind; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_kind (
    id text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_kind_description_not_blank CHECK ((btrim(description) <> ''::text)),
    CONSTRAINT notification_kind_id_format CHECK ((id ~ '^[a-z][a-z0-9_]{1,40}$'::text))
);


--
-- Name: TABLE notification_kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notification_kind IS 'What a notification can announce (ADR-0026 point 3): a curated vocabulary, one row per kind, mirrored by the registry in packages/notifications, which holds each kind''s payload schema, event key and Farsi text. A kind is added by a migration that inserts its row, with its definition in code.';


--
-- Name: COLUMN notification_kind.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notification_kind.description IS 'What the kind announces, in English, for people reading the database; the Farsi a buyer reads is built in code.';


--
-- Name: notification_mute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_mute (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    kind text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE notification_mute; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notification_mute IS 'A kind of notification a buyer does not want (CS-68, ADR-0026 point 4): create_notification() creates none of it for them. Removing the row turns the kind back on; notifications already received stay.';


--
-- Name: notification_mute_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notification_mute ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notification_mute_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: review_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_item (
    id bigint NOT NULL,
    kind text NOT NULL,
    extraction_id bigint,
    field text,
    snapshot_id bigint,
    task text,
    prompt_version text,
    outcome text,
    problems jsonb,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    CONSTRAINT review_item_closed_when_done CHECK (((status = 'open'::text) = (closed_at IS NULL))),
    CONSTRAINT review_item_kind_valid CHECK ((kind = ANY (ARRAY['extraction_field'::text, 'extraction_held'::text, 'answer_invalid'::text]))),
    CONSTRAINT review_item_outcome_valid CHECK ((outcome = ANY (ARRAY['invalid'::text, 'refusal'::text, 'truncated'::text, 'empty'::text, 'error'::text]))),
    CONSTRAINT review_item_problems_is_array CHECK ((jsonb_typeof(problems) = 'array'::text)),
    CONSTRAINT review_item_prompt_version_format CHECK ((prompt_version ~ '^[0-9a-f]{16}$'::text)),
    CONSTRAINT review_item_status_valid CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'dismissed'::text]))),
    CONSTRAINT review_item_subject_by_kind CHECK (
CASE kind
    WHEN 'extraction_field'::text THEN ((extraction_id IS NOT NULL) AND (field IS NOT NULL) AND (snapshot_id IS NULL) AND (task IS NULL) AND (prompt_version IS NULL) AND (outcome IS NULL) AND (problems IS NULL))
    WHEN 'extraction_held'::text THEN ((extraction_id IS NOT NULL) AND (field IS NULL) AND (snapshot_id IS NULL) AND (task IS NULL) AND (prompt_version IS NULL) AND (outcome IS NULL) AND (problems IS NULL))
    WHEN 'answer_invalid'::text THEN ((extraction_id IS NULL) AND (field IS NULL) AND (snapshot_id IS NOT NULL) AND (task IS NOT NULL) AND (prompt_version IS NOT NULL) AND (outcome IS NOT NULL) AND (problems IS NOT NULL))
    ELSE NULL::boolean
END),
    CONSTRAINT review_item_task_format CHECK ((task ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$'::text))
);


--
-- Name: TABLE review_item; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.review_item IS 'The one human review queue (CS-52; CS-50 and CS-55 add their kinds): a field below its threshold, an extraction held whole, or an answer that never validated, with its problems. Problems quote the listing, so they stay here and never reach a log.';


--
-- Name: COLUMN review_item.problems; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.review_item.problems IS 'The layer''s problems for an answer that never validated: [{path, message}], each naming the field, the value seen and what is admissible; for outcome error, why no answer came after repeated calls.';


--
-- Name: review_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.review_item ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.review_item_id_seq
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
    daily_request_budget integer,
    CONSTRAINT source_access_method_valid CHECK ((access_method = ANY (ARRAY['crawl'::text, 'official_api'::text, 'native'::text]))),
    CONSTRAINT source_base_url_https CHECK ((base_url ~ '^https://[^/\s]+/?$'::text)),
    CONSTRAINT source_crawl_has_budget CHECK (((access_method <> 'crawl'::text) OR (daily_request_budget IS NOT NULL))),
    CONSTRAINT source_crawl_interval_floor CHECK (((access_method <> 'crawl'::text) OR ((min_request_interval_ms IS NOT NULL) AND (min_request_interval_ms >= 3000)))),
    CONSTRAINT source_crawl_state_valid CHECK ((crawl_state = ANY (ARRAY['enabled'::text, 'paused'::text, 'stopped_on_block'::text]))),
    CONSTRAINT source_daily_request_budget_range CHECK (((daily_request_budget > 0) AND (daily_request_budget <= ((86400000 / min_request_interval_ms) / 2)))),
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
-- Name: COLUMN source.daily_request_budget; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source.daily_request_budget IS 'Requests this source may receive in one Tehran day (ADR-0017 point 5): at most half of what min_request_interval_ms allows in a day, spent in ADR-0017''s priority order, what comes last dropped first. Divar: 12,000 (owner, 2026-09-30). Set by migrations or the owner; the worker only reads it.';


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

COMMENT ON COLUMN public.source_policy_check.photos_allowed IS 'Whether this source''s terms allow downloading and re-hosting its photos, as read. Nothing is downloaded or re-hosted (ADR-0025), so it does not decide whether pages show a source''s photos from their addresses.';


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
-- Name: source_daily_spend; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.source_daily_spend AS
 SELECT f.source_id,
    ((f.requested_at AT TIME ZONE 'Asia/Tehran'::text))::date AS tehran_day,
    r.kind,
    f.outcome,
    (count(*))::integer AS requests,
    s.daily_request_budget
   FROM ((public.fetch_log f
     JOIN public.crawl_run r ON (((r.id = f.crawl_run_id) AND (r.source_id = f.source_id))))
     JOIN public.source s ON ((s.id = f.source_id)))
  GROUP BY f.source_id, (((f.requested_at AT TIME ZONE 'Asia/Tehran'::text))::date), r.kind, f.outcome, s.daily_request_budget;


--
-- Name: VIEW source_daily_spend; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.source_daily_spend IS 'Requests per source, Tehran day, crawl kind and outcome, with the source''s daily budget (CS-35; ADR-0017 point 5).';


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
-- Name: source_state_change; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_state_change (
    id bigint NOT NULL,
    source_id text NOT NULL,
    from_state text NOT NULL,
    to_state text NOT NULL,
    changed_by_account_id bigint NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    cleared_stopped_at timestamp with time zone,
    cleared_stop_reason text,
    CONSTRAINT source_state_change_cleared_stop_reason_valid CHECK ((cleared_stop_reason = ANY (ARRAY['blocked'::text, 'rate_limited'::text, 'challenge'::text]))),
    CONSTRAINT source_state_change_from_state_valid CHECK ((from_state = ANY (ARRAY['enabled'::text, 'paused'::text, 'stopped_on_block'::text]))),
    CONSTRAINT source_state_change_is_change CHECK ((from_state <> to_state)),
    CONSTRAINT source_state_change_stop_kept CHECK ((((from_state = 'stopped_on_block'::text) = (cleared_stopped_at IS NOT NULL)) AND ((from_state = 'stopped_on_block'::text) = (cleared_stop_reason IS NOT NULL)))),
    CONSTRAINT source_state_change_to_state_valid CHECK ((to_state = ANY (ARRAY['enabled'::text, 'paused'::text])))
);


--
-- Name: TABLE source_state_change; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.source_state_change IS 'Append-only record of every change a person made to a source''s crawl state in the superadmin section (CS-40, ADR-0023), written by change_source_state() in the transaction that makes it.';


--
-- Name: COLUMN source_state_change.from_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source_state_change.from_state IS 'source.crawl_state before the change.';


--
-- Name: COLUMN source_state_change.to_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source_state_change.to_state IS 'source.crawl_state after it: enabled or paused. Only the crawler stops a source (stop_source()).';


--
-- Name: COLUMN source_state_change.changed_by_account_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source_state_change.changed_by_account_id IS 'The superadmin who made the change; change_source_state() refuses any other account.';


--
-- Name: COLUMN source_state_change.changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source_state_change.changed_at IS 'When the change took effect: the moment change_source_state() applied it, holding the source''s lock (clock_timestamp(), not the transaction''s start), so the order of a source''s changes is the order they took effect.';


--
-- Name: COLUMN source_state_change.cleared_stopped_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source_state_change.cleared_stopped_at IS 'For a change away from stopped_on_block, the stop it cleared: source.stopped_at, the start of the blocked request in fetch_log.';


--
-- Name: COLUMN source_state_change.cleared_stop_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.source_state_change.cleared_stop_reason IS 'For a change away from stopped_on_block, why the crawler had stopped the source: source.stop_reason.';


--
-- Name: source_state_change_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.source_state_change ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.source_state_change_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: trim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."trim" (
    id bigint NOT NULL,
    model_id bigint NOT NULL,
    slug text NOT NULL,
    name_fa text,
    name_en text NOT NULL,
    body_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trim_name_en_not_blank CHECK ((btrim(name_en) <> ''::text)),
    CONSTRAINT trim_name_fa_not_blank CHECK ((btrim(name_fa) <> ''::text)),
    CONSTRAINT trim_slug_format CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (char_length(slug) <= 120)))
);


--
-- Name: TABLE "trim"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."trim" IS 'A trim of a model, canonical (CS-50); body_type only where it differs from its model''s (a van of a sedan, say).';


--
-- Name: trim_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."trim" ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.trim_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: valuation_coefficient_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.valuation_coefficient ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.valuation_coefficient_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: valuation_run_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.valuation_run ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.valuation_run_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: worker_heartbeat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_heartbeat (
    id bigint NOT NULL,
    instance_id uuid NOT NULL,
    hostname text NOT NULL,
    pid integer NOT NULL,
    version text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    beat_at timestamp with time zone NOT NULL,
    stopped_at timestamp with time zone,
    CONSTRAINT worker_heartbeat_beat_after_start CHECK ((beat_at >= started_at)),
    CONSTRAINT worker_heartbeat_hostname_format CHECK (((btrim(hostname) <> ''::text) AND (char_length(hostname) <= 255))),
    CONSTRAINT worker_heartbeat_pid_positive CHECK ((pid > 0)),
    CONSTRAINT worker_heartbeat_stop_after_start CHECK ((stopped_at >= started_at)),
    CONSTRAINT worker_heartbeat_version_format CHECK (((btrim(version) <> ''::text) AND (char_length(version) <= 200)))
);


--
-- Name: TABLE worker_heartbeat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.worker_heartbeat IS 'One row per worker process (CS-41): written when it starts, stamped every 15 s, marked stopped on a clean shutdown; rows older than a week are deleted by the next start. The superadmin section shows the worker as down when no running process beat within 40 s.';


--
-- Name: COLUMN worker_heartbeat.instance_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.worker_heartbeat.instance_id IS 'Chosen by the process when it starts; names it in the section.';


--
-- Name: COLUMN worker_heartbeat.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.worker_heartbeat.version IS 'The release the process runs: CARSHENAS_RELEASE, or the commit.';


--
-- Name: COLUMN worker_heartbeat.started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.worker_heartbeat.started_at IS 'When the process started, by the database''s clock.';


--
-- Name: COLUMN worker_heartbeat.beat_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.worker_heartbeat.beat_at IS 'The last beat, by the database''s clock (now() of the beat), so a server''s drifting clock cannot fake one.';


--
-- Name: COLUMN worker_heartbeat.stopped_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.worker_heartbeat.stopped_at IS 'When the process shut down cleanly; null while it runs or when it died without saying so.';


--
-- Name: worker_heartbeat_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.worker_heartbeat ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.worker_heartbeat_id_seq
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
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: account_role_change account_role_change_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_role_change
    ADD CONSTRAINT account_role_change_pkey PRIMARY KEY (id);


--
-- Name: account_session account_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_session
    ADD CONSTRAINT account_session_pkey PRIMARY KEY (id);


--
-- Name: account_session account_session_token_sha256_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_session
    ADD CONSTRAINT account_session_token_sha256_unique UNIQUE (token_sha256);


--
-- Name: account account_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_username_unique UNIQUE (username);


--
-- Name: ai_answer ai_answer_cache_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_answer
    ADD CONSTRAINT ai_answer_cache_key_unique UNIQUE (cache_key);


--
-- Name: ai_answer ai_answer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_answer
    ADD CONSTRAINT ai_answer_pkey PRIMARY KEY (id);


--
-- Name: auth_throttle auth_throttle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_throttle
    ADD CONSTRAINT auth_throttle_pkey PRIMARY KEY (id);


--
-- Name: auth_throttle auth_throttle_subject_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_throttle
    ADD CONSTRAINT auth_throttle_subject_unique UNIQUE (scope, subject_hmac);


--
-- Name: body_type body_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.body_type
    ADD CONSTRAINT body_type_pkey PRIMARY KEY (code);


--
-- Name: body_type body_type_position_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.body_type
    ADD CONSTRAINT body_type_position_unique UNIQUE ("position");


--
-- Name: catalogue_alias catalogue_alias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_alias
    ADD CONSTRAINT catalogue_alias_pkey PRIMARY KEY (id);


--
-- Name: catalogue_alias catalogue_alias_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_alias
    ADD CONSTRAINT catalogue_alias_unique UNIQUE NULLS NOT DISTINCT (make_id, model_id, trim_id, alias_norm, source_id);


--
-- Name: catalogue_source_key catalogue_source_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_source_key
    ADD CONSTRAINT catalogue_source_key_pkey PRIMARY KEY (source_id, source_model_key);


--
-- Name: city city_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city
    ADD CONSTRAINT city_pkey PRIMARY KEY (id);


--
-- Name: city city_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city
    ADD CONSTRAINT city_slug_unique UNIQUE (slug);


--
-- Name: colour colour_label_fa_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colour
    ADD CONSTRAINT colour_label_fa_unique UNIQUE (label_fa);


--
-- Name: colour colour_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colour
    ADD CONSTRAINT colour_pkey PRIMARY KEY (code);


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
-- Name: extraction_field_def extraction_field_def_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_field_def
    ADD CONSTRAINT extraction_field_def_pkey PRIMARY KEY (code);


--
-- Name: extraction_field extraction_field_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_field
    ADD CONSTRAINT extraction_field_pkey PRIMARY KEY (extraction_id, field);


--
-- Name: extraction extraction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction
    ADD CONSTRAINT extraction_pkey PRIMARY KEY (id);


--
-- Name: extraction extraction_snapshot_answer_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction
    ADD CONSTRAINT extraction_snapshot_answer_unique UNIQUE (snapshot_id, ai_answer_id);


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
-- Name: freshness_measurement freshness_measurement_once_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freshness_measurement
    ADD CONSTRAINT freshness_measurement_once_unique UNIQUE NULLS NOT DISTINCT (source_id, source_model_key, measured_at);


--
-- Name: freshness_measurement freshness_measurement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freshness_measurement
    ADD CONSTRAINT freshness_measurement_pkey PRIMARY KEY (id);


--
-- Name: job_state_change job_state_change_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_state_change
    ADD CONSTRAINT job_state_change_pkey PRIMARY KEY (id);


--
-- Name: listing listing_id_source_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_id_source_unique UNIQUE (id, source_id);


--
-- Name: listing_photo listing_photo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_photo
    ADD CONSTRAINT listing_photo_pkey PRIMARY KEY (listing_id, "position");


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
-- Name: listing_recheck_request listing_recheck_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_recheck_request
    ADD CONSTRAINT listing_recheck_request_pkey PRIMARY KEY (id);


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
-- Name: listing_unparsed_value listing_unparsed_value_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_unparsed_value
    ADD CONSTRAINT listing_unparsed_value_pkey PRIMARY KEY (listing_id, field);


--
-- Name: listing_valuation_comparable listing_valuation_comparable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_valuation_comparable
    ADD CONSTRAINT listing_valuation_comparable_pkey PRIMARY KEY (valuation_run_id, listing_id, comparable_listing_id);


--
-- Name: listing_valuation_comparable listing_valuation_comparable_position_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_valuation_comparable
    ADD CONSTRAINT listing_valuation_comparable_position_unique UNIQUE (valuation_run_id, listing_id, "position");


--
-- Name: listing_valuation listing_valuation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_valuation
    ADD CONSTRAINT listing_valuation_pkey PRIMARY KEY (valuation_run_id, listing_id);


--
-- Name: make make_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.make
    ADD CONSTRAINT make_pkey PRIMARY KEY (id);


--
-- Name: make make_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.make
    ADD CONSTRAINT make_slug_unique UNIQUE (slug);


--
-- Name: model model_id_make_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_id_make_unique UNIQUE (id, make_id);


--
-- Name: model model_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_pkey PRIMARY KEY (id);


--
-- Name: model model_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_slug_unique UNIQUE (make_id, slug);


--
-- Name: model_spend model_spend_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_spend
    ADD CONSTRAINT model_spend_pkey PRIMARY KEY (id);


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
-- Name: notification_kind notification_kind_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_kind
    ADD CONSTRAINT notification_kind_pkey PRIMARY KEY (id);


--
-- Name: notification_mute notification_mute_once_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_mute
    ADD CONSTRAINT notification_mute_once_unique UNIQUE (account_id, kind);


--
-- Name: notification_mute notification_mute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_mute
    ADD CONSTRAINT notification_mute_pkey PRIMARY KEY (id);


--
-- Name: notification notification_once_per_event_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_once_per_event_unique UNIQUE (account_id, kind, event_key);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: review_item review_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_item
    ADD CONSTRAINT review_item_pkey PRIMARY KEY (id);


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
-- Name: source_state_change source_state_change_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_state_change
    ADD CONSTRAINT source_state_change_pkey PRIMARY KEY (id);


--
-- Name: trim trim_id_model_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."trim"
    ADD CONSTRAINT trim_id_model_unique UNIQUE (id, model_id);


--
-- Name: trim trim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."trim"
    ADD CONSTRAINT trim_pkey PRIMARY KEY (id);


--
-- Name: trim trim_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."trim"
    ADD CONSTRAINT trim_slug_unique UNIQUE (model_id, slug);


--
-- Name: valuation_coefficient valuation_coefficient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_coefficient
    ADD CONSTRAINT valuation_coefficient_pkey PRIMARY KEY (id);


--
-- Name: valuation_coefficient valuation_coefficient_term_scope_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_coefficient
    ADD CONSTRAINT valuation_coefficient_term_scope_unique UNIQUE NULLS NOT DISTINCT (valuation_run_id, term, model_id, trim_id);


--
-- Name: valuation_comparable valuation_comparable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_comparable
    ADD CONSTRAINT valuation_comparable_pkey PRIMARY KEY (valuation_run_id, listing_id);


--
-- Name: valuation_run valuation_run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_run
    ADD CONSTRAINT valuation_run_pkey PRIMARY KEY (id);


--
-- Name: valuation_segment valuation_segment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_segment
    ADD CONSTRAINT valuation_segment_pkey PRIMARY KEY (valuation_run_id, model_id);


--
-- Name: worker_heartbeat worker_heartbeat_instance_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_heartbeat
    ADD CONSTRAINT worker_heartbeat_instance_unique UNIQUE (instance_id);


--
-- Name: worker_heartbeat worker_heartbeat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_heartbeat
    ADD CONSTRAINT worker_heartbeat_pkey PRIMARY KEY (id);


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
-- Name: account_role_change_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_role_change_account_idx ON public.account_role_change USING btree (account_id, changed_at);


--
-- Name: account_session_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_session_account_idx ON public.account_session USING btree (account_id);


--
-- Name: catalogue_alias_model_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalogue_alias_model_idx ON public.catalogue_alias USING btree (model_id);


--
-- Name: catalogue_alias_norm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalogue_alias_norm_idx ON public.catalogue_alias USING btree (alias_norm);


--
-- Name: catalogue_alias_trim_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalogue_alias_trim_idx ON public.catalogue_alias USING btree (trim_id);


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
-- Name: extraction_ai_answer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX extraction_ai_answer_idx ON public.extraction USING btree (ai_answer_id);


--
-- Name: fetch_log_listing_requested_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fetch_log_listing_requested_idx ON public.fetch_log USING btree (listing_id, source_id, requested_at DESC);


--
-- Name: fetch_log_refused_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fetch_log_refused_idx ON public.fetch_log USING btree (source_id, requested_at DESC) WHERE (outcome = ANY (ARRAY['blocked'::text, 'rate_limited'::text, 'challenge'::text]));


--
-- Name: fetch_log_snapshot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fetch_log_snapshot_idx ON public.fetch_log USING btree (snapshot_id, listing_id);


--
-- Name: fetch_log_source_requested_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fetch_log_source_requested_idx ON public.fetch_log USING btree (source_id, requested_at DESC);


--
-- Name: job_state_change_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_state_change_account_idx ON public.job_state_change USING btree (changed_by_account_id);


--
-- Name: job_state_change_changed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_state_change_changed_idx ON public.job_state_change USING btree (changed_at DESC, id DESC);


--
-- Name: listing_active_model_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listing_active_model_idx ON public.listing USING btree (source_id, source_model_key) WHERE (status = 'active'::text);


--
-- Name: listing_price_event_fetch_log_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listing_price_event_fetch_log_idx ON public.listing_price_event USING btree (fetch_log_id, listing_id);


--
-- Name: listing_price_event_snapshot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listing_price_event_snapshot_idx ON public.listing_price_event USING btree (snapshot_id, listing_id);


--
-- Name: listing_recheck_request_listing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listing_recheck_request_listing_idx ON public.listing_recheck_request USING btree (listing_id, requested_at);


--
-- Name: listing_recheck_request_pending_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX listing_recheck_request_pending_unique ON public.listing_recheck_request USING btree (listing_id) WHERE (handled_at IS NULL);


--
-- Name: listing_source_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listing_source_model_id_idx ON public.listing USING btree (source_id, model_id);


--
-- Name: listing_valuation_comparable_comparable_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listing_valuation_comparable_comparable_idx ON public.listing_valuation_comparable USING btree (valuation_run_id, comparable_listing_id);


--
-- Name: listing_valuation_listing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX listing_valuation_listing_idx ON public.listing_valuation USING btree (listing_id);


--
-- Name: model_spend_snapshot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_spend_snapshot_idx ON public.model_spend USING btree (snapshot_id, prompt_version);


--
-- Name: model_spend_task_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_spend_task_created_idx ON public.model_spend USING btree (task, created_at) INCLUDE (cost_usd_micros);


--
-- Name: notification_inbox_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_inbox_idx ON public.notification USING btree (account_id, created_at DESC, id DESC);


--
-- Name: notification_listing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_listing_idx ON public.notification USING btree (listing_id);


--
-- Name: review_item_extraction_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX review_item_extraction_idx ON public.review_item USING btree (extraction_id, field);


--
-- Name: review_item_open_subject_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX review_item_open_subject_unique ON public.review_item USING btree (extraction_id, field, kind, snapshot_id, prompt_version) NULLS NOT DISTINCT WHERE (status = 'open'::text);


--
-- Name: review_item_snapshot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX review_item_snapshot_idx ON public.review_item USING btree (snapshot_id);


--
-- Name: source_policy_check_source_latest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX source_policy_check_source_latest_idx ON public.source_policy_check USING btree (source_id, checked_at DESC, id DESC);


--
-- Name: source_state_change_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX source_state_change_account_idx ON public.source_state_change USING btree (changed_by_account_id);


--
-- Name: source_state_change_source_changed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX source_state_change_source_changed_idx ON public.source_state_change USING btree (source_id, changed_at DESC, id DESC);


--
-- Name: valuation_comparable_listing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX valuation_comparable_listing_idx ON public.valuation_comparable USING btree (listing_id);


--
-- Name: valuation_comparable_segment_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX valuation_comparable_segment_year_idx ON public.valuation_comparable USING btree (valuation_run_id, model_id, model_year_sh) INCLUDE (is_outlier);


--
-- Name: valuation_run_succeeded_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX valuation_run_succeeded_unique ON public.valuation_run USING btree (as_of_date, method_version) WHERE (status = 'succeeded'::text);


--
-- Name: job_common_pkey; Type: INDEX ATTACH; Schema: pgboss; Owner: -
--

ALTER INDEX pgboss.job_pkey ATTACH PARTITION pgboss.job_common_pkey;


--
-- Name: account_role_change account_role_change_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER account_role_change_append_only BEFORE DELETE OR UPDATE ON public.account_role_change FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: account_role_change account_role_change_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER account_role_change_append_only_truncate BEFORE TRUNCATE ON public.account_role_change FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: ai_answer ai_answer_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_answer_append_only BEFORE DELETE OR UPDATE ON public.ai_answer FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: ai_answer ai_answer_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_answer_append_only_truncate BEFORE TRUNCATE ON public.ai_answer FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: crawl_run crawl_run_history_fixed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER crawl_run_history_fixed BEFORE UPDATE ON public.crawl_run FOR EACH ROW EXECUTE FUNCTION public.crawl_run_history_fixed();


--
-- Name: crawl_run crawl_run_policy_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER crawl_run_policy_guard AFTER INSERT ON public.crawl_run FOR EACH ROW EXECUTE FUNCTION public.crawl_run_policy_guard();


--
-- Name: extraction extraction_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER extraction_append_only BEFORE DELETE OR UPDATE ON public.extraction FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: extraction extraction_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER extraction_append_only_truncate BEFORE TRUNCATE ON public.extraction FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: extraction_field extraction_field_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER extraction_field_append_only BEFORE DELETE OR UPDATE ON public.extraction_field FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: extraction_field extraction_field_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER extraction_field_append_only_truncate BEFORE TRUNCATE ON public.extraction_field FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


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
-- Name: freshness_measurement freshness_measurement_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER freshness_measurement_append_only BEFORE DELETE OR UPDATE ON public.freshness_measurement FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: freshness_measurement freshness_measurement_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER freshness_measurement_append_only_truncate BEFORE TRUNCATE ON public.freshness_measurement FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: job_state_change job_state_change_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER job_state_change_append_only BEFORE DELETE OR UPDATE ON public.job_state_change FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: job_state_change job_state_change_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER job_state_change_append_only_truncate BEFORE TRUNCATE ON public.job_state_change FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


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
-- Name: model_spend model_spend_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER model_spend_append_only BEFORE DELETE OR UPDATE ON public.model_spend FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: model_spend model_spend_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER model_spend_append_only_truncate BEFORE TRUNCATE ON public.model_spend FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


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
-- Name: source_state_change source_state_change_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER source_state_change_append_only BEFORE DELETE OR UPDATE ON public.source_state_change FOR EACH ROW EXECUTE FUNCTION public.refuse_change_unless_purge();


--
-- Name: source_state_change source_state_change_append_only_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER source_state_change_append_only_truncate BEFORE TRUNCATE ON public.source_state_change FOR EACH STATEMENT EXECUTE FUNCTION public.refuse_change_unless_purge();


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
-- Name: account_role_change account_role_change_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_role_change
    ADD CONSTRAINT account_role_change_account_fk FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_session account_session_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_session
    ADD CONSTRAINT account_session_account_fk FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: catalogue_alias catalogue_alias_make_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_alias
    ADD CONSTRAINT catalogue_alias_make_fk FOREIGN KEY (make_id) REFERENCES public.make(id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT catalogue_alias_make_fk ON catalogue_alias; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT catalogue_alias_make_fk ON public.catalogue_alias IS 'unindexed: the unique key catalogue_alias_unique leads with make_id.';


--
-- Name: catalogue_alias catalogue_alias_model_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_alias
    ADD CONSTRAINT catalogue_alias_model_fk FOREIGN KEY (model_id) REFERENCES public.model(id) ON DELETE RESTRICT;


--
-- Name: catalogue_alias catalogue_alias_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_alias
    ADD CONSTRAINT catalogue_alias_source_fk FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT catalogue_alias_source_fk ON catalogue_alias; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT catalogue_alias_source_fk ON public.catalogue_alias IS 'unindexed: sources are never deleted while they have rows (RESTRICT), and aliases are not looked up by source.';


--
-- Name: catalogue_alias catalogue_alias_trim_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_alias
    ADD CONSTRAINT catalogue_alias_trim_fk FOREIGN KEY (trim_id) REFERENCES public."trim"(id) ON DELETE RESTRICT;


--
-- Name: catalogue_source_key catalogue_source_key_make_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_source_key
    ADD CONSTRAINT catalogue_source_key_make_fk FOREIGN KEY (make_id) REFERENCES public.make(id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT catalogue_source_key_make_fk ON catalogue_source_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT catalogue_source_key_make_fk ON public.catalogue_source_key IS 'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); lookups go by the primary key.';


--
-- Name: catalogue_source_key catalogue_source_key_model_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_source_key
    ADD CONSTRAINT catalogue_source_key_model_fk FOREIGN KEY (model_id, make_id) REFERENCES public.model(id, make_id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT catalogue_source_key_model_fk ON catalogue_source_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT catalogue_source_key_model_fk ON public.catalogue_source_key IS 'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); lookups go by the primary key.';


--
-- Name: catalogue_source_key catalogue_source_key_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_source_key
    ADD CONSTRAINT catalogue_source_key_source_fk FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE RESTRICT;


--
-- Name: catalogue_source_key catalogue_source_key_trim_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogue_source_key
    ADD CONSTRAINT catalogue_source_key_trim_fk FOREIGN KEY (trim_id, model_id) REFERENCES public."trim"(id, model_id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT catalogue_source_key_trim_fk ON catalogue_source_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT catalogue_source_key_trim_fk ON public.catalogue_source_key IS 'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); lookups go by the primary key.';


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
-- Name: extraction extraction_ai_answer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction
    ADD CONSTRAINT extraction_ai_answer_fk FOREIGN KEY (ai_answer_id) REFERENCES public.ai_answer(id) ON DELETE RESTRICT;


--
-- Name: extraction_field extraction_field_def_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_field
    ADD CONSTRAINT extraction_field_def_fk FOREIGN KEY (field) REFERENCES public.extraction_field_def(code) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT extraction_field_def_fk ON extraction_field; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT extraction_field_def_fk ON public.extraction_field IS 'unindexed: field definitions are a curated list of a dozen codes that are never deleted.';


--
-- Name: extraction_field extraction_field_extraction_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_field
    ADD CONSTRAINT extraction_field_extraction_fk FOREIGN KEY (extraction_id) REFERENCES public.extraction(id) ON DELETE CASCADE;


--
-- Name: extraction extraction_snapshot_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction
    ADD CONSTRAINT extraction_snapshot_fk FOREIGN KEY (snapshot_id, listing_id) REFERENCES public.snapshot(id, listing_id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT extraction_snapshot_fk ON extraction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT extraction_snapshot_fk ON public.extraction IS 'unindexed: extraction_snapshot_answer_unique starts with snapshot_id, which is the snapshot''s own key.';


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
-- Name: freshness_measurement freshness_measurement_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freshness_measurement
    ADD CONSTRAINT freshness_measurement_source_fk FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE RESTRICT;


--
-- Name: job_state_change job_state_change_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_state_change
    ADD CONSTRAINT job_state_change_account_fk FOREIGN KEY (changed_by_account_id) REFERENCES public.account(id) ON DELETE RESTRICT;


--
-- Name: listing listing_city_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_city_fk FOREIGN KEY (city_id) REFERENCES public.city(id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT listing_city_fk ON listing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT listing_city_fk ON public.listing IS 'unindexed: cities are never deleted; filtering goes through CS-59''s search table.';


--
-- Name: listing listing_colour_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_colour_fk FOREIGN KEY (colour) REFERENCES public.colour(code) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT listing_colour_fk ON listing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT listing_colour_fk ON public.listing IS 'unindexed: colour is a code table that is never deleted from.';


--
-- Name: listing listing_make_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_make_fk FOREIGN KEY (make_id) REFERENCES public.make(id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT listing_make_fk ON listing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT listing_make_fk ON public.listing IS 'unindexed: catalogue rows are curated and never deleted (RESTRICT); searching by make goes through CS-59''s search table.';


--
-- Name: listing listing_model_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_model_fk FOREIGN KEY (model_id, make_id) REFERENCES public.model(id, make_id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT listing_model_fk ON listing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT listing_model_fk ON public.listing IS 'unindexed: catalogue rows are curated and never deleted (RESTRICT); comparables and search go through CS-51''s and CS-59''s own tables and indexes.';


--
-- Name: listing_photo listing_photo_listing_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_photo
    ADD CONSTRAINT listing_photo_listing_fk FOREIGN KEY (listing_id) REFERENCES public.listing(id) ON DELETE CASCADE;


--
-- Name: listing_price_event listing_price_event_fetch_log_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_price_event
    ADD CONSTRAINT listing_price_event_fetch_log_fk FOREIGN KEY (fetch_log_id) REFERENCES public.fetch_log(id) ON DELETE CASCADE;


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
-- Name: listing_recheck_request listing_recheck_request_listing_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_recheck_request
    ADD CONSTRAINT listing_recheck_request_listing_fk FOREIGN KEY (listing_id) REFERENCES public.listing(id) ON DELETE CASCADE;


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
-- Name: listing listing_trim_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing
    ADD CONSTRAINT listing_trim_fk FOREIGN KEY (trim_id, model_id) REFERENCES public."trim"(id, model_id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT listing_trim_fk ON listing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT listing_trim_fk ON public.listing IS 'unindexed: catalogue rows are curated and never deleted (RESTRICT); comparables and search go through CS-51''s and CS-59''s own tables and indexes.';


--
-- Name: listing_unparsed_value listing_unparsed_value_listing_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_unparsed_value
    ADD CONSTRAINT listing_unparsed_value_listing_fk FOREIGN KEY (listing_id) REFERENCES public.listing(id) ON DELETE CASCADE;


--
-- Name: listing_valuation_comparable listing_valuation_comparable_comparable_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_valuation_comparable
    ADD CONSTRAINT listing_valuation_comparable_comparable_fk FOREIGN KEY (valuation_run_id, comparable_listing_id) REFERENCES public.valuation_comparable(valuation_run_id, listing_id) ON DELETE CASCADE;


--
-- Name: listing_valuation_comparable listing_valuation_comparable_valuation_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_valuation_comparable
    ADD CONSTRAINT listing_valuation_comparable_valuation_fk FOREIGN KEY (valuation_run_id, listing_id) REFERENCES public.listing_valuation(valuation_run_id, listing_id) ON DELETE CASCADE;


--
-- Name: listing_valuation listing_valuation_listing_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_valuation
    ADD CONSTRAINT listing_valuation_listing_fk FOREIGN KEY (listing_id) REFERENCES public.listing(id) ON DELETE CASCADE;


--
-- Name: listing_valuation listing_valuation_run_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_valuation
    ADD CONSTRAINT listing_valuation_run_fk FOREIGN KEY (valuation_run_id) REFERENCES public.valuation_run(id) ON DELETE CASCADE;


--
-- Name: model model_body_type_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_body_type_fk FOREIGN KEY (body_type) REFERENCES public.body_type(code) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT model_body_type_fk ON model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT model_body_type_fk ON public.model IS 'unindexed: body_type is a code table of a dozen rows that is never deleted from; filters read model by body type through search tables (CS-59).';


--
-- Name: model model_make_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_make_fk FOREIGN KEY (make_id) REFERENCES public.make(id) ON DELETE RESTRICT;


--
-- Name: model_spend model_spend_snapshot_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_spend
    ADD CONSTRAINT model_spend_snapshot_fk FOREIGN KEY (snapshot_id) REFERENCES public.snapshot(id) ON DELETE CASCADE;


--
-- Name: model_volume model_volume_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_volume
    ADD CONSTRAINT model_volume_source_fk FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE RESTRICT;


--
-- Name: notification notification_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_account_fk FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: notification notification_kind_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_kind_fk FOREIGN KEY (kind) REFERENCES public.notification_kind(id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT notification_kind_fk ON notification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT notification_kind_fk ON public.notification IS 'unindexed: kinds are a handful of curated rows, removed only by a migration that first deletes their notifications.';


--
-- Name: notification notification_listing_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_listing_fk FOREIGN KEY (listing_id) REFERENCES public.listing(id) ON DELETE CASCADE;


--
-- Name: notification_mute notification_mute_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_mute
    ADD CONSTRAINT notification_mute_account_fk FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: notification_mute notification_mute_kind_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_mute
    ADD CONSTRAINT notification_mute_kind_fk FOREIGN KEY (kind) REFERENCES public.notification_kind(id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT notification_mute_kind_fk ON notification_mute; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT notification_mute_kind_fk ON public.notification_mute IS 'unindexed: kinds are a handful of curated rows, removed only by a migration that first deletes their mutes.';


--
-- Name: review_item review_item_extraction_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_item
    ADD CONSTRAINT review_item_extraction_fk FOREIGN KEY (extraction_id) REFERENCES public.extraction(id) ON DELETE CASCADE;


--
-- Name: review_item review_item_field_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_item
    ADD CONSTRAINT review_item_field_fk FOREIGN KEY (extraction_id, field) REFERENCES public.extraction_field(extraction_id, field) ON DELETE CASCADE;


--
-- Name: review_item review_item_snapshot_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_item
    ADD CONSTRAINT review_item_snapshot_fk FOREIGN KEY (snapshot_id) REFERENCES public.snapshot(id) ON DELETE CASCADE;


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
-- Name: source_state_change source_state_change_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_state_change
    ADD CONSTRAINT source_state_change_account_fk FOREIGN KEY (changed_by_account_id) REFERENCES public.account(id) ON DELETE RESTRICT;


--
-- Name: source_state_change source_state_change_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_state_change
    ADD CONSTRAINT source_state_change_source_fk FOREIGN KEY (source_id) REFERENCES public.source(id) ON DELETE RESTRICT;


--
-- Name: trim trim_body_type_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."trim"
    ADD CONSTRAINT trim_body_type_fk FOREIGN KEY (body_type) REFERENCES public.body_type(code) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT trim_body_type_fk ON "trim"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT trim_body_type_fk ON public."trim" IS 'unindexed: body_type is a code table of a dozen rows that is never deleted from.';


--
-- Name: trim trim_model_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."trim"
    ADD CONSTRAINT trim_model_fk FOREIGN KEY (model_id) REFERENCES public.model(id) ON DELETE RESTRICT;


--
-- Name: valuation_coefficient valuation_coefficient_model_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_coefficient
    ADD CONSTRAINT valuation_coefficient_model_fk FOREIGN KEY (model_id) REFERENCES public.model(id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT valuation_coefficient_model_fk ON valuation_coefficient; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT valuation_coefficient_model_fk ON public.valuation_coefficient IS 'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); coefficients are read by run.';


--
-- Name: valuation_coefficient valuation_coefficient_run_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_coefficient
    ADD CONSTRAINT valuation_coefficient_run_fk FOREIGN KEY (valuation_run_id) REFERENCES public.valuation_run(id) ON DELETE CASCADE;


--
-- Name: valuation_coefficient valuation_coefficient_trim_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_coefficient
    ADD CONSTRAINT valuation_coefficient_trim_fk FOREIGN KEY (trim_id, model_id) REFERENCES public."trim"(id, model_id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT valuation_coefficient_trim_fk ON valuation_coefficient; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT valuation_coefficient_trim_fk ON public.valuation_coefficient IS 'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); coefficients are read by run.';


--
-- Name: valuation_comparable valuation_comparable_listing_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_comparable
    ADD CONSTRAINT valuation_comparable_listing_fk FOREIGN KEY (listing_id) REFERENCES public.listing(id) ON DELETE CASCADE;


--
-- Name: valuation_comparable valuation_comparable_segment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_comparable
    ADD CONSTRAINT valuation_comparable_segment_fk FOREIGN KEY (valuation_run_id, model_id) REFERENCES public.valuation_segment(valuation_run_id, model_id) ON DELETE CASCADE;


--
-- Name: valuation_segment valuation_segment_model_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_segment
    ADD CONSTRAINT valuation_segment_model_fk FOREIGN KEY (model_id) REFERENCES public.model(id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT valuation_segment_model_fk ON valuation_segment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT valuation_segment_model_fk ON public.valuation_segment IS 'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); segments are read by run.';


--
-- Name: valuation_segment valuation_segment_run_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_segment
    ADD CONSTRAINT valuation_segment_run_fk FOREIGN KEY (valuation_run_id) REFERENCES public.valuation_run(id) ON DELETE CASCADE;


--
-- Name: SCHEMA pgboss; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA pgboss TO carshenas_worker;
GRANT USAGE ON SCHEMA pgboss TO carshenas_readonly;
GRANT USAGE ON SCHEMA pgboss TO carshenas_admin;


--
-- Name: FUNCTION change_job_state(changing_queue text, changing_job_id uuid, seen_state text, chosen_action text, changed_by bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.change_job_state(changing_queue text, changing_job_id uuid, seen_state text, chosen_action text, changed_by bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.change_job_state(changing_queue text, changing_job_id uuid, seen_state text, chosen_action text, changed_by bigint) TO carshenas_admin;


--
-- Name: FUNCTION change_source_state(changing_source_id text, seen_state text, seen_stopped_at timestamp with time zone, new_state text, changed_by bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.change_source_state(changing_source_id text, seen_state text, seen_stopped_at timestamp with time zone, new_state text, changed_by bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.change_source_state(changing_source_id text, seen_state text, seen_stopped_at timestamp with time zone, new_state text, changed_by bigint) TO carshenas_admin;


--
-- Name: FUNCTION crawl_run_policy_guard(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crawl_run_policy_guard() FROM PUBLIC;


--
-- Name: FUNCTION create_notification(for_account_id bigint, of_kind text, for_event_key text, with_payload jsonb, about_listing_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_notification(for_account_id bigint, of_kind text, for_event_key text, with_payload jsonb, about_listing_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_notification(for_account_id bigint, of_kind text, for_event_key text, with_payload jsonb, about_listing_id bigint) TO carshenas_worker;
GRANT ALL ON FUNCTION public.create_notification(for_account_id bigint, of_kind text, for_event_key text, with_payload jsonb, about_listing_id bigint) TO carshenas_admin;


--
-- Name: FUNCTION fa_normalize(value text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fa_normalize(value text) TO carshenas_web;
GRANT ALL ON FUNCTION public.fa_normalize(value text) TO carshenas_worker;


--
-- Name: FUNCTION stop_source(stopping_source_id text, reason text, blocked_request_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stop_source(stopping_source_id text, reason text, blocked_request_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stop_source(stopping_source_id text, reason text, blocked_request_at timestamp with time zone) TO carshenas_worker;


--
-- Name: TABLE colour; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.colour TO carshenas_readonly;
GRANT SELECT ON TABLE public.colour TO carshenas_web;
GRANT SELECT,INSERT,UPDATE ON TABLE public.colour TO carshenas_worker;


--
-- Name: TABLE listing; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing TO carshenas_readonly;
GRANT SELECT ON TABLE public.listing TO carshenas_web;
GRANT SELECT,INSERT,UPDATE ON TABLE public.listing TO carshenas_worker;
GRANT SELECT ON TABLE public.listing TO carshenas_admin;


--
-- Name: TABLE valuation_coefficient; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.valuation_coefficient TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.valuation_coefficient TO carshenas_worker;


--
-- Name: TABLE valuation_comparable; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.valuation_comparable TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.valuation_comparable TO carshenas_worker;


--
-- Name: TABLE valuation_run; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.valuation_run TO carshenas_readonly;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.valuation_run TO carshenas_worker;


--
-- Name: TABLE valuation_segment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.valuation_segment TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.valuation_segment TO carshenas_worker;


--
-- Name: FUNCTION valuation_rate_listing(run_id bigint, rated_listing_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.valuation_rate_listing(run_id bigint, rated_listing_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.valuation_rate_listing(run_id bigint, rated_listing_id bigint) TO carshenas_worker;
GRANT ALL ON FUNCTION public.valuation_rate_listing(run_id bigint, rated_listing_id bigint) TO carshenas_readonly;


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
GRANT SELECT ON TABLE pgboss.job TO carshenas_admin;


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
-- Name: TABLE account; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.account TO carshenas_web;


--
-- Name: COLUMN account.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.account TO carshenas_readonly;
GRANT SELECT(id) ON TABLE public.account TO carshenas_admin;


--
-- Name: COLUMN account.username; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(username) ON TABLE public.account TO carshenas_web;
GRANT SELECT(username) ON TABLE public.account TO carshenas_readonly;
GRANT SELECT(username) ON TABLE public.account TO carshenas_admin;


--
-- Name: COLUMN account.password_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(password_hash),UPDATE(password_hash) ON TABLE public.account TO carshenas_web;


--
-- Name: COLUMN account.role; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(role) ON TABLE public.account TO carshenas_readonly;
GRANT SELECT(role) ON TABLE public.account TO carshenas_admin;


--
-- Name: COLUMN account.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.account TO carshenas_readonly;


--
-- Name: TABLE account_role_change; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.account_role_change TO carshenas_readonly;


--
-- Name: TABLE account_session; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.account_session TO carshenas_readonly;
GRANT SELECT,DELETE ON TABLE public.account_session TO carshenas_web;


--
-- Name: COLUMN account_session.account_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(account_id) ON TABLE public.account_session TO carshenas_web;


--
-- Name: COLUMN account_session.token_sha256; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(token_sha256) ON TABLE public.account_session TO carshenas_web;


--
-- Name: COLUMN account_session.expires_at; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(expires_at) ON TABLE public.account_session TO carshenas_web;


--
-- Name: TABLE ai_answer; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.ai_answer TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.ai_answer TO carshenas_worker;


--
-- Name: TABLE auth_throttle; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.auth_throttle TO carshenas_readonly;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.auth_throttle TO carshenas_web;


--
-- Name: TABLE body_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.body_type TO carshenas_readonly;
GRANT SELECT ON TABLE public.body_type TO carshenas_web;
GRANT SELECT,INSERT,UPDATE ON TABLE public.body_type TO carshenas_worker;


--
-- Name: TABLE catalogue_alias; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.catalogue_alias TO carshenas_readonly;
GRANT SELECT ON TABLE public.catalogue_alias TO carshenas_web;
GRANT SELECT,INSERT ON TABLE public.catalogue_alias TO carshenas_worker;


--
-- Name: TABLE catalogue_source_key; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.catalogue_source_key TO carshenas_readonly;
GRANT SELECT ON TABLE public.catalogue_source_key TO carshenas_web;
GRANT SELECT,INSERT,UPDATE ON TABLE public.catalogue_source_key TO carshenas_worker;
GRANT SELECT ON TABLE public.catalogue_source_key TO carshenas_admin;


--
-- Name: TABLE city; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.city TO carshenas_readonly;
GRANT SELECT ON TABLE public.city TO carshenas_web;
GRANT SELECT,INSERT ON TABLE public.city TO carshenas_worker;


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
GRANT SELECT ON TABLE public.crawl_lane TO carshenas_admin;


--
-- Name: TABLE crawl_run; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.crawl_run TO carshenas_readonly;
GRANT SELECT,INSERT,UPDATE ON TABLE public.crawl_run TO carshenas_worker;
GRANT SELECT ON TABLE public.crawl_run TO carshenas_admin;


--
-- Name: TABLE extraction; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.extraction TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.extraction TO carshenas_worker;


--
-- Name: TABLE extraction_field; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.extraction_field TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.extraction_field TO carshenas_worker;


--
-- Name: TABLE extraction_field_def; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.extraction_field_def TO carshenas_readonly;
GRANT SELECT ON TABLE public.extraction_field_def TO carshenas_worker;


--
-- Name: TABLE fetch_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.fetch_log TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.fetch_log TO carshenas_worker;
GRANT SELECT ON TABLE public.fetch_log TO carshenas_admin;


--
-- Name: TABLE freshness_measurement; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.freshness_measurement TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.freshness_measurement TO carshenas_worker;
GRANT SELECT ON TABLE public.freshness_measurement TO carshenas_web;
GRANT SELECT ON TABLE public.freshness_measurement TO carshenas_admin;


--
-- Name: TABLE job_state_change; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.job_state_change TO carshenas_readonly;
GRANT SELECT ON TABLE public.job_state_change TO carshenas_admin;


--
-- Name: TABLE listing_photo; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing_photo TO carshenas_readonly;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.listing_photo TO carshenas_worker;


--
-- Name: TABLE listing_price_event; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing_price_event TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.listing_price_event TO carshenas_worker;
GRANT SELECT ON TABLE public.listing_price_event TO carshenas_admin;


--
-- Name: TABLE listing_recheck_request; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing_recheck_request TO carshenas_readonly;
GRANT SELECT ON TABLE public.listing_recheck_request TO carshenas_worker;


--
-- Name: COLUMN listing_recheck_request.listing_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(listing_id) ON TABLE public.listing_recheck_request TO carshenas_web;


--
-- Name: COLUMN listing_recheck_request.handled_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(handled_at) ON TABLE public.listing_recheck_request TO carshenas_worker;


--
-- Name: COLUMN listing_recheck_request.outcome; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(outcome) ON TABLE public.listing_recheck_request TO carshenas_worker;


--
-- Name: TABLE listing_status_transition; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing_status_transition TO carshenas_readonly;
GRANT SELECT ON TABLE public.listing_status_transition TO carshenas_worker;


--
-- Name: TABLE listing_unparsed_value; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing_unparsed_value TO carshenas_readonly;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.listing_unparsed_value TO carshenas_worker;
GRANT SELECT ON TABLE public.listing_unparsed_value TO carshenas_admin;


--
-- Name: TABLE listing_valuation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing_valuation TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.listing_valuation TO carshenas_worker;


--
-- Name: TABLE listing_valuation_comparable; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.listing_valuation_comparable TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.listing_valuation_comparable TO carshenas_worker;


--
-- Name: TABLE make; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.make TO carshenas_readonly;
GRANT SELECT ON TABLE public.make TO carshenas_web;
GRANT SELECT,INSERT,UPDATE ON TABLE public.make TO carshenas_worker;


--
-- Name: TABLE model; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.model TO carshenas_readonly;
GRANT SELECT ON TABLE public.model TO carshenas_web;
GRANT SELECT,INSERT,UPDATE ON TABLE public.model TO carshenas_worker;
GRANT SELECT ON TABLE public.model TO carshenas_admin;


--
-- Name: TABLE model_spend; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.model_spend TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.model_spend TO carshenas_worker;


--
-- Name: TABLE model_volume; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.model_volume TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.model_volume TO carshenas_worker;


--
-- Name: TABLE notification; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.notification TO carshenas_readonly;
GRANT SELECT ON TABLE public.notification TO carshenas_web;
GRANT SELECT,DELETE ON TABLE public.notification TO carshenas_worker;


--
-- Name: COLUMN notification.read_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(read_at) ON TABLE public.notification TO carshenas_web;


--
-- Name: TABLE notification_kind; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.notification_kind TO carshenas_readonly;
GRANT SELECT ON TABLE public.notification_kind TO carshenas_web;


--
-- Name: TABLE notification_mute; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.notification_mute TO carshenas_readonly;
GRANT SELECT,DELETE ON TABLE public.notification_mute TO carshenas_web;


--
-- Name: COLUMN notification_mute.account_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(account_id) ON TABLE public.notification_mute TO carshenas_web;


--
-- Name: COLUMN notification_mute.kind; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(kind) ON TABLE public.notification_mute TO carshenas_web;


--
-- Name: TABLE review_item; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.review_item TO carshenas_readonly;
GRANT SELECT,INSERT ON TABLE public.review_item TO carshenas_worker;


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
GRANT SELECT ON TABLE public.source TO carshenas_admin;


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
-- Name: TABLE source_daily_spend; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.source_daily_spend TO carshenas_readonly;


--
-- Name: TABLE source_state_change; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.source_state_change TO carshenas_readonly;
GRANT SELECT ON TABLE public.source_state_change TO carshenas_admin;


--
-- Name: TABLE "trim"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public."trim" TO carshenas_readonly;
GRANT SELECT ON TABLE public."trim" TO carshenas_web;
GRANT SELECT,INSERT,UPDATE ON TABLE public."trim" TO carshenas_worker;


--
-- Name: TABLE worker_heartbeat; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.worker_heartbeat TO carshenas_readonly;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.worker_heartbeat TO carshenas_worker;
GRANT SELECT ON TABLE public.worker_heartbeat TO carshenas_admin;


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
INSERT INTO public.schema_migrations (version) VALUES ('20260929150523');
INSERT INTO public.schema_migrations (version) VALUES ('20260929181603');
INSERT INTO public.schema_migrations (version) VALUES ('20260929183019');
INSERT INTO public.schema_migrations (version) VALUES ('20260930075957');
INSERT INTO public.schema_migrations (version) VALUES ('20260930080113');
INSERT INTO public.schema_migrations (version) VALUES ('20260930080114');
INSERT INTO public.schema_migrations (version) VALUES ('20260930080115');
INSERT INTO public.schema_migrations (version) VALUES ('20260930083111');
INSERT INTO public.schema_migrations (version) VALUES ('20260930083113');
INSERT INTO public.schema_migrations (version) VALUES ('20260930083115');
INSERT INTO public.schema_migrations (version) VALUES ('20260930083116');
INSERT INTO public.schema_migrations (version) VALUES ('20260930083118');
INSERT INTO public.schema_migrations (version) VALUES ('20260930083311');
INSERT INTO public.schema_migrations (version) VALUES ('20260930083313');
INSERT INTO public.schema_migrations (version) VALUES ('20260930090208');
INSERT INTO public.schema_migrations (version) VALUES ('20260930092826');
INSERT INTO public.schema_migrations (version) VALUES ('20260930092827');
INSERT INTO public.schema_migrations (version) VALUES ('20260930093850');
INSERT INTO public.schema_migrations (version) VALUES ('20260930115630');
INSERT INTO public.schema_migrations (version) VALUES ('20260930115631');
INSERT INTO public.schema_migrations (version) VALUES ('20260930115633');
INSERT INTO public.schema_migrations (version) VALUES ('20260930121256');
INSERT INTO public.schema_migrations (version) VALUES ('20260930121257');
INSERT INTO public.schema_migrations (version) VALUES ('20260930131144');
INSERT INTO public.schema_migrations (version) VALUES ('20260930133008');
INSERT INTO public.schema_migrations (version) VALUES ('20260930150616');
INSERT INTO public.schema_migrations (version) VALUES ('20260930154422');
INSERT INTO public.schema_migrations (version) VALUES ('20260930154512');
INSERT INTO public.schema_migrations (version) VALUES ('20260930154513');
INSERT INTO public.schema_migrations (version) VALUES ('20260930154810');
INSERT INTO public.schema_migrations (version) VALUES ('20260930160913');
INSERT INTO public.schema_migrations (version) VALUES ('20260930160924');
INSERT INTO public.schema_migrations (version) VALUES ('20260930190317');
INSERT INTO public.schema_migrations (version) VALUES ('20260930201819');
