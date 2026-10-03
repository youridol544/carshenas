-- migrate:up
-- Proactive matching (CS-72, ADR-0033): after the search table is refreshed, a worker job tells each watching file's buyer
-- what is new, in one notification per file per run. Matches stay unstored (ADR-0031); what the job needs is:
--  * search_document.indexed_at, when a listing first became searchable (an upsert never changes it), the one clock a
--    file's «new» is measured on, by the job and by the file's page;
--  * search_file.matched_through, the job's watermark: every row indexed up to it has been matched for the file;
--  * search_file.muted_at, the buyer's mute of this one file, which create_notification() honours;
--  * search_file.last_alert_at, when the buyer was last told, for the list and the page;
--  * notification.search_file_id and the kind search_file_matches, whose event key names the file and the run.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Existing rows get the migration's time first (a constant default: no rewrite), then their listing's first sight, so
-- «new» keeps the meaning it had before this column (listing.created_at); new rows get the instant they are inserted.
ALTER TABLE search_document ADD COLUMN indexed_at timestamptz NOT NULL DEFAULT now();
UPDATE search_document d SET indexed_at = l.created_at FROM listing l WHERE l.id = d.listing_id AND l.created_at < d.indexed_at;
ALTER TABLE search_document ALTER COLUMN indexed_at SET DEFAULT clock_timestamp();
COMMENT ON COLUMN search_document.indexed_at IS
  'When the listing first became searchable (CS-72): set by the insert, never by the build''s update, so it is the instant the listing first appeared in search. A row that expires and is built again starts again. A file''s new matches are the rows indexed after its baseline.';

ALTER TABLE search_file
  ADD COLUMN muted_at timestamptz,
  ADD COLUMN matched_through timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN last_alert_at timestamptz;
ALTER TABLE search_file
  ADD CONSTRAINT search_file_matched_after_created CHECK (matched_through >= created_at) NOT VALID,
  ADD CONSTRAINT search_file_muted_after_created CHECK (muted_at >= created_at) NOT VALID,
  ADD CONSTRAINT search_file_alert_after_created CHECK (last_alert_at >= created_at) NOT VALID;

COMMENT ON COLUMN search_file.muted_at IS
  'When the buyer turned off alerts for this file (NULL: alerts on). The file keeps matching and showing what is new; create_notification() creates nothing for a muted file.';
COMMENT ON COLUMN search_file.matched_through IS
  'The matching job''s watermark (CS-72): every listing indexed up to this instant was matched against the file, and the buyer told if it was watched and unmuted. Starts at the file''s creation, so what the search showed then is not alerted; advanced for paused, closed and muted files too, so a buyer who resumes is not flooded; held back only when the account''s daily cap is reached, so the next run tells the whole backlog in one digest.';
COMMENT ON COLUMN search_file.last_alert_at IS 'When the matching job last notified the buyer about this file (NULL: never).';

-- The buyer mutes and unmutes the file; the job moves the watermark and the time of its alert.
GRANT UPDATE (muted_at) ON search_file TO carshenas_web;
GRANT UPDATE (matched_through, last_alert_at) ON search_file TO carshenas_worker;

-- A notification about a search file (the constraints are validated, and the index made, in the next migrations).
INSERT INTO notification_kind (id, description) VALUES
  ('search_file_matches', 'A watching search file found new listings or price drops since the last alert: one digest per file per matching run (CS-72).');

ALTER TABLE notification ADD COLUMN search_file_id bigint;
ALTER TABLE notification
  ADD CONSTRAINT notification_search_file_fk FOREIGN KEY (search_file_id) REFERENCES search_file (id) ON DELETE CASCADE NOT VALID,
  ADD CONSTRAINT notification_search_file_kind_has_file CHECK (kind <> 'search_file_matches' OR search_file_id IS NOT NULL) NOT VALID;
COMMENT ON COLUMN notification.search_file_id IS
  'The search file it is about, for the search file kinds; a deleted file takes its notifications.';

-- The one writer gains the file's mute: nothing is created for a muted file.
DROP FUNCTION create_notification(bigint, text, text, jsonb, bigint);
CREATE FUNCTION create_notification(
  for_account_id bigint,
  of_kind text,
  for_event_key text,
  with_payload jsonb,
  about_listing_id bigint DEFAULT NULL,
  about_search_file_id bigint DEFAULT NULL)
  RETURNS bigint
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
  INSERT INTO public.notification (account_id, kind, event_key, payload, listing_id, search_file_id)
  SELECT for_account_id, of_kind, for_event_key, with_payload, about_listing_id, about_search_file_id
  WHERE NOT EXISTS (
    SELECT FROM public.notification_mute m WHERE m.account_id = for_account_id AND m.kind = of_kind)
    AND NOT EXISTS (
    SELECT FROM public.search_file f WHERE f.id = about_search_file_id AND f.muted_at IS NOT NULL)
  ON CONFLICT ON CONSTRAINT notification_once_per_event_unique DO NOTHING
  RETURNING id
$$;

COMMENT ON FUNCTION create_notification(bigint, text, text, jsonb, bigint, bigint) IS
  'The only way a notification is written (ADR-0026 point 2): returns the new id, or NULL when the account muted the kind, muted the search file it is about, or was already told of this event. Call it in the transaction that records the event, so both commit or neither does. A missing account, kind, listing or file, a malformed event key and a payload that is not a small object are refused by the table''s constraints.';

REVOKE EXECUTE ON FUNCTION create_notification(bigint, text, text, jsonb, bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_notification(bigint, text, text, jsonb, bigint, bigint) TO carshenas_worker, carshenas_admin;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP FUNCTION create_notification(bigint, text, text, jsonb, bigint, bigint);
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
REVOKE EXECUTE ON FUNCTION create_notification(bigint, text, text, jsonb, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_notification(bigint, text, text, jsonb, bigint) TO carshenas_worker, carshenas_admin;

DELETE FROM notification WHERE kind = 'search_file_matches';
ALTER TABLE notification DROP COLUMN search_file_id;
DELETE FROM notification_mute WHERE kind = 'search_file_matches';
DELETE FROM notification_kind WHERE id = 'search_file_matches';
ALTER TABLE search_file DROP COLUMN muted_at, DROP COLUMN matched_through, DROP COLUMN last_alert_at;
ALTER TABLE search_document DROP COLUMN indexed_at;
