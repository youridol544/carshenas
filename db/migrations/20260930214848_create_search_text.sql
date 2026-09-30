-- migrate:up
-- Persian text search for listings (CS-59, the database skill's references/search.md): one IMMUTABLE normaliser for
-- documents and queries, a text search configuration of our own (a copy of simple: no stemming, no stop words), the
-- vocabulary typos are corrected against, and the function that turns what a buyer typed into a tsquery once per
-- search. Characters are written by code point, never typed (AGENTS.md gotcha).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- levenshtein() for typo correction against the vocabulary; a trusted extension.
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

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
  'The words of the searchable listings'' text (CS-59): the vocabulary a query word is corrected against when no listing has it. Rebuilt with search_document by the worker.';
COMMENT ON COLUMN search_word.listing_count IS
  'How many searchable listings have the word: a correction prefers the more common of two equally close words.';

-- What a buyer typed as a tsquery: every word must match, each as a prefix except numbers (a model year or «206» is
-- exact); a word of three letters or more that no listing has and that begins no word of the vocabulary is tried
-- together with its closest vocabulary word (one edit for up to five letters, two for longer; ties to the more common
-- word). NULL when nothing searchable is left. PL/pgSQL, called once per search and passed on as a constant (a
-- builder inside the query ran once per row in the research).
CREATE FUNCTION search_tsquery(query text) RETURNS tsquery
  LANGUAGE plpgsql STABLE PARALLEL SAFE
  SET search_path = public, pg_catalog
AS $$
DECLARE
  lexeme text;
  quoted text;
  closest text;
  allowed integer;
  terms text[] := '{}';
BEGIN
  FOR lexeme IN
    SELECT v.lexeme FROM unnest(to_tsvector('fa_search', search_normalize(query))) v ORDER BY v.positions[1]
  LOOP
    -- A lexeme quoted for tsquery input: backslashes and quotes doubled.
    quoted := '''' || replace(replace(lexeme, '\', '\\'), '''', '''''') || '''';
    IF lexeme ~ '^[0-9]+$' THEN
      terms := terms || quoted;
      CONTINUE;
    END IF;
    closest := NULL;
    IF char_length(lexeme) >= 3
      AND NOT EXISTS (SELECT FROM search_word w WHERE w.word >= lexeme AND w.word < lexeme || chr(1114111))
    THEN
      allowed := CASE WHEN char_length(lexeme) <= 5 THEN 1 ELSE 2 END;
      SELECT w.word INTO closest
      FROM search_word w
      WHERE abs(char_length(w.word) - char_length(lexeme)) <= allowed
        AND w.word !~ '^[0-9]+$'
        AND levenshtein_less_equal(w.word, lexeme, allowed) <= allowed
      ORDER BY levenshtein_less_equal(w.word, lexeme, allowed), w.listing_count DESC, w.word
      LIMIT 1;
    END IF;
    terms := terms || CASE
      WHEN closest IS NULL THEN quoted || ':*'
      ELSE '(' || quoted || ':* | ''' || replace(replace(closest, '\', '\\'), '''', '''''') || ''':*)'
    END;
  END LOOP;
  IF cardinality(terms) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN to_tsquery('fa_search', array_to_string(terms, ' & '));
END
$$;

COMMENT ON FUNCTION search_tsquery(text) IS
  'A buyer''s words as a tsquery over search_document.text_vector (CS-59): normalised by search_normalize, every word required, prefixes except numbers, an unknown word tried with its closest vocabulary word. NULL when no word is left.';

GRANT EXECUTE ON FUNCTION search_normalize(text) TO carshenas_web, carshenas_worker, carshenas_admin;
GRANT EXECUTE ON FUNCTION search_tsquery(text) TO carshenas_web, carshenas_worker, carshenas_admin;
-- The web app reads the vocabulary through search_tsquery; the worker rebuilds it.
GRANT SELECT ON search_word TO carshenas_web, carshenas_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_word TO carshenas_worker;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION search_tsquery(text);
DROP TABLE search_word;
DROP TEXT SEARCH CONFIGURATION fa_search;
DROP FUNCTION search_normalize(text);
DROP EXTENSION IF EXISTS fuzzystrmatch;
