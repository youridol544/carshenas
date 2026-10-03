-- migrate:up
-- Review fixes for tracked models (CS-53, ADR-0037): the backfill planner owns its jobs (a table of them, so the old
-- sweep backlog in the lane never starves it, and a listing that keeps failing stops being planned); an approved request
-- is attached to a model that is tracked already and holds it (no pause, no removal) until it is read; declining takes
-- back exactly what the approval did.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- The jobs the planner has sent for listings of tracked models: one row per listing while its job waits, runs or has
-- failed. A job removes its row when its listing is read or no longer needs reading; a job that failed keeps it with the
-- attempts counted, so a listing that fails every time is planned a few times and then left, not every five minutes
-- forever. The table is small (what is in flight plus the failures), so the planner counts its own work here instead of
-- scanning the queue, which also holds the sweeps' older jobs.
CREATE TABLE tracked_backfill (
  listing_id      bigint NOT NULL,
  queued_at       timestamptz NOT NULL DEFAULT now(),
  attempts        smallint NOT NULL DEFAULT 0 CONSTRAINT tracked_backfill_attempts_nonnegative CHECK (attempts >= 0),
  last_attempt_at timestamptz,
  CONSTRAINT tracked_backfill_pkey PRIMARY KEY (listing_id),
  CONSTRAINT tracked_backfill_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE
);

-- The planner counts what is in flight.
CREATE INDEX tracked_backfill_queued_idx ON tracked_backfill (queued_at);

COMMENT ON TABLE tracked_backfill IS
  'The planner''s own backfill jobs (CS-53, ADR-0037): a listing of a tracked model whose details were sent to the lane, from when its job was queued until it read the page or found it need not. attempts counts the runs of its job; the planner does not plan a listing whose attempts reached its cap (4) and plans a stale row (older than two days: its job was lost) again.';
COMMENT ON COLUMN tracked_backfill.attempts IS 'How many times the job started; pg-boss retries a failed job three times, so four means it gave up.';

GRANT SELECT, INSERT, UPDATE, DELETE ON tracked_backfill TO carshenas_worker;
GRANT SELECT ON tracked_backfill TO carshenas_admin, carshenas_readonly;

-- Whether an approved request that is not fulfilled yet is answered by a tracked scope: a whole-model row answers every
-- request on the model, a trim row the requests for that trim.
CREATE OR REPLACE FUNCTION approved_request_covers(scope_model bigint, scope_trim bigint) RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crawl_request r
    WHERE r.state = 'approved' AND r.model_id = scope_model AND (scope_trim IS NULL OR r.trim_id = scope_trim));
$$;

COMMENT ON FUNCTION approved_request_covers(bigint, bigint) IS
  'Whether an approved, not yet fulfilled crawl request is answered by the tracked scope (a whole-model row answers every request on the model, a trim row the requests for that trim): such a scope is neither paused nor removed by hand (ADR-0037). Granted to no role.';
REVOKE EXECUTE ON FUNCTION approved_request_covers(bigint, bigint) FROM PUBLIC;

-- A row may answer a request without having been made by it: the owner's rows take the request they answer.
ALTER TABLE tracked_model DROP CONSTRAINT tracked_model_origin_matches;
ALTER TABLE tracked_model ADD CONSTRAINT tracked_model_origin_matches CHECK (
  CASE origin
    WHEN 'seed' THEN created_by_account_id IS NULL
    WHEN 'superadmin' THEN created_by_account_id IS NOT NULL
    ELSE created_by_account_id IS NOT NULL AND crawl_request_id IS NOT NULL
  END) NOT VALID;

COMMENT ON COLUMN tracked_model.crawl_request_id IS 'The approved crawl request the row answers: the one that made it (origin request), or one an approval attached to a model that was tracked already. NULL when none.';

CREATE OR REPLACE FUNCTION change_tracked_model(
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
    IF chosen = 'pause' AND public.approved_request_covers(current_row.model_id, current_row.trim_id) THEN
      RETURN 'blocked';
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

  -- untrack: not while an approved request that is not read yet covers it (declining the request is how it is taken back).
  IF public.approved_request_covers(current_row.model_id, current_row.trim_id) THEN
    RETURN 'blocked';
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
  'Tracks, pauses, resumes, re-prioritises or untracks a model (or one trim) for a superadmin (CS-53, ADR-0023) and records it in tracked_model_change: changed; unchanged when it already is so; missing when no such tracked model exists; blocked when pausing or removing a scope that an approved crawl request, not read yet, covers (declining the request takes it back). Refuses any account but a superadmin (tracked_model_change_by_superadmin), any action not listed (tracked_model_change_action_valid) and any priority but high, normal or low (tracked_model_priority_valid). An unknown model or trim fails its foreign key.';

CREATE OR REPLACE FUNCTION track_for_approved_request(approved_request_id bigint, approved_by bigint, approved_at timestamptz)
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
  -- A row that is tracked already keeps its own origin and takes the request as the one it answers.
  UPDATE public.tracked_model t
  SET crawl_request_id = approved_request_id
  WHERE t.model_id = scope_model AND t.trim_id IS NOT DISTINCT FROM scope_trim AND t.crawl_request_id IS NULL;
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

-- Declining an approved request takes back what its approval did and nothing else: a row it made is deleted
-- (request_withdrawn), a row it only answered is detached and stays as it was, and a paused row it resumed is paused
-- again, unless another approved request still covers it.
CREATE OR REPLACE FUNCTION withdraw_approved_request(withdrawn_request_id bigint, withdrawn_by bigint, withdrawn_at timestamptz)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  made record;
  resumed record;
BEGIN
  DELETE FROM public.tracked_model t WHERE t.crawl_request_id = withdrawn_request_id AND t.origin = 'request'
    RETURNING t.model_id, t.trim_id INTO made;
  IF FOUND THEN
    INSERT INTO public.tracked_model_change (model_id, trim_id, action, by_account_id, crawl_request_id, changed_at)
    VALUES (made.model_id, made.trim_id, 'request_withdrawn', withdrawn_by, withdrawn_request_id, withdrawn_at);
  END IF;
  UPDATE public.tracked_model t SET crawl_request_id = NULL WHERE t.crawl_request_id = withdrawn_request_id;
  SELECT c.model_id, c.trim_id INTO resumed FROM public.tracked_model_change c
  WHERE c.crawl_request_id = withdrawn_request_id AND c.action = 'resumed' ORDER BY c.id DESC LIMIT 1;
  IF FOUND AND NOT public.approved_request_covers(resumed.model_id, resumed.trim_id) THEN
    UPDATE public.tracked_model t SET state = 'paused', updated_at = greatest(withdrawn_at, t.created_at),
                                      updated_by_account_id = withdrawn_by
    WHERE t.model_id = resumed.model_id AND t.trim_id IS NOT DISTINCT FROM resumed.trim_id AND t.state = 'tracking';
    IF FOUND THEN
      INSERT INTO public.tracked_model_change (model_id, trim_id, action, from_value, to_value, by_account_id,
                                               crawl_request_id, changed_at)
      VALUES (resumed.model_id, resumed.trim_id, 'request_withdrawn', 'tracking', 'paused', withdrawn_by,
              withdrawn_request_id, withdrawn_at);
    END IF;
  END IF;
END
$$;

COMMENT ON FUNCTION withdraw_approved_request(bigint, bigint, timestamptz) IS
  'Called by decide_crawl_request() when it declines an approved request (ADR-0037): deletes the tracked row the approval made, detaches the request from a row it only answered, and pauses again a paused row the approval resumed (unless another approved request covers it). Granted to no role.';
REVOKE EXECUTE ON FUNCTION withdraw_approved_request(bigint, bigint, timestamptz) FROM PUBLIC;

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
  IF chosen = 'approved' THEN
    PERFORM public.track_for_approved_request(deciding_request_id, decided_by, moment);
  ELSE
    PERFORM public.withdraw_approved_request(deciding_request_id, decided_by, moment);
  END IF;
  RETURN 'changed';
END
$$;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- The functions go back to their first versions (migration 20261003110010).
DROP FUNCTION withdraw_approved_request(bigint, bigint, timestamptz);
ALTER TABLE tracked_model DROP CONSTRAINT tracked_model_origin_matches;
UPDATE tracked_model SET crawl_request_id = NULL WHERE origin <> 'request';
ALTER TABLE tracked_model ADD CONSTRAINT tracked_model_origin_matches CHECK (
  CASE origin
    WHEN 'seed' THEN created_by_account_id IS NULL AND crawl_request_id IS NULL
    WHEN 'superadmin' THEN created_by_account_id IS NOT NULL AND crawl_request_id IS NULL
    ELSE created_by_account_id IS NOT NULL AND crawl_request_id IS NOT NULL
  END) NOT VALID;
DROP TABLE tracked_backfill;
