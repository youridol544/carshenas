-- migrate:up
-- Persian text search for listings (CS-59, the database skill's references/search.md): one IMMUTABLE normaliser for
-- documents and queries, a text search configuration of our own (a copy of simple: no stemming, no stop words), the
-- vocabulary typos are corrected against. The functions that turn what a buyer typed into a tsquery are in the next
-- migration, which creates the table they read. Characters are written by code point, never typed (AGENTS.md gotcha).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- levenshtein_less_equal() for typo correction against the vocabulary. A trusted extension, so the migration role may
-- create it; this migration creates it (plain CREATE fails if it exists), so its down section drops it.
CREATE EXTENSION fuzzystrmatch;

-- fa_normalize (CS-50) plus what search needs besides names: NFKC first (Arabic presentation forms), the alef forms
-- with hamza or madda and alef wasla as alef, teh marbuta and heh goal as heh, no-break spaces as spaces, the Arabic
-- decimal separator as a point; harakat, superscript alef, the zero-width joiner, bidi marks and controls, the byte
-- order mark, the soft hyphen and the Arabic thousands separator removed; then Persian letters split from digits
-- («تیپ۲» → «تیپ 2», «۲۰۶تیپ» → «206 تیپ»).
CREATE FUNCTION search_normalize(value text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  RETURN regexp_replace(regexp_replace(
    fa_normalize(translate(normalize(value, NFKC),
      chr(1571) || chr(1573) || chr(1570) || chr(1649) || chr(1577) || chr(1729) || chr(160) || chr(8239) ||
      chr(1643) ||
      -- Last, with no counterpart: translate() removes them.
      chr(1611) || chr(1612) || chr(1613) || chr(1614) || chr(1615) || chr(1616) || chr(1617) || chr(1618) ||
      chr(1619) || chr(1620) || chr(1621) || chr(1648) || chr(8205) || chr(8206) || chr(8207) || chr(1564) ||
      chr(65279) || chr(173) || chr(1644) || chr(8234) || chr(8235) || chr(8236) || chr(8237) || chr(8238) ||
      chr(8294) || chr(8295) || chr(8296) || chr(8297),
      chr(1575) || chr(1575) || chr(1575) || chr(1575) || chr(1607) || chr(1607) || '  .')),
    '([' || chr(1569) || '-' || chr(1610) || chr(1649) || '-' || chr(1747) || chr(1786) || '-' || chr(1791) ||
      '])([0-9])', '\1 \2', 'g'),
    '([0-9])([' || chr(1569) || '-' || chr(1610) || chr(1649) || '-' || chr(1747) || chr(1786) || '-' || chr(1791) ||
      '])', '\1 \2', 'g');

COMMENT ON FUNCTION search_normalize(text) IS
  'Text as search compares it (CS-59): NFKC, then fa_normalize (Arabic yeh and kaf, zero-width non-joiner, every digit script, lower case, single spaces), alef and heh forms folded, harakat, bidi marks and separators removed, Persian letters split from digits. Documents and queries both go through it; never shown.';

-- Owning the configuration's name lets dictionaries be added later without touching queries.
CREATE TEXT SEARCH CONFIGURATION fa_search (COPY = pg_catalog.simple);

COMMENT ON TEXT SEARCH CONFIGURATION fa_search IS
  'Listing search (CS-59): a copy of simple. PostgreSQL has no Persian configuration, and the Arabic stemmer mangles Persian words.';

CREATE TABLE search_word (
  word text NOT NULL,
  listing_count integer NOT NULL,
  CONSTRAINT search_word_pkey PRIMARY KEY (word),
  CONSTRAINT search_word_word_not_blank CHECK (btrim(word) <> ''),
  CONSTRAINT search_word_listing_count_positive CHECK (listing_count > 0)
);

COMMENT ON TABLE search_word IS
  'The words of the searchable listings'' text (CS-59): the vocabulary a query word is corrected against when no listing has it. Derived: rebuilt by the worker after search_document changes.';
COMMENT ON COLUMN search_word.listing_count IS
  'How many searchable listings have the word: a correction needs a common word, and prefers the more common of two equally close ones.';

GRANT EXECUTE ON FUNCTION search_normalize(text) TO carshenas_web, carshenas_worker, carshenas_admin;
-- The web app reads the vocabulary through search_query (migration create_search_document); the worker rebuilds it.
GRANT SELECT ON search_word TO carshenas_web, carshenas_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_word TO carshenas_worker;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE search_word;
DROP TEXT SEARCH CONFIGURATION fa_search;
DROP FUNCTION search_normalize(text);
DROP EXTENSION fuzzystrmatch;
