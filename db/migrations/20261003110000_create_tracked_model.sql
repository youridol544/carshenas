-- migrate:up
-- Tracked models (CS-53, ADR-0017 point 4, ADR-0037): the catalogue models, or one of their trims, that Carshenas reads
-- in depth, each with a priority, a state and how it came to be, and the append-only record of every change to them.
-- The table replaces the configured list the worker kept in code (CS-33) and the body of the view tracked_model_scope
-- (CS-71). Rows are changed only through change_tracked_model() and decide_crawl_request() (the next migration), which
-- record the superadmin who did it (ADR-0023).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE tracked_model (
  id                    bigint GENERATED ALWAYS AS IDENTITY,
  model_id              bigint NOT NULL,
  -- NULL: the whole model; a trim: only that trim (the composite key below keeps it under its own model).
  trim_id               bigint,
  state                 text NOT NULL DEFAULT 'tracking'
                        CONSTRAINT tracked_model_state_valid CHECK (state IN ('tracking', 'paused')),
  priority              text NOT NULL DEFAULT 'normal'
                        CONSTRAINT tracked_model_priority_valid CHECK (priority IN ('high', 'normal', 'low')),
  -- seed: the owner's first ten, set when this table was made; superadmin: chosen by hand in the section; request:
  -- made by the approval of a buyers' crawl request (CS-71).
  origin                text NOT NULL
                        CONSTRAINT tracked_model_origin_valid CHECK (origin IN ('seed', 'superadmin', 'request')),
  created_by_account_id bigint,
  crawl_request_id      bigint,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by_account_id bigint,
  CONSTRAINT tracked_model_pkey PRIMARY KEY (id),
  CONSTRAINT tracked_model_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE RESTRICT,
  CONSTRAINT tracked_model_trim_fk FOREIGN KEY (trim_id, model_id) REFERENCES trim (id, model_id) ON DELETE RESTRICT,
  CONSTRAINT tracked_model_creator_fk
    FOREIGN KEY (created_by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  CONSTRAINT tracked_model_updater_fk
    FOREIGN KEY (updated_by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  CONSTRAINT tracked_model_request_fk FOREIGN KEY (crawl_request_id) REFERENCES crawl_request (id) ON DELETE RESTRICT,
  -- One row per scope: the model, or one of its trims. NULLS NOT DISTINCT makes the whole-model scope one too. Also the
  -- index of model_id's foreign key and the lookup of a scope's row.
  CONSTRAINT tracked_model_once_per_scope_unique UNIQUE NULLS NOT DISTINCT (model_id, trim_id),
  -- A request makes at most one tracked model.
  CONSTRAINT tracked_model_request_unique UNIQUE (crawl_request_id),
  -- Every origin says exactly what it knows: the seed has no person (the owner chose it in the migration), a person's
  -- choice has the superadmin, a request's model has the approver and the request. IS [NOT] NULL is spelled out,
  -- because a CHECK passes when its expression is NULL.
  CONSTRAINT tracked_model_origin_matches CHECK (
    CASE origin
      WHEN 'seed' THEN created_by_account_id IS NULL AND crawl_request_id IS NULL
      WHEN 'superadmin' THEN created_by_account_id IS NOT NULL AND crawl_request_id IS NULL
      ELSE created_by_account_id IS NOT NULL AND crawl_request_id IS NOT NULL
    END),
  CONSTRAINT tracked_model_updated_after_created CHECK (updated_at >= created_at)
);

-- Serves the foreign keys of the people who created and last changed a row.
CREATE INDEX tracked_model_creator_idx ON tracked_model (created_by_account_id);
CREATE INDEX tracked_model_updater_idx ON tracked_model (updated_by_account_id);

COMMENT ON CONSTRAINT tracked_model_trim_fk ON tracked_model IS
  'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); a row is read by its scope, which the unique key serves.';
COMMENT ON TABLE tracked_model IS
  'The catalogue models (or one trim of a model) Carshenas reads in depth: its details, extraction, valuations and search results (CS-53, ADR-0017 point 4, ADR-0037). tracking is read, paused keeps its last data and is read no more. Changed only through change_tracked_model() and decide_crawl_request(), which write tracked_model_change.';
COMMENT ON COLUMN tracked_model.trim_id IS 'NULL tracks the whole model; a trim tracks that trim only.';
COMMENT ON COLUMN tracked_model.priority IS 'high, normal or low: the order the worker sweeps models and backfills their listings in, and how much of a tier of the daily budget each takes first (never a promise of more requests).';
COMMENT ON COLUMN tracked_model.origin IS 'How the row came to be: seed (the owner''s first ten), superadmin (chosen in the section by created_by_account_id) or request (the approval, by created_by_account_id, of crawl_request_id).';
COMMENT ON COLUMN tracked_model.created_by_account_id IS 'The superadmin who tracked it, or who approved the request that made it; NULL for the seed.';
COMMENT ON COLUMN tracked_model.updated_at IS 'When the row last changed (state or priority), by the database''s clock.';

-- Every change, append-only: who, what and when, kept after the row is gone (ADR-0023: a person changes a curated row
-- only through a function that records who).
CREATE TABLE tracked_model_change (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_id          bigint NOT NULL,
  trim_id           bigint,
  action            text NOT NULL
                    CONSTRAINT tracked_model_change_action_valid CHECK (action IN
                      ('seeded', 'tracked', 'from_request', 'paused', 'resumed', 'priority_changed', 'untracked',
                       'request_withdrawn')),
  -- The priority or state before and after, where the action changes one.
  from_value        text,
  to_value          text,
  by_account_id     bigint,
  crawl_request_id  bigint,
  changed_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracked_model_change_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE RESTRICT,
  CONSTRAINT tracked_model_change_trim_fk FOREIGN KEY (trim_id, model_id) REFERENCES trim (id, model_id) ON DELETE RESTRICT,
  CONSTRAINT tracked_model_change_by_fk FOREIGN KEY (by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  CONSTRAINT tracked_model_change_request_fk
    FOREIGN KEY (crawl_request_id) REFERENCES crawl_request (id) ON DELETE RESTRICT,
  -- Only the seed has no person.
  CONSTRAINT tracked_model_change_person CHECK ((action = 'seeded') = (by_account_id IS NULL))
);

-- A scope's history, newest first; also the model's foreign key.
CREATE INDEX tracked_model_change_scope_idx ON tracked_model_change (model_id, trim_id, changed_at DESC, id DESC);
CREATE INDEX tracked_model_change_by_idx ON tracked_model_change (by_account_id);
CREATE INDEX tracked_model_change_request_idx ON tracked_model_change (crawl_request_id);
-- The section's "latest changes" list.
CREATE INDEX tracked_model_change_recent_idx ON tracked_model_change (changed_at DESC, id DESC);

COMMENT ON CONSTRAINT tracked_model_change_trim_fk ON tracked_model_change IS
  'unindexed: catalogue rows are curated and never deleted; tracked_model_change_scope_idx starts with model_id.';

CREATE TRIGGER tracked_model_change_append_only
  BEFORE UPDATE OR DELETE ON tracked_model_change
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER tracked_model_change_append_only_truncate
  BEFORE TRUNCATE ON tracked_model_change
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE tracked_model_change IS
  'Append-only record of every change to the tracked models (CS-53, ADR-0023): tracked, paused, resumed, priority changed, untracked, made or withdrawn by a crawl request, and the seed. Written by change_tracked_model() and decide_crawl_request() in the transaction that changes the row; it outlives the row.';
COMMENT ON COLUMN tracked_model_change.from_value IS 'The state (paused, tracking) or priority before the change, where the action changes one.';
COMMENT ON COLUMN tracked_model_change.to_value IS 'The state or priority after the change.';

-- The scopes read in depth now: the view the pages ask ("is this model read in depth?") keeps its name and columns; its
-- body is the table (a paused model is not read, so a buyer may ask for it again). trim_id is NULL for a whole model.
CREATE OR REPLACE VIEW tracked_model_scope AS
SELECT t.model_id, t.trim_id
FROM tracked_model t
WHERE t.state = 'tracking';

COMMENT ON VIEW tracked_model_scope IS
  'The catalogue models (and trims) read in depth now: the rows of tracked_model in state tracking (CS-53; CS-71 read the keys of the latest freshness measurement before). trim_id is NULL for a whole model.';

-- The section reads everything it shows and changes the table only through functions; the worker reads what it
-- sweeps (the web app reads the view, which runs with its owner's rights).
GRANT SELECT ON tracked_model, tracked_model_change TO carshenas_admin;
GRANT SELECT ON tracked_model TO carshenas_worker;
GRANT SELECT ON tracked_model, tracked_model_change TO carshenas_readonly;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE VIEW tracked_model_scope AS
SELECT DISTINCT k.model_id, k.trim_id
FROM freshness_measurement m
JOIN catalogue_source_key k ON k.source_id = m.source_id AND k.source_model_key = m.source_model_key
WHERE m.source_model_key IS NOT NULL
  AND k.model_id IS NOT NULL
  AND m.measured_at = (SELECT max(latest.measured_at) FROM freshness_measurement latest
                       WHERE latest.source_id = m.source_id);
COMMENT ON VIEW tracked_model_scope IS
  'The catalogue models (and trims) read in depth now: the keys of each source''s latest freshness measurement, through catalogue_source_key (CS-71; CS-53 replaces the body with its tracked_model table). trim_id is NULL for a whole model.';
DROP TABLE tracked_model_change;
DROP TABLE tracked_model;
