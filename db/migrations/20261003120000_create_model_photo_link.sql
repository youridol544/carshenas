-- migrate:up
-- An external photo for a model (CS-97, ADR-0038): the superadmin gives a top model an https image link that the home
-- page's model tiles and the models index show instead of the body type's sample photograph. The link is only an
-- address: Carshenas never downloads, stores or proxies the image (ADR-0025's spirit); the visitor's browser loads it
-- from its own host. A link is set and cleared only through set_model_photo_link(), which records the superadmin; the
-- web role reads the address and nothing else.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE model_photo_link (
  model_id          bigint NOT NULL,
  url               text NOT NULL,
  set_by_account_id bigint NOT NULL,
  set_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_photo_link_pkey PRIMARY KEY (model_id),
  CONSTRAINT model_photo_link_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE RESTRICT,
  CONSTRAINT model_photo_link_setter_fk FOREIGN KEY (set_by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  -- Only https: an address the page may load without a mixed-content block.
  CONSTRAINT model_photo_link_https CHECK (url LIKE 'https://%'),
  CONSTRAINT model_photo_link_length CHECK (char_length(url) BETWEEN 12 AND 500),
  -- One line of plain characters: no space, control, bidi or zero-width character, no quote, angle bracket, backslash or backtick.
  CONSTRAINT model_photo_link_plain CHECK (url !~ '[\s\u0000-\u001f\u007f-\u009f­؜​‌‍‎‏  ⁠﻿‪‫‬‭‮⁦⁧⁨⁩"<>''\\`]'),
  -- A real host: dotted labels of letters, digits and hyphens (at most 63 characters each), the last starting with a
  -- letter, so no IP address in any spelling (hex, octal, decimal); no all-numeric or hex label; an optional port from 1
  -- to 65535; then the path. No credentials (an at sign cannot be in a host), no bare name such as localhost, no
  -- internal-only suffix.
  CONSTRAINT model_photo_link_host CHECK (
    url ~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?(:([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?([/?#]|$)'
    AND url !~* '^https://[0-9.]+(:[0-9]+)?([/?#]|$)'
    AND url !~* '^https://([^/?#:]*\.)?([0-9]+|0x[0-9a-f]*)(\.|[:/?#]|$)'
    AND url !~* '^https://[^/?#:]*\.(local|localhost|internal|lan|home|corp|test|invalid|example)(:[0-9]+)?([/?#]|$)')
);

-- Serves the setter's foreign key.
CREATE INDEX model_photo_link_setter_idx ON model_photo_link (set_by_account_id);

COMMENT ON TABLE model_photo_link IS
  'An https image link for a catalogue model, shown by the home page''s model tiles and the models index instead of the body type''s sample photograph (CS-97, ADR-0038). Only an address: the image is never downloaded, stored or proxied. One row per model; clearing deletes it. Changed only through set_model_photo_link().';
COMMENT ON COLUMN model_photo_link.url IS 'The image''s own address: https, a dotted host, at most 500 characters, plain characters only. Its being an image is the superadmin''s to confirm in the preview; the page falls back to the body type''s photograph when it does not load.';
COMMENT ON COLUMN model_photo_link.set_by_account_id IS 'The superadmin who last set or replaced the link.';

-- Every change, append-only: who, what and when, kept after the link is cleared (ADR-0023).
CREATE TABLE model_photo_link_change (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_id      bigint NOT NULL,
  action        text NOT NULL CONSTRAINT model_photo_link_change_action_valid CHECK (action IN ('set', 'replaced', 'cleared')),
  from_url      text,
  to_url        text,
  by_account_id bigint NOT NULL,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_photo_link_change_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE RESTRICT,
  CONSTRAINT model_photo_link_change_by_fk FOREIGN KEY (by_account_id) REFERENCES account (id) ON DELETE RESTRICT,
  -- What each action knows: a first link has no earlier one, a clearing has no new one, a replacement has both.
  CONSTRAINT model_photo_link_change_urls_match CHECK (
    CASE action
      WHEN 'set' THEN from_url IS NULL AND to_url IS NOT NULL
      WHEN 'replaced' THEN from_url IS NOT NULL AND to_url IS NOT NULL
      ELSE from_url IS NOT NULL AND to_url IS NULL
    END)
);

CREATE INDEX model_photo_link_change_model_idx ON model_photo_link_change (model_id, changed_at DESC, id DESC);
CREATE INDEX model_photo_link_change_by_idx ON model_photo_link_change (by_account_id);

CREATE TRIGGER model_photo_link_change_append_only
  BEFORE UPDATE OR DELETE ON model_photo_link_change
  FOR EACH ROW EXECUTE FUNCTION refuse_change_unless_purge();
CREATE TRIGGER model_photo_link_change_append_only_truncate
  BEFORE TRUNCATE ON model_photo_link_change
  FOR EACH STATEMENT EXECUTE FUNCTION refuse_change_unless_purge();

COMMENT ON TABLE model_photo_link_change IS
  'Append-only record of every set, replacement and clearing of a model''s photo link (CS-97, ADR-0023), written by set_model_photo_link() in the transaction that changes the link.';

-- Set, replace or clear (a NULL link) a model's photo link for a superadmin: changed, unchanged (already so), or
-- missing (no such model). The link's own rules are the table's checks, which name themselves when one fails.
CREATE FUNCTION set_model_photo_link(changing_model_id bigint, new_url text, changed_by bigint)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  old_url text;
  moment timestamptz := clock_timestamp();
BEGIN
  PERFORM FROM public.account a WHERE a.id = changed_by AND a.role = 'superadmin' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account % is not a superadmin: only a superadmin sets a model photo link', changed_by
      USING ERRCODE = 'check_violation', CONSTRAINT = 'model_photo_link_by_superadmin', TABLE = 'model_photo_link';
  END IF;
  -- The model's row is locked until the transaction ends, so two superadmins changing one model's link are recorded in
  -- turn: each change's from_url is the link the other left.
  PERFORM FROM public.model m WHERE m.id = changing_model_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;
  SELECT l.url INTO old_url FROM public.model_photo_link l WHERE l.model_id = changing_model_id FOR UPDATE;
  IF old_url IS NOT DISTINCT FROM new_url THEN
    RETURN 'unchanged';
  END IF;
  IF new_url IS NULL THEN
    DELETE FROM public.model_photo_link WHERE model_id = changing_model_id;
    INSERT INTO public.model_photo_link_change (model_id, action, from_url, by_account_id, changed_at)
    VALUES (changing_model_id, 'cleared', old_url, changed_by, moment);
  ELSE
    INSERT INTO public.model_photo_link (model_id, url, set_by_account_id, set_at)
    VALUES (changing_model_id, new_url, changed_by, moment)
    ON CONFLICT ON CONSTRAINT model_photo_link_pkey
      DO UPDATE SET url = excluded.url, set_by_account_id = excluded.set_by_account_id, set_at = excluded.set_at;
    INSERT INTO public.model_photo_link_change (model_id, action, from_url, to_url, by_account_id, changed_at)
    VALUES (changing_model_id, CASE WHEN old_url IS NULL THEN 'set' ELSE 'replaced' END, old_url, new_url,
            changed_by, moment);
  END IF;
  RETURN 'changed';
END
$$;

COMMENT ON FUNCTION set_model_photo_link(bigint, text, bigint) IS
  'Sets, replaces or clears (NULL) a model''s photo link for a superadmin and records it in model_photo_link_change (CS-97, ADR-0023): changed; unchanged when it already is so; missing when the model does not exist. Refuses any account but a superadmin (model_photo_link_by_superadmin); a link that breaks a rule fails the table''s own check (model_photo_link_https, _length, _plain, _host).';

REVOKE EXECUTE ON FUNCTION set_model_photo_link(bigint, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_model_photo_link(bigint, text, bigint) TO carshenas_admin;

-- The web role reads the address and nothing else (not who set it, nor when); the section reads everything.
GRANT SELECT (model_id, url) ON model_photo_link TO carshenas_web;
GRANT SELECT ON model_photo_link, model_photo_link_change TO carshenas_admin;
GRANT SELECT ON model_photo_link, model_photo_link_change TO carshenas_readonly;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION set_model_photo_link(bigint, text, bigint);
DROP TABLE model_photo_link_change;
DROP TABLE model_photo_link;
