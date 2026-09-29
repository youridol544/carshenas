-- migrate:up
-- ADR-0008's backstops that read other rows (CS-33; docs/design/data-model.md, section 3). The crawler keeps these
-- rules in its own code; the database holds them whichever process or person writes:
--   1. A crawl run starts only for an enabled, crawled source, citing that source's newest policy check, which must
--      not say not_allowed and must be no older than the source's policy_max_age_days (ADR-0008 point 1). Its source,
--      policy check, kind and start never change afterwards, and a finished run stays finished, so no run can be
--      pointed at another check or reopened past it.
--   2. A blocked or challenge fetch stops its source through stop_source(), in the transaction that records it
--      (ADR-0008 point 6), and the fetch that stopped its source ends its run as stopped_on_block. A 429 stops nothing
--      here: since ADR-0018 the lane cools down on a first 429 and stops the source on a second within 24 hours.
-- fetch_log refuses no request for its source's or its run's state: a row cannot unsend a request, only hide one that
-- was sent (a source paused while its request was on the wire, a run closed under a slow job). What may be sent is
-- decided before sending: when a run opens (rule 1) and when the lane lets a request start, which it does only while
-- the source is enabled (ADR-0018).
-- The run guard locks the source row it reads, so a person's pause waits for it rather than racing it; it runs as its
-- owner because locking a row needs UPDATE rights on its table, which the worker's role must not have on source. Its
-- search path is pinned and every table name qualified.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION crawl_run_policy_guard() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
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

-- A trigger function is never called directly; revoked all the same, as for every function that runs as its owner.
REVOKE EXECUTE ON FUNCTION crawl_run_policy_guard() FROM PUBLIC;

-- AFTER INSERT: a BEFORE INSERT trigger would also judge a row that an upsert only proposes.
CREATE TRIGGER crawl_run_policy_guard
  AFTER INSERT ON crawl_run
  FOR EACH ROW EXECUTE FUNCTION crawl_run_policy_guard();

CREATE FUNCTION crawl_run_history_fixed() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
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

CREATE TRIGGER crawl_run_history_fixed
  BEFORE UPDATE ON crawl_run
  FOR EACH ROW EXECUTE FUNCTION crawl_run_history_fixed();

CREATE FUNCTION fetch_log_stops_on_block() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
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

CREATE TRIGGER fetch_log_stops_on_block
  AFTER INSERT ON fetch_log
  FOR EACH ROW
  WHEN (NEW.outcome IN ('blocked', 'challenge', 'rate_limited'))
  EXECUTE FUNCTION fetch_log_stops_on_block();

COMMENT ON FUNCTION crawl_run_policy_guard() IS
  'Refuses a crawl run of a source that is not an enabled crawled source (crawl_run_source_enabled), or that does not cite its newest policy check (crawl_run_policy_current), whose verdict must not be not_allowed (crawl_run_policy_allows) and which must be no older than policy_max_age_days (crawl_run_policy_fresh).';
COMMENT ON FUNCTION crawl_run_history_fixed() IS
  'Refuses a change to a crawl run''s id, source, policy check, kind or start (crawl_run_identity_fixed), and to the status or end of a finished run (crawl_run_finished_is_final); its counts may still be written.';
COMMENT ON FUNCTION fetch_log_stops_on_block() IS
  'A blocked or challenge fetch stops its source through stop_source(); the fetch whose requested_at and outcome are its source''s stopped_at and stop_reason ends its run as stopped_on_block (ADR-0008 point 6).';
COMMENT ON COLUMN fetch_log.outcome IS
  'What came back. blocked (401, 403) and challenge stop the source, and so does a second rate_limited (429) within 24 hours (ADR-0008 point 6, ADR-0018); error means no usable answer: a network failure, a timeout, a 5xx, or an answer the crawler could not read.';
COMMENT ON COLUMN source.crawl_state IS
  'enabled or paused by a human; stopped_on_block by the crawler on a 401 or 403, a challenge, or a second 429 within 24 hours (ADR-0008 point 6, ADR-0018), until a human reads the evidence and re-enables it.';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

COMMENT ON COLUMN source.crawl_state IS
  'enabled or paused by a human; stopped_on_block by the crawler on a 403, 429 or challenge (ADR-0008 point 6), until a human reads the evidence and re-enables it.';
COMMENT ON COLUMN fetch_log.outcome IS
  'blocked, rate_limited and challenge stop the source (ADR-0008 point 6); error means no usable response (network failure, timeout).';
DROP TRIGGER fetch_log_stops_on_block ON fetch_log;
DROP FUNCTION fetch_log_stops_on_block();
DROP TRIGGER crawl_run_history_fixed ON crawl_run;
DROP FUNCTION crawl_run_history_fixed();
DROP TRIGGER crawl_run_policy_guard ON crawl_run;
DROP FUNCTION crawl_run_policy_guard();
