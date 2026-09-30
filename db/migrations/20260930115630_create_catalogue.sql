-- migrate:up
-- The canonical catalogue of cars (CS-50; docs/design/data-model.md, layer 4): make, model and trim, one Persian and
-- one Latin name each, the body type on the model (on a trim only where it differs), a source's own model keys mapped
-- to them, and aliases for matching names written in Persian, in Latin letters or with spelled-out numbers. Seeded and
-- kept by `pnpm catalogue:sync` from apps/worker/src/catalogue/ (curated) and from what the sources wrote (learned).
-- The owner's decisions of 2026-09-30: a listing matches a trim, a model (its trim unknown) or nothing, never a guess;
-- every model with Tehran listings has a curated body type; curated aliases for makes and tracked models, suggested
-- Persian names from Divar's own «برند و مدل» row for the rest. The body type and colour code tables and the cities
-- are rows kept by the same command. Catalogue rows are curated parents: never deleted, merged by re-pointing.
-- fa_normalize folds the ways one name is typed (Arabic ي ى and ك, ۀ, tatweel, zero-width non-joiner, every digit
-- script, case) so aliases compare as people mean them; its characters are written by code point, never typed.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION fa_normalize(value text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  RETURN btrim(regexp_replace(lower(
    translate(value,
      chr(1610) || chr(1609) || chr(1603) || chr(1728) || chr(8204) ||
      chr(1776) || chr(1777) || chr(1778) || chr(1779) || chr(1780) || chr(1781) || chr(1782) || chr(1783) || chr(1784) || chr(1785) ||
      chr(1632) || chr(1633) || chr(1634) || chr(1635) || chr(1636) || chr(1637) || chr(1638) || chr(1639) || chr(1640) || chr(1641) ||
      -- Last, with no counterpart: translate() removes it.
      chr(1600),
      chr(1740) || chr(1740) || chr(1705) || chr(1607) || ' ' ||
      '0123456789' || '0123456789')),
    '\s+', ' ', 'g'));

COMMENT ON FUNCTION fa_normalize(text) IS
  'A name as matching compares it (CS-50): Arabic yeh, alef maksura and kaf to Persian yeh and kaf, heh with yeh to heh, tatweel removed, the zero-width non-joiner as a space, Persian and Arabic digits to Latin, lower case, single spaces, trimmed.';

CREATE TABLE body_type (
  code text,
  label_fa text NOT NULL,
  position smallint NOT NULL,
  CONSTRAINT body_type_pkey PRIMARY KEY (code),
  CONSTRAINT body_type_code_format CHECK (code ~ '^[a-z][a-z_]{1,29}$'),
  CONSTRAINT body_type_label_fa_not_blank CHECK (btrim(label_fa) <> ''),
  CONSTRAINT body_type_position_unique UNIQUE (position)
);
COMMENT ON TABLE body_type IS
  'The fixed list of body types (CS-50 criterion 4), a filter and a catalogue (CS-58), in the order pages show them (position).';

CREATE TABLE colour (
  code text,
  label_fa text NOT NULL,
  family text NOT NULL,
  CONSTRAINT colour_pkey PRIMARY KEY (code),
  CONSTRAINT colour_code_format CHECK (code ~ '^[a-z][a-z_]{1,39}$'),
  CONSTRAINT colour_label_fa_unique UNIQUE (label_fa),
  CONSTRAINT colour_family_valid CHECK (family IN (
    'white', 'black', 'grey', 'silver', 'blue', 'red', 'green', 'yellow', 'orange', 'brown', 'beige', 'gold', 'purple', 'pink', 'other'))
);
COMMENT ON TABLE colour IS
  'A car''s colour as a source names it (label_fa, Divar''s own word) with the family a filter groups it in (CS-50).';

CREATE TABLE make (
  id bigint GENERATED ALWAYS AS IDENTITY,
  slug text NOT NULL,
  name_fa text,
  name_en text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT make_pkey PRIMARY KEY (id),
  CONSTRAINT make_slug_unique UNIQUE (slug),
  CONSTRAINT make_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60),
  CONSTRAINT make_name_fa_not_blank CHECK (btrim(name_fa) <> ''),
  CONSTRAINT make_name_en_not_blank CHECK (btrim(name_en) <> '')
);
COMMENT ON TABLE make IS 'A car maker, canonical (CS-50). name_fa is null until a source or a person names it in Persian.';

CREATE TABLE model (
  id bigint GENERATED ALWAYS AS IDENTITY,
  make_id bigint NOT NULL,
  slug text NOT NULL,
  name_fa text,
  name_en text NOT NULL,
  body_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_pkey PRIMARY KEY (id),
  CONSTRAINT model_make_fk FOREIGN KEY (make_id) REFERENCES make (id) ON DELETE RESTRICT,
  CONSTRAINT model_body_type_fk FOREIGN KEY (body_type) REFERENCES body_type (code) ON DELETE RESTRICT,
  CONSTRAINT model_slug_unique UNIQUE (make_id, slug),
  CONSTRAINT model_id_make_unique UNIQUE (id, make_id),
  CONSTRAINT model_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
  CONSTRAINT model_name_fa_not_blank CHECK (btrim(name_fa) <> ''),
  CONSTRAINT model_name_en_not_blank CHECK (btrim(name_en) <> '')
);
COMMENT ON TABLE model IS 'A model of a make, canonical (CS-50); its body type is curated, null only for a model with no listings yet.';
COMMENT ON CONSTRAINT model_body_type_fk ON model IS
  'unindexed: body_type is a code table of a dozen rows that is never deleted from; filters read model by body type through search tables (CS-59).';

CREATE TABLE trim (
  id bigint GENERATED ALWAYS AS IDENTITY,
  model_id bigint NOT NULL,
  slug text NOT NULL,
  name_fa text,
  name_en text NOT NULL,
  body_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trim_pkey PRIMARY KEY (id),
  CONSTRAINT trim_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE RESTRICT,
  CONSTRAINT trim_body_type_fk FOREIGN KEY (body_type) REFERENCES body_type (code) ON DELETE RESTRICT,
  CONSTRAINT trim_slug_unique UNIQUE (model_id, slug),
  CONSTRAINT trim_id_model_unique UNIQUE (id, model_id),
  CONSTRAINT trim_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 120),
  CONSTRAINT trim_name_fa_not_blank CHECK (btrim(name_fa) <> ''),
  CONSTRAINT trim_name_en_not_blank CHECK (btrim(name_en) <> '')
);
COMMENT ON TABLE trim IS 'A trim of a model, canonical (CS-50); body_type only where it differs from its model''s (a van of a sedan, say).';
COMMENT ON CONSTRAINT trim_body_type_fk ON trim IS
  'unindexed: body_type is a code table of a dozen rows that is never deleted from.';

-- A source's own model key (Divar's brand_model) and what it names in the catalogue: exactly one level, each id
-- consistent with its parents through the composite keys.
CREATE TABLE catalogue_source_key (
  source_id text NOT NULL,
  source_model_key text NOT NULL,
  level text NOT NULL,
  make_id bigint NOT NULL,
  model_id bigint,
  trim_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_source_key_pkey PRIMARY KEY (source_id, source_model_key),
  CONSTRAINT catalogue_source_key_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE RESTRICT,
  CONSTRAINT catalogue_source_key_make_fk FOREIGN KEY (make_id) REFERENCES make (id) ON DELETE RESTRICT,
  CONSTRAINT catalogue_source_key_model_fk FOREIGN KEY (model_id, make_id) REFERENCES model (id, make_id) ON DELETE RESTRICT,
  CONSTRAINT catalogue_source_key_trim_fk FOREIGN KEY (trim_id, model_id) REFERENCES trim (id, model_id) ON DELETE RESTRICT,
  CONSTRAINT catalogue_source_key_level_valid CHECK (level IN ('make', 'model', 'trim')),
  CONSTRAINT catalogue_source_key_level_matches CHECK (
    CASE level
      WHEN 'make' THEN model_id IS NULL AND trim_id IS NULL
      WHEN 'model' THEN model_id IS NOT NULL AND trim_id IS NULL
      ELSE model_id IS NOT NULL AND trim_id IS NOT NULL
    END),
  CONSTRAINT catalogue_source_key_not_blank CHECK (btrim(source_model_key) <> '')
);
COMMENT ON TABLE catalogue_source_key IS
  'A source''s own model key (Divar: brand_model, such as "Peugeot 206 5") and the make, model or trim it names (CS-50): how a listing is matched, by its source_model_key.';
COMMENT ON CONSTRAINT catalogue_source_key_make_fk ON catalogue_source_key IS
  'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); lookups go by the primary key.';
COMMENT ON CONSTRAINT catalogue_source_key_model_fk ON catalogue_source_key IS
  'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); lookups go by the primary key.';
COMMENT ON CONSTRAINT catalogue_source_key_trim_fk ON catalogue_source_key IS
  'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); lookups go by the primary key.';

CREATE TABLE catalogue_alias (
  id bigint GENERATED ALWAYS AS IDENTITY,
  make_id bigint,
  model_id bigint,
  trim_id bigint,
  alias text NOT NULL,
  alias_norm text GENERATED ALWAYS AS (fa_normalize(alias)) STORED,
  script text NOT NULL,
  status text NOT NULL,
  source_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_alias_pkey PRIMARY KEY (id),
  CONSTRAINT catalogue_alias_make_fk FOREIGN KEY (make_id) REFERENCES make (id) ON DELETE RESTRICT,
  CONSTRAINT catalogue_alias_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE RESTRICT,
  CONSTRAINT catalogue_alias_trim_fk FOREIGN KEY (trim_id) REFERENCES trim (id) ON DELETE RESTRICT,
  CONSTRAINT catalogue_alias_source_fk FOREIGN KEY (source_id) REFERENCES source (id) ON DELETE RESTRICT,
  CONSTRAINT catalogue_alias_one_target CHECK (num_nonnulls(make_id, model_id, trim_id) = 1),
  CONSTRAINT catalogue_alias_not_blank CHECK (btrim(alias) <> '' AND char_length(alias) <= 200),
  CONSTRAINT catalogue_alias_script_valid CHECK (script IN ('fa', 'latin', 'spelled')),
  CONSTRAINT catalogue_alias_status_valid CHECK (status IN ('curated', 'suggested', 'rejected')),
  CONSTRAINT catalogue_alias_unique UNIQUE NULLS NOT DISTINCT (make_id, model_id, trim_id, alias_norm, source_id)
);
CREATE INDEX catalogue_alias_norm_idx ON catalogue_alias (alias_norm);
CREATE INDEX catalogue_alias_model_idx ON catalogue_alias (model_id);
CREATE INDEX catalogue_alias_trim_idx ON catalogue_alias (trim_id);
COMMENT ON TABLE catalogue_alias IS
  'Another way a make, model or trim is written (CS-50): «۲۰۶», "206", «دویست و شش», «تیپ دو». curated by a person, suggested by what a source wrote, rejected when a person refused it. An alias need not be unique across targets: matching resolves by context, make before model before trim.';
COMMENT ON COLUMN catalogue_alias.alias_norm IS 'fa_normalize(alias): what matching compares.';
COMMENT ON CONSTRAINT catalogue_alias_make_fk ON catalogue_alias IS
  'unindexed: the unique key catalogue_alias_unique leads with make_id.';
COMMENT ON CONSTRAINT catalogue_alias_source_fk ON catalogue_alias IS
  'unindexed: sources are never deleted while they have rows (RESTRICT), and aliases are not looked up by source.';

CREATE TABLE city (
  id bigint GENERATED ALWAYS AS IDENTITY,
  slug text NOT NULL,
  name_fa text NOT NULL,
  CONSTRAINT city_pkey PRIMARY KEY (id),
  CONSTRAINT city_slug_unique UNIQUE (slug),
  CONSTRAINT city_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60),
  CONSTRAINT city_name_fa_not_blank CHECK (btrim(name_fa) <> '')
);
COMMENT ON TABLE city IS
  'A city a listing is in (CS-50), keyed by Divar''s own slug (city.second_slug: tehran); added by the parser''s derivation as posts name them.';

GRANT SELECT ON body_type, colour, make, model, trim, catalogue_source_key, catalogue_alias, city TO carshenas_web;
GRANT SELECT, INSERT, UPDATE ON body_type, colour, make, model, trim, catalogue_source_key, catalogue_alias, city
  TO carshenas_worker;
GRANT EXECUTE ON FUNCTION fa_normalize(text) TO carshenas_web, carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE city;
DROP TABLE catalogue_alias;
DROP TABLE catalogue_source_key;
DROP TABLE trim;
DROP TABLE model;
DROP TABLE make;
DROP TABLE colour;
DROP TABLE body_type;
DROP FUNCTION fa_normalize(text);
