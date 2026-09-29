-- migrate:up
-- A listing's price history, append-only in valid time (CS-33 criterion 3; designed in CS-2 and its reviews,
-- docs/design/data-model.md, layer 3; ADR-0014). Every event is a change of what the listing asks: a new asking
-- price, or a switch to negotiable («توافقی»), an installment offer or a placeholder, which carry no amount. One
-- BEFORE INSERT trigger fills the listing's previous event and last asking price, holding the listing row so two
-- writers cannot both take the same predecessor, and refuses an event older than the listing's latest (a late event
-- repeated a drop in the CS-2 review). A price drop is an asking event below last_asking_price_toman, so
-- 1.25 billion, then negotiable, then 1.0 billion is a drop of 250 million. The evidence is the snapshot the price
-- was read from, of the same listing.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE listing_price_event (
  id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id              bigint NOT NULL,
  observed_at             timestamptz NOT NULL,
  price_type              text NOT NULL
                          CONSTRAINT listing_price_event_price_type_valid
                          CHECK (price_type IN ('asking', 'negotiable', 'installment', 'placeholder')),
  asking_price_toman      bigint
                          CONSTRAINT listing_price_event_asking_price_toman_range
                          CHECK (asking_price_toman BETWEEN 1 AND 999999999999999),
  previous_price_type     text
                          CONSTRAINT listing_price_event_previous_price_type_valid
                          CHECK (previous_price_type IN ('asking', 'negotiable', 'installment', 'placeholder')),
  previous_price_toman    bigint
                          CONSTRAINT listing_price_event_previous_price_toman_range
                          CHECK (previous_price_toman BETWEEN 1 AND 999999999999999),
  last_asking_price_toman bigint
                          CONSTRAINT listing_price_event_last_asking_price_toman_range
                          CHECK (last_asking_price_toman BETWEEN 1 AND 999999999999999),
  snapshot_id             bigint NOT NULL,
  recorded_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_price_event_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE,
  -- The evidence is a snapshot of the same listing; purging it removes the events read from it.
  CONSTRAINT listing_price_event_snapshot_fk FOREIGN KEY (snapshot_id, listing_id)
    REFERENCES snapshot (id, listing_id) ON DELETE CASCADE,
  -- One event per listing and instant: re-deriving the history from snapshots never doubles it.
  CONSTRAINT listing_price_event_observed_unique UNIQUE (listing_id, observed_at),
  -- An amount exactly for an asking price, here and in the previous event. IS NOT NULL is spelled out, since a CHECK
  -- passes when its expression is NULL.
  CONSTRAINT listing_price_event_amount_matches_type CHECK ((price_type = 'asking') = (asking_price_toman IS NOT NULL)),
  CONSTRAINT listing_price_event_previous_amount_matches_type CHECK (
    (previous_price_type IS NOT NULL AND previous_price_type = 'asking') = (previous_price_toman IS NOT NULL)),
  -- Every event is a change: the same price again, or negotiable again, is not an event.
  CONSTRAINT listing_price_event_is_a_change CHECK (
    (price_type, asking_price_toman) IS DISTINCT FROM (previous_price_type, previous_price_toman))
);

CREATE INDEX listing_price_event_snapshot_idx ON listing_price_event (snapshot_id, listing_id);

CREATE FUNCTION listing_price_event_fill_previous() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
  AS $$
DECLARE
  previous record;
BEGIN
  -- One writer per listing at a time: the second waits here and then reads the first's event as its predecessor.
  PERFORM FROM public.listing l WHERE l.id = NEW.listing_id FOR NO KEY UPDATE;
  -- An exact re-insert of an event (a job that runs twice) is not late: listing_price_event_observed_unique takes it.
  IF EXISTS (
    SELECT FROM public.listing_price_event e
    WHERE e.listing_id = NEW.listing_id AND e.observed_at > NEW.observed_at
  ) AND NOT EXISTS (
    SELECT FROM public.listing_price_event e
    WHERE e.listing_id = NEW.listing_id AND e.observed_at = NEW.observed_at
  ) THEN
    RAISE EXCEPTION 'listing %: a price observed at % is older than its latest price event', NEW.listing_id, NEW.observed_at
      USING ERRCODE = 'check_violation', CONSTRAINT = 'listing_price_event_in_order', TABLE = TG_TABLE_NAME;
  END IF;
  -- Strictly earlier events only, so an exact re-insert of (listing_id, observed_at) gets the values the original
  -- got and is left to listing_price_event_observed_unique (ON CONFLICT DO NOTHING skips it).
  SELECT e.price_type, e.asking_price_toman INTO previous
  FROM public.listing_price_event e
  WHERE e.listing_id = NEW.listing_id AND e.observed_at < NEW.observed_at
  ORDER BY e.observed_at DESC
  LIMIT 1;
  NEW.previous_price_type := previous.price_type;
  NEW.previous_price_toman := previous.asking_price_toman;
  NEW.last_asking_price_toman := (
    SELECT e.asking_price_toman
    FROM public.listing_price_event e
    WHERE e.listing_id = NEW.listing_id AND e.observed_at < NEW.observed_at AND e.price_type = 'asking'
    ORDER BY e.observed_at DESC
    LIMIT 1);
  RETURN NEW;
END
$$;

CREATE TRIGGER listing_price_event_fill_previous
  BEFORE INSERT ON listing_price_event
  FOR EACH ROW EXECUTE FUNCTION listing_price_event_fill_previous();
CREATE TRIGGER listing_price_event_append_only
  BEFORE UPDATE OR DELETE ON listing_price_event
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER listing_price_event_append_only_truncate
  BEFORE TRUNCATE ON listing_price_event
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE listing_price_event IS
  'Append-only price history of a listing in valid time (ADR-0014): one row per change of what it asks, read from a snapshot of it.';
COMMENT ON COLUMN listing_price_event.observed_at IS
  'When the source showed this price: the start of the request whose snapshot is the evidence. Events of a listing are inserted in this order.';
COMMENT ON COLUMN listing_price_event.price_type IS
  'asking (an amount), negotiable («توافقی»), installment (an installment offer: its figure is not the car''s price), placeholder (a token figure such as 1,000 tomans); only asking carries an amount.';
COMMENT ON COLUMN listing_price_event.asking_price_toman IS 'The asking price in whole tomans, exactly when price_type is asking.';
COMMENT ON COLUMN listing_price_event.previous_price_type IS
  'The type of the listing''s previous event, filled by the trigger; null for its first.';
COMMENT ON COLUMN listing_price_event.previous_price_toman IS
  'The previous event''s asking price, filled by the trigger; null when that event carried none.';
COMMENT ON COLUMN listing_price_event.last_asking_price_toman IS
  'The latest earlier asking price, filled by the trigger, across negotiable and placeholder events: an asking price below it is a drop.';
COMMENT ON COLUMN listing_price_event.snapshot_id IS 'The snapshot the price was read from: the evidence.';
COMMENT ON COLUMN listing_price_event.recorded_at IS 'When we stored the event; differs from observed_at when history is re-derived.';
COMMENT ON FUNCTION listing_price_event_fill_previous() IS
  'Fills previous_price_type, previous_price_toman and last_asking_price_toman from the listing''s earlier events, holding the listing row, and refuses an event older than the listing''s latest (listing_price_event_in_order); one at an existing event''s instant is left to listing_price_event_observed_unique.';

-- The worker records prices; pages read them once a task shows them (CS-64, CS-67) and grants it then.
GRANT SELECT, INSERT ON listing_price_event TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE listing_price_event;
DROP FUNCTION listing_price_event_fill_previous();
