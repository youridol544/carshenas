-- migrate:up
-- The search table (CS-59, ADR-0027, ADR-0028, docs/design/data-model.md): one row per searchable listing, built from
-- listing_filter_row with the same column names, so @carshenas/search's predicates run on it unchanged, plus a sort
-- index per order, the text to search and what a result card shows. Searchable means: active, from a public source,
-- its details read (price_type is set: a list row alone has no title, year, price, mileage, city or photo, cannot be
-- shown as a card or rated, and enters the table by itself when its details are read; the coordinator's decision of
-- 2026-10-02) and seen within the freshness window of ADR-0017 (48 hours). The worker keeps it fresh: triggers mark
-- changed listings in search_document_stale, search.refresh rebuilds their rows every minute and expires rows past the
-- window, and search.rebuild rebuilds every row. search_facet_count holds the counts pages would otherwise count on
-- every request (the filters' options, each catalogue, the listings seen and the listings searchable), and
-- search_build_event says when each part was last built, so a part that failed is rebuilt by the next run.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- fillfactor 80: a listing seen again rewrites its row, and the free space lets PostgreSQL do it in the same page
-- (a HOT update) when no indexed column changed (0 of 10,000 at 100, 15 % at 90 on 2026-10-02).
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
  price_type text NOT NULL,
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
) WITH (fillfactor = 80);

COMMENT ON TABLE search_document IS
  'A searchable listing as search reads it (CS-59): listing_filter_row''s columns for active listings of public sources whose details have been read (price_type is set) and that were seen in the last 48 hours, plus sort, text and card columns. Derived: rebuilt by the worker from the listings, never edited.';
COMMENT ON COLUMN search_document.price_type IS
  'How the listing states its price (asking, negotiable, installment, placeholder). Set exactly when the listing''s details have been read, so it is what makes a listing searchable.';
COMMENT ON COLUMN search_document.last_seen_at IS
  'When a crawl last saw the listing: a search shows it only within 48 hours of this (ADR-0017 point 6), and the worker expires the row after that.';
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
  'search_text normalised by search_normalize, as fa_search lexemes: computed only when a row is written, and searched through search_query().';
COMMENT ON COLUMN search_document.refreshed_at IS 'When the row last changed.';

-- One B-tree per order of @carshenas/search's SORTS, with its directions and NULLS placement and ending on
-- listing_id DESC, so a first page and every keyset page stop after the rows they show.
CREATE INDEX search_document_best_deal_idx
  ON search_document (price_gap_pct ASC NULLS LAST, listed_at DESC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_newest_idx ON search_document (listed_at DESC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_year_idx ON search_document (model_year_sh DESC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_mileage_idx ON search_document (mileage_km ASC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_price_asc_idx ON search_document (asking_price_toman ASC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_price_desc_idx
  ON search_document (asking_price_toman DESC NULLS LAST, listing_id DESC);
-- A city first, then the default order: few listings name a city other than Tehran, and without it a city walked the
-- whole best-deal index.
CREATE INDEX search_document_city_best_deal_idx
  ON search_document (city_key, price_gap_pct ASC NULLS LAST, listed_at DESC NULLS LAST, listing_id DESC);
CREATE INDEX search_document_text_idx ON search_document USING gin (text_vector);

CREATE TABLE search_facet_count (
  facet text NOT NULL,
  value text NOT NULL,
  label_fa text NOT NULL,
  "position" integer NOT NULL,
  listing_count integer NOT NULL,
  changed_at timestamptz NOT NULL,
  CONSTRAINT search_facet_count_pkey PRIMARY KEY (facet, value),
  CONSTRAINT search_facet_count_facet_valid CHECK (
    facet IN ('total', 'seen', 'catalogue', 'make', 'model', 'trim', 'body_type', 'city', 'district', 'source')),
  CONSTRAINT search_facet_count_listing_count_nonnegative CHECK (listing_count >= 0),
  CONSTRAINT search_facet_count_position_nonnegative CHECK ("position" >= 0)
);

COMMENT ON TABLE search_facet_count IS
  'Counts of listings that pages show without counting on every request (CS-59): the searchable total, the listings seen, each catalogue, and each option of the filters whose options are rows (makes, models, trims, body types, cities, districts, sources). Derived: written by the worker after every change and every minute, rows only when a count changed.';
COMMENT ON COLUMN search_facet_count.facet IS
  'total: the listings in search_document. seen: the active listings of public sources a crawl saw in the last 48 hours, whether or not their details were read; the difference is what is not yet searchable.';
COMMENT ON COLUMN search_facet_count.value IS
  'The option''s value as a URL and a stored search name it (make slug, make.model, city.district, a catalogue id); empty for total and seen.';
COMMENT ON COLUMN search_facet_count.label_fa IS 'The option''s Persian name (the English one where the catalogue has none yet).';
COMMENT ON COLUMN search_facet_count."position" IS
  'The option''s place within its facet: the catalogue''s order for body types and catalogues, most listed first for the others.';
COMMENT ON COLUMN search_facet_count.changed_at IS 'When this count last changed.';

-- When each part of the search tables was last built. documents_changed is written by a trigger whenever
-- search_document changes; the worker writes the others when it finishes a part. A part built before the last change
-- is stale, so a run that failed halfway is repaired by the next one, whatever that run changed.
CREATE TABLE search_build_event (
  event text NOT NULL,
  happened_at timestamptz NOT NULL,
  CONSTRAINT search_build_event_pkey PRIMARY KEY (event),
  CONSTRAINT search_build_event_event_valid CHECK (
    event IN ('documents_changed', 'counts_built', 'vocabulary_built', 'full_rebuild'))
);

COMMENT ON TABLE search_build_event IS
  'The last time of each event in building the search tables (CS-59): documents_changed (a trigger on search_document), counts_built (search_facet_count), vocabulary_built (search_word) and full_rebuild (every row rebuilt, then the counts and the vocabulary). One row per event.';

-- The listings whose rows may be out of date: appended by the triggers below, taken by the worker's search.refresh.
-- An append-only queue, with no unique key and no foreign key on purpose: an insert never waits for another
-- transaction (a unique key would make a writer wait for a refresh that is deleting the same mark, and a foreign key
-- would lock the listing), so the crawler and the derivation are never held up by a build. A listing marked twice is
-- built once; a mark of a purged listing builds nothing.
CREATE TABLE search_document_stale (
  id bigint GENERATED ALWAYS AS IDENTITY,
  listing_id bigint NOT NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_document_stale_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE search_document_stale IS
  'Marks of listings whose search_document row may be out of date (CS-59): inserted by triggers on the tables a row comes from, taken (deleted) by the worker''s search.refresh in the transaction that rebuilds their rows. No foreign key and no unique key, so an insert never waits.';

-- The triggers run as the migration role (SECURITY DEFINER), so a writer needs no grant on the marks. They are
-- statement-level with transition tables: one INSERT per statement, however many rows.
CREATE FUNCTION search_mark_listings_inserted() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  -- A listing whose details are not read is not searchable, so it needs no row.
  INSERT INTO search_document_stale (listing_id)
  SELECT n.id FROM new_rows n WHERE n.price_type IS NOT NULL;
  RETURN NULL;
END
$$;

-- An update marks only the rows whose values changed (a guarded update touches none), and only those that are or were
-- searchable by their details.
CREATE FUNCTION search_mark_listings_updated() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO search_document_stale (listing_id)
  SELECT n.id FROM new_rows n JOIN old_rows o ON o.id = n.id
  WHERE (n.price_type IS NOT NULL OR o.price_type IS NOT NULL) AND n IS DISTINCT FROM o;
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
  SET search_path = public, pg_temp
AS $$
BEGIN
  -- A listing deleted in a purge takes its photos with it: only listings that still exist are marked.
  INSERT INTO search_document_stale (listing_id)
  SELECT DISTINCT r.listing_id FROM changed_rows r JOIN listing l ON l.id = r.listing_id;
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
  SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO search_document_stale (listing_id)
  SELECT DISTINCT e.listing_id FROM changed_rows r JOIN extraction e ON e.id = r.extraction_id;
  RETURN NULL;
END
$$;

CREATE TRIGGER extraction_field_search_mark_inserted AFTER INSERT ON extraction_field
  REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION search_mark_extraction_listings();

-- A valuation run that succeeds changes every rated listing's rating and gap: mark every searchable one.
CREATE FUNCTION search_mark_valued_listings() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'succeeded' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'succeeded') THEN
    INSERT INTO search_document_stale (listing_id)
    SELECT l.id FROM listing l WHERE l.status = 'active' AND l.price_type IS NOT NULL;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER valuation_run_search_mark_succeeded AFTER INSERT OR UPDATE OF status ON valuation_run
  FOR EACH ROW EXECUTE FUNCTION search_mark_valued_listings();

-- Whenever search_document changes, whoever changes it: a part of the search tables built before this is stale.
CREATE FUNCTION search_note_document_change() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT FROM changed_rows) THEN
    INSERT INTO search_build_event (event, happened_at) VALUES ('documents_changed', clock_timestamp())
    ON CONFLICT ON CONSTRAINT search_build_event_pkey DO UPDATE SET happened_at = excluded.happened_at;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER search_document_note_inserted AFTER INSERT ON search_document
  REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION search_note_document_change();
CREATE TRIGGER search_document_note_updated AFTER UPDATE ON search_document
  REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION search_note_document_change();
CREATE TRIGGER search_document_note_deleted AFTER DELETE ON search_document
  REFERENCING OLD TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION search_note_document_change();

REVOKE ALL ON FUNCTION search_mark_listings_inserted(), search_mark_listings_updated(), search_mark_photo_listings(),
  search_mark_extraction_listings(), search_mark_valued_listings(), search_note_document_change() FROM PUBLIC;

-- What a buyer typed, as a tsquery and as what the search did with each word (CS-59). Every word is required; each
-- is a prefix («کرول» finds «کرولا») except numbers, which are exact (a model year, «206»). A word that begins no word
-- of the vocabulary (no listing has it) may be replaced by a close vocabulary word, under rules tight enough that a
-- typo never turns into a different word that happens to be near:
--   - only letters: a word with a digit is a model or a year, and «208i» is not «207i»;
--   - the typed word has at least four letters, and so does the word it becomes;
--   - one edit (an insertion, a deletion, a substitution or a swap of neighbours), two from seven letters on;
--   - the word it becomes is in at least half a percent of the searchable listings, and in no fewer than ten: a rare
--     word is more likely a different word («تیبا», a car we do not list, is one edit from «زیبا», in four listings);
--   - the replacement is exact, never a prefix («مزدا» became the prefix «مدا», which begins «مدارک»);
--   - at most three words of a query are tried: each try scans the vocabulary.
-- Words that match nothing and are not corrected come back in `unmatched`, so a page can say which word found no listing.
-- tsquery_text is NULL when no searchable word is left (punctuation only). PL/pgSQL, called once per search and passed
-- on as a constant: a builder inside the query ran once per row in the research.
CREATE FUNCTION search_query(query text)
  RETURNS TABLE (tsquery_text text, corrections jsonb, unmatched text[])
  LANGUAGE plpgsql STABLE PARALLEL SAFE
  SET search_path = public, pg_temp
AS $$
DECLARE
  lexeme text;
  quoted text;
  closest text;
  allowed integer;
  min_count integer;
  tries integer := 0;
  terms text[] := '{}';
  fixes jsonb := '[]';
  missing text[] := '{}';
BEGIN
  SELECT greatest(10, ceil(coalesce(max(f.listing_count), 0) * 0.005))::integer INTO min_count
  FROM search_facet_count f WHERE f.facet = 'total';
  FOR lexeme IN
    SELECT v.lexeme FROM unnest(to_tsvector('fa_search', search_normalize(query))) v ORDER BY v.positions[1]
  LOOP
    -- A lexeme quoted for tsquery input: backslashes and quotes doubled.
    quoted := '''' || replace(replace(lexeme, '\', '\\'), '''', '''''') || '''';
    IF lexeme ~ '^[0-9]+$' THEN
      terms := terms || quoted;
      IF NOT EXISTS (SELECT FROM search_word w WHERE w.word = lexeme) THEN
        missing := missing || lexeme;
      END IF;
      CONTINUE;
    END IF;
    IF EXISTS (SELECT FROM search_word w WHERE w.word >= lexeme AND w.word < lexeme || chr(1114111)) THEN
      terms := terms || (quoted || ':*');
      CONTINUE;
    END IF;
    closest := NULL;
    IF char_length(lexeme) >= 4 AND lexeme !~ '[0-9]' AND tries < 3 THEN
      tries := tries + 1;
      allowed := CASE WHEN char_length(lexeme) >= 7 THEN 2 ELSE 1 END;
      SELECT c.word INTO closest
      FROM (
        SELECT w.word, w.listing_count,
               least(
                 levenshtein_less_equal(w.word, lexeme, allowed),
                 CASE WHEN w.word IN (
                        SELECT substr(lexeme, 1, i - 1) || substr(lexeme, i + 1, 1) || substr(lexeme, i, 1) ||
                               substr(lexeme, i + 2)
                        FROM generate_series(1, char_length(lexeme) - 1) i)
                   THEN 1 ELSE allowed + 1 END) AS distance
        FROM search_word w
        WHERE w.listing_count >= min_count
          AND char_length(w.word) >= 4
          AND abs(char_length(w.word) - char_length(lexeme)) <= allowed
          AND w.word !~ '[0-9]'
      ) c
      WHERE c.distance <= allowed
      ORDER BY c.distance, c.listing_count DESC, c.word
      LIMIT 1;
    END IF;
    IF closest IS NULL THEN
      terms := terms || (quoted || ':*');
      missing := missing || lexeme;
    ELSE
      terms := terms || ('''' || replace(replace(closest, '\', '\\'), '''', '''''') || '''');
      fixes := fixes || jsonb_build_array(jsonb_build_object('from', lexeme, 'to', closest));
    END IF;
  END LOOP;
  tsquery_text := CASE WHEN cardinality(terms) = 0 THEN NULL
                  ELSE to_tsquery('fa_search', array_to_string(terms, ' & '))::text END;
  corrections := fixes;
  unmatched := missing;
  RETURN NEXT;
END
$$;

COMMENT ON FUNCTION search_query(text) IS
  'A buyer''s words as a tsquery (text), the corrections made (jsonb [{from, to}]) and the words that match no listing (CS-59): normalised by search_normalize, every word required, prefixes except numbers, an unknown word replaced only by a common word one edit away (the rules are in the migration). tsquery_text is NULL when no word is left.';

CREATE FUNCTION search_tsquery(query text) RETURNS tsquery
  LANGUAGE sql STABLE PARALLEL SAFE
  SET search_path = public, pg_temp
  RETURN (SELECT q.tsquery_text::tsquery FROM search_query(query) q);

COMMENT ON FUNCTION search_tsquery(text) IS
  'search_query(text)''s tsquery over search_document.text_vector (CS-59); NULL when no word is left.';

GRANT EXECUTE ON FUNCTION search_query(text) TO carshenas_web, carshenas_worker, carshenas_admin;
GRANT EXECUTE ON FUNCTION search_tsquery(text) TO carshenas_web, carshenas_worker, carshenas_admin;

-- Pages read the table, the counts and when they were built; the worker builds them and takes the marks (its triggers'
-- inserts run as the migration role, so it needs no grant to mark).
GRANT SELECT ON search_document, search_facet_count, search_build_event TO carshenas_web, carshenas_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_document, search_facet_count TO carshenas_worker;
GRANT SELECT, INSERT, UPDATE ON search_build_event TO carshenas_worker;
GRANT SELECT, DELETE ON search_document_stale TO carshenas_worker;
-- A rebuild that rewrites many rows analyses the tables, so the next plans see the new rows (MAINTAIN, PostgreSQL 17+).
GRANT MAINTAIN ON search_document, search_word TO carshenas_worker;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION search_tsquery(text);
DROP FUNCTION search_query(text);
DROP TRIGGER search_document_note_deleted ON search_document;
DROP TRIGGER search_document_note_updated ON search_document;
DROP TRIGGER search_document_note_inserted ON search_document;
DROP TRIGGER valuation_run_search_mark_succeeded ON valuation_run;
DROP TRIGGER extraction_field_search_mark_inserted ON extraction_field;
DROP TRIGGER listing_photo_search_mark_deleted ON listing_photo;
DROP TRIGGER listing_photo_search_mark_updated ON listing_photo;
DROP TRIGGER listing_photo_search_mark_inserted ON listing_photo;
DROP TRIGGER listing_search_mark_updated ON listing;
DROP TRIGGER listing_search_mark_inserted ON listing;
DROP FUNCTION search_note_document_change();
DROP FUNCTION search_mark_valued_listings();
DROP FUNCTION search_mark_extraction_listings();
DROP FUNCTION search_mark_photo_listings();
DROP FUNCTION search_mark_listings_updated();
DROP FUNCTION search_mark_listings_inserted();
DROP TABLE search_document_stale;
DROP TABLE search_build_event;
DROP TABLE search_facet_count;
DROP TABLE search_document;
