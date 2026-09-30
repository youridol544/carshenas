-- migrate:up
-- Retrying or cancelling a job from the superadmin section (CS-41 criterion 2, the owner's decision of 2026-09-30,
-- ADR-0023's pattern): the section's role, carshenas_admin, cannot write pg-boss's tables; it calls change_job_state(),
-- which checks the account is a superadmin, locks the job, compares it with the state the person saw, applies pg-boss's
-- own retry or cancel in SQL and appends the change here, in one transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE job_state_change (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- No foreign key to pgboss.job: pg-boss deletes finished jobs after their retention, and the history outlives them.
  queue                 text NOT NULL
                        CONSTRAINT job_state_change_queue_format
                        CHECK (btrim(queue) <> '' AND char_length(queue) <= 200),
  job_id                uuid NOT NULL,
  action                text NOT NULL CONSTRAINT job_state_change_action_valid CHECK (action IN ('retry', 'cancel')),
  from_state            text NOT NULL,
  changed_by_account_id bigint NOT NULL,
  changed_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_state_change_account_fk
    FOREIGN KEY (changed_by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  -- A failed job is retried; a job still waiting to run, or to run again, is cancelled.
  CONSTRAINT job_state_change_from_state_valid CHECK (
    (action = 'retry' AND from_state = 'failed') OR (action = 'cancel' AND from_state IN ('created', 'retry')))
);

-- Serves "the latest changes first" on the worker screen.
CREATE INDEX job_state_change_changed_idx ON job_state_change (changed_at DESC, id DESC);
CREATE INDEX job_state_change_account_idx ON job_state_change (changed_by_account_id);

CREATE TRIGGER job_state_change_append_only
  BEFORE UPDATE OR DELETE ON job_state_change
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER job_state_change_append_only_truncate
  BEFORE TRUNCATE ON job_state_change
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE job_state_change IS
  'Append-only record of every job a superadmin retried or cancelled in the superadmin section (CS-41, ADR-0023), written by change_job_state() in the transaction that makes the change.';
COMMENT ON COLUMN job_state_change.queue IS 'The pg-boss queue of the job (pgboss.job.name).';
COMMENT ON COLUMN job_state_change.job_id IS 'pgboss.job.id; the job itself may since have been deleted by pg-boss.';
COMMENT ON COLUMN job_state_change.from_state IS 'pgboss.job.state before the change.';
COMMENT ON COLUMN job_state_change.changed_by_account_id IS
  'The superadmin who made the change; change_job_state() refuses any other account.';
COMMENT ON COLUMN job_state_change.changed_at IS
  'When the change took effect, holding the job''s lock (clock_timestamp()).';

-- pg-boss's retry (retryJobs in pg-boss 12's plans): state retry, one more attempt allowed, completion cleared. It
-- also starts the job now and slides keep_until by its original retention window, which pg-boss's own retry leaves
-- behind: a queued job past keep_until is deleted by pg-boss's maintenance. pg-boss's cancel (cancelJobs): state
-- cancelled, completed now. A job already in the chosen state is left alone, so a repeated press changes nothing.
CREATE FUNCTION change_job_state(
  changing_queue text,
  changing_job_id uuid,
  seen_state text,
  chosen_action text,
  changed_by bigint)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  job_row record;
BEGIN
  IF chosen_action IS NULL OR chosen_action NOT IN ('retry', 'cancel') THEN
    RAISE EXCEPTION 'a person may only retry or cancel a job, not %', chosen_action
      USING ERRCODE = 'check_violation', CONSTRAINT = 'job_state_change_action_valid', TABLE = 'job_state_change';
  END IF;
  PERFORM FROM public.account a WHERE a.id = changed_by AND a.role = 'superadmin' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account % is not a superadmin: only a superadmin retries or cancels a job', changed_by
      USING ERRCODE = 'check_violation', CONSTRAINT = 'job_state_change_by_superadmin', TABLE = 'job_state_change';
  END IF;
  SELECT j.state::text AS state INTO job_row
  FROM pgboss.job j
  WHERE j.name = changing_queue AND j.id = changing_job_id
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;
  IF (chosen_action = 'retry' AND job_row.state = 'retry') OR (chosen_action = 'cancel' AND job_row.state = 'cancelled')
  THEN
    RETURN 'unchanged';
  END IF;
  IF job_row.state IS DISTINCT FROM seen_state
     OR NOT ((chosen_action = 'retry' AND job_row.state = 'failed')
             OR (chosen_action = 'cancel' AND job_row.state IN ('created', 'retry'))) THEN
    RETURN 'stale';
  END IF;
  IF chosen_action = 'retry' THEN
    UPDATE pgboss.job
    SET state = 'retry', retry_limit = retry_limit + 1, completed_on = NULL, start_after = now(),
        keep_until = now() + (keep_until - start_after)
    WHERE name = changing_queue AND id = changing_job_id;
  ELSE
    UPDATE pgboss.job
    SET state = 'cancelled', completed_on = now()
    WHERE name = changing_queue AND id = changing_job_id;
  END IF;
  INSERT INTO public.job_state_change (queue, job_id, action, from_state, changed_by_account_id, changed_at)
  VALUES (changing_queue, changing_job_id, chosen_action, job_row.state, changed_by, clock_timestamp());
  RETURN 'changed';
END
$$;

COMMENT ON FUNCTION change_job_state(text, uuid, text, text, bigint) IS
  'Retries a failed job or cancels a waiting one for a superadmin (CS-41, ADR-0023) and records it in job_state_change: changed; unchanged when the job is already retrying or cancelled; stale, changing nothing, when the job is gone or its state is no longer the one the person saw, or the action does not apply to it. Refuses any account but a superadmin (job_state_change_by_superadmin) and any action but retry or cancel (job_state_change_action_valid).';

REVOKE EXECUTE ON FUNCTION change_job_state(text, uuid, text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION change_job_state(text, uuid, text, text, bigint) TO carshenas_admin;
GRANT SELECT ON job_state_change TO carshenas_admin;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION change_job_state(text, uuid, text, text, bigint);
DROP TABLE job_state_change;
