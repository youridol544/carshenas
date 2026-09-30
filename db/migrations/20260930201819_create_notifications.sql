-- migrate:up
-- Buyers' notifications inbox (CS-68, ADR-0026): the kinds a notification can be, one row per thing an account is
-- told, the kinds an account muted, and the one function every producer writes through. The function skips a muted
-- kind and deduplicates on (account, kind, event key), so a job that runs twice notifies once; producers call it in
-- the transaction that records the event they announce (CS-69 price events, CS-71 approvals, CS-72 matches). The web
-- app reads its buyer's rows, marks them read and keeps the buyer's mutes; no role inserts a notification directly.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE notification_kind (
  id          text NOT NULL
              CONSTRAINT notification_kind_id_format CHECK (id ~ '^[a-z][a-z0-9_]{1,40}$'),
  description text NOT NULL
              CONSTRAINT notification_kind_description_not_blank CHECK (btrim(description) <> ''),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_kind_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE notification_kind IS
  'What a notification can announce (ADR-0026 point 3): a curated vocabulary, one row per kind, mirrored by the registry in packages/notifications, which holds each kind''s payload schema, event key and Farsi text. A kind is added by a migration that inserts its row, with its definition in code.';
COMMENT ON COLUMN notification_kind.description IS
  'What the kind announces, in English, for people reading the database; the Farsi a buyer reads is built in code.';

INSERT INTO notification_kind (id, description) VALUES
  ('listing_price_drop', 'A listing the buyer follows asks less than before: one per price event (CS-69 produces it).');

CREATE TABLE notification (
  id         bigint GENERATED ALWAYS AS IDENTITY,
  account_id bigint NOT NULL,
  kind       text NOT NULL,
  event_key  text NOT NULL
             CONSTRAINT notification_event_key_format CHECK (event_key ~ '^[a-z][a-z0-9_]{0,40}:[0-9A-Za-z_.:-]{1,160}$'),
  payload    jsonb NOT NULL
             CONSTRAINT notification_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  listing_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz,
  CONSTRAINT notification_pkey PRIMARY KEY (id),
  CONSTRAINT notification_account_fk FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE,
  CONSTRAINT notification_kind_fk FOREIGN KEY (kind) REFERENCES notification_kind (id) ON DELETE RESTRICT,
  -- A purged listing takes the notifications about it (data-model.md, open question 11).
  CONSTRAINT notification_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE,
  -- Each event notifies each buyer at most once (ADR-0026 point 1): the arbiter of create_notification's ON CONFLICT,
  -- and the index of the account's foreign key.
  CONSTRAINT notification_once_per_event_unique UNIQUE (account_id, kind, event_key),
  -- Facts, not documents: a payload holds a handful of values.
  CONSTRAINT notification_payload_small CHECK (octet_length(payload::text) <= 4096),
  CONSTRAINT notification_read_after_created CHECK (read_at >= created_at)
);

-- The inbox, newest first, a page at a time (keyset on created_at and id), and the unread count in the header.
CREATE INDEX notification_inbox_idx ON notification (account_id, created_at DESC, id DESC);
-- Serves the listing's foreign key: a purge deletes a listing's notifications.
CREATE INDEX notification_listing_idx ON notification (listing_id);

COMMENT ON CONSTRAINT notification_kind_fk ON notification IS
  'unindexed: kinds are a handful of curated rows, removed only by a migration that first deletes their notifications.';

COMMENT ON TABLE notification IS
  'One thing one buyer is told (CS-68, ADR-0026): written only through create_notification(), which honours the buyer''s mutes and notifies each event once. The row keeps the facts; the Farsi text is built from them when shown.';
COMMENT ON COLUMN notification.event_key IS
  'Names the event this notification announces, built by the kind''s definition from its payload (price_event:812, crawl_request:31:approved); with the account and the kind it is unique, so a producer that runs twice notifies once.';
COMMENT ON COLUMN notification.payload IS
  'The facts the notification was built from, when it was created (a car''s name, the price before and after), as the kind''s schema in packages/notifications defines them; never personal data.';
COMMENT ON COLUMN notification.listing_id IS
  'The listing it is about, for a listing''s kinds; search files and crawl requests get columns of their own with their tables (CS-70, CS-71).';
COMMENT ON COLUMN notification.read_at IS
  'When the buyer read it or marked it read; NULL while unread. The only column the web app may change.';

CREATE TABLE notification_mute (
  id         bigint GENERATED ALWAYS AS IDENTITY,
  account_id bigint NOT NULL,
  kind       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_mute_pkey PRIMARY KEY (id),
  CONSTRAINT notification_mute_account_fk FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE,
  CONSTRAINT notification_mute_kind_fk FOREIGN KEY (kind) REFERENCES notification_kind (id) ON DELETE RESTRICT,
  -- Muting twice is muting once: the web app inserts ON CONFLICT DO NOTHING. Also the account's foreign-key index.
  CONSTRAINT notification_mute_once_unique UNIQUE (account_id, kind)
);

COMMENT ON CONSTRAINT notification_mute_kind_fk ON notification_mute IS
  'unindexed: kinds are a handful of curated rows, removed only by a migration that first deletes their mutes.';
COMMENT ON TABLE notification_mute IS
  'A kind of notification a buyer does not want (CS-68, ADR-0026 point 4): create_notification() creates none of it for them. Removing the row turns the kind back on; notifications already received stay.';

CREATE FUNCTION create_notification(
  for_account_id bigint,
  of_kind text,
  for_event_key text,
  with_payload jsonb,
  about_listing_id bigint DEFAULT NULL)
  RETURNS bigint
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
  INSERT INTO public.notification (account_id, kind, event_key, payload, listing_id)
  SELECT for_account_id, of_kind, for_event_key, with_payload, about_listing_id
  WHERE NOT EXISTS (
    SELECT FROM public.notification_mute m WHERE m.account_id = for_account_id AND m.kind = of_kind)
  ON CONFLICT ON CONSTRAINT notification_once_per_event_unique DO NOTHING
  RETURNING id
$$;

COMMENT ON FUNCTION create_notification(bigint, text, text, jsonb, bigint) IS
  'The only way a notification is written (ADR-0026 point 2): returns the new id, or NULL when the account muted the kind or was already told of this event. Call it in the transaction that records the event, so both commit or neither does. A missing account, kind or listing, a malformed event key and a payload that is not a small object are refused by the table''s constraints.';

REVOKE EXECUTE ON FUNCTION create_notification(bigint, text, text, jsonb, bigint) FROM PUBLIC;
-- Producers: the worker's jobs (price events, matches) and the superadmin section (crawl request decisions).
GRANT EXECUTE ON FUNCTION create_notification(bigint, text, text, jsonb, bigint) TO carshenas_worker, carshenas_admin;

-- The web app shows a buyer their notifications, marks them read and keeps their mutes; it never creates one.
GRANT SELECT ON notification_kind TO carshenas_web;
GRANT SELECT ON notification TO carshenas_web;
GRANT UPDATE (read_at) ON notification TO carshenas_web;
GRANT SELECT, DELETE ON notification_mute TO carshenas_web;
GRANT INSERT (account_id, kind) ON notification_mute TO carshenas_web;
-- The worker deletes old notifications (ADR-0026 point 6), reading what it deletes.
GRANT SELECT, DELETE ON notification TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION create_notification(bigint, text, text, jsonb, bigint);
DROP TABLE notification_mute;
DROP TABLE notification;
DROP TABLE notification_kind;
