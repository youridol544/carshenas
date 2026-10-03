-- migrate:up
-- Engine volume and origin per model and per trim (CS-99, ADR-0039). A listing rarely states its engine volume, and
-- the catalogue had no origin, yet buyers ask by both («حجم موتور بیشتر از ۲۰۰۰», «ماشین خارجی»). A row here says what a
-- catalogue scope is: a model (trim_id NULL) or one of its trims, with an engine volume in cubic centimetres, an origin
-- or both. A listing gets each value from its own title, else its trim, else its model (listing_filter_row), so a
-- trim's row beats the model's per field and a model without a row stays unknown, never guessed. Rows come from three
-- places: the catalogue's own trim names that state a volume («1800cc»), a short list of engines the manufacturers
-- publish for the ten tracked models (both marked as seeds, to be reviewed), and the superadmin, who changes rows only
-- through set_model_spec() (ADR-0023): the section's role cannot write the table, and every change is recorded with who
-- and when in model_spec_change, which is append-only and outlives the row.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE model_spec (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_id          bigint NOT NULL,
  trim_id           bigint,
  engine_volume_cc  integer,
  car_origin        text,
  -- catalogue: the trim's own name states the volume; seed: written by CS-99 from the makers' published engines;
  -- superadmin: entered in the section.
  source            text NOT NULL,
  set_by_account_id bigint,
  set_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_spec_once_per_scope_unique UNIQUE NULLS NOT DISTINCT (model_id, trim_id),
  CONSTRAINT model_spec_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE RESTRICT,
  CONSTRAINT model_spec_trim_fk FOREIGN KEY (trim_id, model_id) REFERENCES trim (id, model_id) ON DELETE RESTRICT,
  CONSTRAINT model_spec_setter_fk FOREIGN KEY (set_by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  -- 500 cc (a small kei car) to 9,000 cc (a hypercar). An electric car has no volume: it is left empty.
  CONSTRAINT model_spec_engine_volume_cc_range CHECK (engine_volume_cc >= 500 AND engine_volume_cc <= 9000),
  CONSTRAINT model_spec_car_origin_valid CHECK (car_origin IN ('domestic', 'joint_venture', 'imported')),
  CONSTRAINT model_spec_says_something CHECK (engine_volume_cc IS NOT NULL OR car_origin IS NOT NULL),
  CONSTRAINT model_spec_source_valid CHECK (source IN ('catalogue', 'seed', 'superadmin')),
  CONSTRAINT model_spec_source_matches_setter CHECK ((source = 'superadmin') = (set_by_account_id IS NOT NULL))
);

-- Serves the setter's foreign key.
CREATE INDEX model_spec_setter_idx ON model_spec (set_by_account_id);

COMMENT ON TABLE model_spec IS
  'The engine volume and origin of a catalogue model (trim_id NULL) or of one of its trims (CS-99, ADR-0039). A listing inherits each value from its trim, else its model, unless its own title states a volume (listing.engine_volume_cc). Changed only through set_model_spec(), seeded by the migration that created it.';
COMMENT ON COLUMN model_spec.engine_volume_cc IS 'Nominal engine volume in cubic centimetres (500 to 9000), the figure buyers type («۱۶۰۰»), not the exact displacement; null when only the origin is known.';
COMMENT ON COLUMN model_spec.car_origin IS 'domestic: an Iranian maker''s own design (Pride, Samand, Dena); joint_venture: a foreign design built in Iran under licence or partnership (Peugeot 206, 405); imported: built abroad and brought in. Null when unknown.';
COMMENT ON COLUMN model_spec.source IS 'catalogue: the trim''s own name states the volume; seed: written by CS-99 from the makers'' published engines; superadmin: entered in the superadmin section.';

-- Every change, append-only: what the row said before and after, who made it and when; kept after the row is removed.
CREATE TABLE model_spec_change (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_id         bigint NOT NULL,
  trim_id          bigint,
  action           text NOT NULL CONSTRAINT model_spec_change_action_valid CHECK (action IN ('seeded', 'added', 'changed', 'removed')),
  from_volume_cc   integer,
  from_origin      text,
  to_volume_cc     integer,
  to_origin        text,
  by_account_id    bigint,
  changed_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_spec_change_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE RESTRICT,
  CONSTRAINT model_spec_change_trim_fk FOREIGN KEY (trim_id, model_id) REFERENCES trim (id, model_id) ON DELETE RESTRICT,
  CONSTRAINT model_spec_change_by_fk FOREIGN KEY (by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  -- Only the seed has no author; every other change names its superadmin.
  CONSTRAINT model_spec_change_author_matches CHECK ((action = 'seeded') = (by_account_id IS NULL)),
  -- What each action knows: a first row has no earlier values, a removal has no later ones, a change has both.
  CONSTRAINT model_spec_change_values_match CHECK (
    CASE action
      WHEN 'seeded' THEN from_volume_cc IS NULL AND from_origin IS NULL AND (to_volume_cc IS NOT NULL OR to_origin IS NOT NULL)
      WHEN 'added' THEN from_volume_cc IS NULL AND from_origin IS NULL AND (to_volume_cc IS NOT NULL OR to_origin IS NOT NULL)
      WHEN 'removed' THEN to_volume_cc IS NULL AND to_origin IS NULL AND (from_volume_cc IS NOT NULL OR from_origin IS NOT NULL)
      ELSE (from_volume_cc IS NOT NULL OR from_origin IS NOT NULL) AND (to_volume_cc IS NOT NULL OR to_origin IS NOT NULL)
    END)
);

CREATE INDEX model_spec_change_model_idx ON model_spec_change (model_id, changed_at DESC, id DESC);
CREATE INDEX model_spec_change_trim_idx ON model_spec_change (trim_id, model_id) WHERE trim_id IS NOT NULL;
CREATE INDEX model_spec_change_by_idx ON model_spec_change (by_account_id) WHERE by_account_id IS NOT NULL;
CREATE INDEX model_spec_change_recent_idx ON model_spec_change (changed_at DESC, id DESC);

CREATE TRIGGER model_spec_change_append_only
  BEFORE UPDATE OR DELETE ON model_spec_change
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER model_spec_change_append_only_truncate
  BEFORE TRUNCATE ON model_spec_change
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE model_spec_change IS
  'Append-only record of every seed, addition, change and removal of a model_spec row (CS-99, ADR-0023), written in the transaction that makes it.';

-- A spec reaches search through the view, so the listings it covers are marked for the next refresh (ADR-0028): those of
-- the model, or of the trim when the row is a trim's. A refresh writes only rows whose values changed.
CREATE FUNCTION search_mark_spec_listings() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  changed record := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
BEGIN
  INSERT INTO public.search_document_stale (listing_id)
  SELECT l.id FROM public.listing l
  WHERE l.model_id = changed.model_id
    AND (changed.trim_id IS NULL OR l.trim_id = changed.trim_id)
    AND l.price_type IS NOT NULL;
  RETURN NULL;
END
$$;

CREATE TRIGGER model_spec_search_mark
  AFTER INSERT OR UPDATE OR DELETE ON model_spec
  FOR EACH ROW EXECUTE FUNCTION search_mark_spec_listings();

-- Sets, changes or removes (both values NULL) the spec of a model or one of its trims for a superadmin and records it.
-- Returns changed, unchanged (already so) or missing (no such model, or the trim is not that model's). Both values
-- are the target state, never a toggle. The values' own rules are the table's checks, which name themselves.
CREATE FUNCTION set_model_spec(
  changing_model_id bigint, changing_trim_id bigint, new_volume_cc integer, new_origin text, changed_by bigint
) RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  old_row public.model_spec%ROWTYPE;
  had boolean;
  moment timestamptz := clock_timestamp();
BEGIN
  PERFORM FROM public.account a WHERE a.id = changed_by AND a.role = 'superadmin' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account % is not a superadmin: only a superadmin sets a model spec', changed_by
      USING ERRCODE = 'check_violation', CONSTRAINT = 'model_spec_by_superadmin', TABLE = 'model_spec';
  END IF;
  -- The model's row is locked until the transaction ends, so two superadmins changing one model's specs are recorded
  -- in turn: each change's earlier values are what the other left.
  PERFORM FROM public.model m WHERE m.id = changing_model_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;
  IF changing_trim_id IS NOT NULL THEN
    PERFORM FROM public.trim t WHERE t.id = changing_trim_id AND t.model_id = changing_model_id;
    IF NOT FOUND THEN
      RETURN 'missing';
    END IF;
  END IF;
  SELECT * INTO old_row FROM public.model_spec s
  WHERE s.model_id = changing_model_id AND s.trim_id IS NOT DISTINCT FROM changing_trim_id FOR UPDATE;
  had := FOUND;
  IF NOT had AND new_volume_cc IS NULL AND new_origin IS NULL THEN
    RETURN 'unchanged';
  END IF;
  IF had AND old_row.engine_volume_cc IS NOT DISTINCT FROM new_volume_cc AND old_row.car_origin IS NOT DISTINCT FROM new_origin THEN
    RETURN 'unchanged';
  END IF;
  IF new_volume_cc IS NULL AND new_origin IS NULL THEN
    DELETE FROM public.model_spec WHERE id = old_row.id;
    INSERT INTO public.model_spec_change (model_id, trim_id, action, from_volume_cc, from_origin, by_account_id, changed_at)
    VALUES (changing_model_id, changing_trim_id, 'removed', old_row.engine_volume_cc, old_row.car_origin, changed_by, moment);
  ELSIF had THEN
    UPDATE public.model_spec
    SET engine_volume_cc = new_volume_cc, car_origin = new_origin, source = 'superadmin',
        set_by_account_id = changed_by, set_at = moment
    WHERE id = old_row.id;
    INSERT INTO public.model_spec_change (model_id, trim_id, action, from_volume_cc, from_origin, to_volume_cc, to_origin, by_account_id, changed_at)
    VALUES (changing_model_id, changing_trim_id, 'changed', old_row.engine_volume_cc, old_row.car_origin, new_volume_cc, new_origin, changed_by, moment);
  ELSE
    INSERT INTO public.model_spec (model_id, trim_id, engine_volume_cc, car_origin, source, set_by_account_id, set_at)
    VALUES (changing_model_id, changing_trim_id, new_volume_cc, new_origin, 'superadmin', changed_by, moment);
    INSERT INTO public.model_spec_change (model_id, trim_id, action, to_volume_cc, to_origin, by_account_id, changed_at)
    VALUES (changing_model_id, changing_trim_id, 'added', new_volume_cc, new_origin, changed_by, moment);
  END IF;
  RETURN 'changed';
END
$$;

COMMENT ON FUNCTION set_model_spec(bigint, bigint, integer, text, bigint) IS
  'Sets, changes or removes (both values NULL) the engine volume and origin of a model or one of its trims for a superadmin and records it in model_spec_change (CS-99, ADR-0023): changed; unchanged when it already is so; missing when the model, or the trim of that model, does not exist. Refuses any account but a superadmin (model_spec_by_superadmin); a value that breaks a rule fails the table''s own check (model_spec_engine_volume_cc_range, model_spec_car_origin_valid).';

REVOKE EXECUTE ON FUNCTION set_model_spec(bigint, bigint, integer, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_model_spec(bigint, bigint, integer, text, bigint) TO carshenas_admin;

-- The web role reads the two values and where they belong, never who set them; the section reads everything.
GRANT SELECT (model_id, trim_id, engine_volume_cc, car_origin) ON model_spec TO carshenas_web;
GRANT SELECT ON model_spec, model_spec_change TO carshenas_admin;
GRANT SELECT ON model_spec, model_spec_change TO carshenas_readonly;

-- The seed, in one statement so each scope gets one row and one 'seeded' change. Three sources, merged per model or trim:
-- (1) the catalogue's own trim names that state a volume (source catalogue); (2) the engines the makers publish for the
-- ten tracked models, the model's usual engine and the trims that differ, nominal figures as sellers write them, and
-- the origin of those models; (3) the origin of a make whose models are all Iranian designs or all imported. The rest
-- of the catalogue stays unknown and is listed as missing in the superadmin section. A fresh database with no
-- catalogue gets no rows.
WITH rules (make_slug, model_slug, trim_slug, volume_cc, origin, source) AS (
  VALUES
    -- 1. The trim's name states the volume.
    ('toyota', 'corolla', '1200', 1200, NULL, 'catalogue'), ('toyota', 'corolla', '1500', 1500, NULL, 'catalogue'),
    ('toyota', 'corolla', 'se-1600cc', 1600, NULL, 'catalogue'),
    ('toyota', 'corolla', '1800-hybrid', 1800, NULL, 'catalogue'),
    ('toyota', 'corolla', 'gli-manual-1800cc', 1800, NULL, 'catalogue'),
    ('toyota', 'corolla', 'gli-automatic-1800cc', 1800, NULL, 'catalogue'),
    ('toyota', 'corolla', 'xli-automatic-1800cc', 1800, NULL, 'catalogue'),
    ('toyota', 'corolla', 'corolla-cross-hybrid', 2000, NULL, 'catalogue'),
    ('toyota', 'corolla', 'cross-petrol-2-0l', 2000, NULL, 'catalogue'),
    ('dena', 'plus', '1700cc-automatic', 1700, NULL, 'catalogue'),
    ('dena', 'plus', '1700cc-manual', 1700, NULL, 'catalogue'),
    ('dena', 'plus', '1700cc-turbo', 1700, NULL, 'catalogue'),
    ('peugeot', '405', 'slx-1800', 1800, NULL, 'catalogue'),
    -- 2. The makers' published engines and the origin of the ten tracked models.
    ('pride', '131', NULL, 1300, 'domestic', 'seed'), ('quick', 'manual', NULL, 1500, 'domestic', 'seed'),
    ('dena', 'plus', NULL, 1700, 'domestic', 'seed'),
    ('samand', 'lx', NULL, 1800, 'domestic', 'seed'), ('samand', 'lx', 'ef7-normal', 1700, NULL, 'seed'),
    ('samand', 'lx', 'ef7-petrol', 1700, NULL, 'seed'),
    ('samand', 'soren', NULL, NULL, 'domestic', 'seed'), ('samand', 'soren', 'plus-ef7-bi-fuel', 1700, NULL, 'seed'),
    ('samand', 'soren', 'plus-ef7-petrol', 1700, NULL, 'seed'),
    ('samand', 'soren', 'plus-tu5p-petrol', 1600, NULL, 'seed'),
    ('samand', 'soren', 'plus-xu7p-petrol', 1800, NULL, 'seed'),
    ('peugeot', '207i', NULL, 1600, 'joint_venture', 'seed'), ('peugeot', '207i', 'manual-tu3', 1400, NULL, 'seed'),
    ('peugeot', '206', NULL, NULL, 'joint_venture', 'seed'),
    ('peugeot', '206', '1', 1400, NULL, 'seed'), ('peugeot', '206', '2', 1400, NULL, 'seed'),
    ('peugeot', '206', '3', 1400, NULL, 'seed'), ('peugeot', '206', '3p', 1400, NULL, 'seed'),
    ('peugeot', '206', '5', 1600, NULL, 'seed'), ('peugeot', '206', '6', 1600, NULL, 'seed'),
    ('peugeot', '206', 'sd-v8', 1600, NULL, 'seed'), ('peugeot', '206', 'sd-v9', 1600, NULL, 'seed'),
    ('peugeot', '206', 'sd-v20', 1600, NULL, 'seed'),
    ('peugeot', '405', NULL, 1800, 'joint_venture', 'seed'), ('peugeot', '405', 'slx-normal', 1600, NULL, 'seed'),
    ('peugeot', '405', 'glx-tu5-petrol', 1600, NULL, 'seed'),
    ('peugeot', 'pars', NULL, 1800, 'joint_venture', 'seed'), ('peugeot', 'pars', 'lx-tu5', 1600, NULL, 'seed'),
    ('peugeot', 'pars', 'automatic-tu5', 1600, NULL, 'seed'), ('peugeot', 'pars', 'elx-tu5', 1600, NULL, 'seed'),
    ('toyota', 'corolla', NULL, NULL, 'imported', 'seed')
), by_make (make_slug, origin) AS (
  VALUES ('pride', 'domestic'), ('samand', 'domestic'), ('dena', 'domestic'), ('tiba', 'domestic'),
         ('saina', 'domestic'), ('quick', 'domestic'), ('shahin', 'domestic'), ('tara', 'domestic'),
         ('runna', 'domestic'), ('paykan', 'domestic'), ('pars-khodro', 'domestic'), ('iran-khodro', 'domestic'),
         ('irankhodro-van', 'domestic'), ('saipa', 'domestic'), ('zamyad', 'domestic'), ('lamari', 'domestic'),
         ('bmw', 'imported'), ('mercedes-benz', 'imported'), ('porsche', 'imported'), ('audi', 'imported'),
         ('lexus', 'imported'), ('land-rover', 'imported'), ('jaguar', 'imported'), ('volvo', 'imported'),
         ('maserati', 'imported'), ('lamborghini', 'imported'), ('rollsroyce', 'imported'), ('lotus', 'imported'),
         ('mini', 'imported'), ('infiniti', 'imported'), ('alfa-romeo', 'imported')
), scopes AS (
  SELECT m.id AS model_id, t.id AS trim_id, r.volume_cc, r.origin, r.source
  FROM rules r
  JOIN make k ON k.slug = r.make_slug
  JOIN model m ON m.make_id = k.id AND m.slug = r.model_slug
  LEFT JOIN trim t ON t.model_id = m.id AND t.slug = r.trim_slug
  WHERE r.trim_slug IS NULL OR t.id IS NOT NULL
  UNION ALL
  SELECT m.id, NULL::bigint, NULL::integer, b.origin, 'seed'
  FROM by_make b
  JOIN make k ON k.slug = b.make_slug
  JOIN model m ON m.make_id = k.id
), merged AS (
  SELECT model_id, trim_id, max(volume_cc) AS volume_cc, max(origin) AS origin,
         CASE WHEN bool_or(source = 'seed') THEN 'seed' ELSE 'catalogue' END AS source
  FROM scopes
  GROUP BY model_id, trim_id
), added AS (
  INSERT INTO model_spec (model_id, trim_id, engine_volume_cc, car_origin, source)
  SELECT model_id, trim_id, volume_cc, origin, source FROM merged
  RETURNING model_id, trim_id, engine_volume_cc, car_origin
)
INSERT INTO model_spec_change (model_id, trim_id, action, to_volume_cc, to_origin)
SELECT model_id, trim_id, 'seeded', engine_volume_cc, car_origin FROM added;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TRIGGER model_spec_search_mark ON model_spec;
DROP FUNCTION search_mark_spec_listings();
DROP FUNCTION set_model_spec(bigint, bigint, integer, text, bigint);
DROP TABLE model_spec_change;
DROP TABLE model_spec;
