-- migrate:up
-- The listing page asks for a stale listing to be read again (CS-64, CS-35), through a public action: anyone can call it for any
-- id. A loop over the ids could queue every listing (about 23,000 on 2026-10-02), and the worker's drain would spend the
-- source's whole daily request budget on them (ADR-0017 point 5). So the request is made by this function, which keeps the
-- one-pending-request-per-listing guard of listing_recheck_request_pending_unique and adds two caps, counted under an
-- advisory lock so they are exact: at most 200 requests waiting (handled_at IS NULL) at once, and at most 120 requests made
-- in the last hour, whatever became of them (queued or fresh). Reasons: Divar's daily budget is 12,000 requests (source.daily_request_budget);
-- 120 an hour is at most 2,880 a day, a quarter of it, and 200 waiting is under two hours of the cap; a buyer opening
-- listings one at a time never reaches either.
-- It answers 'recorded', 'pending' (already asked), 'not_needed' (off the market, fresh within six hours, or no such listing)
-- or 'capped'. SECURITY DEFINER with a fixed search_path, because the web role may insert but not read the requests it
-- counts; it reads and writes nothing else. The six hours are the worker's FRESHNESS_WINDOW_HOURS (ADR-0017 point 3).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION request_listing_recheck(target_listing_id bigint) RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM listing l
    WHERE l.id = target_listing_id AND l.status = 'active'
      AND (l.last_checked_at IS NULL OR l.last_checked_at < now() - interval '6 hours')
  ) THEN
    RETURN 'not_needed';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('request_listing_recheck'));
  IF EXISTS (SELECT FROM listing_recheck_request r WHERE r.listing_id = target_listing_id AND r.handled_at IS NULL) THEN
    RETURN 'pending';
  END IF;
  IF (SELECT count(*) FROM listing_recheck_request r WHERE r.handled_at IS NULL) >= 200
    OR (SELECT count(*) FROM listing_recheck_request r WHERE r.requested_at > now() - interval '1 hour') >= 120 THEN
    RETURN 'capped';
  END IF;
  INSERT INTO listing_recheck_request (listing_id) VALUES (target_listing_id) ON CONFLICT DO NOTHING;
  RETURN 'recorded';
END
$$;

COMMENT ON FUNCTION request_listing_recheck(bigint) IS 'A buyer''s request to read a stale, active listing again (CS-64): one pending request per listing, at most 200 waiting and 120 made in an hour. Returns recorded, pending, not_needed or capped.';

REVOKE ALL ON FUNCTION request_listing_recheck(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_listing_recheck(bigint) TO carshenas_web;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION request_listing_recheck(bigint);
