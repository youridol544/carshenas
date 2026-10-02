-- migrate:up
-- Marked listings (CS-69, «نشان کردن»): a buyer marks a listing to follow it. One row says that one account follows one
-- listing, with the asking price at the moment of marking (so the buyer sees what changed since) and the status the
-- worker last compared the listing against (so a sale or a return produces one notification). The web app inserts and
-- deletes its own buyer's marks and reads them; the worker's marks.notify job reads them and moves the bookkeeping
-- columns forward; nobody updates a mark's account, listing or price.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE listing_mark (
  account_id         bigint NOT NULL,
  listing_id         bigint NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  marked_price_toman bigint
                     CONSTRAINT listing_mark_marked_price_toman_range
                     CHECK (marked_price_toman >= 1 AND marked_price_toman <= 999999999999999),
  seen_status        text NOT NULL
                     CONSTRAINT listing_mark_seen_status_valid
                     CHECK (seen_status IN ('active', 'sold', 'expired', 'gone', 'removed')),
  status_version     integer NOT NULL DEFAULT 0
                     CONSTRAINT listing_mark_status_version_nonnegative CHECK (status_version >= 0),
  checked_at         timestamptz NOT NULL DEFAULT now(),
  -- A buyer marks a listing once: the primary key is the rule, the arbiter of the insert's ON CONFLICT DO NOTHING and
  -- the index of the account's foreign key and of "this buyer's marks".
  CONSTRAINT listing_mark_pkey PRIMARY KEY (account_id, listing_id),
  CONSTRAINT listing_mark_account_fk FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE,
  -- A purged listing takes the marks on it (data-model.md, open question 11).
  CONSTRAINT listing_mark_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE
);

-- The buyer's page, most recently marked first (keyset on created_at and listing_id).
CREATE INDEX listing_mark_account_recent_idx ON listing_mark (account_id, created_at DESC, listing_id DESC);
-- The listing's foreign key (a purge deletes its marks) and the worker's join from a price event or a status to its marks.
CREATE INDEX listing_mark_listing_idx ON listing_mark (listing_id);

COMMENT ON TABLE listing_mark IS
  'A listing a buyer follows (CS-69, «نشان کردن»). The web app inserts and deletes the signed-in buyer''s own marks; the worker''s marks.notify job tells the buyer of a price drop, a sale or a return through create_notification() and moves seen_status, status_version and checked_at forward.';
COMMENT ON COLUMN listing_mark.marked_price_toman IS
  'The listing''s asking price when it was marked, in whole tomans; NULL when it had none (negotiable, instalment, placeholder). The page compares it with today''s price.';
COMMENT ON COLUMN listing_mark.seen_status IS
  'The listing status the buyer was last shown or told: marks.notify notifies when the listing''s status differs from it by going off the market (sold, expired, gone) or coming back (active), then sets it.';
COMMENT ON COLUMN listing_mark.status_version IS
  'How many status changes marks.notify has announced for this mark; part of the notification''s event key, so the same listing can be announced again when it goes off the market a second time.';
COMMENT ON COLUMN listing_mark.checked_at IS
  'Price events recorded up to this moment (less a safety overlap) were handled by marks.notify; the next run looks at later ones.';

-- At most 200 marks per buyer, counted under a lock on the buyer so two tabs cannot both take the last place. The rule
-- reads other rows, so it is a trigger (data-model.md: triggers for what a row cannot state); it runs AFTER the insert,
-- so an insert that conflicts with an existing mark (a double press, a retry) does nothing instead of tripping the cap.
-- It raises 23514 with a constraint name, which the web app maps to a Farsi message like any constraint.
-- 200: well over what anyone compares at once, small enough that the page and the worker's join stay trivial.
CREATE FUNCTION listing_mark_account_cap() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('listing_mark:' || NEW.account_id::text, 0));
  IF (SELECT count(*) FROM public.listing_mark m WHERE m.account_id = NEW.account_id) > 200 THEN
    RAISE EXCEPTION 'an account may mark at most 200 listings'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'listing_mark_account_cap', TABLE = 'listing_mark';
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER listing_mark_account_cap
  AFTER INSERT ON listing_mark
  FOR EACH ROW EXECUTE FUNCTION listing_mark_account_cap();

REVOKE EXECUTE ON FUNCTION listing_mark_account_cap() FROM PUBLIC;

-- Closed by default; exactly what each role needs. The web role may not change a mark: unmarking and marking again is
-- how a price is retaken.
GRANT SELECT, DELETE ON listing_mark TO carshenas_web;
GRANT INSERT (account_id, listing_id, marked_price_toman, seen_status) ON listing_mark TO carshenas_web;
GRANT SELECT ON listing_mark TO carshenas_worker;
GRANT UPDATE (seen_status, status_version, checked_at) ON listing_mark TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE listing_mark;
DROP FUNCTION listing_mark_account_cap();
