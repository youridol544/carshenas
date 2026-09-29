-- migrate:up
-- A block that answers a request after a person paused its source stops the source too (CS-33, from its database
-- review; ADR-0008 point 6): a request can still be on the wire when its source is paused, and whoever resumes the
-- source must see the block first, as for an enabled one. A stopped source keeps its first stop and its evidence, and
-- a source that is not crawled is never stopped (it may only be paused: source_only_crawled_sources_run).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION stop_source(stopping_source_id text, reason text, blocked_request_at timestamptz)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  WITH stopped AS (
    UPDATE public.source
    SET crawl_state = 'stopped_on_block', stopped_at = blocked_request_at, stop_reason = reason
    WHERE id = stopping_source_id AND access_method = 'crawl' AND crawl_state IN ('enabled', 'paused')
    RETURNING id
  )
  SELECT EXISTS (SELECT FROM stopped)
$$;

COMMENT ON FUNCTION stop_source(text, text, timestamptz) IS
  'Stops a crawled source on a block (ADR-0008 point 6, ADR-0018 point 6), whether it is enabled or was paused while the request was on the wire, recording when the blocked request started and why (blocked, rate_limited, challenge); true when this call stopped it. A stopped source keeps its first stop. Only a human re-enables a source.';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION stop_source(stopping_source_id text, reason text, blocked_request_at timestamptz)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  WITH stopped AS (
    UPDATE public.source
    SET crawl_state = 'stopped_on_block', stopped_at = blocked_request_at, stop_reason = reason
    WHERE id = stopping_source_id AND crawl_state = 'enabled'
    RETURNING id
  )
  SELECT EXISTS (SELECT FROM stopped)
$$;

COMMENT ON FUNCTION stop_source(text, text, timestamptz) IS
  'Stops an enabled source on a block (ADR-0008 point 6, ADR-0018 point 6), recording when the blocked request started and why (blocked, rate_limited, challenge); true when this call stopped it. Only a human re-enables a source.';
