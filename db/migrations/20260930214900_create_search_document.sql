-- migrate:up
-- The search table (CS-59, ADR-0027, docs/design/data-model.md): one row per searchable listing, built from
-- listing_filter_row with the same column names, so @carshenas/search's predicates run on it unchanged, plus a sort
-- index per order, the text to search and what a result card shows. Searchable: active, from a public source, of a
-- tracked model, seen within the freshness window of ADR-0017 (48 hours). The worker keeps it fresh: triggers on the
-- tables its rows come from mark changed listings in search_document_stale, and search.refresh rebuilds their rows
-- every minute; search.rebuild (nightly and `pnpm search:rebuild`) rebuilds every row. search_facet_count holds the
-- counts pages would otherwise count on every request (the filters' options, each catalogue, the total), refreshed
-- with the table.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE search_document (
  listing_id bigint NOT NULL,
  source_id text NOT NULL,
  listed_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  make_id bigint,
  model_id bigint,
  trim_id bigint,
  make_key text,
  model_key text,
  trim_key text,
  body_type text,
  model_year_sh smallint,
  mileage_km integer,
  km_per_year integer,
  price_type text,
  asking_price_toman bigint,
  market_value_toman bigint,
  price_gap_pct numeric(7, 2),
  deal_rating deal_rating,
  valued_on date,
  gearbox text,
  fuel text,
  colour_family text,
  city_id bigint,
  city_key text,
  district_fa text,
  district_key text,
  seller_type text,
  insurance_months_left smallint,
  body_condition text,
  engine_condition text,
  gearbox_condition text,
  chassis_condition text,
  paint_free boolean,
  accident text,
  replaced_parts text,
  ride_hailing text,
  plate text,
  offers_swap boolean,
  offers_installments boolean,
  has_photo boolean NOT NULL,
  photo_count integer NOT NULL,
  cover_photo_url text,
  cover_thumbnail_url text,
  model_rank integer,
  search_text text NOT NULL,
  text_vector tsvector GENERATED ALWAYS AS (to_tsvector('fa_search'::regconfig, search_normalize(search_text))) STORED,
  refreshed_at timestamptz NOT NULL,
  CONSTRAINT search_document_pkey PRIMARY KEY (listing_id),
  CONSTRAINT search_document_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE,
  CONSTRAINT search_document_asking_price_toman_range CHECK (asking_price_toman BETWEEN 1 AND 999999999999999),
  CONSTRAINT search_document_market_value_toman_range CHECK (market_value_toman BETWEEN 1 AND 999999999999999),
  CONSTRAINT search_document_photos_counted CHECK (photo_count >= 0 AND has_photo = (photo_count > 0)),
  CONSTRAINT search_document_cover_with_photo CHECK ((cover_photo_url IS NOT NULL) = has_photo)
);

COMMENT ON TABLE search_document IS
  'A searchable listing as search reads it (CS-59): listing_filter_row''s columns for active listings of public sources and tracked models seen in the last 48 hours, plus sort, text and card columns. Derived: rebuilt by the worker from the listings, never edited.';
COMMENT ON COLUMN search_document.last_seen_at IS
  'When a crawl last saw the listing: a search shows it only within 48 hours of this (ADR-0017 point 6).';
COMMENT ON COLUMN search_document.km_per_year IS
  'mileage_km per year of age in the build''s Solar Hijri year, a car under a year counted as half a year (S01), rounded: what «کم‌کارکرد نسبت به سن» reads, shown on a card.';
COMMENT ON COLUMN search_document.price_gap_pct IS
  'The asking price''s distance from market value in percent, negative below it, from the latest succeeded valuation run (CS-51); null when unrated. The default order leads with it.';
COMMENT ON COLUMN search_document.valued_on IS 'as_of_date of the valuation run the rating comes from; null when unrated.';
COMMENT ON COLUMN search_document.photo_count IS 'How many photos the listing''s latest snapshot has (ADR-0025).';
COMMENT ON COLUMN search_document.cover_photo_url IS
  'The first photo''s address on the source''s own host (listing_photo, ADR-0025): shown from there, never stored.';
COMMENT ON COLUMN search_document.search_text IS
  'What a query matches, as written: the title, the make, model and trim names in Persian and English with their curated and suggested aliases, the model year in both calendars, the city, district, colour and body type. Never shown.';
COMMENT ON COLUMN search_document.text_vector IS
  'search_text normalised by search_normalize, as fa_search lexemes: computed only when a row is written, and searched through search_tsquery().';
COMMENT ON COLUMN search_document.refreshed_at IS 'When the row last changed.';

-- One B-tree per order of @carshenas/search's SORTS, with its directions and NULLS placement, ending on listing_id,
-- so a first page and every keyset page stop after the rows they show.
CREATE INDEX search_document_best_deal_idx
  ON search_document (price_gap_pct ASC NULLS LAST, listed_at DESC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_newest_idx ON search_document (listed_at DESC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_year_idx ON search_document (model_year_sh DESC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_mileage_idx ON search_document (mileage_km ASC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_price_asc_idx ON search_document (asking_price_toman ASC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_price_desc_idx
  ON search_document (asking_price_toman DESC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_text_idx ON search_document USING gin (text_vector);

CREATE TABLE search_facet_count (
  facet text NOT NULL,
  value text NOT NULL,
  label_fa text NOT NULL,
  "position" integer NOT NULL,
  listing_count integer NOT NULL,
  refreshed_at timestamptz NOT NULL,
  CONSTRAINT search_facet_count_pkey PRIMARY KEY (facet, value),
  CONSTRAINT search_facet_count_facet_valid CHECK (
    facet IN ('total', 'catalogue', 'make', 'model', 'trim', 'body_type', 'city', 'district', 'source')),
  CONSTRAINT search_facet_count_listing_count_nonnegative CHECK (listing_count >= 0),
  CONSTRAINT search_facet_count_position_nonnegative CHECK ("position" >= 0)
);

COMMENT ON TABLE search_facet_count IS
  'Counts of searchable listings that pages show without counting on every request (CS-59): the total, each catalogue, and each option of the filters whose options are rows (makes, models, trims, body types, cities, districts, sources). Rebuilt by the worker with search_document.';
COMMENT ON COLUMN search_facet_count.value IS
  'The option''s value as a URL and a stored search name it (make slug, make.model, city.district, a catalogue id); empty for the total.';
COMMENT ON COLUMN search_facet_count.label_fa IS 'The option''s Persian name (the English one where the catalogue has none yet).';
COMMENT ON COLUMN search_facet_count."position" IS
  'The option''s place within its facet: the catalogue''s order for body types and catalogues, most listed first for the others.';

CREATE TABLE search_document_stale (
  listing_id bigint NOT NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_document_stale_pkey PRIMARY KEY (listing_id),
  CONSTRAINT search_document_stale_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE
);

COMMENT ON TABLE search_document_stale IS
  'Listings whose search_document row may be out of date (CS-59): marked by triggers on the tables the row comes from, drained by the worker''s search.refresh in the same transaction that rebuilds their rows.';

-- The triggers run as the migration's owner, so every writer (the worker, the superadmin section) marks listings
-- without a grant on this table. Statement-level with transition tables: one INSERT per statement, however many rows.
CREATE FUNCTION search_mark_listings_inserted() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO search_document_stale (listing_id)
  SELECT DISTINCT n.id FROM new_rows n
  ON CONFLICT ON CONSTRAINT search_document_stale_pkey DO NOTHING;
  RETURN NULL;
END
$$;

-- An update marks only the rows whose values changed (a guarded update touches none).
CREATE FUNCTION search_mark_listings_updated() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO search_document_stale (listing_id)
  SELECT DISTINCT n.id FROM new_rows n JOIN old_rows o ON o.id = n.id WHERE n IS DISTINCT FROM o
  ON CONFLICT ON CONSTRAINT search_document_stale_pkey DO NOTHING;
  RETURN NULL;
END
$$;

CREATE TRIGGER listing_search_mark_inserted AFTER INSERT ON listing
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_mark_listings_inserted();
CREATE TRIGGER listing_search_mark_updated AFTER UPDATE ON listing
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION search_mark_listings_updated();

-- Photos: every inserted, changed or deleted row marks its listing. Text facts: extraction_field is append-only, so
-- an inserted row (a new reading) marks its listing.
CREATE FUNCTION search_mark_photo_listings() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO search_document_stale (listing_id)
  SELECT DISTINCT r.listing_id FROM changed_rows r
  ON CONFLICT ON CONSTRAINT search_document_stale_pkey DO NOTHING;
  RETURN NULL;
END
$$;

CREATE TRIGGER listing_photo_search_mark_inserted AFTER INSERT ON listing_photo
  REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION search_mark_photo_listings();
CREATE TRIGGER listing_photo_search_mark_updated AFTER UPDATE ON listing_photo
  REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION search_mark_photo_listings();
CREATE TRIGGER listing_photo_search_mark_deleted AFTER DELETE ON listing_photo
  REFERENCING OLD TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION search_mark_photo_listings();

CREATE FUNCTION search_mark_extraction_listings() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO search_document_stale (listing_id)
  SELECT DISTINCT e.listing_id FROM changed_rows r JOIN extraction e ON e.id = r.extraction_id
  ON CONFLICT ON CONSTRAINT search_document_stale_pkey DO NOTHING;
  RETURN NULL;
END
$$;

CREATE TRIGGER extraction_field_search_mark_inserted AFTER INSERT ON extraction_field
  REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION search_mark_extraction_listings();

-- A valuation run that succeeds changes every listing's rating and gap: mark every active listing.
CREATE FUNCTION search_mark_valued_listings() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.status = 'succeeded' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'succeeded') THEN
    INSERT INTO search_document_stale (listing_id)
    SELECT l.id FROM listing l WHERE l.status = 'active'
    ON CONFLICT ON CONSTRAINT search_document_stale_pkey DO NOTHING;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER valuation_run_search_mark_succeeded AFTER INSERT OR UPDATE OF status ON valuation_run
  FOR EACH ROW EXECUTE FUNCTION search_mark_valued_listings();

REVOKE ALL ON FUNCTION search_mark_listings_inserted(), search_mark_listings_updated(), search_mark_photo_listings(),
  search_mark_extraction_listings(), search_mark_valued_listings() FROM PUBLIC;

-- Pages read the table and the counts; the worker builds both and drains the marks.
GRANT SELECT ON search_document, search_facet_count TO carshenas_web, carshenas_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_document, search_facet_count, search_document_stale
  TO carshenas_worker;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TRIGGER valuation_run_search_mark_succeeded ON valuation_run;
DROP TRIGGER extraction_field_search_mark_inserted ON extraction_field;
DROP TRIGGER listing_photo_search_mark_deleted ON listing_photo;
DROP TRIGGER listing_photo_search_mark_updated ON listing_photo;
DROP TRIGGER listing_photo_search_mark_inserted ON listing_photo;
DROP TRIGGER listing_search_mark_updated ON listing;
DROP TRIGGER listing_search_mark_inserted ON listing;
DROP FUNCTION search_mark_valued_listings();
DROP FUNCTION search_mark_extraction_listings();
DROP FUNCTION search_mark_photo_listings();
DROP FUNCTION search_mark_listings_updated();
DROP FUNCTION search_mark_listings_inserted();
DROP TABLE search_document_stale;
DROP TABLE search_facet_count;
DROP TABLE search_document;
