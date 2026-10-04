-- migrate:up
-- A pasted link names its car in its address (CS-115, ADR-0046): Divar's long form is /v/<title>/<token>, and the web app
-- reads the title with the catalogue's names, in code, never asking Divar. record_paste_request() takes the model that
-- reading found (null when it found none) as a third argument, so a link whose ad Carshenas never saw still counts as
-- demand for its model in model_demand: that is how the superadmin learns which cars buyers paste links of that nobody
-- reads in depth. A listing we know keeps counting for its own, structured model (Divar filed it there; the title is only
-- a fallback for a known listing with no model). The wanted-link rules and caps (5,000 tokens, the oldest once-asked ones
-- dropped to 4,900) are the CS-65 function's, unchanged. The web role may execute it and nothing else of it; the model
-- id is the web app's own reading and is checked against the catalogue here, so an id that names no model counts nothing.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION record_paste_request(text, text);

CREATE FUNCTION record_paste_request(pasted_source_id text, pasted_key text, titled_model_id bigint DEFAULT NULL)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  known boolean;
  known_model_id bigint;
  counted_model_id bigint;
BEGIN
  IF pasted_key IS NULL OR pasted_source_id IS NULL OR pasted_key !~ '^[A-Za-z0-9_-]{6,32}$' OR NOT EXISTS (SELECT FROM source s WHERE s.id = pasted_source_id) THEN
    RETURN 'invalid';
  END IF;
  SELECT l.model_id INTO known_model_id
    FROM listing l WHERE l.source_id = pasted_source_id AND l.source_listing_key = pasted_key;
  known := FOUND;
  -- The model asked about: the listing's own when it has one, else the one the title names, when the catalogue has it.
  counted_model_id := known_model_id;
  IF counted_model_id IS NULL AND titled_model_id IS NOT NULL
    AND EXISTS (SELECT FROM model m WHERE m.id = titled_model_id) THEN
    counted_model_id := titled_model_id;
  END IF;
  IF counted_model_id IS NOT NULL THEN
    INSERT INTO model_demand (demand_date, model_id, kind)
    VALUES ((now() AT TIME ZONE 'Asia/Tehran')::date, counted_model_id, 'paste')
    ON CONFLICT ON CONSTRAINT model_demand_day_unique
    DO UPDATE SET request_count = least(model_demand.request_count + 1, 1000000);
  END IF;
  IF known THEN
    RETURN CASE WHEN counted_model_id IS NULL THEN 'known' ELSE 'counted' END;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('record_paste_request'));
  IF NOT EXISTS (SELECT FROM wanted_link w WHERE w.source_id = pasted_source_id AND w.source_listing_key = pasted_key)
    AND (SELECT count(*) FROM wanted_link) >= 5000 THEN
    -- Full: make room by dropping the oldest links asked for only once, down to 4,900 (a link asked for twice or more is kept), so
    -- a crowd of junk tokens cannot shut real ones out for good. All asked for more than once: nothing to drop.
    DELETE FROM wanted_link WHERE id IN (
      SELECT w.id FROM wanted_link w WHERE w.request_count = 1 ORDER BY w.last_wanted_at, w.id LIMIT (SELECT count(*) FROM wanted_link) - 4900);
    IF (SELECT count(*) FROM wanted_link) >= 5000 THEN
      RETURN 'capped';
    END IF;
  END IF;
  INSERT INTO wanted_link (source_id, source_listing_key) VALUES (pasted_source_id, pasted_key)
  ON CONFLICT ON CONSTRAINT wanted_link_key_unique
  DO UPDATE SET request_count = least(wanted_link.request_count + 1, 1000000), last_wanted_at = now();
  RETURN 'wanted';
END
$$;
COMMENT ON FUNCTION record_paste_request(text, text, bigint) IS
  'What a pasted link adds up to (CS-65, CS-115): it counts as demand for a catalogue model in model_demand, kind paste, when the listing is known with a model (counted), or when the model the title of its address names is given (the web app reads it with the catalogue names; counted for a known listing with no model of its own); a known listing with no model and no title model counts as nothing (known); a token we have not seen becomes a wanted link, at most 5,000 of them, the oldest once-asked ones dropped to make room (wanted; capped only when every kept link was asked for twice or more); invalid for a token or source that cannot be one. An id that names no model counts nothing.';

REVOKE ALL ON FUNCTION record_paste_request(text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_paste_request(text, text, bigint) TO carshenas_web;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION record_paste_request(text, text, bigint);

CREATE FUNCTION record_paste_request(pasted_source_id text, pasted_key text) RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  known_id bigint;
  known_model_id bigint;
BEGIN
  IF pasted_key IS NULL OR pasted_source_id IS NULL OR pasted_key !~ '^[A-Za-z0-9_-]{6,32}$' OR NOT EXISTS (SELECT FROM source s WHERE s.id = pasted_source_id) THEN
    RETURN 'invalid';
  END IF;
  SELECT l.id, l.model_id INTO known_id, known_model_id
    FROM listing l WHERE l.source_id = pasted_source_id AND l.source_listing_key = pasted_key;
  IF FOUND THEN
    IF known_model_id IS NULL THEN
      RETURN 'known';
    END IF;
    INSERT INTO model_demand (demand_date, model_id, kind)
    VALUES ((now() AT TIME ZONE 'Asia/Tehran')::date, known_model_id, 'paste')
    ON CONFLICT ON CONSTRAINT model_demand_day_unique
    DO UPDATE SET request_count = least(model_demand.request_count + 1, 1000000);
    RETURN 'counted';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('record_paste_request'));
  IF NOT EXISTS (SELECT FROM wanted_link w WHERE w.source_id = pasted_source_id AND w.source_listing_key = pasted_key)
    AND (SELECT count(*) FROM wanted_link) >= 5000 THEN
    -- Full: make room by dropping the oldest links asked for only once, down to 4,900 (a link asked for twice or more is kept), so
    -- a crowd of junk tokens cannot shut real ones out for good. All asked for more than once: nothing to drop.
    DELETE FROM wanted_link WHERE id IN (
      SELECT w.id FROM wanted_link w WHERE w.request_count = 1 ORDER BY w.last_wanted_at, w.id LIMIT (SELECT count(*) FROM wanted_link) - 4900);
    IF (SELECT count(*) FROM wanted_link) >= 5000 THEN
      RETURN 'capped';
    END IF;
  END IF;
  INSERT INTO wanted_link (source_id, source_listing_key) VALUES (pasted_source_id, pasted_key)
  ON CONFLICT ON CONSTRAINT wanted_link_key_unique
  DO UPDATE SET request_count = least(wanted_link.request_count + 1, 1000000), last_wanted_at = now();
  RETURN 'wanted';
END
$$;
COMMENT ON FUNCTION record_paste_request(text, text) IS
  'What a pasted link adds up to (CS-65): a listing we know with a catalogue model counts as demand for that model (counted), one without a model counts as nothing (known), a token we have not seen becomes a wanted link, at most 5,000 of them, the oldest once-asked ones dropped to make room (wanted; capped only when every kept link was asked for twice or more); invalid for a token or source that cannot be one.';

REVOKE ALL ON FUNCTION record_paste_request(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_paste_request(text, text) TO carshenas_web;
