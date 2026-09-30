-- migrate:up
-- One lock order for a crawl run and its source (CS-35, from CS-33's review): opening a run updates the source's
-- running crawl_run rows and then share-locks the source (crawl_run_policy_guard), while a blocked fetch used to stop
-- the source first and update its crawl_run after, the opposite order, so two transactions of one source could
-- deadlock. The lane runs one job of a source at a time, so it has not happened; with sweeps, checks and re-checks all
-- in the lane, the trigger now locks its run's row before it stops the source, as opening does. Otherwise unchanged.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION fetch_log_stops_on_block() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
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


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION fetch_log_stops_on_block() RETURNS trigger
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
