-- migrate:up
-- What every paid model call cost, whatever came back (CS-52; the owner's US$10 daily cap on extraction): an answer
-- that validated, one sent to review, and a call that got no answer at all. ai_answer keeps only validated answers, so
-- a cap summed there would miss the others; this is what the cap sums. A call answered from the cache costs nothing
-- and has no row. A cost the layer could not measure (a timed-out attempt, a model with no price) is an estimate.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE model_spend (
  id bigint GENERATED ALWAYS AS IDENTITY,
  task text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  outcome text NOT NULL,
  error_reason text,
  cost_usd_micros bigint NOT NULL,
  estimated boolean NOT NULL,
  snapshot_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_spend_pkey PRIMARY KEY (id),
  CONSTRAINT model_spend_snapshot_fk FOREIGN KEY (snapshot_id) REFERENCES snapshot (id) ON DELETE CASCADE,
  CONSTRAINT model_spend_task_format CHECK (task ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$'),
  CONSTRAINT model_spend_prompt_version_format CHECK (prompt_version ~ '^[0-9a-f]{16}$'),
  CONSTRAINT model_spend_model_format CHECK (model ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'),
  CONSTRAINT model_spend_outcome_valid CHECK (outcome IN ('ok', 'invalid', 'refusal', 'truncated', 'empty', 'error')),
  CONSTRAINT model_spend_error_reason_valid CHECK (
    error_reason IN ('timeout', 'aborted', 'rate_limited', 'unavailable', 'unauthorized', 'no_credit', 'rejected')),
  CONSTRAINT model_spend_reason_with_error CHECK ((outcome = 'error') = (error_reason IS NOT NULL)),
  CONSTRAINT model_spend_cost_usd_micros_range CHECK (cost_usd_micros BETWEEN 0 AND 999999999999999)
);
-- The day's spend of a task, read once per job run: an index-only scan of today's rows.
CREATE INDEX model_spend_task_created_idx ON model_spend (task, created_at) INCLUDE (cost_usd_micros);
-- The snapshot key, and how often a snapshot's calls got no answer at a prompt version.
CREATE INDEX model_spend_snapshot_idx ON model_spend (snapshot_id, prompt_version);
CREATE TRIGGER model_spend_append_only
  BEFORE UPDATE OR DELETE ON model_spend
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER model_spend_append_only_truncate
  BEFORE TRUNCATE ON model_spend
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();
COMMENT ON TABLE model_spend IS
  'Every paid model call and what it cost, whatever came back (CS-52): what a daily spending cap sums. Cached answers cost nothing and have no row. Append-only; leaves with its snapshot in a purge.';
COMMENT ON COLUMN model_spend.cost_usd_micros IS 'Millionths of a US dollar at Metis''s price, every attempt of the call included.';
COMMENT ON COLUMN model_spend.estimated IS 'True when the layer could not measure the cost (an attempt that got no answer, a model with no price) and the caller counted its estimate.';
COMMENT ON COLUMN model_spend.snapshot_id IS 'The snapshot the call read, for a listing step; how often its calls failed decides when it goes to review.';

GRANT SELECT, INSERT ON model_spend TO carshenas_worker;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE model_spend;
