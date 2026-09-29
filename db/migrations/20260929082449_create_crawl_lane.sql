-- migrate:up
-- Each source's lane (ADR-0018 points 3, 5 and 6): the pacing state every request to the source passes through, so
-- that one request at a time is in flight and the next waits its gap, whichever worker process sends it. A worker
-- takes the lease in one statement only while the source is enabled, the lane is not cooling down and its time has
-- come, and records the outcome when it gives the lease back. Operational state, rewritten on every request; the
-- requests themselves are in fetch_log (CS-33). stop_source() is how the worker stops a source on a block, and the
-- only change to a source its role may make.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE crawl_lane (
  source_id       text PRIMARY KEY,
  next_request_at timestamptz NOT NULL DEFAULT now(),
  last_request_at timestamptz,
  lease_holder    text,
  lease_until     timestamptz,
  failure_streak  integer NOT NULL DEFAULT 0,
  cooldowns       integer NOT NULL DEFAULT 0,
  cooldown_until  timestamptz,
  cooldown_reason text
                  CONSTRAINT crawl_lane_cooldown_reason_valid CHECK (cooldown_reason IN ('unavailable', 'rate_limited')),
  rate_limited_at timestamptz,
  CONSTRAINT crawl_lane_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE CASCADE,
  -- A lease names who holds it and until when, or neither: a request in flight is always accounted for.
  CONSTRAINT crawl_lane_lease_complete CHECK ((lease_holder IS NULL) = (lease_until IS NULL)),
  CONSTRAINT crawl_lane_lease_holder_not_blank CHECK (btrim(lease_holder) <> ''),
  CONSTRAINT crawl_lane_failure_streak_nonnegative CHECK (failure_streak >= 0),
  CONSTRAINT crawl_lane_cooldowns_nonnegative CHECK (cooldowns >= 0),
  -- A cool-down says why, and a reason never lingers after it.
  CONSTRAINT crawl_lane_cooldown_explained CHECK ((cooldown_until IS NULL) = (cooldown_reason IS NULL)),
  -- A lease belongs to the request that started it and outlives it only briefly (the request's timeout and a margin,
  -- 45 s today): a mistake in code cannot hold a lane for hours. IS NOT NULL is spelled out, since a CHECK passes on NULL.
  CONSTRAINT crawl_lane_lease_bounded CHECK (
    lease_until IS NULL
    OR (last_request_at IS NOT NULL AND lease_until > last_request_at AND lease_until <= last_request_at + interval '15 minutes'))
);

COMMENT ON TABLE crawl_lane IS
  'Request pacing per source (ADR-0018): when the next request may start, the request in flight, the breaker and the last 429. Written by the worker on every request.';
COMMENT ON COLUMN crawl_lane.next_request_at IS
  'The earliest start of the next request (from the lane''s creation at first): the end of the previous one plus its gap (five times its duration, at least source.min_request_interval_ms, doubled for 24 hours after a 429, at most 30 s unless the interval is longer).';
COMMENT ON COLUMN crawl_lane.last_request_at IS 'When the latest request started.';
COMMENT ON COLUMN crawl_lane.lease_holder IS
  'Who holds the request in flight (worker process and job), or null. A lease that outlives lease_until is free again, so a crashed worker cannot hold the lane.';
COMMENT ON COLUMN crawl_lane.failure_streak IS
  'Timeouts, server errors and dropped connections in a row; three open the breaker (a cool-down). Any other answer resets it.';
COMMENT ON COLUMN crawl_lane.cooldowns IS
  'Cool-downs in a row without a successful request between them; each one lasts about twice the previous, up to an hour.';
COMMENT ON COLUMN crawl_lane.cooldown_until IS
  'The lane sends nothing until then: after three transient failures in a row (unavailable), or after a 429 (rate_limited). The next request after it is the probe.';
COMMENT ON COLUMN crawl_lane.rate_limited_at IS
  'The latest 429. For 24 hours after it the gap is doubled, and another 429 stops the source (ADR-0018 point 6).';

CREATE FUNCTION stop_source(stopping_source_id text, reason text, blocked_request_at timestamptz)
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

REVOKE EXECUTE ON FUNCTION stop_source(text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stop_source(text, text, timestamptz) TO carshenas_worker;
GRANT SELECT, INSERT, UPDATE ON crawl_lane TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION stop_source(text, text, timestamptz);
DROP TABLE crawl_lane;
