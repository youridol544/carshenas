-- migrate:up
-- ADR-0008's backstops that read other rows (CS-33; docs/design/data-model.md, section 3). The crawler keeps these
-- rules in its own code; the database refuses what slips past it, whichever process or person writes:
--   1. A crawl run starts only for an enabled, crawled source, citing that source's newest policy check, which must
--      not say not_allowed and must be no older than the source's policy_max_age_days (ADR-0008 point 1).
--   2. A fetch is logged only while its run is running and its source enabled, or when it is the very request that
--      stopped its source (its requested_at is the source's stopped_at): that request is the stop's evidence.
--   3. A blocked or challenge fetch stops its source through stop_source() and closes its run, in the transaction
--      that records it (ADR-0008 point 6). A 429 stops nothing here: since ADR-0018 the lane cools down on a first 429
--      and stops the source on a second within 24 hours, and the fetch that did so then closes its run.
-- Both functions judge rows after they are inserted (a BEFORE INSERT trigger would also judge rows an upsert only
-- proposes) and lock the source row they read, so a person's pause waits for them rather than racing them. They run
-- as their owner, because locking a row needs UPDATE rights on its table, which the worker's role must not have on
-- source; their search path is pinned and every table name qualified.
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

CREATE TRIGGER crawl_run_policy_guard
  AFTER INSERT ON crawl_run
  FOR EACH ROW EXECUTE FUNCTION crawl_run_policy_guard();

COMMENT ON FUNCTION crawl_run_policy_guard() IS
  'Refuses a crawl run of a source that is not an enabled crawled source (crawl_run_source_enabled), or that does not cite its newest policy check (crawl_run_policy_current), whose verdict must not be not_allowed (crawl_run_policy_allows) and which must be no older than policy_max_age_days (crawl_run_policy_fresh).';

CREATE FUNCTION fetch_log_crawl_rules() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  run_status text;
  crawled record;
BEGIN
  SELECT r.status INTO run_status
  FROM public.crawl_run r
  WHERE r.id = NEW.crawl_run_id
  FOR SHARE;
  IF run_status IS DISTINCT FROM 'running' THEN
    RAISE EXCEPTION 'crawl run % is %: it logs no more requests', NEW.crawl_run_id, run_status
      USING ERRCODE = 'check_violation', CONSTRAINT = 'fetch_log_run_running', TABLE = TG_TABLE_NAME;
  END IF;
  SELECT s.crawl_state, s.stopped_at INTO crawled
  FROM public.source s
  WHERE s.id = NEW.source_id
  FOR SHARE;
  IF crawled.crawl_state = 'stopped_on_block' AND NEW.requested_at = crawled.stopped_at
     AND NEW.outcome IN ('blocked', 'challenge', 'rate_limited') THEN
    -- The request that stopped the source: its evidence. Its run ends with it.
    UPDATE public.crawl_run
    SET status = 'stopped_on_block', finished_at = greatest(now(), started_at)
    WHERE id = NEW.crawl_run_id;
    RETURN NULL;
  END IF;
  IF crawled.crawl_state <> 'enabled' THEN
    RAISE EXCEPTION 'source % is %: no request to it may be logged (ADR-0008 point 6)', NEW.source_id, crawled.crawl_state
      USING ERRCODE = 'check_violation', CONSTRAINT = 'fetch_log_source_enabled', TABLE = TG_TABLE_NAME;
  END IF;
  IF NEW.outcome IN ('blocked', 'challenge') THEN
    PERFORM public.stop_source(NEW.source_id, NEW.outcome, NEW.requested_at);
    UPDATE public.crawl_run
    SET status = 'stopped_on_block', finished_at = greatest(now(), started_at)
    WHERE id = NEW.crawl_run_id;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER fetch_log_crawl_rules
  AFTER INSERT ON fetch_log
  FOR EACH ROW EXECUTE FUNCTION fetch_log_crawl_rules();

COMMENT ON FUNCTION fetch_log_crawl_rules() IS
  'Refuses a fetch of a run that is not running (fetch_log_run_running) or of a source that is not enabled (fetch_log_source_enabled), except the request that stopped the source; a blocked or challenge fetch stops its source through stop_source() and ends its run as stopped_on_block (ADR-0008 point 6).';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TRIGGER fetch_log_crawl_rules ON fetch_log;
DROP FUNCTION fetch_log_crawl_rules();
DROP TRIGGER crawl_run_policy_guard ON crawl_run;
DROP FUNCTION crawl_run_policy_guard();
