-- migrate:up
-- A published evaluation of an AI step (CS-66): the scores of a dated report in docs/evidence, kept as rows so the
-- public data-status page shows them from the database, like every other number it shows (ADR-0017 point 6; AGENTS.md:
-- numbers a person sees come from the database). One row per task, prompt version and model; a new report is a new
-- row, never an edit. Seeded with CS-52's evaluation of listing.facts on 2026-09-30, its primary model on the test
-- split (held out while the prompt was written), and the injected listings of the whole labelled set.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE ai_evaluation (
  id bigint GENERATED ALWAYS AS IDENTITY,
  task text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  evaluated_on date NOT NULL,
  items integer NOT NULL,
  items_right integer NOT NULL,
  fields_scored integer NOT NULL,
  fields_right integer NOT NULL,
  injected_items integer NOT NULL,
  injected_held integer NOT NULL,
  report_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_evaluation_pkey PRIMARY KEY (id),
  CONSTRAINT ai_evaluation_run_unique UNIQUE (task, prompt_version, model),
  CONSTRAINT ai_evaluation_task_format CHECK (task ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$'),
  CONSTRAINT ai_evaluation_prompt_version_format CHECK (prompt_version ~ '^[0-9a-f]{16}$'),
  CONSTRAINT ai_evaluation_model_format CHECK (model ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'),
  CONSTRAINT ai_evaluation_items_range CHECK (items > 0 AND items_right BETWEEN 0 AND items),
  CONSTRAINT ai_evaluation_fields_range CHECK (fields_scored > 0 AND fields_right BETWEEN 0 AND fields_scored),
  CONSTRAINT ai_evaluation_injected_range CHECK (injected_items >= 0 AND injected_held BETWEEN 0 AND injected_items),
  CONSTRAINT ai_evaluation_report_path_format CHECK (report_path ~ '^docs/evidence/[a-z0-9][a-z0-9/._-]*\.md$')
);
CREATE TRIGGER ai_evaluation_append_only
  BEFORE UPDATE OR DELETE ON ai_evaluation
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER ai_evaluation_append_only_truncate
  BEFORE TRUNCATE ON ai_evaluation
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();
COMMENT ON TABLE ai_evaluation IS
  'A published evaluation of an AI step on its labelled set (CS-66): the scores of a dated report in docs/evidence, which the public data-status page shows. Append-only; a new report is a new row.';
COMMENT ON COLUMN ai_evaluation.task IS 'The AI layer''s task name, as in model_spend (listing.facts).';
COMMENT ON COLUMN ai_evaluation.items IS 'Labelled items scored for items_right and the fields: the test split, held out while the prompt was written.';
COMMENT ON COLUMN ai_evaluation.items_right IS 'Items whose every scored field was right.';
COMMENT ON COLUMN ai_evaluation.fields_scored IS 'Fields scored over those items; an item without a valid answer counts wrong on every field.';
COMMENT ON COLUMN ai_evaluation.injected_items IS 'Items of the whole labelled set whose text addresses the model (prompt injection); 0 when the set has none.';
COMMENT ON COLUMN ai_evaluation.injected_held IS 'Of injected_items, those the step held for a person instead of using.';
COMMENT ON COLUMN ai_evaluation.report_path IS 'The report the scores come from, relative to the repository root.';

GRANT SELECT ON ai_evaluation TO carshenas_web;

-- CS-52's report of 2026-09-30 (docs/evidence/listing-facts/2026-09-30/report.md): google/gemini-3.7-flash, test
-- split 791 of 792 fields and 65 of 66 listings fully right; 11 of 11 injected listings held for a person.
INSERT INTO ai_evaluation (
  task, prompt_version, model, evaluated_on, items, items_right, fields_scored, fields_right, injected_items,
  injected_held, report_path)
VALUES (
  'listing.facts', '571b413f827bf546', 'google/gemini-3.7-flash', '2026-09-30', 66, 65, 792, 791, 11, 11,
  'docs/evidence/listing-facts/2026-09-30/report.md');

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE ai_evaluation;
