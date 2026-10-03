-- migrate:up
-- How tracked models change (CS-53, ADR-0037, ADR-0023, ADR-0036): the superadmin's one function for tracking, pausing,
-- resuming, re-prioritising and untracking a model; the approval of a crawl request making its model tracked (and the
-- decline of an approved one taking it back); and the worker's function that marks an approved request fulfilled once
-- its model has been read. Every change writes tracked_model_change in the transaction that makes it.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Track, pause, resume, set the priority of, or untrack a model (or one trim of it) for a superadmin. The target is
-- stated, never toggled, so a second press changes nothing: changed; unchanged (already so); missing (no such tracked
-- model); blocked (a model made by an approved request that is not fulfilled yet is taken back by declining the
-- request, which tells its buyers, not by untracking it).
CREATE FUNCTION change_tracked_model(
  changing_model_id bigint,
  changing_trim_id bigint,
  chosen text,
  chosen_priority text,
  changed_by bigint)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  current_row public.tracked_model%ROWTYPE;
  inserted integer;
  request_state text;
  target_state text;
  moment timestamptz := clock_timestamp();
BEGIN
  IF chosen IS NULL OR chosen NOT IN ('track', 'pause', 'resume', 'untrack', 'set_priority') THEN
    RAISE EXCEPTION 'a person may track, pause, resume, untrack or set the priority of a model, not %', chosen
      USING ERRCODE = 'check_violation', CONSTRAINT = 'tracked_model_change_action_valid',
        TABLE = 'tracked_model_change';
  END IF;
  IF chosen IN ('track', 'set_priority') AND (chosen_priority IS NULL OR chosen_priority NOT IN ('high', 'normal', 'low'))
     AND NOT (chosen = 'track' AND chosen_priority IS NULL) THEN
    RAISE EXCEPTION 'priority % is not high, normal or low', chosen_priority
      USING ERRCODE = 'check_violation', CONSTRAINT = 'tracked_model_priority_valid', TABLE = 'tracked_model';
  END IF;
  PERFORM FROM public.account a WHERE a.id = changed_by AND a.role = 'superadmin' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account % is not a superadmin: only a superadmin changes the tracked models', changed_by
      USING ERRCODE = 'check_violation', CONSTRAINT = 'tracked_model_change_by_superadmin',
        TABLE = 'tracked_model_change';
  END IF;

  IF chosen = 'track' THEN
    INSERT INTO public.tracked_model (model_id, trim_id, priority, origin, created_by_account_id,
                                      updated_by_account_id, created_at, updated_at)
    VALUES (changing_model_id, changing_trim_id, coalesce(chosen_priority, 'normal'), 'superadmin', changed_by,
            changed_by, moment, moment)
    ON CONFLICT ON CONSTRAINT tracked_model_once_per_scope_unique DO NOTHING;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    IF inserted = 0 THEN
      RETURN 'unchanged';
    END IF;
    INSERT INTO public.tracked_model_change (model_id, trim_id, action, to_value, by_account_id, changed_at)
    VALUES (changing_model_id, changing_trim_id, 'tracked', coalesce(chosen_priority, 'normal'), changed_by, moment);
    RETURN 'changed';
  END IF;

  SELECT * INTO current_row FROM public.tracked_model t
  WHERE t.model_id = changing_model_id AND t.trim_id IS NOT DISTINCT FROM changing_trim_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;

  IF chosen = 'pause' OR chosen = 'resume' THEN
    target_state := CASE WHEN chosen = 'pause' THEN 'paused' ELSE 'tracking' END;
    IF current_row.state = target_state THEN
      RETURN 'unchanged';
    END IF;
    UPDATE public.tracked_model
    SET state = target_state,
        updated_at = greatest(moment, created_at), updated_by_account_id = changed_by
    WHERE id = current_row.id;
    INSERT INTO public.tracked_model_change (model_id, trim_id, action, from_value, to_value, by_account_id, changed_at)
    VALUES (changing_model_id, changing_trim_id, CASE WHEN chosen = 'pause' THEN 'paused' ELSE 'resumed' END,
            current_row.state, target_state, changed_by, moment);
    RETURN 'changed';
  END IF;

  IF chosen = 'set_priority' THEN
    IF current_row.priority = chosen_priority THEN
      RETURN 'unchanged';
    END IF;
    UPDATE public.tracked_model
    SET priority = chosen_priority, updated_at = greatest(moment, created_at), updated_by_account_id = changed_by
    WHERE id = current_row.id;
    INSERT INTO public.tracked_model_change (model_id, trim_id, action, from_value, to_value, by_account_id, changed_at)
    VALUES (changing_model_id, changing_trim_id, 'priority_changed', current_row.priority, chosen_priority,
            changed_by, moment);
    RETURN 'changed';
  END IF;

  -- untrack
  IF current_row.crawl_request_id IS NOT NULL THEN
    SELECT r.state INTO request_state FROM public.crawl_request r WHERE r.id = current_row.crawl_request_id;
    IF request_state = 'approved' THEN
      RETURN 'blocked';
    END IF;
  END IF;
  DELETE FROM public.tracked_model WHERE id = current_row.id;
  INSERT INTO public.tracked_model_change (model_id, trim_id, action, from_value, by_account_id, crawl_request_id,
                                           changed_at)
  VALUES (changing_model_id, changing_trim_id, 'untracked', current_row.state, changed_by,
          current_row.crawl_request_id, moment);
  RETURN 'changed';
END
$$;

COMMENT ON FUNCTION change_tracked_model(bigint, bigint, text, text, bigint) IS
  'Tracks, pauses, resumes, re-prioritises or untracks a model (or one trim) for a superadmin (CS-53, ADR-0023) and records it in tracked_model_change: changed; unchanged when it already is so; missing when no such tracked model exists; blocked when the model came from an approved crawl request that is not fulfilled yet (declining the request takes it back). Refuses any account but a superadmin (tracked_model_change_by_superadmin), any action not listed (tracked_model_change_action_valid) and any priority but high, normal or low (tracked_model_priority_valid). An unknown model or trim fails its foreign key.';

REVOKE EXECUTE ON FUNCTION change_tracked_model(bigint, bigint, text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION change_tracked_model(bigint, bigint, text, text, bigint) TO carshenas_admin;

-- An approval makes its model tracked, in the same transaction (ADR-0037): a new row of origin request, or a paused
-- row resumed; a model already tracked is left as it is (the request is then fulfilled when its listings are read).
CREATE FUNCTION track_for_approved_request(approved_request_id bigint, approved_by bigint, approved_at timestamptz)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  scope_model bigint;
  scope_trim bigint;
  inserted integer;
  resumed integer;
BEGIN
  SELECT r.model_id, r.trim_id INTO scope_model, scope_trim FROM public.crawl_request r WHERE r.id = approved_request_id;
  INSERT INTO public.tracked_model (model_id, trim_id, origin, created_by_account_id, crawl_request_id,
                                    updated_by_account_id, created_at, updated_at)
  VALUES (scope_model, scope_trim, 'request', approved_by, approved_request_id, approved_by, approved_at, approved_at)
  ON CONFLICT ON CONSTRAINT tracked_model_once_per_scope_unique DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 1 THEN
    INSERT INTO public.tracked_model_change (model_id, trim_id, action, to_value, by_account_id, crawl_request_id,
                                             changed_at)
    VALUES (scope_model, scope_trim, 'from_request', 'normal', approved_by, approved_request_id, approved_at);
    RETURN;
  END IF;
  UPDATE public.tracked_model t
  SET state = 'tracking', updated_at = greatest(approved_at, t.created_at), updated_by_account_id = approved_by
  WHERE t.model_id = scope_model AND t.trim_id IS NOT DISTINCT FROM scope_trim AND t.state = 'paused';
  GET DIAGNOSTICS resumed = ROW_COUNT;
  IF resumed = 1 THEN
    INSERT INTO public.tracked_model_change (model_id, trim_id, action, from_value, to_value, by_account_id,
                                             crawl_request_id, changed_at)
    VALUES (scope_model, scope_trim, 'resumed', 'paused', 'tracking', approved_by, approved_request_id, approved_at);
  END IF;
END
$$;

COMMENT ON FUNCTION track_for_approved_request(bigint, bigint, timestamptz) IS
  'Called by decide_crawl_request() when it approves a request (ADR-0037): the request''s model becomes tracked (origin request), or a paused one is resumed. Granted to no role.';
REVOKE EXECUTE ON FUNCTION track_for_approved_request(bigint, bigint, timestamptz) FROM PUBLIC;

-- The decision on a crawl request now also moves the model: an approval tracks it, and declining an approved request
-- takes back the model that approval made (a fulfilled request, which the crawl has read, is no one's to change).
CREATE OR REPLACE FUNCTION decide_crawl_request(
  deciding_request_id bigint,
  seen_state text,
  chosen text,
  because text,
  decided_by bigint)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  current_state text;
  moment timestamptz := clock_timestamp();
  withdrawn record;
BEGIN
  IF chosen IS NULL OR chosen NOT IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'a person may only approve or decline a crawl request, not %', chosen
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_request_decision_valid', TABLE = 'crawl_request_decision';
  END IF;
  PERFORM FROM public.account a WHERE a.id = decided_by AND a.role = 'superadmin' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account % is not a superadmin: only a superadmin decides a crawl request', decided_by
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_request_decision_by_superadmin',
        TABLE = 'crawl_request_decision';
  END IF;
  SELECT r.state INTO current_state FROM public.crawl_request r WHERE r.id = deciding_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;
  IF current_state = chosen THEN
    RETURN 'unchanged';
  END IF;
  IF current_state IS DISTINCT FROM seen_state OR current_state = 'fulfilled' THEN
    RETURN 'stale';
  END IF;
  UPDATE public.crawl_request
  SET state = chosen, decided_by_account_id = decided_by, decided_at = moment,
      decline_reason = CASE WHEN chosen = 'declined' THEN because END
  WHERE id = deciding_request_id;
  INSERT INTO public.crawl_request_decision (crawl_request_id, decision, from_state, reason, decided_by_account_id,
                                             decided_at)
  VALUES (deciding_request_id, chosen, current_state, CASE WHEN chosen = 'declined' THEN because END, decided_by,
          moment);
  IF chosen = 'approved' THEN
    PERFORM public.track_for_approved_request(deciding_request_id, decided_by, moment);
  ELSE
    -- Only an approved request has a model of its own to take back; a declined or pending one has none.
    DELETE FROM public.tracked_model t WHERE t.crawl_request_id = deciding_request_id
      RETURNING t.model_id, t.trim_id INTO withdrawn;
    IF FOUND THEN
      INSERT INTO public.tracked_model_change (model_id, trim_id, action, by_account_id, crawl_request_id, changed_at)
      VALUES (withdrawn.model_id, withdrawn.trim_id, 'request_withdrawn', decided_by, deciding_request_id, moment);
    END IF;
  END IF;
  RETURN 'changed';
END
$$;

COMMENT ON FUNCTION decide_crawl_request(bigint, text, text, text, bigint) IS
  'Approves or declines a crawl request for a superadmin (CS-71, ADR-0023) and records it in crawl_request_decision: changed; unchanged when the request already is in the chosen state; stale, changing nothing, when the request is gone, fulfilled, or no longer in the state the person saw. An approval makes the request''s model tracked (CS-53, ADR-0037: a new row of origin request, or a paused one resumed), and declining an approved request takes that row back, each recorded in tracked_model_change. A decline needs its reason: without one the table''s own check fails (crawl_request_state_matches_decision), a malformed one fails crawl_request_decline_reason_format. Refuses any account but a superadmin (crawl_request_decision_by_superadmin) and any choice but approved or declined (crawl_request_decision_valid).';

-- The worker marks an approved request fulfilled once the model it asked for is tracked and its listings have been
-- read (a listing of the scope whose own page was read): CS-71's states end here. Returns how many it fulfilled.
CREATE FUNCTION fulfil_crawl_requests() RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  fulfilled integer;
BEGIN
  UPDATE public.crawl_request r
  SET state = 'fulfilled', fulfilled_at = greatest(clock_timestamp(), r.decided_at)
  WHERE r.state = 'approved'
    AND EXISTS (SELECT 1 FROM public.tracked_model t
                WHERE t.state = 'tracking' AND t.model_id = r.model_id
                  AND (t.trim_id IS NULL OR t.trim_id = r.trim_id))
    AND EXISTS (SELECT 1 FROM public.listing l
                WHERE l.model_id = r.model_id AND (r.trim_id IS NULL OR l.trim_id = r.trim_id)
                  AND l.status = 'active' AND l.last_checked_at IS NOT NULL);
  GET DIAGNOSTICS fulfilled = ROW_COUNT;
  RETURN fulfilled;
END
$$;

COMMENT ON FUNCTION fulfil_crawl_requests() IS
  'Sets approved crawl requests fulfilled when a tracked model covers them and an active listing of their scope has had its own page read (CS-53, ADR-0036, ADR-0037); returns how many. Run by the worker''s planning job; no buyer or superadmin path sets fulfilled.';
REVOKE EXECUTE ON FUNCTION fulfil_crawl_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fulfil_crawl_requests() TO carshenas_worker;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION fulfil_crawl_requests();
CREATE OR REPLACE FUNCTION decide_crawl_request(
  deciding_request_id bigint,
  seen_state text,
  chosen text,
  because text,
  decided_by bigint)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  current_state text;
  moment timestamptz := clock_timestamp();
BEGIN
  IF chosen IS NULL OR chosen NOT IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'a person may only approve or decline a crawl request, not %', chosen
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_request_decision_valid', TABLE = 'crawl_request_decision';
  END IF;
  PERFORM FROM public.account a WHERE a.id = decided_by AND a.role = 'superadmin' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account % is not a superadmin: only a superadmin decides a crawl request', decided_by
      USING ERRCODE = 'check_violation', CONSTRAINT = 'crawl_request_decision_by_superadmin',
        TABLE = 'crawl_request_decision';
  END IF;
  SELECT r.state INTO current_state FROM public.crawl_request r WHERE r.id = deciding_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;
  IF current_state = chosen THEN
    RETURN 'unchanged';
  END IF;
  IF current_state IS DISTINCT FROM seen_state OR current_state = 'fulfilled' THEN
    RETURN 'stale';
  END IF;
  UPDATE public.crawl_request
  SET state = chosen, decided_by_account_id = decided_by, decided_at = moment,
      decline_reason = CASE WHEN chosen = 'declined' THEN because END
  WHERE id = deciding_request_id;
  INSERT INTO public.crawl_request_decision (crawl_request_id, decision, from_state, reason, decided_by_account_id,
                                             decided_at)
  VALUES (deciding_request_id, chosen, current_state, CASE WHEN chosen = 'declined' THEN because END, decided_by,
          moment);
  RETURN 'changed';
END
$$;
DROP FUNCTION track_for_approved_request(bigint, bigint, timestamptz);
DROP FUNCTION change_tracked_model(bigint, bigint, text, text, bigint);
