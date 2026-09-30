-- migrate:up
-- What a listing is in the catalogue, and where the car is (CS-50; data-model.md, layers 3 and 4). catalogue_match is
-- one explicit state (the owner's decision of 2026-09-30): trim (its make, model and trim known), model (the source
-- named only the model, as a sweep's list row does, so the trim is unknown) or unmatched (the source's key is not in
-- the catalogue); never a guess. Set by the catalogue matching from source_model_key; the composite keys keep a
-- listing's make, model and trim consistent with each other. colour, city and district are read from the post by the
-- parser (CS-34's derivation). listing has rows, so the columns arrive bare and nullable, and the checks and foreign
-- keys NOT VALID; the next migration validates them.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing
  ADD COLUMN make_id bigint,
  ADD COLUMN model_id bigint,
  ADD COLUMN trim_id bigint,
  ADD COLUMN catalogue_match text,
  ADD COLUMN colour text,
  ADD COLUMN city_id bigint,
  ADD COLUMN district_fa text,
  ADD CONSTRAINT listing_catalogue_match_valid CHECK (catalogue_match IN ('trim', 'model', 'unmatched')) NOT VALID,
  ADD CONSTRAINT listing_catalogue_match_consistent CHECK (
    CASE catalogue_match
      WHEN 'trim' THEN make_id IS NOT NULL AND model_id IS NOT NULL AND trim_id IS NOT NULL
      WHEN 'model' THEN make_id IS NOT NULL AND model_id IS NOT NULL AND trim_id IS NULL
      ELSE make_id IS NULL AND model_id IS NULL AND trim_id IS NULL
    END) NOT VALID,
  ADD CONSTRAINT listing_district_fa_not_blank CHECK (btrim(district_fa) <> '') NOT VALID,
  ADD CONSTRAINT listing_make_fk FOREIGN KEY (make_id) REFERENCES make (id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT listing_model_fk FOREIGN KEY (model_id, make_id) REFERENCES model (id, make_id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT listing_trim_fk FOREIGN KEY (trim_id, model_id) REFERENCES trim (id, model_id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT listing_colour_fk FOREIGN KEY (colour) REFERENCES colour (code) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT listing_city_fk FOREIGN KEY (city_id) REFERENCES city (id) ON DELETE RESTRICT NOT VALID;

COMMENT ON COLUMN listing.catalogue_match IS
  'What the catalogue knows of the car (CS-50): trim (make, model and trim), model (the source named the model only: trim unknown) or unmatched (its source_model_key is not in the catalogue). NULL until matched. Never a guess.';
COMMENT ON COLUMN listing.colour IS 'The colour the post states, as a colour code (CS-50); an unknown word is kept in listing_unparsed_value.';
COMMENT ON COLUMN listing.city_id IS 'The city the post is in (Divar: city.second_slug).';
COMMENT ON COLUMN listing.district_fa IS 'The district the post names, as written (Divar: seo.web_info.district_persian).';
COMMENT ON CONSTRAINT listing_make_fk ON listing IS
  'unindexed: catalogue rows are curated and never deleted (RESTRICT); searching by make goes through CS-59''s search table.';
COMMENT ON CONSTRAINT listing_model_fk ON listing IS
  'unindexed: catalogue rows are curated and never deleted (RESTRICT); comparables and search go through CS-51''s and CS-59''s own tables and indexes.';
COMMENT ON CONSTRAINT listing_trim_fk ON listing IS
  'unindexed: catalogue rows are curated and never deleted (RESTRICT); comparables and search go through CS-51''s and CS-59''s own tables and indexes.';
COMMENT ON CONSTRAINT listing_colour_fk ON listing IS 'unindexed: colour is a code table that is never deleted from.';
COMMENT ON CONSTRAINT listing_city_fk ON listing IS 'unindexed: cities are never deleted; filtering goes through CS-59''s search table.';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE listing
  DROP COLUMN district_fa,
  DROP COLUMN city_id,
  DROP COLUMN colour,
  DROP COLUMN catalogue_match,
  DROP COLUMN trim_id,
  DROP COLUMN model_id,
  DROP COLUMN make_id;
