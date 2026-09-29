-- migrate:up
-- How many active listings a source holds per make, model and trim, as one walk of its list pages counted them
-- (CS-33 criteria 5 and 7; planned for CS-35 in docs/design/data-model.md, layer 1b, and created here for the first
-- measurement). A slice is one of the source's own filter values (Divar's brand_model: 'ROOT' for every car, a brand
-- such as 'Peugeot', a model such as 'Peugeot 206', a trim such as 'Peugeot 206 5'). The ten models with the most
-- listings become the first tracked models; CS-35's daily sweep writes the same rows and CS-53 shows them.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE model_volume (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id        text NOT NULL,
  source_model_key text NOT NULL
                   CONSTRAINT model_volume_source_model_key_not_blank CHECK (btrim(source_model_key) <> ''),
  level            text NOT NULL
                   CONSTRAINT model_volume_level_valid CHECK (level IN ('all', 'brand', 'model', 'trim')),
  swept_at         timestamptz NOT NULL,
  active_count     integer NOT NULL
                   CONSTRAINT model_volume_active_count_nonnegative CHECK (active_count >= 0),
  pages_read       integer NOT NULL
                   CONSTRAINT model_volume_pages_read_nonnegative CHECK (pages_read >= 0),
  complete         boolean NOT NULL,
  CONSTRAINT model_volume_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE CASCADE,
  -- One count per slice and sweep: a job that runs twice cannot count a slice twice.
  CONSTRAINT model_volume_sweep_unique UNIQUE (source_id, source_model_key, swept_at)
);

COMMENT ON TABLE model_volume IS
  'Active listings per source and filter value (make, model or trim), counted from the source''s list pages in one sweep; written once per slice and sweep.';
COMMENT ON COLUMN model_volume.source_model_key IS
  'The source''s own filter value for the slice, as its search takes it (Divar''s brand_model: ROOT, Peugeot, Peugeot 206, Peugeot 206 5); mapped to the catalogue when CS-50 knows it.';
COMMENT ON COLUMN model_volume.level IS 'all (every car), brand, model or trim: how finely the slice is cut.';
COMMENT ON COLUMN model_volume.swept_at IS 'When the sweep (or measurement) that counted it started: it groups one sweep''s slices.';
COMMENT ON COLUMN model_volume.active_count IS 'Listings the walk read in the slice, promoted rows counted once.';
COMMENT ON COLUMN model_volume.pages_read IS 'List pages the walk read: how deep the source let it follow the slice.';
COMMENT ON COLUMN model_volume.complete IS
  'Whether the walk reached the end of the slice; false when the source stopped answering pages first or the walk hit its page limit, and then active_count is a lower bound.';

GRANT SELECT, INSERT ON model_volume TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE model_volume;
