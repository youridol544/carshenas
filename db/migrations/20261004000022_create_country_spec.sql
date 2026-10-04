-- migrate:up
-- The country a car's brand comes from, per make and optionally per model (CS-103, ADR-0041), separate from where the car
-- was built or sold from (model_spec.car_origin: domestic, joint_venture, imported). «ژاپنی» is a brand's country whoever
-- assembled the car: a Peugeot 206 built in Iran is French. A row is a make (model_id NULL) or one model of it, which
-- corrects the make where a model belongs to another country; a listing takes its model's row, else its make's.
-- Rows are seeded for the makes we know and changed only through set_country_spec() (ADR-0023), which records who and when
-- in country_spec_change (append-only, kept after the row is gone); the web role reads the country and where it belongs.
-- The countries are a closed list (the check below, and `COUNTRIES` in @carshenas/search/specs): a new one is a migration
-- and a line there, because its Farsi names and the words buyers write for it are code.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE country_spec (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  make_id           bigint NOT NULL,
  model_id          bigint,
  country           text NOT NULL,
  -- seed: written by CS-103 from what we know of the brand; superadmin: entered in the superadmin section.
  source            text NOT NULL,
  set_by_account_id bigint,
  set_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT country_spec_once_per_scope_unique UNIQUE NULLS NOT DISTINCT (make_id, model_id),
  CONSTRAINT country_spec_make_fk FOREIGN KEY (make_id) REFERENCES make (id) ON DELETE RESTRICT,
  CONSTRAINT country_spec_model_fk FOREIGN KEY (model_id, make_id) REFERENCES model (id, make_id) ON DELETE RESTRICT,
  CONSTRAINT country_spec_setter_fk FOREIGN KEY (set_by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  CONSTRAINT country_spec_country_valid CHECK (country IN ('ir', 'jp', 'kr', 'cn', 'de', 'fr', 'it', 'us', 'gb', 'se', 'cz', 'es', 'ro', 'ru', 'my', 'in', 'tw')),
  CONSTRAINT country_spec_source_valid CHECK (source IN ('seed', 'superadmin')),
  CONSTRAINT country_spec_source_matches_setter CHECK ((source = 'superadmin') = (set_by_account_id IS NOT NULL))
);

-- Serve the model and setter foreign keys.
CREATE INDEX country_spec_model_idx ON country_spec (model_id, make_id);
CREATE INDEX country_spec_setter_idx ON country_spec (set_by_account_id);

COMMENT ON TABLE country_spec IS
  'The country a make (model_id NULL) or one of its models comes from (CS-103, ADR-0041): the brand''s country, whoever assembled the car. A listing takes its model''s row, else its make''s. Changed only through set_country_spec(), seeded by the migration that created it.';
COMMENT ON COLUMN country_spec.country IS 'Lower-case ISO 3166-1 code from the closed list: ir, jp, kr, cn, de, fr, it, us, gb, se, cz, es, ro, ru, my, in, tw.';

-- Every change, append-only: the earlier and later country, who and when; kept after the row is removed.
CREATE TABLE country_spec_change (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  make_id       bigint NOT NULL,
  model_id      bigint,
  action        text NOT NULL CONSTRAINT country_spec_change_action_valid CHECK (action IN ('seeded', 'added', 'changed', 'removed')),
  from_country  text,
  to_country    text,
  by_account_id bigint,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT country_spec_change_make_fk FOREIGN KEY (make_id) REFERENCES make (id) ON DELETE RESTRICT,
  CONSTRAINT country_spec_change_model_fk FOREIGN KEY (model_id, make_id) REFERENCES model (id, make_id) ON DELETE RESTRICT,
  CONSTRAINT country_spec_change_by_fk FOREIGN KEY (by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  -- Only the seed has no author; every other change names its superadmin.
  CONSTRAINT country_spec_change_author_matches CHECK ((action = 'seeded') = (by_account_id IS NULL)),
  -- What each action knows: a first row has no earlier country, a removal has no later one, a change has both.
  CONSTRAINT country_spec_change_values_match CHECK (
    CASE action
      WHEN 'seeded' THEN from_country IS NULL AND to_country IS NOT NULL
      WHEN 'added' THEN from_country IS NULL AND to_country IS NOT NULL
      WHEN 'removed' THEN from_country IS NOT NULL AND to_country IS NULL
      ELSE from_country IS NOT NULL AND to_country IS NOT NULL
    END)
);

CREATE INDEX country_spec_change_make_idx ON country_spec_change (make_id, changed_at DESC, id DESC);
CREATE INDEX country_spec_change_model_idx ON country_spec_change (model_id, make_id);
CREATE INDEX country_spec_change_by_idx ON country_spec_change (by_account_id);
CREATE INDEX country_spec_change_recent_idx ON country_spec_change (changed_at DESC, id DESC);

CREATE TRIGGER country_spec_change_append_only
  BEFORE UPDATE OR DELETE ON country_spec_change
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER country_spec_change_append_only_truncate
  BEFORE TRUNCATE ON country_spec_change
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE country_spec_change IS
  'Append-only record of every seed, addition, change and removal of a country_spec row (CS-103, ADR-0023), written in the transaction that makes it.';

-- A country reaches search through the view, so the listings a changed row covers are marked for the next refresh
-- (ADR-0028): those of the make, or of the one model when the row is a model's; once each however many rows changed.
CREATE FUNCTION search_mark_country_changed() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- A make's row covers every listing of the make (the models with a row of their own change nothing, and are marked
  -- all the same: a refresh writes only rows whose values changed); a model's row, that model's listings.
  INSERT INTO public.search_document_stale (listing_id)
  SELECT DISTINCT l.id FROM public.listing l
  JOIN changed_rows r ON r.make_id = l.make_id AND (r.model_id IS NULL OR r.model_id = l.model_id)
  WHERE l.price_type IS NOT NULL;
  RETURN NULL;
END
$$;

CREATE TRIGGER country_spec_search_mark_inserted
  AFTER INSERT ON country_spec REFERENCING NEW TABLE AS changed_rows
  FOR EACH STATEMENT EXECUTE FUNCTION search_mark_country_changed();
CREATE TRIGGER country_spec_search_mark_updated
  AFTER UPDATE ON country_spec REFERENCING NEW TABLE AS changed_rows
  FOR EACH STATEMENT EXECUTE FUNCTION search_mark_country_changed();
CREATE TRIGGER country_spec_search_mark_deleted
  AFTER DELETE ON country_spec REFERENCING OLD TABLE AS changed_rows
  FOR EACH STATEMENT EXECUTE FUNCTION search_mark_country_changed();

-- Sets, changes or removes (a NULL country) the country of a make (model NULL) or of one of its models for a superadmin
-- and records it. Returns changed, unchanged (already so) or missing (no such make, or the model is not that make's).
-- The country's own rule is the table's check, which names itself when it fails.
CREATE FUNCTION set_country_spec(changing_make_id bigint, changing_model_id bigint, new_country text, changed_by bigint)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  old_row public.country_spec%ROWTYPE;
  had boolean;
  moment timestamptz := clock_timestamp();
BEGIN
  PERFORM FROM public.account a WHERE a.id = changed_by AND a.role = 'superadmin' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account % is not a superadmin: only a superadmin sets a country', changed_by
      USING ERRCODE = 'check_violation', CONSTRAINT = 'country_spec_by_superadmin', TABLE = 'country_spec';
  END IF;
  -- The make's row is locked until the transaction ends, so two superadmins changing one scope are recorded in turn.
  PERFORM FROM public.make k WHERE k.id = changing_make_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;
  IF changing_model_id IS NOT NULL THEN
    PERFORM FROM public.model m WHERE m.id = changing_model_id AND m.make_id = changing_make_id;
    IF NOT FOUND THEN
      RETURN 'missing';
    END IF;
  END IF;
  SELECT * INTO old_row FROM public.country_spec s
  WHERE s.make_id = changing_make_id AND s.model_id IS NOT DISTINCT FROM changing_model_id FOR UPDATE;
  had := FOUND;
  IF NOT had AND new_country IS NULL THEN
    RETURN 'unchanged';
  END IF;
  IF had AND old_row.country IS NOT DISTINCT FROM new_country THEN
    RETURN 'unchanged';
  END IF;
  IF new_country IS NULL THEN
    DELETE FROM public.country_spec WHERE id = old_row.id;
    INSERT INTO public.country_spec_change (make_id, model_id, action, from_country, by_account_id, changed_at)
    VALUES (changing_make_id, changing_model_id, 'removed', old_row.country, changed_by, moment);
  ELSIF had THEN
    UPDATE public.country_spec
    SET country = new_country, source = 'superadmin', set_by_account_id = changed_by, set_at = moment
    WHERE id = old_row.id;
    INSERT INTO public.country_spec_change (make_id, model_id, action, from_country, to_country, by_account_id, changed_at)
    VALUES (changing_make_id, changing_model_id, 'changed', old_row.country, new_country, changed_by, moment);
  ELSE
    INSERT INTO public.country_spec (make_id, model_id, country, source, set_by_account_id, set_at)
    VALUES (changing_make_id, changing_model_id, new_country, 'superadmin', changed_by, moment);
    INSERT INTO public.country_spec_change (make_id, model_id, action, to_country, by_account_id, changed_at)
    VALUES (changing_make_id, changing_model_id, 'added', new_country, changed_by, moment);
  END IF;
  RETURN 'changed';
END
$$;

COMMENT ON FUNCTION set_country_spec(bigint, bigint, text, bigint) IS
  'Sets, changes or removes (NULL) the country of a make or of one of its models for a superadmin and records it in country_spec_change (CS-103, ADR-0023): changed; unchanged when it already is so; missing when the make, or the model of that make, does not exist. Refuses any account but a superadmin (country_spec_by_superadmin); a country outside the closed list fails the table''s own check (country_spec_country_valid).';

REVOKE EXECUTE ON FUNCTION set_country_spec(bigint, bigint, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_country_spec(bigint, bigint, text, bigint) TO carshenas_admin;

-- The web role reads the country and where it belongs, never who set it; the section reads everything.
GRANT SELECT (make_id, model_id, country) ON country_spec TO carshenas_web;
GRANT SELECT ON country_spec, country_spec_change TO carshenas_admin;
GRANT SELECT ON country_spec, country_spec_change TO carshenas_readonly;

-- The seed: the makes whose country we know (a fresh database with no catalogue gets none). The country is the
-- brand's, whoever assembles the car: MG is Chinese-made and Chinese-owned, Volvo is Swedish, a Peugeot is French.
-- Makes with no row (Iranian-assembled Chinese designs under local names, brands we are unsure of) are listed as missing
-- in the superadmin section.
WITH makes (make_slug, country) AS (
  VALUES
  ('samand', 'ir'), ('dena', 'ir'), ('quick', 'ir'), ('pride', 'ir'), ('tara', 'ir'), ('lamari', 'ir'),
  ('saina', 'ir'), ('shahin', 'ir'), ('tiba', 'ir'), ('runna', 'ir'), ('paykan', 'ir'), ('saipa', 'ir'),
  ('iran-khodro', 'ir'), ('irankhodro-van', 'ir'), ('pars-khodro', 'ir'), ('zamyad', 'ir'), ('toyota', 'jp'),
  ('honda', 'jp'), ('mazda', 'jp'), ('mitsubishi', 'jp'), ('nissan', 'jp'), ('subaru', 'jp'), ('suzuki', 'jp'),
  ('lexus', 'jp'), ('infiniti', 'jp'), ('daihatsu', 'jp'), ('isuzu', 'jp'), ('datsun', 'jp'), ('kia', 'kr'),
  ('hyundai', 'kr'), ('daewoo', 'kr'), ('ssangyong', 'kr'), ('kg-mobility', 'kr'), ('bmw', 'de'),
  ('mercedes-benz', 'de'), ('amg', 'de'), ('audi', 'de'), ('volkswagen', 'de'), ('porsche', 'de'), ('opel', 'de'),
  ('smart', 'de'), ('borgward', 'de'), ('peugeot', 'fr'), ('renault', 'fr'), ('citroen', 'fr'), ('ds', 'fr'),
  ('fiat', 'it'), ('alfa-romeo', 'it'), ('maserati', 'it'), ('lamborghini', 'it'), ('iveco', 'it'), ('ford', 'us'),
  ('chevrolet', 'us'), ('jeep', 'us'), ('chrysler', 'us'), ('dodge', 'us'), ('buick', 'us'), ('pontiac', 'us'),
  ('hummer', 'us'), ('oldsmobile', 'us'), ('land-rover', 'gb'), ('jaguar', 'gb'), ('mini', 'gb'),
  ('rollsroyce', 'gb'), ('lotus', 'gb'), ('rover', 'gb'), ('hillman', 'gb'), ('volvo', 'se'), ('skoda', 'cz'),
  ('seat', 'es'), ('dacia', 'ro'), ('lada', 'ru'), ('gaz', 'ru'), ('uaz', 'ru'), ('proton', 'my'), ('luxgen', 'tw'),
  ('baic', 'cn'), ('baw', 'cn'), ('bestune', 'cn'), ('besturn', 'cn'), ('brilliance', 'cn'), ('byd', 'cn'),
  ('changan', 'cn'), ('chery', 'cn'), ('dayun', 'cn'), ('dongfeng', 'cn'), ('foton', 'cn'), ('gac', 'cn'),
  ('gac-gonow', 'cn'), ('geely', 'cn'), ('great-wall', 'cn'), ('haima', 'cn'), ('haval', 'cn'), ('hongqi', 'cn'),
  ('jac', 'cn'), ('jetour', 'cn'), ('jmc', 'cn'), ('lifan', 'cn'), ('mg', 'cn'), ('neta', 'cn'), ('oshan', 'cn'),
  ('roewe', 'cn'), ('skywell', 'cn'), ('soueast', 'cn'), ('swm', 'cn'), ('venucia', 'cn'), ('voyah', 'cn'),
  ('xpeng', 'cn'), ('zotye', 'cn'), ('faw', 'cn'), ('changhe', 'cn'), ('hafei-lobo', 'cn'), ('hanteng', 'cn'),
  ('leapmotor', 'cn'), ('maxus', 'cn'), ('nammi', 'cn'), ('qingling', 'cn'), ('im', 'cn'), ('avatr', 'cn'),
  ('joylong', 'cn'), ('deer', 'cn')
), added AS (
  INSERT INTO country_spec (make_id, model_id, country, source)
  SELECT k.id, NULL, makes.country, 'seed'
  FROM makes JOIN make k ON k.slug = makes.make_slug
  RETURNING make_id, country
)
INSERT INTO country_spec_change (make_id, model_id, action, to_country)
SELECT make_id, NULL, 'seeded', country FROM added;

-- migrate:down
-- WARNING: this down drops country_spec_change, the append-only record of who changed which country and when. Rolling
-- this migration back destroys that audit trail for good; roll back only a database whose changes do not matter.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TRIGGER country_spec_search_mark_inserted ON country_spec;
DROP TRIGGER country_spec_search_mark_updated ON country_spec;
DROP TRIGGER country_spec_search_mark_deleted ON country_spec;
DROP FUNCTION search_mark_country_changed();
DROP FUNCTION set_country_spec(bigint, bigint, text, bigint);
DROP TABLE country_spec_change;
DROP TABLE country_spec;
