-- 02_native.sql: native listings later, as one additive migration applied on top of live crawled data.
-- Nothing existing is rewritten: new tables, one new source row, new nullable columns, widened CHECKs
-- (added NOT VALID, then validated), and new rows in the lifecycle table.
BEGIN;

-- Sellers (and later buyers) who sign in with a phone number and a one-time code.
CREATE TABLE account (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone_e164   text CONSTRAINT account_phone_unique UNIQUE
               CONSTRAINT account_phone_format CHECK (phone_e164 ~ '^\+989[0-9]{9}$'),   -- our own user's login; never shown
  phone_hmac   bytea CONSTRAINT account_phone_hmac_unique UNIQUE
               CONSTRAINT account_phone_hmac_length CHECK (octet_length(phone_hmac) = 32), -- same keyed hash as listing_contact_hash
  display_name text,
  status       text NOT NULL DEFAULT 'active' CONSTRAINT account_status_valid CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  CONSTRAINT account_live_has_phone CHECK (status = 'deleted' OR (phone_e164 IS NOT NULL AND phone_hmac IS NOT NULL)),
  CONSTRAINT account_deleted_is_scrubbed CHECK (status <> 'deleted' OR (deleted_at IS NOT NULL AND phone_e164 IS NULL AND display_name IS NULL))
);

-- Carshenas itself becomes a source: native listings keep source_id NOT NULL and every per-source rule still applies.
INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility)
VALUES ('carshenas', 'native', 'native', 'کارشناس', 'https://carshenas.example', 'public');

-- The listing core learns about owners. Existing external rows already satisfy every new rule.
ALTER TABLE listing ADD COLUMN seller_account_id bigint REFERENCES account (id) ON DELETE RESTRICT;
ALTER TABLE listing DROP CONSTRAINT listing_only_external_for_now;
ALTER TABLE listing ADD CONSTRAINT listing_owner_matches_origin CHECK (
      (origin = 'external' AND source_listing_key IS NOT NULL AND seller_account_id IS NULL)
   OR (origin = 'native'   AND source_listing_key IS NULL     AND seller_account_id IS NOT NULL)) NOT VALID;
ALTER TABLE listing VALIDATE CONSTRAINT listing_owner_matches_origin;

ALTER TABLE listing DROP CONSTRAINT listing_status_valid;
ALTER TABLE listing ADD CONSTRAINT listing_status_valid CHECK (status IN (
  'draft', 'in_review', 'active', 'rejected', 'sold', 'expired', 'withdrawn', 'gone', 'removed')) NOT VALID;
ALTER TABLE listing VALIDATE CONSTRAINT listing_status_valid;

-- A native listing may be half-filled while it is a draft, but never on the market.
ALTER TABLE listing ADD CONSTRAINT listing_native_active_is_complete CHECK (
  origin <> 'native' OR status <> 'active' OR (
    catalogue_match = 'trim' AND model_year_sh IS NOT NULL AND mileage_km IS NOT NULL
    AND price_type IS NOT NULL AND city_id IS NOT NULL)) NOT VALID;
ALTER TABLE listing VALIDATE CONSTRAINT listing_native_active_is_complete;
ALTER TABLE listing ADD CONSTRAINT listing_id_origin_key UNIQUE (id, origin);   -- target for native-only child tables

INSERT INTO listing_status_transition (origin, from_status, to_status) VALUES
  ('native', 'new', 'draft'),
  ('native', 'draft', 'in_review'),                  -- a discarded draft is deleted: it was never on the market
  ('native', 'in_review', 'active'), ('native', 'in_review', 'rejected'),
  ('native', 'rejected', 'in_review'),
  ('native', 'active', 'sold'), ('native', 'active', 'expired'), ('native', 'active', 'withdrawn'), ('native', 'active', 'removed');

-- What the seller wrote, version by version. A draft is mutable; a submitted revision is frozen.
-- The listing core is projected from the latest approved revision, as it is projected from snapshots for crawled ads.
CREATE TABLE native_listing_revision (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id       bigint NOT NULL,
  origin           text NOT NULL DEFAULT 'native' CONSTRAINT revision_origin_native CHECK (origin = 'native'),
  revision_no      integer NOT NULL CONSTRAINT revision_no_positive CHECK (revision_no >= 1),
  status           text NOT NULL DEFAULT 'draft'
                   CONSTRAINT revision_status_valid CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'superseded')),
  payload          jsonb NOT NULL DEFAULT '{}',   -- the form: trim, year, mileage, price, city, condition, description, photo order
  created_at       timestamptz NOT NULL DEFAULT now(),
  submitted_at     timestamptz,
  decided_at       timestamptz,
  decided_by       text,
  rejection_reason text,
  CONSTRAINT revision_listing_is_native FOREIGN KEY (listing_id, origin) REFERENCES listing (id, origin) ON DELETE CASCADE,
  CONSTRAINT revision_no_unique UNIQUE (listing_id, revision_no),
  CONSTRAINT revision_submitted_consistent CHECK ((status = 'draft') = (submitted_at IS NULL)),
  CONSTRAINT revision_decision_recorded CHECK (status NOT IN ('approved', 'rejected') OR (decided_at IS NOT NULL AND decided_by IS NOT NULL)),
  CONSTRAINT revision_rejection_has_reason CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)
);
CREATE UNIQUE INDEX revision_one_draft_per_listing ON native_listing_revision (listing_id) WHERE status = 'draft';
CREATE UNIQUE INDEX revision_one_pending_per_listing ON native_listing_revision (listing_id) WHERE status = 'submitted';

CREATE FUNCTION revision_freeze() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' AND (NEW.payload IS DISTINCT FROM OLD.payload OR NEW.revision_no <> OLD.revision_no) THEN
    RAISE EXCEPTION 'revision % of listing % was submitted and is frozen; start a new draft', OLD.revision_no, OLD.listing_id;
  END IF;
  IF NOT ((OLD.status, NEW.status) IN (('draft', 'draft'), ('draft', 'submitted'), ('submitted', 'approved'),
                                        ('submitted', 'rejected'), ('approved', 'superseded'), ('approved', 'approved'),
                                        ('rejected', 'rejected'), ('superseded', 'superseded'), ('submitted', 'submitted'))) THEN
    RAISE EXCEPTION 'revision cannot go from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER revision_freeze BEFORE UPDATE ON native_listing_revision FOR EACH ROW EXECUTE FUNCTION revision_freeze();

ALTER TABLE listing ADD COLUMN current_revision_id bigint REFERENCES native_listing_revision (id) ON DELETE SET NULL;
ALTER TABLE listing ADD CONSTRAINT listing_revision_only_native CHECK (origin = 'native' OR current_revision_id IS NULL);

-- Price history of native listings comes from approved revisions instead of snapshots.
ALTER TABLE listing_price_event ADD COLUMN native_revision_id bigint REFERENCES native_listing_revision (id) ON DELETE CASCADE;
ALTER TABLE listing_price_event DROP CONSTRAINT price_event_from_snapshot;
ALTER TABLE listing_price_event ADD CONSTRAINT price_event_has_one_evidence CHECK (num_nonnulls(snapshot_id, native_revision_id) = 1) NOT VALID;
ALTER TABLE listing_price_event VALIDATE CONSTRAINT price_event_has_one_evidence;

-- Buyers reach a native seller through Carshenas; the seller's number is never published.
CREATE TABLE contact_request (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id        bigint NOT NULL,
  origin            text NOT NULL DEFAULT 'native' CONSTRAINT contact_origin_native CHECK (origin = 'native'),
  buyer_account_id  bigint NOT NULL REFERENCES account (id) ON DELETE CASCADE,
  message           text NOT NULL CONSTRAINT contact_message_length CHECK (length(message) BETWEEN 1 AND 1000),
  share_buyer_phone boolean NOT NULL DEFAULT false,   -- the buyer's explicit consent, per request
  status            text NOT NULL DEFAULT 'sent'
                    CONSTRAINT contact_status_valid CHECK (status IN ('sent', 'read', 'replied', 'closed', 'reported_spam')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_listing_is_native FOREIGN KEY (listing_id, origin) REFERENCES listing (id, origin) ON DELETE CASCADE
);
CREATE UNIQUE INDEX contact_request_one_open ON contact_request (listing_id, buyer_account_id) WHERE status IN ('sent', 'read');

CREATE INDEX listing_seller_account_idx ON listing (seller_account_id) WHERE seller_account_id IS NOT NULL;
CREATE INDEX contact_request_buyer_idx ON contact_request (buyer_account_id);

COMMIT;
