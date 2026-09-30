-- migrate:up
-- A value a listing states that the parser could not read, kept with its raw text (CS-34 criterion 3). The column it
-- would have filled stays null, never a guess, and the rows count what the parser does not know yet. They are derived
-- from the listing's latest snapshot with its other attributes, so once the parser learns a new form,
-- `pnpm derive:listings` turns them into values. A value the listing does not state is simply absent: no row.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE listing_unparsed_value (
  listing_id bigint NOT NULL,
  field      text NOT NULL
             CONSTRAINT listing_unparsed_value_field_valid CHECK (field IN (
               'model_year', 'mileage_km', 'fuel', 'gearbox', 'insurance_months_left', 'price', 'accepts_swap',
               'accepts_installments', 'seller_type', 'body_condition', 'engine_condition', 'gearbox_condition',
               'chassis_condition')),
  raw_text   text NOT NULL
             CONSTRAINT listing_unparsed_value_raw_text_not_blank CHECK (btrim(raw_text) <> ''),
  CONSTRAINT listing_unparsed_value_pkey PRIMARY KEY (listing_id, field),
  CONSTRAINT listing_unparsed_value_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE
);

COMMENT ON TABLE listing_unparsed_value IS
  'A value a listing states that its source''s parser could not read, with its raw text; the column it would fill stays null. Derived with the listing''s other attributes.';
COMMENT ON COLUMN listing_unparsed_value.field IS
  'The attribute the value would fill: model_year (model_year_written, _sh and _ad), price (price_type and its amounts), chassis_condition (front and rear), or the listing column of that name.';
COMMENT ON COLUMN listing_unparsed_value.raw_text IS 'The value exactly as the source wrote it, direction marks and all.';

GRANT SELECT, INSERT, UPDATE, DELETE ON listing_unparsed_value TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE listing_unparsed_value;
