-- migrate:up
-- Who paused or resumed a source, and when (CS-40, ADR-0023). The superadmin section changes a source's crawl state
-- only through change_source_state(), the one change to a source its role, carshenas_admin, may make: the function
-- locks the source, compares it with what the person saw, applies the change and appends the change here, in one
-- transaction. Resuming a source the crawler stopped on a block clears the stop on the source, as
-- source_stop_recorded requires, and the change keeps the stop it cleared. The crawler's stops themselves are on the
-- source row and in fetch_log (ADR-0008 point 6), so they are not repeated here.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE source_state_change (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id             text NOT NULL,
  from_state            text NOT NULL
                        CONSTRAINT source_state_change_from_state_valid
                        CHECK (from_state IN ('enabled', 'paused', 'stopped_on_block')),
  -- A person enables or pauses a source; only the crawler stops one (stop_source()).
  to_state              text NOT NULL
                        CONSTRAINT source_state_change_to_state_valid CHECK (to_state IN ('enabled', 'paused')),
  changed_by_account_id bigint NOT NULL,
  changed_at            timestamptz NOT NULL DEFAULT now(),
  cleared_stopped_at    timestamptz,
  cleared_stop_reason   text
                        CONSTRAINT source_state_change_cleared_stop_reason_valid
                        CHECK (cleared_stop_reason IN ('blocked', 'rate_limited', 'challenge')),
  CONSTRAINT source_state_change_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE RESTRICT,
  CONSTRAINT source_state_change_account_fk
    FOREIGN KEY (changed_by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  CONSTRAINT source_state_change_is_change CHECK (from_state <> to_state),
  -- Leaving a stop clears it on the source; here it stays, with when and why.
  CONSTRAINT source_state_change_stop_kept CHECK (
    (from_state = 'stopped_on_block') = (cleared_stopped_at IS NOT NULL)
    AND (from_state = 'stopped_on_block') = (cleared_stop_reason IS NOT NULL))
);

-- Serves the foreign key and "a source's latest changes first" on the sources screen.
CREATE INDEX source_state_change_source_changed_idx ON source_state_change (source_id, changed_at DESC, id DESC);
CREATE INDEX source_state_change_account_idx ON source_state_change (changed_by_account_id);

CREATE TRIGGER source_state_change_append_only
  BEFORE UPDATE OR DELETE ON source_state_change
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER source_state_change_append_only_truncate
  BEFORE TRUNCATE ON source_state_change
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE source_state_change IS
  'Append-only record of every change a person made to a source''s crawl state in the superadmin section (CS-40, ADR-0023), written by change_source_state() in the transaction that makes it.';
COMMENT ON COLUMN source_state_change.from_state IS 'source.crawl_state before the change.';
COMMENT ON COLUMN source_state_change.to_state IS
  'source.crawl_state after it: enabled or paused. Only the crawler stops a source (stop_source()).';
COMMENT ON COLUMN source_state_change.changed_by_account_id IS
  'The superadmin who made the change; change_source_state() refuses any other account.';
COMMENT ON COLUMN source_state_change.changed_at IS 'When the change was made: its transaction''s start.';
COMMENT ON COLUMN source_state_change.cleared_stopped_at IS
  'For a change away from stopped_on_block, the stop it cleared: source.stopped_at, the start of the blocked request in fetch_log.';
COMMENT ON COLUMN source_state_change.cleared_stop_reason IS
  'For a change away from stopped_on_block, why the crawler had stopped the source: source.stop_reason.';

-- Optimistic concurrency without a version column: whether a person's choice still holds depends only on the state and
-- the stop they saw, so the function compares those two (the stop as the database's own text, exact to the
-- microsecond, which a JavaScript Date is not). A source already in the chosen state is left alone, so a repeated
-- press changes nothing. The superadmin check repeats the section's own (requireSuperadmin(), ADR-0020 point 10) where
-- no bug in the app can skip it.
CREATE FUNCTION change_source_state(
  changing_source_id text,
  seen_state text,
  seen_stopped_at timestamptz,
  new_state text,
  changed_by bigint)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  source_row record;
BEGIN
  IF new_state IS NULL OR new_state NOT IN ('enabled', 'paused') THEN
    RAISE EXCEPTION 'a person may only enable or pause a source, not set it to %', new_state
      USING ERRCODE = 'check_violation', CONSTRAINT = 'source_state_change_to_state_valid',
        TABLE = 'source_state_change';
  END IF;
  PERFORM FROM public.account a WHERE a.id = changed_by AND a.role = 'superadmin' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account % is not a superadmin: only a superadmin changes a source''s crawl state', changed_by
      USING ERRCODE = 'check_violation', CONSTRAINT = 'source_state_change_by_superadmin',
        TABLE = 'source_state_change';
  END IF;
  SELECT s.crawl_state, s.stopped_at, s.stop_reason INTO source_row
  FROM public.source s
  WHERE s.id = changing_source_id
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;
  IF source_row.crawl_state = new_state THEN
    RETURN 'unchanged';
  END IF;
  IF (source_row.crawl_state, source_row.stopped_at) IS DISTINCT FROM (seen_state, seen_stopped_at) THEN
    RETURN 'stale';
  END IF;
  UPDATE public.source
  SET crawl_state = new_state, stopped_at = NULL, stop_reason = NULL
  WHERE id = changing_source_id;
  INSERT INTO public.source_state_change (
    source_id, from_state, to_state, changed_by_account_id, cleared_stopped_at, cleared_stop_reason)
  VALUES (
    changing_source_id, source_row.crawl_state, new_state, changed_by, source_row.stopped_at, source_row.stop_reason);
  RETURN 'changed';
END
$$;

COMMENT ON FUNCTION change_source_state(text, text, timestamptz, text, bigint) IS
  'Enables or pauses a source for a superadmin (CS-40, ADR-0023) and records the change in source_state_change: changed; unchanged when the source is in that state already; stale, changing nothing, when its state or stop is no longer what the person saw, or it is gone. A stop it leaves is cleared on the source and kept in the change. Refuses any account but a superadmin (source_state_change_by_superadmin) and any state but enabled or paused (source_state_change_to_state_valid); a source that is not crawled cannot be enabled (source_only_crawled_sources_run).';

REVOKE EXECUTE ON FUNCTION change_source_state(text, text, timestamptz, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION change_source_state(text, text, timestamptz, text, bigint) TO carshenas_admin;

-- The superadmin section reads what its screens show through its own role: the sources and their changes, and the
-- names of the accounts that made them (never a password hash). It changes nothing directly.
GRANT SELECT ON source TO carshenas_admin;
GRANT SELECT ON source_state_change TO carshenas_admin;
GRANT SELECT (id, username, role, created_at) ON account TO carshenas_admin;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE SELECT (id, username, role, created_at) ON account FROM carshenas_admin;
REVOKE SELECT ON source FROM carshenas_admin;
DROP FUNCTION change_source_state(text, text, timestamptz, text, bigint);
DROP TABLE source_state_change;
