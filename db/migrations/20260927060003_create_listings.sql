-- migrate:up
-- The listing's identity and lifecycle: one ad on one source, for every origin (CS-4; ADR-0013; the model is
-- docs/design/data-model.md). What the ad says about the car (catalogue match, model year, mileage, price, city,
-- seller) arrives with the tasks that decide its types: money and calendars (CS-2), extraction (CS-8) and the
-- catalogue (CS-10).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE listing (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  origin             text NOT NULL DEFAULT 'external'
                     CONSTRAINT listing_origin_valid CHECK (origin IN ('external', 'native')),
  source_id          text NOT NULL,
  source_listing_key text
                     CONSTRAINT listing_source_listing_key_format CHECK (source_listing_key ~ '^\S{1,200}$'),
  url                text
                     CONSTRAINT listing_url_http CHECK (url ~ '^https?://'),
  status             text NOT NULL
                     CONSTRAINT listing_status_valid CHECK (status IN ('active', 'sold', 'expired', 'gone', 'removed')),
  listed_at          timestamptz NOT NULL,
  delisted_at        timestamptz,
  last_seen_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_source_fk FOREIGN KEY (source_id, origin) REFERENCES source (id, origin) ON DELETE RESTRICT,
  CONSTRAINT listing_source_key_unique UNIQUE (source_id, source_listing_key),
  -- Target of fetch_log (listing_id, source_id): a fetch of one source never points at another source's listing.
  CONSTRAINT listing_id_source_unique UNIQUE (id, source_id),
  -- Native listings arrive with one additive migration that drops this constraint (docs/design/data-model.md).
  CONSTRAINT listing_only_external_for_now CHECK (origin = 'external'),
  CONSTRAINT listing_external_identity CHECK (origin <> 'external' OR (source_listing_key IS NOT NULL AND url IS NOT NULL)),
  -- An external listing exists because a fetch showed it.
  CONSTRAINT listing_external_was_seen CHECK (origin <> 'external' OR last_seen_at IS NOT NULL),
  CONSTRAINT listing_off_market_has_date CHECK ((status IN ('sold', 'expired', 'gone', 'removed')) = (delisted_at IS NOT NULL)),
  CONSTRAINT listing_market_dates_ordered CHECK (delisted_at IS NULL OR delisted_at >= listed_at),
  -- An expired or gone listing that a fetch shows again must go back to active in the same write: the crawler's upsert
  -- reactivates it, and this refuses a sighting recorded without doing so (the listing would stay out of search).
  CONSTRAINT listing_gone_not_seen_since CHECK (status NOT IN ('expired', 'gone') OR last_seen_at <= delisted_at)
) WITH (
  -- The crawler refreshes last_seen_at at most once a day per listing: free space in each page keeps those updates
  -- HOT (no index touched), and vacuum and analyze run after 2 % of rows change instead of the default 20 %.
  fillfactor = 90,
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02
);

COMMENT ON TABLE listing IS
  'The offer: one ad on one source. Its id is permanent (URLs, alerts, evaluation sets point at it); what it says about the car is derived and rebuildable.';
COMMENT ON COLUMN listing.origin IS 'external: crawled or read through an official API; native: created on Carshenas (later).';
COMMENT ON COLUMN listing.source_listing_key IS 'The source''s own id or token for the ad; with source_id it is the natural key the crawler upserts on.';
COMMENT ON COLUMN listing.url IS 'Where the ad lives on its source; the click-out target.';
COMMENT ON COLUMN listing.status IS
  'active: on the market; sold, expired, gone (disappeared from the source): off the market; removed: taken down by Carshenas. Changes follow listing_status_transition.';
COMMENT ON COLUMN listing.listed_at IS
  'When the ad went on the market: the source''s posting time when the page shows it, else our first sighting. Native drafts, later, have none: the native-listings migration relaxes NOT NULL for them.';
COMMENT ON COLUMN listing.delisted_at IS 'When the ad left the market; set exactly when the status is off the market.';
COMMENT ON COLUMN listing.last_seen_at IS
  'The latest fetch that showed the ad, to within a day: the crawler refreshes it when it is more than a day old (fetch_log keeps every visit). Deliberately not indexed, so those updates stay HOT.';
COMMENT ON CONSTRAINT listing_source_fk ON listing IS
  'unindexed: listing_source_key_unique (source_id, source_listing_key) serves it through its leading column, origin follows from source_id, and sources are never deleted while they have listings.';

-- The lifecycle as data: the status changes each origin allows. 'new' is the status a row has before its insert.
CREATE TABLE listing_status_transition (
  origin      text NOT NULL
              CONSTRAINT listing_status_transition_origin_valid CHECK (origin IN ('external', 'native')),
  from_status text NOT NULL,
  to_status   text NOT NULL,
  CONSTRAINT listing_status_transition_pkey PRIMARY KEY (origin, from_status, to_status),
  CONSTRAINT listing_status_transition_changes_status CHECK (from_status <> to_status),
  -- The statuses of listing_status_valid (plus 'new' before an insert); the native-listings migration widens both.
  CONSTRAINT listing_status_transition_statuses_valid CHECK (
    from_status IN ('new', 'active', 'sold', 'expired', 'gone', 'removed')
    AND to_status IN ('active', 'sold', 'expired', 'gone', 'removed'))
);

INSERT INTO listing_status_transition (origin, from_status, to_status) VALUES
  ('external', 'new', 'active'),
  ('external', 'new', 'gone'),        -- a pasted link can already be gone
  ('external', 'active', 'sold'),
  ('external', 'active', 'expired'),
  ('external', 'active', 'gone'),
  ('external', 'active', 'removed'),
  ('external', 'gone', 'active'),     -- relisted under the same key
  ('external', 'expired', 'active'),
  ('external', 'sold', 'active');

COMMENT ON TABLE listing_status_transition IS
  'Allowed listing status changes per origin; listing_status_guard enforces them. Curated: a new lifecycle rule is a migration.';

-- Runs with the caller's rights, so a role that changes a listing's status needs SELECT on listing_status_transition.
-- The table name is qualified and the search path pinned with pg_temp last, so a temporary table can never stand in
-- for the transitions.
CREATE FUNCTION listing_status_guard() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
  AS $$
DECLARE
  previous_status text := CASE TG_OP WHEN 'INSERT' THEN 'new' ELSE OLD.status END;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.origin IS DISTINCT FROM OLD.origin THEN
      RAISE EXCEPTION 'listing %: the origin of a listing never changes', OLD.id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'listing_status_guard', TABLE = TG_TABLE_NAME;
    END IF;
    IF NEW.status = OLD.status THEN
      RETURN NEW;
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT FROM public.listing_status_transition t
    WHERE t.origin = NEW.origin AND t.from_status = previous_status AND t.to_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'listing %: % listings cannot change status from % to %', NEW.id, NEW.origin, previous_status, NEW.status
      USING ERRCODE = 'check_violation', CONSTRAINT = 'listing_status_guard', TABLE = TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END
$$;

-- An update is checked before it is written. An insert is checked after it, because a BEFORE INSERT trigger also
-- fires on the row an upsert proposes (INSERT … ON CONFLICT DO UPDATE) before PostgreSQL finds the conflict: a
-- re-crawl proposing 'sold' for a known listing is an update from 'active', and only the BEFORE UPDATE trigger sees it.
CREATE TRIGGER listing_status_guard
  BEFORE UPDATE OF status, origin ON listing
  FOR EACH ROW EXECUTE FUNCTION listing_status_guard();
CREATE TRIGGER listing_status_guard_on_insert
  AFTER INSERT ON listing
  FOR EACH ROW EXECUTE FUNCTION listing_status_guard();

COMMENT ON FUNCTION listing_status_guard() IS
  'Refuses a listing status change that listing_status_transition does not allow, and any change of origin; errors name the constraint listing_status_guard.';

-- The web app shows listings; everything else about them stays closed to it.
GRANT SELECT ON listing TO carshenas_web;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
REVOKE SELECT ON listing FROM carshenas_web;
DROP TRIGGER listing_status_guard_on_insert ON listing;
DROP TRIGGER listing_status_guard ON listing;
DROP FUNCTION listing_status_guard();
DROP TABLE listing_status_transition;
DROP TABLE listing;
