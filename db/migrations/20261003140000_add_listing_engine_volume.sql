-- migrate:up
-- The engine volume a listing states itself (CS-99, ADR-0039): the parser reads it from the title («موتور ۱۴۰۰ سی‌سی»,
-- «۲ لیتری») by code, and `pnpm derive:listings` fills it for the listings already stored. Most posts state none, so
-- the column is null for nearly all of them and the volume comes from the car's trim or model (model_spec). It is a
-- derived attribute like the others, never an observation: rebuildable from the snapshot. The table has rows, so the
-- column arrives bare and the CHECK NOT VALID; the next migration validates it.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing
  ADD COLUMN engine_volume_cc integer,
  ADD CONSTRAINT listing_engine_volume_cc_range CHECK (engine_volume_cc >= 500 AND engine_volume_cc <= 9000) NOT VALID;

COMMENT ON COLUMN listing.engine_volume_cc IS 'The engine volume in cubic centimetres that the listing''s title states (500 to 9000), read by the parser; null when it states none. Beats the volume of the listing''s trim and model (model_spec).';

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing DROP COLUMN engine_volume_cc;
