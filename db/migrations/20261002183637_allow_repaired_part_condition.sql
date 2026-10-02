-- migrate:up
-- CS-85: Divar's gearbox score reads «تعمیر شده» (repaired) on 54 of 6,088 derived listings. It is not needs_repair (the
-- part is not faulty now), not replaced and not sound, and no existing value may stand in for it, so the engine and
-- gearbox ratings get a fourth value, `repaired`; the next migration validates the CHECKs, which Squawk wants in a separate transaction. Valuation does not exclude it: S01 excludes only `replaced` and
-- `needs_repair`.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing
  DROP CONSTRAINT listing_engine_condition_valid,
  DROP CONSTRAINT listing_gearbox_condition_valid,
  ADD CONSTRAINT listing_engine_condition_valid
    CHECK (engine_condition IN ('sound', 'needs_repair', 'replaced', 'repaired')) NOT VALID,
  ADD CONSTRAINT listing_gearbox_condition_valid
    CHECK (gearbox_condition IN ('sound', 'needs_repair', 'replaced', 'repaired')) NOT VALID;

COMMENT ON COLUMN listing.engine_condition IS
  'The seller''s own rating of the engine: sound, needs_repair, replaced or repaired.';
COMMENT ON COLUMN listing.gearbox_condition IS
  'The seller''s own rating of the gearbox: sound, needs_repair, replaced or repaired.';

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- A listing rated `repaired` goes back to unrated, which is what the parser before CS-85 made of it (unparsed).
UPDATE listing SET engine_condition = NULL WHERE engine_condition = 'repaired';
UPDATE listing SET gearbox_condition = NULL WHERE gearbox_condition = 'repaired';

ALTER TABLE listing
  DROP CONSTRAINT listing_engine_condition_valid,
  DROP CONSTRAINT listing_gearbox_condition_valid,
  ADD CONSTRAINT listing_engine_condition_valid
    CHECK (engine_condition IN ('sound', 'needs_repair', 'replaced')) NOT VALID,
  ADD CONSTRAINT listing_gearbox_condition_valid
    CHECK (gearbox_condition IN ('sound', 'needs_repair', 'replaced')) NOT VALID;

COMMENT ON COLUMN listing.engine_condition IS 'The seller''s own rating of the engine: sound, needs_repair or replaced.';
COMMENT ON COLUMN listing.gearbox_condition IS 'The seller''s own rating of the gearbox: sound, needs_repair or replaced.';
