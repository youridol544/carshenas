-- migrate:up
-- What is read in depth, as one view, and the superadmin's decision on a crawl request (CS-71, ADR-0033, ADR-0023).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- The catalogue scopes Carshenas reads in depth now: the models of the source's latest freshness measurement, each
-- through the catalogue key that names it (until CS-53 keeps a tracked_model table; its migration replaces this view's
-- body, so the pages that ask "is this model read in depth?" do not change). A key at model or trim level names its
-- model; a trim is read in depth only where its key names that trim.
CREATE VIEW tracked_model_scope AS
SELECT DISTINCT k.model_id, k.trim_id
FROM freshness_measurement m
JOIN catalogue_source_key k ON k.source_id = m.source_id AND k.source_model_key = m.source_model_key
WHERE m.source_model_key IS NOT NULL
  AND k.model_id IS NOT NULL
  AND m.measured_at = (SELECT max(latest.measured_at) FROM freshness_measurement latest
                       WHERE latest.source_id = m.source_id);

COMMENT ON VIEW tracked_model_scope IS
  'The catalogue models (and trims) read in depth now: the keys of each source''s latest freshness measurement, through catalogue_source_key (CS-71; CS-53 replaces the body with its tracked_model table). trim_id is NULL for a whole model.';

GRANT SELECT ON tracked_model_scope TO carshenas_web, carshenas_admin, carshenas_worker;

INSERT INTO notification_kind (id, description) VALUES
  ('crawl_request_decided', 'The superadmin approved or declined a crawl request a buyer''s search file raised: one per request and decision, to each buyer who asked (CS-71).');

-- Approve or decline a request for a superadmin, and record it: the section's role cannot write crawl_request; it calls
-- this function, which checks that the account is a superadmin, locks the request, compares it with the state the
-- person saw, changes it and appends the decision, in one transaction. Approved and declined may follow each other (a
-- declined request is reconsidered when capacity allows); a fulfilled request, which the crawl has read, is no one's to
-- change. The caller notifies the buyers in the same transaction when the answer is 'changed'.
CREATE FUNCTION decide_crawl_request(
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

COMMENT ON FUNCTION decide_crawl_request(bigint, text, text, text, bigint) IS
  'Approves or declines a crawl request for a superadmin (CS-71, ADR-0023) and records it in crawl_request_decision: changed; unchanged when the request already is in the chosen state; stale, changing nothing, when the request is gone, fulfilled, or no longer in the state the person saw. A decline needs its reason (crawl_request_decline_reason_format). Refuses any account but a superadmin (crawl_request_decision_by_superadmin) and any choice but approved or declined (crawl_request_decision_valid).';

REVOKE EXECUTE ON FUNCTION decide_crawl_request(bigint, text, text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decide_crawl_request(bigint, text, text, text, bigint) TO carshenas_admin;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION decide_crawl_request(bigint, text, text, text, bigint);
DELETE FROM notification WHERE kind = 'crawl_request_decided';
DELETE FROM notification_mute WHERE kind = 'crawl_request_decided';
DELETE FROM notification_kind WHERE id = 'crawl_request_decided';
DROP VIEW tracked_model_scope;
