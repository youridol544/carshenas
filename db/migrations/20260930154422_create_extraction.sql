-- migrate:up
-- What a listing's text says, read by the listing.facts AI step (CS-52; docs/design/data-model.md, layer 2): each
-- extraction links a snapshot to the validated answer it used (ai_answer, CS-45), each field keeps its value, evidence,
-- the confidence code computed from signals and the threshold it was held to, and one review queue holds the fields
-- below their threshold, the extractions held whole, and the answers that never validated. Invalid output is never
-- stored as a value (CS-52 #1): an invalid answer is only a review item with its problems. The text's reading stays
-- here; the listing's derivation merges it with CS-34's columns (the owner's decision of 2026-09-30).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE extraction_field_def (
  code text NOT NULL,
  min_confidence numeric(4,3) NOT NULL,
  CONSTRAINT extraction_field_def_pkey PRIMARY KEY (code),
  CONSTRAINT extraction_field_def_code_format CHECK (code ~ '^[a-z][a-z_]{0,39}$'),
  CONSTRAINT extraction_field_def_min_confidence_range CHECK (min_confidence > 0 AND min_confidence <= 1)
);
COMMENT ON TABLE extraction_field_def IS
  'Every field an extraction step reads from text, with the confidence a value needs before it is used (CS-52): below it, the field waits in review_item.';
INSERT INTO extraction_field_def (code, min_confidence) VALUES
  ('paint', 0.75), ('replaced', 0.75), ('chassis', 0.75), ('accident', 0.75), ('negotiable', 0.75),
  ('installment', 0.75), ('swap', 0.75), ('ride_hailing', 0.75), ('price_meaning', 0.75), ('plate', 0.75),
  ('panels', 0.75);

CREATE TABLE extraction (
  id bigint GENERATED ALWAYS AS IDENTITY,
  snapshot_id bigint NOT NULL,
  listing_id bigint NOT NULL,
  ai_answer_id bigint NOT NULL,
  status text NOT NULL,
  hold_reasons text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT extraction_pkey PRIMARY KEY (id),
  CONSTRAINT extraction_snapshot_fk FOREIGN KEY (snapshot_id, listing_id)
    REFERENCES snapshot (id, listing_id) ON DELETE CASCADE,
  CONSTRAINT extraction_ai_answer_fk FOREIGN KEY (ai_answer_id) REFERENCES ai_answer (id) ON DELETE RESTRICT,
  CONSTRAINT extraction_snapshot_answer_unique UNIQUE (snapshot_id, ai_answer_id),
  CONSTRAINT extraction_status_valid CHECK (status IN ('usable', 'held')),
  CONSTRAINT extraction_hold_reasons_valid CHECK (hold_reasons <@ ARRAY['addressed_model', 'hidden_characters']::text[]),
  CONSTRAINT extraction_held_with_reason CHECK ((status = 'held') = (cardinality(hold_reasons) > 0))
);
CREATE INDEX extraction_ai_answer_idx ON extraction (ai_answer_id);
COMMENT ON TABLE extraction IS
  'One snapshot read by an AI extraction step (CS-52) through one validated answer; a new prompt version gives a new answer and a new row beside the old. Derived: deleted with its snapshot.';
COMMENT ON COLUMN extraction.listing_id IS 'The snapshot''s listing, part of the composite key to snapshot so an extraction cannot name another listing''s snapshot.';
COMMENT ON COLUMN extraction.status IS
  'usable: its accepted fields may be used; held: a person reads it first, because the listing addressed the model or hid tag characters (hold_reasons).';
COMMENT ON CONSTRAINT extraction_snapshot_fk ON extraction IS
  'unindexed: extraction_snapshot_answer_unique starts with snapshot_id, which is the snapshot''s own key.';

CREATE TABLE extraction_field (
  extraction_id bigint NOT NULL,
  field text NOT NULL,
  value text NOT NULL,
  evidence text NOT NULL,
  confidence numeric(4,3) NOT NULL,
  threshold numeric(4,3) NOT NULL,
  status text NOT NULL,
  CONSTRAINT extraction_field_pkey PRIMARY KEY (extraction_id, field),
  CONSTRAINT extraction_field_extraction_fk FOREIGN KEY (extraction_id) REFERENCES extraction (id) ON DELETE CASCADE,
  CONSTRAINT extraction_field_def_fk FOREIGN KEY (field) REFERENCES extraction_field_def (code) ON DELETE RESTRICT,
  CONSTRAINT extraction_field_value_format CHECK (value ~ '^[a-z0-9_]{1,40}$'),
  CONSTRAINT extraction_field_evidence_with_value CHECK ((value = 'not_stated') = (evidence = '')),
  CONSTRAINT extraction_field_evidence_length CHECK (char_length(evidence) <= 1200),
  CONSTRAINT extraction_field_confidence_range CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT extraction_field_threshold_range CHECK (threshold > 0 AND threshold <= 1),
  CONSTRAINT extraction_field_status_valid CHECK (status IN ('accepted', 'needs_review')),
  CONSTRAINT extraction_field_status_by_threshold CHECK ((status = 'accepted') = (confidence >= threshold))
);
COMMENT ON TABLE extraction_field IS
  'Each field of an extraction (CS-52): the value the model chose, the phrase of the listing it copied as evidence, and the confidence computed in code from signals (never the model''s own), accepted only at or above the threshold it was held to.';
COMMENT ON COLUMN extraction_field.value IS 'The schema''s value code, such as partial, down_payment, free_zone or 5_or_more; not_stated when the text says nothing.';
COMMENT ON COLUMN extraction_field.threshold IS 'extraction_field_def.min_confidence when the field was stored, kept for audit.';
COMMENT ON CONSTRAINT extraction_field_def_fk ON extraction_field IS
  'unindexed: field definitions are a curated list of a dozen codes that are never deleted.';

-- Recorded model responses are never changed in place (section 1): an extraction and its fields leave only with their
-- snapshot, in a purge. A new prompt version writes new rows beside the old.
CREATE TRIGGER extraction_append_only
  BEFORE UPDATE OR DELETE ON extraction
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER extraction_append_only_truncate
  BEFORE TRUNCATE ON extraction
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER extraction_field_append_only
  BEFORE UPDATE OR DELETE ON extraction_field
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER extraction_field_append_only_truncate
  BEFORE TRUNCATE ON extraction_field
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

CREATE TABLE review_item (
  id bigint GENERATED ALWAYS AS IDENTITY,
  kind text NOT NULL,
  extraction_id bigint,
  field text,
  snapshot_id bigint,
  task text,
  prompt_version text,
  outcome text,
  problems jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT review_item_pkey PRIMARY KEY (id),
  CONSTRAINT review_item_field_fk FOREIGN KEY (extraction_id, field)
    REFERENCES extraction_field (extraction_id, field) ON DELETE CASCADE,
  CONSTRAINT review_item_extraction_fk FOREIGN KEY (extraction_id) REFERENCES extraction (id) ON DELETE CASCADE,
  CONSTRAINT review_item_snapshot_fk FOREIGN KEY (snapshot_id) REFERENCES snapshot (id) ON DELETE CASCADE,
  CONSTRAINT review_item_kind_valid CHECK (kind IN ('extraction_field', 'extraction_held', 'answer_invalid')),
  CONSTRAINT review_item_subject_by_kind CHECK (
    CASE kind
      WHEN 'extraction_field' THEN extraction_id IS NOT NULL AND field IS NOT NULL AND snapshot_id IS NULL
        AND task IS NULL AND prompt_version IS NULL AND outcome IS NULL AND problems IS NULL
      WHEN 'extraction_held' THEN extraction_id IS NOT NULL AND field IS NULL AND snapshot_id IS NULL
        AND task IS NULL AND prompt_version IS NULL AND outcome IS NULL AND problems IS NULL
      WHEN 'answer_invalid' THEN extraction_id IS NULL AND field IS NULL AND snapshot_id IS NOT NULL
        AND task IS NOT NULL AND prompt_version IS NOT NULL AND outcome IS NOT NULL AND problems IS NOT NULL
    END),
  CONSTRAINT review_item_task_format CHECK (task ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$'),
  CONSTRAINT review_item_prompt_version_format CHECK (prompt_version ~ '^[0-9a-f]{16}$'),
  CONSTRAINT review_item_outcome_valid CHECK (outcome IN ('invalid', 'refusal', 'truncated', 'empty', 'error')),
  CONSTRAINT review_item_problems_is_array CHECK (jsonb_typeof(problems) = 'array'),
  CONSTRAINT review_item_status_valid CHECK (status IN ('open', 'resolved', 'dismissed')),
  CONSTRAINT review_item_closed_when_done CHECK ((status = 'open') = (closed_at IS NULL))
);
-- One open item per subject, so a job that runs twice queues nothing twice; also serves both extraction keys.
CREATE UNIQUE INDEX review_item_open_subject_unique ON review_item (extraction_id, field, kind, snapshot_id, prompt_version)
  NULLS NOT DISTINCT WHERE status = 'open';
CREATE INDEX review_item_extraction_idx ON review_item (extraction_id, field);
CREATE INDEX review_item_snapshot_idx ON review_item (snapshot_id);
COMMENT ON TABLE review_item IS
  'The one human review queue (CS-52; CS-50 and CS-55 add their kinds): a field below its threshold, an extraction held whole, or an answer that never validated, with its problems. Problems quote the listing, so they stay here and never reach a log.';
COMMENT ON COLUMN review_item.problems IS 'The layer''s problems for an answer that never validated: [{path, message}], each naming the field, the value seen and what is admissible; for outcome error, why no answer came after repeated calls.';

-- The worker reads snapshots, stores extractions and queues reviews; a person closes reviews in the superadmin section
-- (a later task grants carshenas_admin). Rows are only added by the worker, and leave with their snapshot.
GRANT SELECT ON extraction_field_def TO carshenas_worker;
GRANT SELECT, INSERT ON extraction, extraction_field, review_item TO carshenas_worker;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE review_item;
DROP TABLE extraction_field;
DROP TABLE extraction;
DROP TABLE extraction_field_def;
