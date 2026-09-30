-- migrate:up
-- Which of the source's own model filters a listing belongs to (CS-35; ADR-0017 point 3): Divar's brand_model value
-- of the sweep slice that last showed it, or of its page. A complete sweep of a slice finds the listings it no longer
-- shows through it (active, of that key, not seen since the sweep started), and it tells a tracked model's listing
-- from an untracked one. It is the source's own value, not the catalogue's model: CS-50 maps one to the other.
-- Nullable: a listing stored before sweeps has none until a sweep or its page shows it.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing
  ADD COLUMN source_model_key text
    CONSTRAINT listing_source_model_key_format CHECK (source_model_key ~ '^\S(.*\S)?$' AND char_length(source_model_key) <= 200);

COMMENT ON COLUMN listing.source_model_key IS
  'The source''s own model filter value the listing was last seen under (Divar: brand_model, such as "Peugeot 206 SD"), from a sweep slice or its page; a complete sweep of that value finds the listings it no longer shows. Not the catalogue''s model (CS-50).';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing DROP COLUMN source_model_key;
