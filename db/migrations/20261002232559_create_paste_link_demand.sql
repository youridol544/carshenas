-- migrate:up
-- Paste a listing link (CS-65; ADR-0008, ADR-0017 points 8 and 6). A buyer pastes the link of a listing; the web app
-- finds it in our own database by the source's token and shows its rating. Three things need the database:
-- 1. paste_rate_listing(): the rating of a listing the daily valuation run did not rate (crawled after the run), through a
--    SECURITY DEFINER wrapper of valuation_rate_listing() on the latest succeeded run, because the web role may not read the
--    comparables and coefficients the function reads. It reads and rates; it writes nothing.
-- 2. wanted_link: a link whose listing we have not seen. Nothing is fetched for it (the crawl is paused and a pasted link is
--    answered from our data only); the link's source and token are kept, counted, for the crawler to read once it runs
--    again. Only the token is stored, never the pasted text, and it must be a safe token (a CHECK), so a visitor cannot put
--    arbitrary text in the table. At most 5,000 distinct links are kept, counted under an advisory lock; when full, the 100 oldest links asked for once are dropped.
-- 3. model_demand: how many times buyers asked about a model, per Tehran day and kind (the data model's layer 7 name;
--    CS-53 shows it to the superadmin next to the tracked models, so a model buyers paste but we do not read in depth is
--    visible). Written only by record_paste_request(): the web role cannot insert.
-- record_paste_request() decides what a pasted token is: a listing we know with a catalogue model counts as demand for that
-- model; a listing we know without one counts as nothing; a token we do not know becomes a wanted link. It returns
-- counted, known, wanted, capped or invalid. SECURITY DEFINER with a fixed search_path.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE wanted_link (
  id bigint GENERATED ALWAYS AS IDENTITY,
  source_id text NOT NULL,
  source_listing_key text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  first_wanted_at timestamptz NOT NULL DEFAULT now(),
  last_wanted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wanted_link_pkey PRIMARY KEY (id),
  CONSTRAINT wanted_link_key_unique UNIQUE (source_id, source_listing_key),
  CONSTRAINT wanted_link_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE CASCADE,
  CONSTRAINT wanted_link_key_format CHECK (source_listing_key ~ '^[A-Za-z0-9_-]{6,32}$'),
  CONSTRAINT wanted_link_request_count_positive CHECK (request_count >= 1),
  CONSTRAINT wanted_link_dates_ordered CHECK (last_wanted_at >= first_wanted_at)
);
COMMENT ON TABLE wanted_link IS
  'A pasted link whose listing Carshenas has not seen (CS-65): the source and token, with how many times buyers asked. Nothing is fetched for it when it is pasted; the crawler may read it once the source crawls again. Written only by record_paste_request().';
COMMENT ON COLUMN wanted_link.source_listing_key IS 'The source''s token as the listing table keeps it (listing.source_listing_key), taken from the pasted address by code.';
COMMENT ON COLUMN wanted_link.request_count IS 'How many times it was pasted, capped at 1,000,000.';

CREATE TABLE model_demand (
  id bigint GENERATED ALWAYS AS IDENTITY,
  demand_date date NOT NULL,
  model_id bigint NOT NULL,
  kind text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  CONSTRAINT model_demand_pkey PRIMARY KEY (id),
  CONSTRAINT model_demand_day_unique UNIQUE (demand_date, model_id, kind),
  CONSTRAINT model_demand_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE CASCADE,
  CONSTRAINT model_demand_kind_valid CHECK (kind IN ('search', 'paste')),
  CONSTRAINT model_demand_request_count_positive CHECK (request_count >= 1)
);
CREATE INDEX model_demand_model_idx ON model_demand (model_id, demand_date);
COMMENT ON TABLE model_demand IS
  'How often buyers asked about a catalogue model, per Tehran day and kind: search (CS-53) or paste (CS-65). No personal data. Shown to the superadmin next to the tracked models.';
COMMENT ON COLUMN model_demand.demand_date IS 'The Tehran day.';
COMMENT ON COLUMN model_demand.request_count IS 'Requests that day, capped at 1,000,000.';

GRANT SELECT ON wanted_link TO carshenas_readonly, carshenas_worker, carshenas_admin;
GRANT SELECT ON model_demand TO carshenas_readonly, carshenas_admin;

CREATE FUNCTION paste_rate_listing(target_listing_id bigint)
  RETURNS TABLE (
    asking_price_toman bigint,
    market_value_toman bigint,
    price_gap_pct numeric(7,2),
    deal_rating deal_rating,
    no_rating_reason text)
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  latest_run_id bigint;
BEGIN
  -- Guards first: an unknown or removed id costs one primary-key probe, not the whole rating.
  IF NOT EXISTS (SELECT FROM listing l WHERE l.id = target_listing_id AND l.status <> 'removed') THEN
    RETURN;
  END IF;
  SELECT r.id INTO latest_run_id FROM valuation_run r WHERE r.status = 'succeeded'
   ORDER BY r.as_of_date DESC, r.id DESC LIMIT 1;
  IF latest_run_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT v.asking_price_toman, v.market_value_toman, v.price_gap_pct, v.deal_rating, v.no_rating_reason
    FROM valuation_rate_listing(latest_run_id, target_listing_id) v;
END
$$;
COMMENT ON FUNCTION paste_rate_listing(bigint) IS
  'The market value, gap and deal rating of one listing on the latest succeeded valuation run, computed from the stored coefficients by valuation_rate_listing() (CS-65): for a listing the daily run did not rate. No row for a missing or removed listing. Writes nothing.';

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

REVOKE ALL ON FUNCTION paste_rate_listing(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_paste_request(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION paste_rate_listing(bigint) TO carshenas_web;
GRANT EXECUTE ON FUNCTION record_paste_request(text, text) TO carshenas_web;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION record_paste_request(text, text);
DROP FUNCTION paste_rate_listing(bigint);
DROP TABLE model_demand;
DROP TABLE wanted_link;
